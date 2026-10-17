"""Rule-based fraud detection engine.

Configurable rules with documented weights.
Person 3 owns this module.
"""

from dataclasses import dataclass
from typing import List, Dict, Any
from datetime import datetime, timedelta


@dataclass
class RuleResult:
    rule_name: str
    triggered: bool
    risk_score: float
    reason: str


# Documented weights (sum should be interpretable; adjust as team agrees)
RULE_WEIGHTS = {
    "unusual_amount": 0.40,      # transaction amount far above customer average
    "high_frequency": 0.30,      # many transactions in short window
    "location_change": 0.20,     # transaction from new region
    "unusual_time": 0.10,        # transaction at odd hours
}


def check_unusual_amount(transaction: Dict[str, Any], customer_avg: float) -> RuleResult:
    """Flag if amount is > 3x customer average."""
    amount = transaction["amount"]
    threshold = customer_avg * 3
    triggered = amount > threshold
    score = RULE_WEIGHTS["unusual_amount"] if triggered else 0.0
    reason = (
        f"Amount {amount} exceeds 3x customer average {customer_avg:.2f}"
        if triggered else "Amount within normal range"
    )
    return RuleResult("unusual_amount", triggered, score, reason)


def check_high_frequency(transactions: List[Dict[str, Any]], window_minutes: int = 60, max_count: int = 5) -> RuleResult:
    """Flag if more than max_count transactions in window_minutes."""
    triggered = len(transactions) > max_count
    score = RULE_WEIGHTS["high_frequency"] if triggered else 0.0
    reason = (
        f"{len(transactions)} transactions in {window_minutes} min (limit {max_count})"
        if triggered else f"Frequency normal ({len(transactions)} in {window_minutes} min)"
    )
    return RuleResult("high_frequency", triggered, score, reason)


def check_location_change(transaction: Dict[str, Any], customer_regions: List[str]) -> RuleResult:
    """Flag if transaction region is new for this customer."""
    region = transaction.get("region_optional")
    triggered = region is not None and region not in customer_regions
    score = RULE_WEIGHTS["location_change"] if triggered else 0.0
    reason = (
        f"New region detected: {region}"
        if triggered else f"Region {region} is known for customer"
    )
    return RuleResult("location_change", triggered, score, reason)


def check_unusual_time(transaction: Dict[str, Any]) -> RuleResult:
    """Flag if transaction occurs outside business hours (22:00-06:00)."""
    txn_time = transaction["transaction_datetime"]
    if isinstance(txn_time, str):
        txn_time = datetime.fromisoformat(txn_time)
    hour = txn_time.hour
    triggered = hour < 6 or hour > 22
    score = RULE_WEIGHTS["unusual_time"] if triggered else 0.0
    reason = (
        f"Transaction at unusual hour: {hour}:00"
        if triggered else "Transaction within business hours"
    )
    return RuleResult("unusual_time", triggered, score, reason)


def calculate_risk_score(rule_results: List[RuleResult]) -> float:
    """Sum weighted scores from all triggered rules. Max possible: 1.0."""
    return round(sum(r.risk_score for r in rule_results), 4)
