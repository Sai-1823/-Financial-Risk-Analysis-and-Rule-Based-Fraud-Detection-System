import { Transaction, AlertItem, RuleWeightConfig, AuditLogEntry, AnalyticsSummary, TrendDataPoint } from '../types';

export const DEFAULT_WEIGHTS: RuleWeightConfig = {
  unusual_amount: 0.40,
  high_frequency: 0.30,
  location_change: 0.20,
  unusual_time: 0.10,
  alert_threshold: 0.30,
};

const CHANNELS: Array<Transaction['channel']> = ['web', 'mobile_app', 'atm', 'pos', 'wire'];
const TYPES: Array<Transaction['transaction_type']> = ['payment', 'transfer', 'withdrawal', 'pos', 'online'];
const PRIMARY_REGIONS = ['US-East', 'US-West', 'US-Central', 'EU-West', 'APAC-SG'];
const ANOMALY_REGIONS = ['RU-East', 'AF-North', 'SA-East', 'ME-Central', 'CY-South'];

export interface RuleEvaluationResult {
  score: number;
  triggeredRules: string[];
  reasons: string[];
}

export function evaluateTransactionRules(
  tx: {
    amount: number;
    transaction_datetime: string;
    region_optional?: string;
    account_id: number;
  },
  context: {
    customer_avg_amount: number;
    recent_60m_count: number;
    known_regions: string[];
  },
  weights: RuleWeightConfig = DEFAULT_WEIGHTS
): RuleEvaluationResult {
  const effectiveWeights: RuleWeightConfig = {
    unusual_amount: typeof weights?.unusual_amount === 'number' ? weights.unusual_amount : DEFAULT_WEIGHTS.unusual_amount,
    high_frequency: typeof weights?.high_frequency === 'number' ? weights.high_frequency : DEFAULT_WEIGHTS.high_frequency,
    location_change: typeof weights?.location_change === 'number' ? weights.location_change : DEFAULT_WEIGHTS.location_change,
    unusual_time: typeof weights?.unusual_time === 'number' ? weights.unusual_time : DEFAULT_WEIGHTS.unusual_time,
    alert_threshold: typeof weights?.alert_threshold === 'number' ? weights.alert_threshold : DEFAULT_WEIGHTS.alert_threshold,
  };

  const triggeredRules: string[] = [];
  const reasons: string[] = [];
  let score = 0.0;

  const dt = new Date(tx.transaction_datetime);
  const hour = isNaN(dt.getHours()) ? new Date().getHours() : dt.getHours();

  const numAmount = Number(tx.amount) || 0;
  const numAvg = Number(context.customer_avg_amount) || 0;

  // Rule 1: Unusual Amount (Weight: unusual_amount, condition: > 3x average)
  if (numAvg > 0 && numAmount > 3.0 * numAvg) {
    score += effectiveWeights.unusual_amount;
    triggeredRules.push('unusual_amount');
    const ratio = (numAmount / numAvg).toFixed(1);
    reasons.push(
      `Amount ₹${numAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })} exceeds 3x customer average (₹${numAvg.toFixed(2)}) by ${ratio}x`
    );
  }

  // Rule 2: High Frequency (Weight: high_frequency, condition: > 5 tx in 60m)
  if (Number(context.recent_60m_count) > 5) {
    score += effectiveWeights.high_frequency;
    triggeredRules.push('high_frequency');
    reasons.push(
      `High frequency velocity: ${context.recent_60m_count} transactions recorded in trailing 60m (threshold > 5)`
    );
  }

  // Rule 3: Location Change (Weight: location_change, condition: region not in customer history)
  if (
    tx.region_optional &&
    context.known_regions &&
    context.known_regions.length > 0 &&
    !context.known_regions.includes(tx.region_optional)
  ) {
    score += effectiveWeights.location_change;
    triggeredRules.push('location_change');
    reasons.push(
      `Unfamiliar geographical region '${tx.region_optional}' not in customer's prior transaction history (${context.known_regions.join(', ')})`
    );
  }

  // Rule 4: Unusual Time (Weight: unusual_time, condition: hour < 6 or hour >= 22)
  if (hour < 6 || hour >= 22) {
    score += effectiveWeights.unusual_time;
    triggeredRules.push('unusual_time');
    reasons.push(
      `Off-hours nocturnal execution at ${hour.toString().padStart(2, '0')}:${dt.getMinutes().toString().padStart(2, '0')} (window: 22:00 - 06:00)`
    );
  }

  const finalScore = Math.min(1.0, Math.round(score * 100) / 100);
  return {
    score: isNaN(finalScore) ? 0.0 : finalScore,
    triggeredRules,
    reasons,
  };
}

export interface SyntheticDataset {
  transactions: Transaction[];
  alerts: AlertItem[];
  auditLogs: AuditLogEntry[];
}

export function generateSyntheticDataset(targetCount = 500, weights = DEFAULT_WEIGHTS): SyntheticDataset {
  const transactions: Transaction[] = [];
  const alerts: AlertItem[] = [];
  const auditLogs: AuditLogEntry[] = [];

  const customerCount = 25;
  const customers = Array.from({ length: customerCount }, (_, i) => ({
    id: i + 1,
    code: `CUST-${1001 + i}`,
    homeRegion: PRIMARY_REGIONS[i % PRIMARY_REGIONS.length],
    minAmount: 18 + (i % 5) * 5,
    maxAmount: 85 + (i % 7) * 20,
    amounts: [] as number[],
  }));

  const accounts = customers.flatMap((c) => [
    { accountId: c.id * 10 + 1, customerId: c.id, customerCode: c.code },
    ...(c.id % 3 === 0 ? [{ accountId: c.id * 10 + 2, customerId: c.id, customerCode: c.code }] : []),
  ]);

  const now = new Date();
  let nextTxId = 1;
  let nextAlertId = 1;

  // 1. Generate ~410 Benign Transactions
  const benignCount = Math.floor(targetCount * 0.82);
  for (let i = 0; i < benignCount; i++) {
    const acc = accounts[Math.floor(Math.random() * accounts.length)];
    const cust = customers.find((c) => c.id === acc.customerId)!;

    const daysAgo = Math.random() * 26 + 0.1;
    const txTime = new Date(now.getTime() - daysAgo * 86400000);
    // daytime 07:00 to 21:00
    txTime.setHours(Math.floor(Math.random() * 14) + 7);
    txTime.setMinutes(Math.floor(Math.random() * 60));

    const amt = Math.round((Math.random() * (cust.maxAmount - cust.minAmount) + cust.minAmount) * 100) / 100;
    cust.amounts.push(amt);

    transactions.push({
      transaction_id: nextTxId++,
      account_id: acc.accountId,
      customer_code: acc.customerCode,
      transaction_datetime: txTime.toISOString(),
      amount: amt,
      transaction_type: TYPES[Math.floor(Math.random() * TYPES.length)],
      channel: CHANNELS[Math.floor(Math.random() * CHANNELS.length)],
      region_optional: cust.homeRegion,
      created_at: txTime.toISOString(),
      alerts: [],
      is_flagged: false,
      max_risk_score: 0.0,
    });
  }

  // 2. Anomaly: Outlier Spikes (amount > 3x average)
  for (let i = 0; i < 24; i++) {
    const acc = accounts[Math.floor(Math.random() * accounts.length)];
    const cust = customers.find((c) => c.id === acc.customerId)!;
    const avg = cust.amounts.length > 0 ? cust.amounts.reduce((a, b) => a + b, 0) / cust.amounts.length : 80;
    const outlierAmt = Math.round(avg * (4.2 + Math.random() * 7.5) * 100) / 100;

    const daysAgo = Math.random() * 20 + 0.5;
    const txTime = new Date(now.getTime() - daysAgo * 86400000);
    txTime.setHours(Math.floor(Math.random() * 8) + 10); // daytime

    transactions.push({
      transaction_id: nextTxId++,
      account_id: acc.accountId,
      customer_code: acc.customerCode,
      transaction_datetime: txTime.toISOString(),
      amount: outlierAmt,
      transaction_type: 'transfer',
      channel: Math.random() > 0.5 ? 'wire' : 'web',
      region_optional: cust.homeRegion,
      created_at: txTime.toISOString(),
      alerts: [],
      is_flagged: false,
      max_risk_score: 0.0,
    });
  }

  // 3. Anomaly: Rapid Burst Transactions (>5 in 60m)
  for (let b = 0; b < 4; b++) {
    const acc = accounts[Math.floor(Math.random() * accounts.length)];
    const cust = customers.find((c) => c.id === acc.customerId)!;
    const baseTime = new Date(now.getTime() - (Math.random() * 12 + 1) * 86400000);
    baseTime.setHours(14, 10, 0);

    for (let k = 0; k < 7; k++) {
      const burstTime = new Date(baseTime.getTime() + k * 4 * 60000);
      const amt = Math.round((25 + Math.random() * 60) * 100) / 100;
      transactions.push({
        transaction_id: nextTxId++,
        account_id: acc.accountId,
        customer_code: acc.customerCode,
        transaction_datetime: burstTime.toISOString(),
        amount: amt,
        transaction_type: k % 2 === 0 ? 'pos' : 'online',
        channel: 'mobile_app',
        region_optional: cust.homeRegion,
        created_at: burstTime.toISOString(),
        alerts: [],
        is_flagged: false,
        max_risk_score: 0.0,
      });
    }
  }

  // 4. Anomaly: Foreign Unfamiliar Region
  for (let i = 0; i < 20; i++) {
    const acc = accounts[Math.floor(Math.random() * accounts.length)];
    const foreignRegion = ANOMALY_REGIONS[i % ANOMALY_REGIONS.length];
    const daysAgo = Math.random() * 18 + 1;
    const txTime = new Date(now.getTime() - daysAgo * 86400000);
    txTime.setHours(15, 20);

    transactions.push({
      transaction_id: nextTxId++,
      account_id: acc.accountId,
      customer_code: acc.customerCode,
      transaction_datetime: txTime.toISOString(),
      amount: Math.round((95 + Math.random() * 220) * 100) / 100,
      transaction_type: 'online',
      channel: 'web',
      region_optional: foreignRegion,
      created_at: txTime.toISOString(),
      alerts: [],
      is_flagged: false,
      max_risk_score: 0.0,
    });
  }

  // 5. Anomaly: Nocturnal Off-Hours Transactions (02:00 - 04:30 AM)
  for (let i = 0; i < 18; i++) {
    const acc = accounts[Math.floor(Math.random() * accounts.length)];
    const cust = customers.find((c) => c.id === acc.customerId)!;
    const daysAgo = Math.random() * 22 + 1;
    const txTime = new Date(now.getTime() - daysAgo * 86400000);
    txTime.setHours(Math.random() > 0.5 ? 2 : 3, Math.floor(Math.random() * 50));

    transactions.push({
      transaction_id: nextTxId++,
      account_id: acc.accountId,
      customer_code: acc.customerCode,
      transaction_datetime: txTime.toISOString(),
      amount: Math.round((35 + Math.random() * 95) * 100) / 100,
      transaction_type: 'withdrawal',
      channel: 'atm',
      region_optional: cust.homeRegion,
      created_at: txTime.toISOString(),
      alerts: [],
      is_flagged: false,
      max_risk_score: 0.0,
    });
  }

  // 6. Anomaly: High Risk Compound (>0.70 score)
  for (let i = 0; i < 12; i++) {
    const acc = accounts[Math.floor(Math.random() * accounts.length)];
    const cust = customers.find((c) => c.id === acc.customerId)!;
    const avg = cust.amounts.length > 0 ? cust.amounts.reduce((a, b) => a + b, 0) / cust.amounts.length : 70;
    const daysAgo = Math.random() * 10 + 0.5;
    const txTime = new Date(now.getTime() - daysAgo * 86400000);
    txTime.setHours(3, Math.floor(Math.random() * 50)); // 3 AM

    transactions.push({
      transaction_id: nextTxId++,
      account_id: acc.accountId,
      customer_code: acc.customerCode,
      transaction_datetime: txTime.toISOString(),
      amount: Math.round(avg * (5.5 + Math.random() * 6.0) * 100) / 100,
      transaction_type: 'transfer',
      channel: 'web',
      region_optional: ANOMALY_REGIONS[Math.floor(Math.random() * ANOMALY_REGIONS.length)],
      created_at: txTime.toISOString(),
      alerts: [],
      is_flagged: false,
      max_risk_score: 0.0,
    });
  }

  // Sort chronologically
  transactions.sort(
    (a, b) => new Date(a.transaction_datetime).getTime() - new Date(b.transaction_datetime).getTime()
  );

  // Evaluate rules with temporal context
  const customerAmounts: Record<string, number[]> = {};
  const customerRegions: Record<string, Set<string>> = {};
  const accountTimestamps: Record<number, number[]> = {};

  for (const tx of transactions) {
    const custCode = tx.customer_code || 'CUST-1001';
    if (!customerAmounts[custCode]) {
      customerAmounts[custCode] = [];
      customerRegions[custCode] = new Set();
    }
    if (!accountTimestamps[tx.account_id]) {
      accountTimestamps[tx.account_id] = [];
    }

    const txTimeMs = new Date(tx.transaction_datetime).getTime();
    const historyAmounts = customerAmounts[custCode];
    const avgAmount =
      historyAmounts.length > 0 ? historyAmounts.reduce((a, b) => a + b, 0) / historyAmounts.length : 0;

    // Count tx in past 60 min (3600000 ms)
    const recent60m = accountTimestamps[tx.account_id].filter(
      (t) => txTimeMs - t >= 0 && txTimeMs - t <= 3600000
    ).length;

    const knownRegions = Array.from(customerRegions[custCode]);

    const { score, triggeredRules, reasons } = evaluateTransactionRules(
      {
        amount: tx.amount,
        transaction_datetime: tx.transaction_datetime,
        region_optional: tx.region_optional,
        account_id: tx.account_id,
      },
      {
        customer_avg_amount: avgAmount,
        recent_60m_count: recent60m,
        known_regions: knownRegions,
      },
      weights
    );

    // Update history
    customerAmounts[custCode].push(tx.amount);
    if (tx.region_optional) {
      customerRegions[custCode].add(tx.region_optional);
    }
    accountTimestamps[tx.account_id].push(txTimeMs);

    tx.max_risk_score = score;
    tx.is_flagged = score > weights.alert_threshold;

    if (score > weights.alert_threshold && triggeredRules.length > 0) {
      const primaryRule = triggeredRules.length === 1 ? triggeredRules[0] : 'multi_rule';
      const initialStatus: 'pending' | 'approved' | 'rejected' =
        alerts.length % 5 === 0 ? 'approved' : alerts.length % 8 === 0 ? 'rejected' : 'pending';

      const alertItem: AlertItem = {
        alert_id: nextAlertId++,
        transaction_id: tx.transaction_id,
        customer_code: custCode,
        account_id: tx.account_id,
        amount: tx.amount,
        channel: tx.channel,
        region: tx.region_optional,
        transaction_datetime: tx.transaction_datetime,
        rule_name: primaryRule,
        risk_score: score,
        review_status: initialStatus,
        review_reason: reasons.join('; '),
        created_at: tx.transaction_datetime,
      };

      alerts.push(alertItem);
      tx.alerts = [
        {
          alert_id: alertItem.alert_id,
          transaction_id: tx.transaction_id,
          rule_name: primaryRule,
          risk_score: score,
          review_status: initialStatus,
          review_reason: alertItem.review_reason,
          created_at: alertItem.created_at,
        },
      ];

      if (initialStatus !== 'pending') {
        auditLogs.push({
          id: `audit-${auditLogs.length + 1}`,
          timestamp: new Date(txTimeMs + 7200000).toISOString(),
          alert_id: alertItem.alert_id,
          transaction_id: tx.transaction_id,
          customer_code: custCode,
          analyst: 'Compliance Officer Alex R.',
          previous_status: 'pending',
          new_status: initialStatus,
          reason:
            initialStatus === 'approved'
              ? 'Cardholder confirmed travel and authentic authorization via mobile 2FA.'
              : 'Cardholder confirmed unauthorized device card test. Account blocked.',
        });
      }
    }
  }

  return { transactions, alerts, auditLogs };
}

export function computeAnalytics(transactions: Transaction[], alerts: AlertItem[]): AnalyticsSummary {
  const totalVolume = transactions.reduce((acc, t) => acc + t.amount, 0);
  const avgAmount = transactions.length > 0 ? totalVolume / transactions.length : 0;

  const highRisk = alerts.filter((a) => a.risk_score >= 0.70).length;
  const pending = alerts.filter((a) => a.review_status === 'pending').length;
  const approved = alerts.filter((a) => a.review_status === 'approved').length;
  const rejected = alerts.filter((a) => a.review_status === 'rejected').length;

  const ruleBreakdown: Record<string, number> = {
    unusual_amount: 0,
    high_frequency: 0,
    location_change: 0,
    unusual_time: 0,
    multi_rule: 0,
  };

  alerts.forEach((a) => {
    ruleBreakdown[a.rule_name] = (ruleBreakdown[a.rule_name] || 0) + 1;
  });

  const buckets: Record<string, number> = {
    'Low (0.30 - 0.45)': 0,
    'Moderate (0.45 - 0.65)': 0,
    'Elevated (0.65 - 0.80)': 0,
    'Critical (0.80 - 1.00)': 0,
  };

  alerts.forEach((a) => {
    const s = a.risk_score;
    if (s >= 0.30 && s < 0.45) buckets['Low (0.30 - 0.45)']++;
    else if (s >= 0.45 && s < 0.65) buckets['Moderate (0.45 - 0.65)']++;
    else if (s >= 0.65 && s < 0.80) buckets['Elevated (0.65 - 0.80)']++;
    else if (s >= 0.80) buckets['Critical (0.80 - 1.00)']++;
  });

  return {
    total_transactions: transactions.length,
    total_alerts: alerts.length,
    high_risk_alerts: highRisk,
    pending_reviews: pending,
    approved_reviews: approved,
    rejected_reviews: rejected,
    total_volume: Math.round(totalVolume * 100) / 100,
    average_amount: Math.round(avgAmount * 100) / 100,
    alert_rate_percentage:
      transactions.length > 0 ? Math.round((alerts.length / transactions.length) * 1000) / 10 : 0,
    rule_breakdown: ruleBreakdown,
    risk_histogram: buckets,
  };
}

export function computeDailyTrends(transactions: Transaction[], alerts: AlertItem[], days = 14): TrendDataPoint[] {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);

  const datesMap: Record<string, { transactions: number; alerts: number; volume: number; scores: number[] }> = {};

  for (let i = 0; i <= days; i++) {
    const d = new Date(cutoff);
    d.setDate(d.getDate() + i);
    const key = d.toISOString().split('T')[0];
    datesMap[key] = { transactions: 0, alerts: 0, volume: 0, scores: [] };
  }

  transactions.forEach((tx) => {
    const key = tx.transaction_datetime.split('T')[0];
    if (datesMap[key]) {
      datesMap[key].transactions++;
      datesMap[key].volume += tx.amount;
    }
  });

  alerts.forEach((a) => {
    const key = a.created_at.split('T')[0];
    if (datesMap[key]) {
      datesMap[key].alerts++;
      datesMap[key].scores.push(a.risk_score);
    }
  });

  return Object.entries(datesMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, data]) => {
      const avgScore =
        data.scores.length > 0 ? data.scores.reduce((sum, s) => sum + s, 0) / data.scores.length : 0;
      return {
        date: date.slice(5), // MM-DD for clean chart label
        transactions: data.transactions,
        alerts: data.alerts,
        volume: Math.round(data.volume),
        avg_risk_score: Math.round(avgScore * 100) / 100,
      };
    });
}
