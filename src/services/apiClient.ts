/**
 * API Client supporting both live FastAPI backend (http://localhost:8000)
 * and graceful fallback to standalone client simulation.
 */

import { Transaction, AlertItem, AnalyticsSummary, TrendDataPoint, RuleWeightConfig } from '../types';

const API_BASE_URL = 'http://localhost:8000';

export interface BackendStatus {
  isOnline: boolean;
  dbDialect?: string;
  lastChecked: Date;
  error?: string;
}

export async function checkBackendHealth(): Promise<BackendStatus> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 1500);

    const res = await fetch(`${API_BASE_URL}/health`, {
      method: 'GET',
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      return {
        isOnline: true,
        dbDialect: data.database_url_type || 'sqlite',
        lastChecked: new Date(),
      };
    }
    return {
      isOnline: false,
      lastChecked: new Date(),
      error: `Server returned status ${res.status}`,
    };
  } catch (err: any) {
    return {
      isOnline: false,
      lastChecked: new Date(),
      error: err.message || 'Connection refused (Backend offline)',
    };
  }
}

export async function fetchLiveTransactions(params: {
  account_id?: number;
  min_amount?: number;
  max_amount?: number;
  channel?: string;
  transaction_type?: string;
  flagged_only?: boolean;
  search?: string;
  limit?: number;
  offset?: number;
}): Promise<{ total: number; items: Transaction[] } | null> {
  try {
    const query = new URLSearchParams();
    if (params.account_id) query.set('account_id', params.account_id.toString());
    if (params.min_amount) query.set('min_amount', params.min_amount.toString());
    if (params.max_amount) query.set('max_amount', params.max_amount.toString());
    if (params.channel) query.set('channel', params.channel);
    if (params.transaction_type) query.set('transaction_type', params.transaction_type);
    if (params.flagged_only) query.set('flagged_only', 'true');
    if (params.search) query.set('search', params.search);
    if (params.limit) query.set('limit', params.limit.toString());
    if (params.offset) query.set('offset', params.offset.toString());

    const res = await fetch(`${API_BASE_URL}/transactions?${query.toString()}`);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function postLiveTransactionsBatch(
  transactions: Array<{
    account_id: number;
    amount: number;
    transaction_type?: string;
    channel?: string;
    region_optional?: string;
    transaction_datetime?: string;
  }>
): Promise<any | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/transactions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(transactions),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function fetchLiveAlerts(params: {
  status?: string;
  rule_name?: string;
  min_score?: number;
  limit?: number;
  offset?: number;
}): Promise<{ total: number; items: AlertItem[] } | null> {
  try {
    const query = new URLSearchParams();
    if (params.status) query.set('status', params.status);
    if (params.rule_name) query.set('rule_name', params.rule_name);
    if (params.min_score) query.set('min_score', params.min_score.toString());
    if (params.limit) query.set('limit', params.limit.toString());
    if (params.offset) query.set('offset', params.offset.toString());

    const res = await fetch(`${API_BASE_URL}/alerts?${query.toString()}`);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function patchLiveAlertReview(
  alertId: number,
  reviewStatus: 'pending' | 'approved' | 'rejected',
  reviewReason?: string
): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE_URL}/alerts/${alertId}/review`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ review_status: reviewStatus, review_reason: reviewReason }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function fetchLiveAnalyticsSummary(): Promise<AnalyticsSummary | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/analytics/summary`);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function fetchLiveAnalyticsTrends(): Promise<TrendDataPoint[] | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/analytics/trends?days=14`);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function triggerLiveSeed(count = 500): Promise<any | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/seed?count=${count}`, {
      method: 'POST',
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}
