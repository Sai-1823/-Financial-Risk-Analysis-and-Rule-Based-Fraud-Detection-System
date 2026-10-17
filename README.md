# Project 21: Financial Risk Analysis and Rule-Based Fraud Detection System

5-person team · Advanced difficulty

## Objective
Analyze synthetic financial transactions, calculate transparent risk indicators, and flag transactions that meet configurable anomaly rules for manual review.

## Tech stack
- Python 3.10+
- FastAPI (REST API)
- MySQL (database)
- Pandas / NumPy / Matplotlib (analytics & visualization)
- pytest (testing)

## Quick start

```bash
# Clone the repo
git clone https://github.com/Sai-1823/-Financial-Risk-Analysis-and-Rule-Based-Fraud-Detection-System.git
cd "-Financial-Risk-Analysis-and-Rule-Based-Fraud-Detection-System"

# Create virtual environment
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Set up environment
cp .env.example .env
# Edit .env with your MySQL credentials

# Run the API
uvicorn app.main:app --reload
```

## Team workflow
See `CONTRIBUTING.md` for Git branching, PR, and AI usage rules.

## Acceptance criteria
- Rules and scores are explainable
- False positives/negatives discussed
- Access and audit logs implemented
- No real banking data required (synthetic data only)
