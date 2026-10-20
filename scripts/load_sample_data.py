"""
Load sample data into the RiskShield database.

Usage:
    python scripts/load_sample_data.py

This reads data/sample_data.json and inserts all customers, accounts,
transactions, and alerts into the configured database (SQLite by default).
IDs are auto-incremented, so insertion order determines foreign key mapping.
"""

import json
import os
import sys
from datetime import datetime

# Add project root to path so we can import app modules
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.db.database import SessionLocal, engine, Base
from app.db.schema import Customer, Account, Transaction, Alert


def load_sample_data():
    """Load sample data from data/sample_data.json into the database."""
    # Ensure tables exist
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    try:
        # Load JSON
        data_path = os.path.join(
            os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
            "data",
            "sample_data.json",
        )
        with open(data_path, "r") as f:
            data = json.load(f)

        # Insert customers (IDs auto-increment: 1, 2, 3...)
        for c in data.get("customers", []):
            db.add(Customer(customer_code=c["customer_code"]))
        db.commit()
        print(f"Inserted {len(data.get('customers', []))} customers")

        # Insert accounts (IDs auto-increment: 1, 2, 3...)
        for a in data.get("accounts", []):
            db.add(Account(customer_id=a["customer_id"]))
        db.commit()
        print(f"Inserted {len(data.get('accounts', []))} accounts")

        # Insert transactions (IDs auto-increment: 1, 2, 3...)
        tx_count = 0
        for t in data.get("transactions", []):
            db.add(Transaction(
                account_id=t["account_id"],
                transaction_datetime=datetime.fromisoformat(t["transaction_datetime"]),
                amount=t["amount"],
                transaction_type=t["transaction_type"],
                channel=t["channel"],
                region_optional=t.get("region_optional"),
            ))
            tx_count += 1
        db.commit()
        print(f"Inserted {tx_count} transactions")

        # Insert alerts
        alert_count = 0
        for a in data.get("alerts", []):
            db.add(Alert(
                transaction_id=a["transaction_id"],
                rule_name=a["rule_name"],
                risk_score=a["risk_score"],
                review_status=a["review_status"],
                review_reason=a.get("review_reason"),
                created_at=datetime.utcnow(),
            ))
            alert_count += 1
        db.commit()
        print(f"Inserted {alert_count} alerts")

        print("\nSample data loaded successfully!")
        print("You can now view it at http://localhost:8000/transactions and http://localhost:8000/alerts")

    except Exception as e:
        db.rollback()
        print(f"Error loading sample data: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    load_sample_data()
