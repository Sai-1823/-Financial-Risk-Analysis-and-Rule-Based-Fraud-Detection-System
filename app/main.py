"""
Project 21: Financial Risk Analysis and Rule-Based Fraud Detection System
FastAPI Application Entry Point

Features:
- CORS enabled for SPA frontend
- System health status endpoint
- Automated SQLite / MySQL schema bootstrap
- Synthetic data seeding trigger endpoint
- Interactive Swagger docs at /docs
"""

import os
from datetime import datetime
from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import text

from app.db.database import engine, Base, get_db
from app.db.seed import seed_database
from app.api.transactions import router as transactions_router
from app.api.alerts import router as alerts_router
from app.api.analytics import router as analytics_router
from app.rules.engine import DEFAULT_WEIGHTS, ALERT_THRESHOLD, calculate_risk_score

# Create database tables automatically upon startup
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Project 21: Financial Risk Analysis & Rule-Based Fraud Detection API",
    description=(
        "Rule-based fraud detection microservice for a 5-person student team. "
        "Flags synthetic financial transactions for manual human review without labeling confirmed fraud."
    ),
    version="1.0.0",
)

# Enable CORS for local dev servers and frontend dashboards
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register route modules
app.include_router(transactions_router)
app.include_router(alerts_router)
app.include_router(analytics_router)


@app.get("/health", tags=["System"])
def health_check(db: Session = Depends(get_db)):
    """
    Healthcheck endpoint verifying API uptime and database connectivity.
    """
    try:
        db.execute(text("SELECT 1"))
        db_status = "connected"
    except Exception as e:
        db_status = f"unreachable: {str(e)}"

    return {
        "status": "healthy",
        "app": "Project 21 Financial Risk & Fraud Detection",
        "timestamp": datetime.utcnow().isoformat(),
        "database": db_status,
        "database_url_type": "sqlite" if "sqlite" in str(engine.url) else "mysql",
    }


@app.get("/rules", tags=["Rules"])
def get_rule_definitions():
    """
    Returns active rule specifications, standard weights, and trigger thresholds.
    """
    return {
        "threshold": ALERT_THRESHOLD,
        "weights": DEFAULT_WEIGHTS,
        "rules": [
            {
                "rule_name": "unusual_amount",
                "weight": DEFAULT_WEIGHTS["unusual_amount"],
                "condition": "amount > 3.0 * customer_historical_average",
                "description": "Flags transaction amounts severely diverging from established customer habits",
            },
            {
                "rule_name": "high_frequency",
                "weight": DEFAULT_WEIGHTS["high_frequency"],
                "condition": "transactions_in_last_60_minutes > 5",
                "description": "Detects rapid transaction velocity indicative of automated bots or card cracking",
            },
            {
                "rule_name": "location_change",
                "weight": DEFAULT_WEIGHTS["location_change"],
                "condition": "region not in customer_historical_regions",
                "description": "Identifies geographic anomalies from unknown IP/POS terminal territories",
            },
            {
                "rule_name": "unusual_time",
                "weight": DEFAULT_WEIGHTS["unusual_time"],
                "condition": "hour < 6 or hour >= 22",
                "description": "Highlights off-peak nocturnal execution windows",
            },
        ],
    }


@app.post("/seed", tags=["System"])
def trigger_seed(count: int = 500, db: Session = Depends(get_db)):
    """
    HTTP trigger to generate ~500 synthetic transactions with deliberate anomalies.
    """
    stats = seed_database(db, target_transactions=count)
    return stats


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
