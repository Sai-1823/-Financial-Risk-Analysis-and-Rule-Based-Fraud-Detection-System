export interface Customer {
  customer_id: number;
  customer_code: string;
  created_at: string;
}

export interface Account {
  account_id: number;
  customer_id: number;
  created_at: string;
}

export interface AlertSummary {
  alert_id: number;
  transaction_id: number;
  rule_name: string;
  risk_score: number;
  review_status: 'pending' | 'approved' | 'rejected';
  review_reason?: string;
  created_at: string;
}

export interface Transaction {
  transaction_id: number;
  account_id: number;
  customer_code?: string;
  transaction_datetime: string;
  amount: number;
  transaction_type: 'payment' | 'transfer' | 'withdrawal' | 'pos' | 'online';
  channel: 'web' | 'mobile_app' | 'atm' | 'pos' | 'wire';
  region_optional?: string;
  created_at: string;
  alerts?: AlertSummary[];
  is_flagged?: boolean;
  max_risk_score?: number;
}

export interface AlertItem {
  alert_id: number;
  transaction_id: number;
  customer_code: string;
  account_id: number;
  amount: number;
  channel: string;
  region?: string;
  transaction_datetime: string;
  rule_name: string;
  risk_score: number;
  review_status: 'pending' | 'approved' | 'rejected';
  review_reason?: string;
  created_at: string;
}

export interface AnalyticsSummary {
  total_transactions: number;
  total_alerts: number;
  high_risk_alerts: number;
  pending_reviews: number;
  approved_reviews: number;
  rejected_reviews: number;
  total_volume: number;
  average_amount: number;
  alert_rate_percentage: number;
  rule_breakdown: Record<string, number>;
  risk_histogram: Record<string, number>;
}

export interface TrendDataPoint {
  date: string;
  transactions: number;
  alerts: number;
  volume: number;
  avg_risk_score: number;
}

export interface RuleWeightConfig {
  unusual_amount: number;
  high_frequency: number;
  location_change: number;
  unusual_time: number;
  alert_threshold: number;
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  alert_id: number;
  transaction_id: number;
  customer_code: string;
  analyst: string;
  previous_status: string;
  new_status: 'pending' | 'approved' | 'rejected';
  reason: string;
}
