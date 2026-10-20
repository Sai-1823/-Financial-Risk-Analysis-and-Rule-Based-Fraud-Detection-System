"""
Integration Tests for Project 21 FastAPI Endpoints
Uses TestClient to test all API routes, status codes, and request bodies.
"""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.main import app
from app.db.database import Base, get_db
from app.db.schema import Customer, Account, Transaction, Alert


# Use an in-memory SQLite database for isolated test execution
SQLALCHEMY_TEST_DATABASE_URL = "sqlite:///:memory:"

engine = create_engine(
    SQLALCHEMY_TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db
client = TestClient(app)


@pytest.fixture(autouse=True)
def setup_test_db():
    """Create fresh tables for every test."""
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


def test_health_endpoint():
    """Verify healthcheck endpoint returns 200 and healthy status."""
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert "database" in data


def test_rules_endpoint():
    """Verify /rules returns rule specifications and weights."""
    response = client.get("/rules")
    assert response.status_code == 200
    data = response.json()
    assert data["threshold"] == 0.30
    assert "unusual_amount" in data["weights"]
    assert len(data["rules"]) == 4


def test_seed_and_list_transactions():
    """Verify POST /seed creates synthetic records and GET /transactions retrieves them."""
    seed_res = client.post("/seed?count=50")
    assert seed_res.status_code == 200
    seed_data = seed_res.json()
    assert seed_data["status"] == "success"
    assert seed_data["transactions_seeded"] > 0

    list_res = client.get("/transactions?limit=10")
    assert list_res.status_code == 200
    list_data = list_res.json()
    assert list_data["total"] > 0
    assert len(list_data["items"]) <= 10


def test_batch_import_and_alert_trigger():
    """Verify POST /transactions detects anomaly and auto-generates an alert."""
    # Seed baseline customer
    db = TestingSessionLocal()
    cust = Customer(customer_code="CUST-TEST-1")
    db.add(cust)
    db.flush()
    acc = Account(customer_id=cust.customer_id)
    db.add(acc)
    db.commit()
    account_id = acc.account_id
    db.close()

    # Import an extreme outlier transaction (3 AM, $9500)
    tx_payload = [
        {
            "account_id": account_id,
            "amount": 9500.0,
            "transaction_type": "transfer",
            "channel": "web",
            "region_optional": "RU-East",
            "transaction_datetime": "2026-10-20T03:15:00",
        }
    ]

    import_res = client.post("/transactions", json=tx_payload)
    assert import_res.status_code == 201
    import_data = import_res.json()
    assert import_data["imported_count"] == 1
    assert import_data["alerts_created_count"] >= 1
    assert import_data["transactions"][0]["score"] > 0.30


def test_alert_queue_and_review_lifecycle():
    """Verify GET /alerts queue listing and PATCH /alerts/{id}/review status transition."""
    # Seed small batch
    client.post("/seed?count=30")

    # Fetch alerts
    alerts_res = client.get("/alerts")
    assert alerts_res.status_code == 200
    alerts_data = alerts_res.json()

    if alerts_data["total"] > 0:
        first_alert = alerts_data["items"][0]
        alert_id = first_alert["alert_id"]
        assert first_alert["review_status"] == "pending"

        # Update to approved with manual review reason
        patch_res = client.patch(
            f"/alerts/{alert_id}/review",
            json={
                "review_status": "approved",
                "review_reason": "Verified with cardholder over telephone: legitimate travel purchase.",
            },
        )
        assert patch_res.status_code == 200
        patch_data = patch_res.json()
        assert patch_data["review_status"] == "approved"
        assert "telephone" in patch_data["review_reason"]


def test_analytics_endpoints():
    """Verify analytics summary and trends endpoints respond with valid schema."""
    client.post("/seed?count=40")

    summary_res = client.get("/analytics/summary")
    assert summary_res.status_code == 200
    summary = summary_res.json()
    assert "total_transactions" in summary
    assert "total_alerts" in summary
    assert "risk_histogram" in summary

    trends_res = client.get("/analytics/trends?days=7")
    assert trends_res.status_code == 200
    trends = trends_res.json()
    assert isinstance(trends, list)
    assert len(trends) > 0
    assert "avg_risk_score" in trends[0]
