"""Synthetic data generator for Project 21.

Generates fake customers, accounts, and transactions.
No real banking data is used.
"""

import random
from datetime import datetime, timedelta
from faker import Faker

fake = Faker()


def generate_customers(n: int = 100):
    """Generate n synthetic customers."""
    customers = []
    for _ in range(n):
        customers.append({
            "customer_id": fake.uuid4(),
            "customer_code": f"CUST-{random.randint(1000, 9999)}",
        })
    return customers


def generate_accounts(customers, accounts_per_customer: int = 2):
    """Generate synthetic accounts linked to customers."""
    accounts = []
    for customer in customers:
        for _ in range(accounts_per_customer):
            accounts.append({
                "account_id": fake.uuid4(),
                "customer_id": customer["customer_id"],
            })
    return accounts


def generate_transactions(accounts, n: int = 1000):
    """Generate synthetic transactions."""
    transaction_types = ["purchase", "transfer", "withdrawal", "deposit"]
    channels = ["online", "mobile", "atm", "branch"]
    regions = ["US-East", "US-West", "EU-Central", "APAC-South", "LATAM-North"]

    transactions = []
    for _ in range(n):
        account = random.choice(accounts)
        days_ago = random.randint(0, 30)
        txn_time = datetime.now() - timedelta(days=days_ago)
        transactions.append({
            "transaction_id": fake.uuid4(),
            "account_id": account["account_id"],
            "transaction_datetime": txn_time,
            "amount": round(random.uniform(10, 10000), 2),
            "transaction_type": random.choice(transaction_types),
            "channel": random.choice(channels),
            "region_optional": random.choice(regions),
        })
    return transactions


if __name__ == "__main__":
    customers = generate_customers(50)
    accounts = generate_accounts(customers)
    transactions = generate_transactions(accounts, 500)
    print(f"Generated {len(customers)} customers, {len(accounts)} accounts, {len(transactions)} transactions")
