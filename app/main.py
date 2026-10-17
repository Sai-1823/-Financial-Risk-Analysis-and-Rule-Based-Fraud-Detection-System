"""Project 21 - Financial Risk Analysis and Rule-Based Fraud Detection System.

FastAPI entrypoint. Import and retrieve transactions, view alerts.
"""

from fastapi import FastAPI

app = FastAPI(
    title="Financial Risk Analysis & Rule-Based Fraud Detection",
    description="Analyze synthetic financial transactions and flag anomalies for manual review.",
    version="0.1.0",
)


@app.get("/")
def read_root():
    return {
        "message": "Project 21 Fraud Detection API",
        "status": "running",
        "docs": "/docs",
    }


@app.get("/health")
def health_check():
    return {"status": "healthy"}


# TODO: Person 2 - add REST API routes for:
#   - POST /transactions (import)
#   - GET /transactions (retrieve)
#   - GET /alerts (flagged queue)
#   - PATCH /alerts/{id}/review (review status + reason)
