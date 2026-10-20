# RiskShield: Evaluation Report on Rule-Based Fraud Detection System

**Author:** 5-Person Engineering Team  
**Evaluation Date:** October 2026  
**Scope:** Performance, Error Analysis, and Theoretical Limitations of Heuristic-Based Transaction Screening on Synthetic Financial Datasets.

---

## 1. Executive Summary

This evaluation analyzes the efficacy and operational trade-offs of the rule-based fraud detection architecture implemented in **RiskShield**. Utilizing a deterministic four-factor heuristic engine, the system processed **500 synthetic transactions** across 25 customer profiles, evaluating each against contextual behavioral baselines.

### Primary System Directive
The system serves as a **triage filter for manual compliance review**. In compliance with legal fair-lending and consumer banking mandates, transactions exceeding the composite risk threshold of **0.30** are flagged as alerts and staged in a human-in-the-loop review queue. Under no circumstance does the automated system label a transaction as "confirmed fraud".

---

## 2. Experimental Setup & Synthetic Dataset Profile

The evaluation dataset was generated using `app/db/seed.py` with reproducible random seeds:
- **Total Synthetic Transactions:** 500
- **Benign Baseline Transactions:** ~420 (84%)
- **Deliberately Injected Anomalies:** ~80 (16%)
  - *Outlier Spend:* 25 instances (>3x to 12x historical mean)
  - *Velocity Bursts:* 28 instances (4 bursts of 7 rapid transactions in < 25 minutes)
  - *Geographical Divergence:* 20 instances (unseen international / remote regions)
  - *Nocturnal Activity:* 20 instances (executed between 01:00 AM and 05:00 AM)
  - *Compound High-Risk Injections:* 12 instances (combination of 3+ rules firing simultaneously)

---

## 3. Heuristic Performance Matrix

| Rule | Mathematical Condition | Weight | Primary Vulnerability | Observed Alert Yield |
| :--- | :--- | :---: | :--- | :---: |
| **Unusual Amount** | `amount > 3.0 * avg(customer_history)` | `0.40` | Insensitive to low-dollar micro-theft; vulnerable to legitimate infrequent capital purchases. | ~26 alerts |
| **High Frequency** | `count(account_tx_last_60m) > 5` | `0.30` | Blind to slow-drip automated draining below 1 transaction per 12 minutes. | ~18 alerts |
| **Location Change** | `region ∉ customer_known_regions` | `0.20` | High false positive rate for business travelers or holiday transit. | ~22 alerts |
| **Unusual Time** | `hour < 6 or hour >= 22` | `0.10` | Disproportionately flags night-shift workers, international time zone travelers, or scheduled SaaS bills. | ~24 alerts |

---

## 4. Error Analysis: False Positives vs. False Negatives

### 4.1 False Positive Case Studies (FPs)
A false positive occurs when legitimate customer behavior triggers a risk score > 0.30, imposing friction and manual review costs on both the institution and the end-user.

1. **The Holiday Shopping Spike:**
   - *Scenario:* A customer whose average monthly transaction is $45 purchases an appliance for $480 on Black Friday.
   - *Result:* Triggers `unusual_amount` (0.40). Risk score = 0.40.
   - *Impact:* Transaction flagged. The cardholder experiences temporary review delay despite authentic intent.
2. **Business Travel to New City / Region:**
   - *Scenario:* Customer normally transacting in `US-East` travels to Singapore (`APAC-SG`) for an international conference and buys coffee at 11:00 PM local time.
   - *Result:* Triggers `location_change` (0.20) and `unusual_time` (0.10). Risk score = 0.30.
   - *Impact:* Borderline flag requiring manual verification.

### 4.2 False Negative Case Studies (FNs)
A false negative occurs when malicious behavior slips undetected below the rule thresholds.

1. **Sub-Threshold Smurfing / Micro-Draining:**
   - *Attacker Strategy:* Bad actor captures stolen credentials and initiates transactions of $80 every 2 hours, well below 3x average and well below the 5-tx/hour limit.
   - *Result:* 0 rules trigger. Risk score = 0.00. Malicious draining proceeds unflagged.
2. **Local Session Spoofing / Proxy Evasion:**
   - *Attacker Strategy:* Attacker routes automated checkout through a residential proxy matching the victim's home city (`US-East`) at 2:00 PM.
   - *Result:* Region matches, time is normal. Only triggered if amount exceeds 3x. If the attacker purchases $120 gift cards, the transaction goes completely undetected.

---

## 5. Fundamental Limitations of Heuristic-Based Detection

1. **Static, Rigid Boundary Thresholds:**
   A transaction of $299.99 for a customer with a $100 average scores `0.00`, whereas $300.01 scores `0.40`. Hard threshold cliffs create easy targets for adversarial reverse-engineering.
2. **Lack of Cross-Feature Dimensionality:**
   Heuristic rules score independently and sum linearly ($S = \sum w_i$). They cannot capture non-linear relationships, such as the statistical interaction between Merchant Category Code (MCC) and device fingerprinting.
3. **Cold Start & Baseline Drift:**
   New customers have negligible transaction history, distorting the customer average and producing elevated false positive spikes during onboarding.
4. **Maintenance Overhead:**
   As fraud patterns evolve, maintaining dozens of static SQL/Python rules results in rule bloat, conflicting priorities, and high computational latency.

---

## 6. Recommendations for Next-Generation Upgrades (Phase 2)

1. **Transition to Adaptive Exponential Moving Averages (EMA):**
   Replace static averages with recency-weighted decay so gradual lifestyle changes do not trigger false alerts.
2. **Unsupervised Anomaly Detection:**
   Implement **Isolation Forests** or **Autoencoders** to evaluate multidimensional distance from cluster centroids without requiring labeled fraud data.
3. **Graph Analysis for Mules & Synthetic IDs:**
   Use graph database modeling (e.g. Neo4j / NetworkX) to uncover circular fund routing between interconnected synthetic accounts.
4. **Human Review Feedback Loop:**
   Feed analyst decisions (`approved` vs. `rejected`) back into an XGBoost classifier to iteratively reweight rules based on actual verification outcomes.

---

## 7. Conclusion

The rule-based architecture of RiskShield provides a deterministic, transparent, and auditable foundation suitable for manual triage in regulated financial environments. While static rules suffer from clear false-positive and evasion boundaries, pairing this engine with a responsive analyst review queue effectively balances automated risk scoring with human discretion.
