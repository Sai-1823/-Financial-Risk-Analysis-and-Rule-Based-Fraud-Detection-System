"""
Synthetic Data Generation and Anomaly Seeding Script
RiskShield: Financial Risk Analysis & Rule-Based Fraud Detection System

Generates ~500 synthetic transactions across synthetic customers/accounts.
Deliberately seeds anomalies:
- Extreme amounts (3x - 20x customer average)
- Rapid bursts (>5 transactions within 60 minutes)
- Geographical anomalies (unseen regions)
- Off-hours / 3 AM transactions
- High-risk compound anomalies (>0.70 score)
"""

import random
from datetime import datetime, timedelta
from typing import Dict, Any, List

from sqlalchemy.orm import Session
from app.db.database import Base, engine, SessionLocal
from app.db.schema import Customer, Account, Transaction, Alert
from app.rules.engine import calculate_risk_score, ALERT_THRESHOLD


CHANNELS = ["web", "mobile_app", "atm", "pos", "wire"]
TRANSACTION_TYPES = ["payment", "transfer", "withdrawal", "pos", "online"]
PRIMARY_REGIONS = ["US-East", "US-West", "US-Central", "EU-West", "APAC-SG"]
ANOMALY_REGIONS = ["RU-East", "AF-North", "SA-East", "ME-Central", "CY-South"]


def seed_database(db: Session, target_transactions: int = 500) -> Dict[str, Any]:
    """
    Seeds the database with customers, accounts, and transactions with known anomaly injections.
    Returns summary statistics.
    """
    # Create tables if they do not exist
    Base.metadata.create_all(bind=engine)

    # Clean existing data for deterministic re-seeding
    db.query(Alert).delete()
    db.query(Transaction).delete()
    db.query(Account).delete()
    db.query(Customer).delete()
    db.commit()

    random.seed(42)

    num_customers = 25
    customers: List[Customer] = []
    accounts: List[Account] = []

    # Map customer ID to customer baseline home region and typical spend
    customer_profiles: Dict[int, Dict[str, Any]] = {}

    for i in range(1, num_customers + 1):
        cust = Customer(customer_code=f"CUST-{1000 + i}")
        db.add(cust)
        db.flush()
        customers.append(cust)

        # Assign 1 or 2 accounts
        for acc_idx in range(random.choice([1, 1, 2])):
            acc = Account(customer_id=cust.customer_id)
            db.add(acc)
            db.flush()
            accounts.append(acc)

        home_region = PRIMARY_REGIONS[(i - 1) % len(PRIMARY_REGIONS)]
        customer_profiles[cust.customer_id] = {
            "home_region": home_region,
            "known_regions": {home_region},
            "typical_min": random.uniform(15.0, 40.0),
            "typical_max": random.uniform(80.0, 220.0),
            "amounts": [],
        }

    now = datetime.utcnow()
    account_history: Dict[int, List[datetime]] = {acc.account_id: [] for acc in accounts}
    created_transactions: List[Transaction] = []
    created_alerts: List[Alert] = []

    # Generate baseline benign transactions (~420 transactions)
    benign_count = int(target_transactions * 0.84)
    for _ in range(benign_count):
        acc = random.choice(accounts)
        profile = customer_profiles[acc.customer_id]

        days_ago = random.uniform(0.1, 28.0)
        # Normal waking hours: 7 AM to 9 PM
        hour = random.randint(7, 21)
        minute = random.randint(0, 59)
        second = random.randint(0, 59)
        tx_time = (now - timedelta(days=days_ago)).replace(hour=hour, minute=minute, second=second)

        amount = round(random.uniform(profile["typical_min"], profile["typical_max"]), 2)
        profile["amounts"].append(amount)
        account_history[acc.account_id].append(tx_time)

        tx = Transaction(
            account_id=acc.account_id,
            transaction_datetime=tx_time,
            amount=amount,
            transaction_type=random.choice(TRANSACTION_TYPES),
            channel=random.choice(CHANNELS),
            region_optional=profile["home_region"],
        )
        created_transactions.append(tx)

    # Anomaly Type A: Extreme Outlier Amounts (amount > 3x average)
    for _ in range(25):
        acc = random.choice(accounts)
        profile = customer_profiles[acc.customer_id]
        avg = sum(profile["amounts"]) / max(len(profile["amounts"]), 1) if profile["amounts"] else 100.0
        amount = round(avg * random.uniform(4.5, 12.0), 2)
        tx_time = now - timedelta(days=random.uniform(1, 14), hours=random.randint(9, 18))

        tx = Transaction(
            account_id=acc.account_id,
            transaction_datetime=tx_time,
            amount=amount,
            transaction_type="transfer",
            channel="wire" if random.random() > 0.5 else "web",
            region_optional=profile["home_region"],
        )
        created_transactions.append(tx)

    # Anomaly Type B: High Frequency Burst (> 5 transactions within 60 minutes)
    for _ in range(4):
        acc = random.choice(accounts)
        profile = customer_profiles[acc.customer_id]
        burst_base_time = now - timedelta(days=random.uniform(1, 10), hours=random.randint(10, 16))
        # 7 rapid transactions separated by 2-5 minutes
        for b_idx in range(7):
            t_burst = burst_base_time + timedelta(minutes=b_idx * 3 + random.randint(0, 1))
            amount = round(random.uniform(18.0, 95.0), 2)
            tx = Transaction(
                account_id=acc.account_id,
                transaction_datetime=t_burst,
                amount=amount,
                transaction_type="pos" if b_idx % 2 == 0 else "online",
                channel="mobile_app",
                region_optional=profile["home_region"],
            )
            created_transactions.append(tx)

    # Anomaly Type C: Unfamiliar Geographical Region
    for _ in range(20):
        acc = random.choice(accounts)
        profile = customer_profiles[acc.customer_id]
        tx_time = now - timedelta(days=random.uniform(1, 20), hours=random.randint(8, 20))
        foreign_region = random.choice(ANOMALY_REGIONS)
        amount = round(random.uniform(80.0, 350.0), 2)

        tx = Transaction(
            account_id=acc.account_id,
            transaction_datetime=tx_time,
            amount=amount,
            transaction_type="online",
            channel="web",
            region_optional=foreign_region,
        )
        created_transactions.append(tx)

    # Anomaly Type D: Unusual Off-Hours Execution (e.g. 02:45 AM or 03:20 AM)
    for _ in range(20):
        acc = random.choice(accounts)
        profile = customer_profiles[acc.customer_id]
        tx_time = (now - timedelta(days=random.uniform(1, 25))).replace(
            hour=random.choice([1, 2, 3, 4]), minute=random.randint(5, 55)
        )
        amount = round(random.uniform(40.0, 180.0), 2)

        tx = Transaction(
            account_id=acc.account_id,
            transaction_datetime=tx_time,
            amount=amount,
            transaction_type="withdrawal" if random.random() > 0.5 else "payment",
            channel="atm" if random.random() > 0.5 else "mobile_app",
            region_optional=profile["home_region"],
        )
        created_transactions.append(tx)

    # Anomaly Type E: High Risk Multi-Rule Compound Anomaly (>0.70 score: amount + time + region + frequency)
    for _ in range(12):
        acc = random.choice(accounts)
        profile = customer_profiles[acc.customer_id]
        avg = sum(profile["amounts"]) / max(len(profile["amounts"]), 1) if profile["amounts"] else 120.0
        # 3 AM, 6x normal amount, foreign region
        tx_time = (now - timedelta(days=random.uniform(0.5, 8))).replace(
            hour=3, minute=random.randint(10, 45)
        )
        amount = round(avg * random.uniform(5.0, 9.0), 2)

        tx = Transaction(
            account_id=acc.account_id,
            transaction_datetime=tx_time,
            amount=amount,
            transaction_type="transfer",
            channel="web",
            region_optional=random.choice(ANOMALY_REGIONS),
        )
        created_transactions.append(tx)

    # Sort all transactions chronologically so context can be computed accurately
    created_transactions.sort(key=lambda t: t.transaction_datetime)

    # Commit transactions in batch
    db.add_all(created_transactions)
    db.commit()

    # Now evaluate rules across all transactions and generate alerts
    # Build dynamic customer baseline as we evaluate
    dynamic_amounts: Dict[int, List[float]] = {}
    dynamic_regions: Dict[int, set] = {}
    account_to_cust: Dict[int, int] = {acc.account_id: acc.customer_id for acc in accounts}
    tx_times_by_acc: Dict[int, List[datetime]] = {acc.account_id: [] for acc in accounts}

    for tx in created_transactions:
        cust_id = account_to_cust[tx.account_id]
        if cust_id not in dynamic_amounts:
            dynamic_amounts[cust_id] = []
            dynamic_regions[cust_id] = set()

        history_amounts = dynamic_amounts[cust_id]
        avg_amt = sum(history_amounts) / len(history_amounts) if history_amounts else 0.0

        # Check transactions in past 60 minutes for this account
        recent_times = [
            t for t in tx_times_by_acc[tx.account_id]
            if 0 <= (tx.transaction_datetime - t).total_seconds() <= 3600
        ]

        context = {
            "customer_avg_amount": avg_amt,
            "recent_60m_count": len(recent_times),
            "known_regions": list(dynamic_regions[cust_id]),
        }

        score, triggered_rules, reasons = calculate_risk_score(tx, context)

        # Update customer profile
        dynamic_amounts[cust_id].append(tx.amount)
        if tx.region_optional:
            dynamic_regions[cust_id].add(tx.region_optional)
        tx_times_by_acc[tx.account_id].append(tx.transaction_datetime)

        # If score exceeds threshold, create Alert
        if score > ALERT_THRESHOLD and triggered_rules:
            primary_rule = triggered_rules[0] if len(triggered_rules) == 1 else "multi_rule"
            alert = Alert(
                transaction_id=tx.transaction_id,
                rule_name=primary_rule,
                risk_score=score,
                review_status="pending",
                review_reason="; ".join(reasons),
                created_at=tx.transaction_datetime,
            )
            created_alerts.append(alert)

    db.add_all(created_alerts)
    db.commit()

    return {
        "status": "success",
        "customers_seeded": len(customers),
        "accounts_seeded": len(accounts),
        "transactions_seeded": len(created_transactions),
        "alerts_generated": len(created_alerts),
        "threshold": ALERT_THRESHOLD,
    }


if __name__ == "__main__":
    db = SessionLocal()
    try:
        print("[+] Seeding synthetic financial dataset for RiskShield...")
        stats = seed_database(db, target_transactions=500)
        print(f"[✓] Seeding complete! Summary:")
        for k, v in stats.items():
            print(f"    - {k}: {v}")
    finally:
        db.close()
