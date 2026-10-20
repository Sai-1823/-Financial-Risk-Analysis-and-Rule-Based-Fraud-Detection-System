"""Pandas feature preparation for analytics.

Person 4 owns this module.
"""

import pandas as pd


def load_transactions(path: str) -> pd.DataFrame:
    """Load transactions CSV into a DataFrame."""
    df = pd.read_csv(path, parse_dates=["transaction_datetime"])
    return df


def add_hour_feature(df: pd.DataFrame) -> pd.DataFrame:
    """Extract hour of day from transaction_datetime."""
    df = df.copy()
    df["hour"] = df["transaction_datetime"].dt.hour
    return df


def add_amount_zscore(df: pd.DataFrame) -> pd.DataFrame:
    """Add z-score of amount per account."""
    df = df.copy()
    df["amount_zscore"] = df.groupby("account_id")["amount"].transform(
        lambda x: (x - x.mean()) / (x.std() + 1e-9)
    )
    return df


def summary_stats(df: pd.DataFrame) -> dict:
    """Return basic statistical thresholds."""
    return {
        "total_transactions": len(df),
        "total_amount": float(df["amount"].sum()),
        "avg_amount": float(df["amount"].mean()),
        "median_amount": float(df["amount"].median()),
        "std_amount": float(df["amount"].std()),
        "max_amount": float(df["amount"].max()),
    }
