# RiskShield: Financial Risk Analysis and Rule-Based Fraud Detection System

> **A 5-Person Student Team Engineering Project**  
> **Core Mandate:** Analyze synthetic financial transactions ONLY. Flags are raised for human manual review. **Never** label transactions as "confirmed fraud".

---

## ⚡ How to Run in 5 Minutes

### 1. Backend Quickstart (Python FastAPI)

```bash
# 1. Clone repository and navigate to root
cd project-21-fraud-detection

# 2. Create and activate a Python virtual environment
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# 3. Install dependencies
pip install -r requirements.txt

# 4. Copy environment template (defaults to zero-config SQLite: project21.db)
cp .env.example .env

# 5. Seed synthetic data (500 transactions with seeded anomalies)
python -m app.db.seed

# 6. Start the FastAPI server
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

- **Swagger API Documentation:** [http://localhost:8000/docs](http://localhost:8000/docs)
- **Healthcheck:** [http://localhost:8000/health](http://localhost:8000/health)

### 2. Frontend Quickstart (Vite / React Dashboard)

```bash
# Install Node dependencies and launch interactive dashboard
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.  
> **Note on Backend Fallback:** If the FastAPI backend is not running, the dashboard automatically activates **Interactive Simulation & Demo Mode** with real-time rule scanning, instant review status updates, and dynamic charts.

---

## 👥 5-Person Team Structure & Role Ownership

| Team Role | Primary Owner | Core Deliverables & Files |
| :--- | :--- | :--- |
| **1. Data & Schema Engineer** | Role 1 | `app/db/database.py`, `app/db/schema.py`, `app/db/seed.py`, migrations, synthetic transaction generation |
| **2. Backend API Engineer** | Role 2 | `app/main.py`, `app/api/transactions.py`, `app/api/alerts.py`, CORS, Pydantic validation |
| **3. Rule Engine Specialist** | Role 3 | `app/rules/engine.py`, mathematical scoring formulas, contextual anomaly definitions |
| **4. Analytics & Viz Engineer** | Role 4 | `app/api/analytics.py`, Chart.js visualizations, risk score histograms, trend lines, KPI cards |
| **5. QA & Test Automation** | Role 5 | `tests/test_rules.py`, `tests/test_api.py`, pytest test suites, synthetic edge case verification |

---

## 🗄️ Database Architecture: SQLite & MySQL

The database layer uses **SQLAlchemy 2.0 ORM** with automated schema bootstrapping on startup.

- **Default Engine (Zero-Config):** SQLite (`sqlite:///./project21.db`). No external database installation needed!
- **Production / MySQL Mode:** To connect to a MySQL instance, configure your `.env`:
  ```ini
  DATABASE_URL=mysql+mysqlconnector://user:password@localhost:3306/fraud_db
  ```
  The application automatically switches between drivers without requiring code changes.

### Schema Entities

1. `customers` (`customer_id` PK, `customer_code`, `created_at`)
2. `accounts` (`account_id` PK, `customer_id` FK, `created_at`)
3. `transactions` (`transaction_id` PK, `account_id` FK, `transaction_datetime`, `amount`, `transaction_type`, `channel`, `region_optional`, `created_at`)
4. `alerts` (`alert_id` PK, `transaction_id` FK, `rule_name`, `risk_score`, `review_status` DEFAULT `'pending'`, `review_reason`, `created_at`)

---

## 🧠 Rule Engine Specification & Scoring Weights

Each transaction is evaluated in the context of the customer's historical behavior:

| Heuristic | Trigger Condition | Weight | Rationale |
| :--- | :--- | :--- | :--- |
| **Unusual Amount** | `amount > 3.0 * customer_historical_average` | **0.40** | High-magnitude spikes indicate account takeovers or uncharacteristic transfers. |
| **High Frequency** | `> 5 transactions in trailing 60 minutes` | **0.30** | Rapid burst velocity indicates automated bot testing or card skimming cashouts. |
| **Location Change** | `region_optional not in customer_history` | **0.20** | Geographical divergence indicates compromised credentials from unknown IP/region. |
| **Unusual Time** | `transaction hour < 06:00 or >= 22:00` | **0.10** | Nocturnal off-peak transactions have higher statistical anomaly probability. |

- **Alert Threshold:** Composite Risk Score **> 0.30** triggers an alert entry in the queue.
- **Risk Score Bands:**
  - 🟢 **Low / Benign:** `0.00 - 0.39`
  - 🟡 **Medium Review:** `0.40 - 0.69`
  - 🔴 **High Priority Review:** `0.70 - 1.00`

---

## 📡 API Endpoint Reference

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/health` | System status, DB connectivity, and dialect |
| `GET` | `/rules` | Retrieve rule names, weights, and conditions |
| `POST` | `/seed?count=500` | Regenerate synthetic dataset with anomalies |
| `GET` | `/transactions` | List transactions with filters (`min_amount`, `max_amount`, `channel`, `flagged_only`, pagination) |
| `POST` | `/transactions` | Batch import transactions; runs rule engine and generates alerts |
| `GET` | `/transactions/{id}` | Detailed single transaction view with associated alerts |
| `GET` | `/alerts` | Review queue filtered by `status` (pending/approved/rejected) |
| `PATCH` | `/alerts/{id}/review`| Analyst triage: update review status (`pending`, `approved`, `rejected`) + reason |
| `GET` | `/analytics/summary` | Global KPIs, rule breakdowns, risk score histogram |
| `GET` | `/analytics/trends` | 14-day daily time series of volume and alerts |

---

## 🧪 Running Automated Tests

Run the complete test suite with `pytest`:

```bash
# Run all tests
pytest -v

# Run rule engine tests only
pytest tests/test_rules.py -v

# Run API endpoint tests only
pytest tests/test_api.py -v
```

---

## 🛡️ Ethical Notice

This software is designed exclusively for educational and risk-scoring evaluation purposes using synthetic data. In strict accordance with anti-bias and privacy regulations, rule triggers **never convict** or permanently freeze accounts without manual compliance review.
