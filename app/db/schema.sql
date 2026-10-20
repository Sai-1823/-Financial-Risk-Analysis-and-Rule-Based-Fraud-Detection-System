-- MySQL schema for Project 21
-- Synthetic data only. No real banking data.

CREATE DATABASE IF NOT EXISTS fraud_detection;
USE fraud_detection;

CREATE TABLE IF NOT EXISTS customers (
    customer_id VARCHAR(36) PRIMARY KEY,
    customer_code VARCHAR(50) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS accounts (
    account_id VARCHAR(36) PRIMARY KEY,
    customer_id VARCHAR(36) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES customers(customer_id)
);

CREATE TABLE IF NOT EXISTS transactions (
    transaction_id VARCHAR(36) PRIMARY KEY,
    account_id VARCHAR(36) NOT NULL,
    transaction_datetime DATETIME NOT NULL,
    amount DECIMAL(15, 2) NOT NULL,
    transaction_type VARCHAR(50) NOT NULL,
    channel VARCHAR(50),
    region_optional VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (account_id) REFERENCES accounts(account_id)
);

CREATE TABLE IF NOT EXISTS alerts (
    alert_id VARCHAR(36) PRIMARY KEY,
    transaction_id VARCHAR(36) NOT NULL,
    rule_name VARCHAR(100) NOT NULL,
    risk_score DECIMAL(5, 2) NOT NULL,
    review_status VARCHAR(50) DEFAULT 'pending',
    review_reason TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (transaction_id) REFERENCES transactions(transaction_id)
);

-- Indexes for common queries
CREATE INDEX idx_transactions_account ON transactions(account_id);
CREATE INDEX idx_transactions_datetime ON transactions(transaction_datetime);
CREATE INDEX idx_alerts_status ON alerts(review_status);
CREATE INDEX idx_alerts_transaction ON alerts(transaction_id);
