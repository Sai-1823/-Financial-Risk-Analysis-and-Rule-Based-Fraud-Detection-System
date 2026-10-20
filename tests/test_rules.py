"""
Unit Tests for Project 21 Rule-Based Fraud Detection Engine
Tests individual rule thresholds, boundary conditions, and composite scoring.
"""

from datetime import datetime
import pytest
from app.rules.engine import calculate_risk_score, DEFAULT_WEIGHTS


def test_benign_transaction():
    """Verify standard benign transaction triggers zero flags and returns 0.0 risk score."""
    tx = {
        "amount": 45.0,
        "transaction_datetime": "2026-10-20T14:30:00",
        "region_optional": "US-East",
    }
    context = {
        "customer_avg_amount": 50.0,
        "recent_60m_count": 1,
        "known_regions": ["US-East"],
    }

    score, triggered, reasons = calculate_risk_score(tx, context)

    assert score == 0.0
    assert len(triggered) == 0
    assert len(reasons) == 0


def test_unusual_amount_triggered():
    """Verify amount > 3x historical average triggers unusual_amount (weight 0.40)."""
    tx = {
        "amount": 450.0,  # 4.5x average
        "transaction_datetime": "2026-10-20T12:00:00",
        "region_optional": "US-East",
    }
    context = {
        "customer_avg_amount": 100.0,
        "recent_60m_count": 0,
        "known_regions": ["US-East"],
    }

    score, triggered, reasons = calculate_risk_score(tx, context)

    assert "unusual_amount" in triggered
    assert score == pytest.approx(0.40)
    assert any("exceeds 3x customer average" in r for r in reasons)


def test_unusual_amount_not_triggered_at_threshold():
    """Verify amount exactly at or below 3x average does NOT trigger."""
    tx = {
        "amount": 300.0,  # exactly 3x, not > 3x
        "transaction_datetime": "2026-10-20T12:00:00",
        "region_optional": "US-East",
    }
    context = {
        "customer_avg_amount": 100.0,
        "recent_60m_count": 0,
        "known_regions": ["US-East"],
    }

    score, triggered, reasons = calculate_risk_score(tx, context)

    assert "unusual_amount" not in triggered
    assert score == 0.0


def test_high_frequency_triggered():
    """Verify > 5 transactions in trailing 60m triggers high_frequency (weight 0.30)."""
    tx = {
        "amount": 25.0,
        "transaction_datetime": "2026-10-20T15:00:00",
        "region_optional": "US-East",
    }
    context = {
        "customer_avg_amount": 30.0,
        "recent_60m_count": 6,  # > 5
        "known_regions": ["US-East"],
    }

    score, triggered, reasons = calculate_risk_score(tx, context)

    assert "high_frequency" in triggered
    assert score == pytest.approx(0.30)
    assert any("High frequency activity" in r for r in reasons)


def test_high_frequency_boundary():
    """Verify exactly 5 transactions does NOT trigger high_frequency (> 5 required)."""
    tx = {
        "amount": 25.0,
        "transaction_datetime": "2026-10-20T15:00:00",
        "region_optional": "US-East",
    }
    context = {
        "customer_avg_amount": 30.0,
        "recent_60m_count": 5,
        "known_regions": ["US-East"],
    }

    score, triggered, reasons = calculate_risk_score(tx, context)

    assert "high_frequency" not in triggered
    assert score == 0.0


def test_location_change_triggered():
    """Verify transaction in unfamiliar region triggers location_change (weight 0.20)."""
    tx = {
        "amount": 50.0,
        "transaction_datetime": "2026-10-20T16:00:00",
        "region_optional": "APAC-SG",
    }
    context = {
        "customer_avg_amount": 60.0,
        "recent_60m_count": 0,
        "known_regions": ["US-East", "US-West"],
    }

    score, triggered, reasons = calculate_risk_score(tx, context)

    assert "location_change" in triggered
    assert score == pytest.approx(0.20)
    assert any("Unfamiliar region 'APAC-SG'" in r for r in reasons)


def test_unusual_time_early_morning():
    """Verify transaction at 03:30 AM triggers unusual_time (weight 0.10)."""
    tx = {
        "amount": 40.0,
        "transaction_datetime": "2026-10-20T03:30:00",
        "region_optional": "US-East",
    }
    context = {
        "customer_avg_amount": 50.0,
        "recent_60m_count": 0,
        "known_regions": ["US-East"],
    }

    score, triggered, reasons = calculate_risk_score(tx, context)

    assert "unusual_time" in triggered
    assert score == pytest.approx(0.10)


def test_unusual_time_late_night():
    """Verify transaction at 23:15 triggers unusual_time."""
    tx = {
        "amount": 40.0,
        "transaction_datetime": datetime(2026, 10, 20, 23, 15, 0),
        "region_optional": "US-East",
    }
    context = {
        "customer_avg_amount": 50.0,
        "recent_60m_count": 0,
        "known_regions": ["US-East"],
    }

    score, triggered, reasons = calculate_risk_score(tx, context)

    assert "unusual_time" in triggered
    assert score == pytest.approx(0.10)


def test_compound_anomalies_cap():
    """Verify all 4 rules firing gives score 1.0 (0.4 + 0.3 + 0.2 + 0.1 = 1.0)."""
    tx = {
        "amount": 2500.0,
        "transaction_datetime": "2026-10-20T02:15:00",
        "region_optional": "RU-East",
    }
    context = {
        "customer_avg_amount": 100.0,
        "recent_60m_count": 8,
        "known_regions": ["US-East"],
    }

    score, triggered, reasons = calculate_risk_score(tx, context)

    assert len(triggered) == 4
    assert set(triggered) == {"unusual_amount", "high_frequency", "location_change", "unusual_time"}
    assert score == 1.0
    assert len(reasons) == 4
