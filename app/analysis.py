"""
Data Analysis & Visualization Script
Project 21: Financial Risk Analysis and Rule-Based Fraud Detection System

Utilizes:
- Pandas: Feature preparation, transaction aggregation, rolling windows.
- NumPy: Statistical quantile thresholds (Z-score / IQR) for anomaly comparison.
- Matplotlib: Generates executive chart artifacts (alert trends & risk histogram).
- Scikit-learn (Optional model comparison): Isolation Forest anomaly detection.
"""

import os
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
from datetime import datetime, timedelta

from app.db.database import SessionLocal
from app.db.schema import Transaction, Alert, Account, Customer


def run_data_analysis(output_dir: str = "docs/visualizations"):
    """
    Extracts transaction and alert data from the database, performs Pandas/NumPy analysis,
    and produces high-resolution Matplotlib visualizations.
    """
    os.makedirs(output_dir, exist_ok=True)
    db = SessionLocal()

    try:
        # 1. Load data via SQLAlchemy into Pandas DataFrames
        tx_query = db.query(
            Transaction.transaction_id,
            Transaction.account_id,
            Transaction.transaction_datetime,
            Transaction.amount,
            Transaction.transaction_type,
            Transaction.channel,
            Transaction.region_optional,
        )
        df_tx = pd.read_sql(tx_query.statement, db.bind)

        alert_query = db.query(
            Alert.alert_id,
            Alert.transaction_id,
            Alert.rule_name,
            Alert.risk_score,
            Alert.review_status,
            Alert.created_at,
        )
        df_alerts = pd.read_sql(alert_query.statement, db.bind)

        if df_tx.empty:
            print("[!] No transactions found in database. Run `python -m app.db.seed` first.")
            return

        print(f"[+] Loaded {len(df_tx)} transactions and {len(df_alerts)} alerts into Pandas.")

        # 2. Pandas feature preparation & time indexing
        df_tx["transaction_datetime"] = pd.to_datetime(df_tx["transaction_datetime"])
        df_tx["date"] = df_tx["transaction_datetime"].dt.date
        df_tx["hour"] = df_tx["transaction_datetime"].dt.hour

        # 3. NumPy statistical threshold calculations (IQR & Z-score)
        amounts = df_tx["amount"].to_numpy()
        q25, q75 = np.percentile(amounts, [25, 75])
        iqr = q75 - q25
        statistical_upper_bound = q75 + (1.5 * iqr)
        mean_amount = np.mean(amounts)
        std_amount = np.std(amounts)
        zscore_threshold_3sigma = mean_amount + (3.0 * std_amount)

        print(f"[+] Statistical Metrics (NumPy):")
        print(f"    - Mean: ${mean_amount:,.2f} | Std: ${std_amount:,.2f}")
        print(f"    - IQR Upper Fence (1.5x IQR): ${statistical_upper_bound:,.2f}")
        print(f"    - 3-Sigma Upper Threshold: ${zscore_threshold_3sigma:,.2f}")

        # 4. Matplotlib Figure 1: Alert Trends Over Time
        if not df_alerts.empty:
            df_alerts["created_at"] = pd.to_datetime(df_alerts["created_at"])
            df_alerts["date"] = df_alerts["created_at"].dt.date

            daily_tx = df_tx.groupby("date").size()
            daily_alerts = df_alerts.groupby("date").size()

            plt.figure(figsize=(10, 4.5), dpi=150)
            plt.style.use("seaborn-v0_8-whitegrid" if "seaborn-v0_8-whitegrid" in plt.style.available else "default")
            
            plt.plot(daily_tx.index, daily_tx.values, label="Transactions Evaluated", color="#3b82f6", marker="o", linewidth=2)
            plt.plot(daily_alerts.index, daily_alerts.values, label="Alerts Flagged (Score > 0.30)", color="#ef4444", marker="s", linewidth=2)
            
            plt.title("Project 21: Daily Financial Transaction & Alert Trends", fontsize=12, fontweight="bold")
            plt.xlabel("Date", fontsize=10)
            plt.ylabel("Count", fontsize=10)
            plt.xticks(rotation=45, ha="right", fontsize=9)
            plt.legend(frameon=True)
            plt.tight_layout()

            trends_path = os.path.join(output_dir, "alert_trends.png")
            plt.savefig(trends_path)
            plt.close()
            print(f"[✓] Saved Matplotlib trends figure to {trends_path}")

        # 5. Matplotlib Figure 2: Risk-Score Distribution Histogram
        if not df_alerts.empty:
            scores = df_alerts["risk_score"].to_numpy()

            plt.figure(figsize=(8, 4.5), dpi=150)
            n, bins, patches = plt.hist(scores, bins=12, range=(0.3, 1.0), edgecolor="black", alpha=0.85)

            # Color code bins: Green (<0.4), Yellow (0.4-0.7), Red (>0.7)
            for bin_left, patch in zip(bins[:-1], patches):
                if bin_left < 0.40:
                    patch.set_facecolor("#10b981")  # Green
                elif bin_left < 0.70:
                    patch.set_facecolor("#f59e0b")  # Yellow/Amber
                else:
                    patch.set_facecolor("#ef4444")  # Red

            plt.title("Project 21: Risk Score Distribution (Flagged Alerts)", fontsize=12, fontweight="bold")
            plt.xlabel("Heuristic Risk Score (0.30 to 1.00)", fontsize=10)
            plt.ylabel("Alert Frequency", fontsize=10)
            plt.axvline(0.70, color="darkred", linestyle="--", linewidth=1.5, label="High-Risk Threshold (0.70)")
            plt.legend()
            plt.tight_layout()

            hist_path = os.path.join(output_dir, "risk_distribution_histogram.png")
            plt.savefig(hist_path)
            plt.close()
            print(f"[✓] Saved Matplotlib histogram to {hist_path}")

        # 6. Optional Anomaly Detection Model with scikit-learn
        try:
            from sklearn.ensemble import IsolationForest
            print("[+] Optional Model: Evaluating IsolationForest on synthetic features...")
            features = df_tx[["amount", "hour"]].copy()
            iso_forest = IsolationForest(contamination=0.15, random_state=42)
            df_tx["ml_anomaly"] = iso_forest.fit_predict(features)
            ml_flagged = (df_tx["ml_anomaly"] == -1).sum()
            print(f"[✓] IsolationForest flagged {ml_flagged} / {len(df_tx)} outlier transactions.")
        except ImportError:
            print("[*] scikit-learn not installed (optional library for extended model evaluation).")

    finally:
        db.close()


if __name__ == "__main__":
    run_data_analysis()
