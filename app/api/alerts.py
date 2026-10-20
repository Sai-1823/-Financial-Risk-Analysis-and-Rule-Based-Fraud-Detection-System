from typing import Optional, Dict, Any
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.db.database import get_db
from app.db.schema import Alert, Transaction, Account, Customer

router = APIRouter(prefix="/alerts", tags=["Alerts"])


class ReviewRequest(BaseModel):
    review_status: str = Field(..., description="Must be 'pending', 'approved', or 'rejected'")
    review_reason: Optional[str] = Field(None, description="Investigator notes and rationale")


@router.get("", response_model=Dict[str, Any])
def list_alerts(
    status_filter: Optional[str] = Query(None, alias="status", description="pending, approved, rejected"),
    rule_name: Optional[str] = Query(None, description="Filter by rule"),
    min_score: Optional[float] = Query(None, description="Minimum risk score"),
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
    sort_by: str = Query("risk_score", description="risk_score or created_at"),
    db: Session = Depends(get_db),
):
    """
    Returns the fraud alert queue for human analyst triage.
    Enforces the RiskShield standard: Flags are for manual review only.
    """
    query = (
        db.query(Alert, Transaction, Customer.customer_code)
        .join(Transaction, Alert.transaction_id == Transaction.transaction_id)
        .join(Account, Transaction.account_id == Account.account_id)
        .join(Customer, Account.customer_id == Customer.customer_id)
    )

    if status_filter:
        query = query.filter(Alert.review_status == status_filter.lower())
    if rule_name:
        query = query.filter(Alert.rule_name == rule_name)
    if min_score is not None:
        query = query.filter(Alert.risk_score >= min_score)

    total_count = query.count()

    if sort_by == "created_at":
        query = query.order_by(desc(Alert.created_at))
    else:
        # Default order by risk score descending, then by alert date
        query = query.order_by(desc(Alert.risk_score), desc(Alert.created_at))

    rows = query.offset(offset).limit(limit).all()

    items = []
    for alert, tx, customer_code in rows:
        items.append({
            "alert_id": alert.alert_id,
            "transaction_id": alert.transaction_id,
            "customer_code": customer_code,
            "account_id": tx.account_id,
            "amount": tx.amount,
            "channel": tx.channel,
            "region": tx.region_optional,
            "transaction_datetime": tx.transaction_datetime.isoformat(),
            "rule_name": alert.rule_name,
            "risk_score": alert.risk_score,
            "review_status": alert.review_status,
            "review_reason": alert.review_reason,
            "created_at": alert.created_at.isoformat(),
        })

    return {
        "total": total_count,
        "limit": limit,
        "offset": offset,
        "items": items,
    }


@router.patch("/{alert_id}/review")
def review_alert(
    alert_id: int,
    body: ReviewRequest,
    db: Session = Depends(get_db),
):
    """
    Analyst review action endpoint.
    Transitions alert review_status (pending, approved, rejected) with human investigator rationale.
    """
    valid_statuses = {"pending", "approved", "rejected"}
    norm_status = body.review_status.lower().strip()
    if norm_status not in valid_statuses:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid review_status '{body.review_status}'. Must be one of: {list(valid_statuses)}"
        )

    alert = db.query(Alert).filter(Alert.alert_id == alert_id).first()
    if not alert:
        raise HTTPException(status_code=404, detail=f"Alert #{alert_id} not found")

    alert.review_status = norm_status
    if body.review_reason is not None:
        alert.review_reason = body.review_reason

    db.commit()
    db.refresh(alert)

    return {
        "status": "success",
        "alert_id": alert.alert_id,
        "review_status": alert.review_status,
        "review_reason": alert.review_reason,
        "updated_at": datetime.utcnow().isoformat(),
    }
