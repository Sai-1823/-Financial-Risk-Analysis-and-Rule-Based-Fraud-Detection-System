from typing import List, Optional, Any, Dict
from datetime import datetime
from fastapi import APIRouter, Body, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from sqlalchemy import desc, func

from app.db.database import get_db
from app.db.schema import Transaction, Alert, Account, Customer
from app.rules.engine import calculate_risk_score, ALERT_THRESHOLD

router = APIRouter(prefix="/transactions", tags=["Transactions"])


# --- Pydantic Models ---
class TransactionCreate(BaseModel):
    account_id: int
    amount: float = Field(..., gt=0, description="Transaction amount in USD")
    transaction_type: str = Field("payment", description="e.g. transfer, payment, pos, online, withdrawal")
    channel: str = Field("web", description="e.g. web, mobile_app, atm, pos, wire")
    region_optional: Optional[str] = Field(None, description="e.g. US-East, EU-West, APAC-SG")
    transaction_datetime: Optional[datetime] = Field(None, description="ISO datetime; defaults to now")


class TransactionBatchRequest(BaseModel):
    items: List[TransactionCreate]


class AlertSummary(BaseModel):
    alert_id: int
    rule_name: str
    risk_score: float
    review_status: str
    review_reason: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class TransactionResponse(BaseModel):
    transaction_id: int
    account_id: int
    customer_code: Optional[str] = None
    transaction_datetime: datetime
    amount: float
    transaction_type: str
    channel: str
    region_optional: Optional[str]
    created_at: datetime
    alerts: List[AlertSummary] = []
    is_flagged: bool = False
    max_risk_score: float = 0.0

    class Config:
        from_attributes = True


@router.get("", response_model=Dict[str, Any])
def list_transactions(
    account_id: Optional[int] = Query(None, description="Filter by account ID"),
    min_amount: Optional[float] = Query(None, description="Minimum amount"),
    max_amount: Optional[float] = Query(None, description="Maximum amount"),
    channel: Optional[str] = Query(None, description="Filter by channel"),
    transaction_type: Optional[str] = Query(None, description="Filter by type"),
    flagged_only: Optional[bool] = Query(False, description="Filter only transactions with alerts"),
    search: Optional[str] = Query(None, description="Search term for customer code or channel"),
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
):
    """
    Retrieves transactions with multi-criteria filtering, pagination, and alert metadata.
    """
    query = (
        db.query(Transaction, Account.customer_id, Customer.customer_code)
        .join(Account, Transaction.account_id == Account.account_id)
        .join(Customer, Account.customer_id == Customer.customer_id)
    )

    if account_id is not None:
        query = query.filter(Transaction.account_id == account_id)
    if min_amount is not None:
        query = query.filter(Transaction.amount >= min_amount)
    if max_amount is not None:
        query = query.filter(Transaction.amount <= max_amount)
    if channel:
        query = query.filter(Transaction.channel.ilike(f"%{channel}%"))
    if transaction_type:
        query = query.filter(Transaction.transaction_type.ilike(f"%{transaction_type}%"))
    if search:
        query = query.filter(
            (Customer.customer_code.ilike(f"%{search}%"))
            | (Transaction.region_optional.ilike(f"%{search}%"))
            | (Transaction.channel.ilike(f"%{search}%"))
        )

    if flagged_only:
        # Join with alerts
        query = query.join(Alert, Transaction.transaction_id == Alert.transaction_id)

    total_count = query.count()
    rows = query.order_by(desc(Transaction.transaction_datetime)).offset(offset).limit(limit).all()

    # Pre-fetch alerts for the selected transactions
    tx_ids = [tx.transaction_id for tx, _, _ in rows]
    alerts_by_tx: Dict[int, List[Alert]] = {}
    if tx_ids:
        alerts = db.query(Alert).filter(Alert.transaction_id.in_(tx_ids)).all()
        for a in alerts:
            alerts_by_tx.setdefault(a.transaction_id, []).append(a)

    items = []
    for tx, cust_id, cust_code in rows:
        tx_alerts = alerts_by_tx.get(tx.transaction_id, [])
        max_score = max([a.risk_score for a in tx_alerts], default=0.0)
        items.append({
            "transaction_id": tx.transaction_id,
            "account_id": tx.account_id,
            "customer_code": cust_code,
            "transaction_datetime": tx.transaction_datetime.isoformat(),
            "amount": tx.amount,
            "transaction_type": tx.transaction_type,
            "channel": tx.channel,
            "region_optional": tx.region_optional,
            "created_at": tx.created_at.isoformat(),
            "alerts": [
                {
                    "alert_id": a.alert_id,
                    "rule_name": a.rule_name,
                    "risk_score": a.risk_score,
                    "review_status": a.review_status,
                    "review_reason": a.review_reason,
                    "created_at": a.created_at.isoformat(),
                }
                for a in tx_alerts
            ],
            "is_flagged": len(tx_alerts) > 0,
            "max_risk_score": max_score,
        })

    return {
        "total": total_count,
        "limit": limit,
        "offset": offset,
        "items": items,
    }


@router.post("", status_code=status.HTTP_201_CREATED)
def import_transactions(
    payload: Any = Body(...),  # Supports single TransactionCreate, list of TransactionCreate, or {items: [...]}
    db: Session = Depends(get_db),
):
    """
    Batch import endpoint.
    Scans every transaction through the rule engine:
    - calculates customer context (average amount, 60m frequency, region history)
    - calculates risk score
    - creates an Alert if risk_score > 0.30
    """
    raw_items = []
    if isinstance(payload, list):
        raw_items = payload
    elif isinstance(payload, dict):
        raw_items = payload.get("items") or [payload]
    else:
        raw_items = [payload]

    if not raw_items:
        raise HTTPException(status_code=400, detail="Empty transaction payload")

    imported_transactions = []
    new_alerts = []

    for item in raw_items:
        if isinstance(item, BaseModel):
            item_data = item.dict()
        elif isinstance(item, dict):
            item_data = item
        else:
            continue

        acc_id = int(item_data.get("account_id", 1))
        account = db.query(Account).filter(Account.account_id == acc_id).first()
        if not account:
            # Auto-provision customer and account if not present (helps student testing/demo)
            cust = db.query(Customer).first()
            if not cust:
                cust = Customer(customer_code="CUST-DEMO")
                db.add(cust)
                db.flush()
            account = Account(customer_id=cust.customer_id)
            db.add(account)
            db.flush()
            acc_id = account.account_id

        tx_dt = item_data.get("transaction_datetime")
        if isinstance(tx_dt, str):
            try:
                tx_dt = datetime.fromisoformat(tx_dt.replace("Z", "+00:00"))
            except Exception:
                tx_dt = datetime.utcnow()
        elif not isinstance(tx_dt, datetime):
            tx_dt = datetime.utcnow()

        amount = float(item_data.get("amount", 0.0))
        tx = Transaction(
            account_id=acc_id,
            transaction_datetime=tx_dt,
            amount=amount,
            transaction_type=str(item_data.get("transaction_type", "payment")),
            channel=str(item_data.get("channel", "web")),
            region_optional=item_data.get("region_optional"),
        )
        db.add(tx)
        db.flush()

        # Build context for this customer & account
        cust_id = account.customer_id
        # Historical average amount for this customer
        cust_account_ids = [
            a.account_id
            for a in db.query(Account.account_id).filter(Account.customer_id == cust_id).all()
        ]

        avg_res = (
            db.query(func.avg(Transaction.amount))
            .filter(Transaction.account_id.in_(cust_account_ids))
            .filter(Transaction.transaction_id != tx.transaction_id)
            .scalar()
        )
        customer_avg = float(avg_res) if avg_res else amount

        # Transactions in previous 60 minutes
        window_start = tx_dt.timestamp() - 3600
        recent_txs = (
            db.query(Transaction)
            .filter(Transaction.account_id == acc_id)
            .filter(Transaction.transaction_id != tx.transaction_id)
            .all()
        )
        recent_60m_count = sum(
            1 for t in recent_txs
            if abs((tx_dt - t.transaction_datetime).total_seconds()) <= 3600
        )

        # Known regions for customer
        known_region_rows = (
            db.query(Transaction.region_optional)
            .filter(Transaction.account_id.in_(cust_account_ids))
            .filter(Transaction.transaction_id != tx.transaction_id)
            .filter(Transaction.region_optional.isnot(None))
            .distinct()
            .all()
        )
        known_regions = [r[0] for r in known_region_rows if r[0]]

        context = {
            "customer_avg_amount": customer_avg,
            "recent_60m_count": recent_60m_count,
            "known_regions": known_regions,
        }

        score, triggered_rules, reasons = calculate_risk_score(tx, context)

        alert_info = None
        if score > ALERT_THRESHOLD and triggered_rules:
            primary_rule = triggered_rules[0] if len(triggered_rules) == 1 else "multi_rule"
            alert = Alert(
                transaction_id=tx.transaction_id,
                rule_name=primary_rule,
                risk_score=score,
                review_status="pending",
                review_reason="; ".join(reasons),
                created_at=datetime.utcnow(),
            )
            db.add(alert)
            db.flush()
            new_alerts.append({
                "alert_id": alert.alert_id,
                "rule_name": primary_rule,
                "risk_score": score,
                "reasons": reasons,
            })
            alert_info = {"alert_id": alert.alert_id, "risk_score": score, "reasons": reasons}

        imported_transactions.append({
            "transaction_id": tx.transaction_id,
            "account_id": tx.account_id,
            "amount": tx.amount,
            "score": score,
            "alert": alert_info,
        })

    db.commit()

    return {
        "status": "success",
        "imported_count": len(imported_transactions),
        "alerts_created_count": len(new_alerts),
        "transactions": imported_transactions,
    }


@router.get("/{transaction_id}")
def get_transaction(transaction_id: int, db: Session = Depends(get_db)):
    """
    Retrieves full details for a single transaction including alert breakdown and customer record.
    """
    row = (
        db.query(Transaction, Account, Customer)
        .join(Account, Transaction.account_id == Account.account_id)
        .join(Customer, Account.customer_id == Customer.customer_id)
        .filter(Transaction.transaction_id == transaction_id)
        .first()
    )

    if not row:
        raise HTTPException(status_code=404, detail="Transaction not found")

    tx, account, customer = row
    alerts = db.query(Alert).filter(Alert.transaction_id == tx.transaction_id).all()

    return {
        "transaction_id": tx.transaction_id,
        "account_id": tx.account_id,
        "customer_id": customer.customer_id,
        "customer_code": customer.customer_code,
        "transaction_datetime": tx.transaction_datetime.isoformat(),
        "amount": tx.amount,
        "transaction_type": tx.transaction_type,
        "channel": tx.channel,
        "region_optional": tx.region_optional,
        "created_at": tx.created_at.isoformat(),
        "alerts": [
            {
                "alert_id": a.alert_id,
                "rule_name": a.rule_name,
                "risk_score": a.risk_score,
                "review_status": a.review_status,
                "review_reason": a.review_reason,
                "created_at": a.created_at.isoformat(),
            }
            for a in alerts
        ],
    }
