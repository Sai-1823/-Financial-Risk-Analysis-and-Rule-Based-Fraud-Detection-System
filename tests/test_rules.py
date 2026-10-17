"""Tests for the rule engine.

Person 5 owns the test suite.
"""

import pytest
from app.rules.engine import (
    check_unusual_amount,
    check_high_frequency,
    check_location_change,
    check_unusual_time,
    calculate_risk_score,
    RuleResult,
)
from datetime import datetime


def test_unusual_amount_triggered():
    txn = {"amount": 5000}
    result = check_unusual_amount(txn, customer_avg=1000)
    assert result.triggered is True
    assert result.risk_score > 0


def test_unusual_amount_not_triggered():
    txn = {"amount": 500}
    result = check_unusual_amount(txn, customer_avg=1000)
    assert result.triggered is False
    assert result.risk_score == 0


def test_high_frequency_triggered():
    txns = [{"amount": 100}] * 6
    result = check_high_frequency(txns, window_minutes=60, max_count=5)
    assert result.triggered is True


def test_high_frequency_not_triggered():
    txns = [{"amount": 100}] * 3
    result = check_high_frequency(txns, window_minutes=60, max_count=5)
    assert result.triggered is False


def test_location_change_new_region():
    txn = {"region_optional": "APAC-South"}
    result = check_location_change(txn, customer_regions=["US-East", "US-West"])
    assert result.triggered is True


def test_location_change_known_region():
    txn = {"region_optional": "US-East"}
    result = check_location_change(txn, customer_regions=["US-East", "US-West"])
    assert result.triggered is False


def test_unusual_time_night():
    txn = {"transaction_datetime": datetime(2024, 1, 1, 3, 0)}
    result = check_unusual_time(txn)
    assert result.triggered is True


def test_unusual_time_day():
    txn = {"transaction_datetime": datetime(2024, 1, 1, 10, 0)}
    result = check_unusual_time(txn)
    assert result.triggered is False


def test_calculate_risk_score():
    results = [
        RuleResult("unusual_amount", True, 0.4, "high amount"),
        RuleResult("high_frequency", False, 0.0, "normal frequency"),
    ]
    score = calculate_risk_score(results)
    assert score == 0.4
