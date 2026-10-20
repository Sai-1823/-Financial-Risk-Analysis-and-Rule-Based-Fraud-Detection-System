from typing import Dict, Any, List
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.db.database import get_db
from app.db.schema import Transaction, Alert

router = APIRouter(prefix="/analytics", tags=["Analytics"])


@router.get("/summary", response_model=Dict[str, Any])
def get_analytics_summary(db: Session = Depends(get_db)):
    """
    Computes global metrics for the executive dashboard:
    - Total synthetic transactions
    - Total alerts flagged
    - High-risk alert count (score >= 0.70)
    - Total transaction financial volume and average amount
    - Rule triggering breakdown and review status distributions
    - Risk score histogram buckets
    """
    total_tx = db.query(func.count(Transaction.transaction_id)).scalar() or 0
    total_vol = db.query(func.sum(Transaction.amount)).scalar() or 0.0
    avg_amt = db.query(func.avg(Transaction.amount)).scalar() or 0.0

    total_alerts = db.query(func.count(Alert.alert_id)).scalar() or 0
    high_risk_alerts = db.query(func.count(Alert.alert_id)).filter(Alert.risk_score >= 0.70).scalar() or 0
    pending_alerts = db.query(func.count(Alert.alert_id)).filter(Alert.review_status == "pending").scalar() or 0
    approved_alerts = db.query(func.count(Alert.alert_id)).filter(Alert.review_status == "approved").scalar() or 0
    rejected_alerts = db.query(func.count(Alert.alert_id)).filter(Alert.review_status == "rejected").scalar() or 0

    # Rule breakdown
    rule_counts_rows = (
        db.query(Alert.rule_name, func.count(Alert.alert_id))
        .group_by(Alert.rule_name)
        .all()
    )
    rule_breakdown = {r[0]: r[1] for r in rule_counts_rows}

    # Risk score histogram buckets
    # [0.0 - 0.3, 0.3 - 0.5, 0.5 - 0.7, 0.7 - 1.0]
    all_scores = [r[0] for r in db.query(Alert.risk_score).all()]
    buckets = {
        "Low (0.30 - 0.45)": sum(1 for s in all_scores if 0.30 <= s < 0.45),
        "Moderate (0.45 - 0.65)": sum(1 for s in all_scores if 0.45 <= s < 0.65),
        "Elevated (0.65 - 0.80)": sum(1 for s in all_scores if 0.65 <= s < 0.80),
        "Critical (0.80 - 1.00)": sum(1 for s in all_scores if s >= 0.80),
    }

    return {
        "total_transactions": total_tx,
        "total_alerts": total_alerts,
        "high_risk_alerts": high_risk_alerts,
        "pending_reviews": pending_alerts,
        "approved_reviews": approved_alerts,
        "rejected_reviews": rejected_alerts,
        "total_volume": round(float(total_vol), 2),
        "average_amount": round(float(avg_amt), 2),
        "alert_rate_percentage": round((total_alerts / max(total_tx, 1)) * 100, 2),
        "rule_breakdown": rule_breakdown,
        "risk_histogram": buckets,
    }


@router.get("/trends", response_model=List[Dict[str, Any]])
def get_analytics_trends(days: int = 14, db: Session = Depends(get_db)):
    """
    Returns daily time series for transaction volume, alert counts, and average risk score.
    """
    cutoff = datetime.utcnow() - timedelta(days=days)

    transactions = (
        db.query(Transaction.transaction_datetime, Transaction.amount)
        .filter(Transaction.transaction_datetime >= cutoff)
        .all()
    )
    alerts = (
        db.query(Alert.created_at, Alert.risk_score)
        .filter(Alert.created_at >= cutoff)
        .all()
    )

    # Group by date YYYY-MM-DD
    data_by_date: Dict[str, Dict[str, Any]] = {}

    for i in range(days + 1):
        d_str = (cutoff + timedelta(days=i)).strftime("%Y-%m-%d")
        data_by_date[d_str] = {
            "date": d_str,
            "transactions": 0,
            "alerts": 0,
            "volume": 0.0,
            "risk_scores": [],
        }

    for tx_dt, amt in transactions:
        d_str = tx_dt.strftime("%Y-%m-%d")
        if d_str in data_by_date:
            data_by_date[d_str]["transactions"] += 1
            data_by_date[d_str]["volume"] += amt

    for a_dt, score in alerts:
        d_str = a_dt.strftime("%Y-%m-%d")
        if d_str in data_by_date:
            data_by_date[d_str]["alerts"] += 1
            data_by_date[d_str]["risk_scores"].append(score)

    trend_list = []
    for d_str in sorted(data_by_date.keys()):
        item = data_by_date[d_str]
        scores = item.pop("risk_scores")
        avg_score = round(sum(scores) / len(scores), 2) if scores else 0.0
        item["avg_risk_score"] = avg_score
        item["volume"] = round(item["volume"], 2)
        trend_list.append(item)

    return trend_list
