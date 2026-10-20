"""Matplotlib visualizations for alert trends.

Person 4 owns this module.
"""

import matplotlib.pyplot as plt


def plot_alert_trends(alerts_by_day, save_path="alert_trends.png"):
    """Plot number of alerts per day."""
    plt.figure(figsize=(10, 5))
    plt.bar(alerts_by_day.index, alerts_by_day.values)
    plt.title("Alert Trends Over Time")
    plt.xlabel("Date")
    plt.ylabel("Number of Alerts")
    plt.xticks(rotation=45)
    plt.tight_layout()
    plt.savefig(save_path)
    plt.close()
    print(f"Saved alert trend chart to {save_path}")


def plot_risk_score_distribution(scores, save_path="risk_score_distribution.png"):
    """Plot histogram of risk scores."""
    plt.figure(figsize=(8, 5))
    plt.hist(scores, bins=20, edgecolor="black")
    plt.title("Risk Score Distribution")
    plt.xlabel("Risk Score")
    plt.ylabel("Count")
    plt.tight_layout()
    plt.savefig(save_path)
    plt.close()
    print(f"Saved risk score distribution to {save_path}")
