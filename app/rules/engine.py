"""
Financial Risk Analysis and Rule-Based Fraud Detection Engine
Project 21: Student Team Implementation

RULE SPECIFICATION & WEIGHT MATRIX:
1. unusual_amount (weight: 0.40):
   Triggered if transaction amount > 3x the customer's historical average amount.
   Rationale: Outlier spending spikes strongly correlate with account compromise or unauthorized transfers.

2. high_frequency (weight: 0.30):
   Triggered if the account initiated > 5 transactions within the past 60 minutes.
   Rationale: Rapid-fire micro or macro transactions often indicate bot-driven card testing or rapid asset draining.

3. location_change (weight: 0.20):
   Triggered if transaction region is not in customer's previous history of approved/settled regions.
   Rationale: Sudden geographical anomalies suggest hijacked credentials or session spoofing.

4. unusual_time (weight: 0.10):
   Triggered if transaction occurs between 22:00 (10 PM) and 06:00 (6 AM) local transaction time.
   Rationale: Off-hours automated execution carries moderate risk elevation.

DISCLAIMER:
All flags represent risk alerts for HUMAN MANUAL REVIEW.
This system NEVER labels transactions as "confirmed fraud".
"""

from typing import Dict, List, Tuple, Any, Optional
from datetime import datetime

# Default Weights defined by Project 21 specification
DEFAULT_WEIGHTS = {
    "unusual_amount": 0.40,
    "high_frequency": 0.30,
    "location_change": 0.20,
    "unusual_time": 0.10,
}

ALERT_THRESHOLD = 0.30  # Scores > 0.30 produce an alert in the review queue


def calculate_risk_score(
    transaction: Any,
    context: Optional[Dict[str, Any]] = None,
    custom_weights: Optional[Dict[str, float]] = None,
) -> Tuple[float, List[str], List[str]]:
    """
    Evaluates a transaction against the four core fraud detection heuristics.

    Args:
        transaction: Transaction model instance or dict with keys:
            - amount: float
            - transaction_datetime: datetime or ISO string
            - region_optional: str or None
            - account_id: int
        context: Contextual historical metrics for the customer/account:
            - customer_avg_amount: float (historical mean amount)
            - recent_60m_count: int (number of transactions within last 60 minutes)
            - known_regions: list[str] or set[str] (historical regions seen for customer)
        custom_weights: Optional override dictionary for rule weights.

    Returns:
        Tuple of:
            - risk_score: float bounded between 0.00 and 1.00
            - triggered_rules: list of rule names that fired
            - reasons: list of human-readable explanations for manual review analysts
    """
    weights = custom_weights or DEFAULT_WEIGHTS
    context = context or {}

    # Extract transaction fields safely whether model or dict
    if isinstance(transaction, dict):
        amount = float(transaction.get("amount", 0.0))
        tx_dt = transaction.get("transaction_datetime")
        region = transaction.get("region_optional")
    else:
        amount = float(getattr(transaction, "amount", 0.0))
        tx_dt = getattr(transaction, "transaction_datetime", None)
        region = getattr(transaction, "region_optional", None)

    if isinstance(tx_dt, str):
        try:
            tx_dt = datetime.fromisoformat(tx_dt.replace("Z", "+00:00"))
        except Exception:
            tx_dt = datetime.utcnow()
    elif not isinstance(tx_dt, datetime):
        tx_dt = datetime.utcnow()

    customer_avg = float(context.get("customer_avg_amount", 0.0))
    recent_60m_count = int(context.get("recent_60m_count", 0))
    known_regions = set(context.get("known_regions") or [])

    triggered_rules: List[str] = []
    reasons: List[str] = []
    score = 0.0

    # Rule 1: Unusual Amount (Weight: 0.40)
    # Trigger if amount > 3x average (when baseline average exists > 0)
    if customer_avg > 0 and amount > (3.0 * customer_avg):
        rule_w = weights.get("unusual_amount", 0.40)
        score += rule_w
        triggered_rules.append("unusual_amount")
        ratio = amount / customer_avg
        reasons.append(
            f"Amount ${amount:,.2f} exceeds 3x customer average (${customer_avg:,.2f}) by {ratio:.1f}x"
        )

    # Rule 2: High Frequency (Weight: 0.30)
    # Trigger if > 5 transactions in the trailing 60 minutes
    if recent_60m_count > 5:
        rule_w = weights.get("high_frequency", 0.30)
        score += rule_w
        triggered_rules.append("high_frequency")
        reasons.append(
            f"High frequency activity: {recent_60m_count} transactions recorded in past 60 minutes (threshold > 5)"
        )

    # Rule 3: Location Change (Weight: 0.20)
    # Trigger if region is provided, known history exists, and region is unrecognized
    if region and len(known_regions) > 0 and region not in known_regions:
        rule_w = weights.get("location_change", 0.20)
        score += rule_w
        triggered_rules.append("location_change")
        reasons.append(
            f"Unfamiliar region '{region}' not present in customer's prior transaction history ({', '.join(sorted(known_regions))})"
        )

    # Rule 4: Unusual Time (Weight: 0.10)
    # Trigger if hour < 6 or hour > 22
    hour = tx_dt.hour
    if hour < 6 or hour >= 22:
        rule_w = weights.get("unusual_time", 0.10)
        score += rule_w
        triggered_rules.append("unusual_time")
        reasons.append(
            f"Off-hours transaction initiated at {hour:02d}:{tx_dt.minute:02d} (unusual window: 22:00-06:00)"
        )

    # Round to 2 decimal places and cap at 1.00
    final_score = min(1.0, round(score, 2))
    return final_score, triggered_rules, reasons
