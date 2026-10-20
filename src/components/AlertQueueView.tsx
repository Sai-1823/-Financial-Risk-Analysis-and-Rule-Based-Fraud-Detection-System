import React, { useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  Filter,
  Save,
  ShieldCheck,
  Search,
  MessageSquare,
  Sparkles,
  Info,
} from 'lucide-react';
import { AlertItem } from '../types';

interface AlertQueueViewProps {
  alerts: AlertItem[];
  onReviewAlert: (
    alertId: number,
    status: 'pending' | 'approved' | 'rejected',
    reason: string
  ) => Promise<void>;
  onBulkApproveLowRisk: () => void;
}

export const AlertQueueView: React.FC<AlertQueueViewProps> = ({
  alerts,
  onReviewAlert,
  onBulkApproveLowRisk,
}) => {
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending');
  const [searchTerm, setSearchTerm] = useState('');
  const [riskFilter, setRiskFilter] = useState<'all' | 'low' | 'medium' | 'high'>('all');

  // Draft edits map: alertId -> { status, reason, saving }
  const [draftEdits, setDraftEdits] = useState<
    Record<number, { status: 'pending' | 'approved' | 'rejected'; reason: string; isSaving?: boolean }>
  >({});

  const filteredAlerts = alerts.filter((alert) => {
    if (statusFilter !== 'all' && alert.review_status !== statusFilter) return false;
    if (riskFilter === 'low' && alert.risk_score >= 0.40) return false;
    if (riskFilter === 'medium' && (alert.risk_score < 0.40 || alert.risk_score >= 0.70)) return false;
    if (riskFilter === 'high' && alert.risk_score < 0.70) return false;

    if (searchTerm) {
      const lower = searchTerm.toLowerCase();
      const matchCust = alert.customer_code.toLowerCase().includes(lower);
      const matchRule = alert.rule_name.toLowerCase().includes(lower);
      const matchReason = alert.review_reason?.toLowerCase().includes(lower);
      const matchId = alert.alert_id.toString().includes(lower);
      if (!matchCust && !matchRule && !matchReason && !matchId) return false;
    }
    return true;
  });

  const getDraft = (alert: AlertItem) => {
    return (
      draftEdits[alert.alert_id] || {
        status: alert.review_status,
        reason: alert.review_reason || '',
        isSaving: false,
      }
    );
  };

  const handleStatusChange = (alertId: number, newStatus: 'pending' | 'approved' | 'rejected') => {
    setDraftEdits((prev) => {
      const current = prev[alertId] || {
        status: alerts.find((a) => a.alert_id === alertId)?.review_status || 'pending',
        reason: alerts.find((a) => a.alert_id === alertId)?.review_reason || '',
      };
      return {
        ...prev,
        [alertId]: { ...current, status: newStatus },
      };
    });
  };

  const handleReasonChange = (alertId: number, newReason: string) => {
    setDraftEdits((prev) => {
      const current = prev[alertId] || {
        status: alerts.find((a) => a.alert_id === alertId)?.review_status || 'pending',
        reason: '',
      };
      return {
        ...prev,
        [alertId]: { ...current, reason: newReason },
      };
    });
  };

  const handleSave = async (alert: AlertItem) => {
    const draft = getDraft(alert);
    setDraftEdits((prev) => ({
      ...prev,
      [alert.alert_id]: { ...draft, isSaving: true },
    }));

    try {
      await onReviewAlert(alert.alert_id, draft.status, draft.reason);
    } finally {
      setDraftEdits((prev) => {
        const copy = { ...prev };
        delete copy[alert.alert_id];
        return copy;
      });
    }
  };

  // Helper for quick pre-filled compliance reasons
  const applyQuickTemplate = (alertId: number, template: string) => {
    handleReasonChange(alertId, template);
  };

  return (
    <div className="space-y-4">
      {/* Top Directive Header */}
      <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
              Manual Review Alert Queue
            </h2>
            <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400">
              Human-in-the-Loop Triage
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Examine flagged indicators, record analyst findings, and transition review status. Automated rules flag for review only; never confirm fraud.
          </p>
        </div>

        <button
          onClick={onBulkApproveLowRisk}
          className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors flex items-center gap-1.5 shrink-0"
        >
          <Sparkles className="w-3.5 h-3.5 text-emerald-500" />
          Bulk Approve Low Risk (&lt;0.40)
        </button>
      </div>

      {/* Filter Tabs & Search */}
      <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        {/* Status Tabs */}
        <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800/60 p-1 rounded-lg">
          {(['all', 'pending', 'approved', 'rejected'] as const).map((tab) => {
            const count =
              tab === 'all'
                ? alerts.length
                : alerts.filter((a) => a.review_status === tab).length;
            const isActive = statusFilter === tab;

            return (
              <button
                key={tab}
                onClick={() => setStatusFilter(tab)}
                className={`px-3 py-1 text-xs font-medium rounded-md capitalize transition-all flex items-center gap-1.5 ${
                  isActive
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-semibold shadow-xs'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                <span>{tab}</span>
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Search & Risk Level Filter */}
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Filter by customer, rule, reason..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-slate-900 dark:text-slate-100 w-52 sm:w-64 focus:outline-none"
            />
          </div>

          <select
            value={riskFilter}
            onChange={(e) => setRiskFilter(e.target.value as any)}
            className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 focus:outline-none"
          >
            <option value="all">All Risk Levels</option>
            <option value="low">Green (&lt;0.40)</option>
            <option value="medium">Yellow (0.40 - 0.70)</option>
            <option value="high">Red (&gt;0.70)</option>
          </select>
        </div>
      </div>

      {/* Alerts Table */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">Alert ID</th>
                <th className="py-3 px-4">Customer & TX</th>
                <th className="py-3 px-4">Amount & Channel</th>
                <th className="py-3 px-4">Triggered Heuristics</th>
                <th className="py-3 px-4 text-center">Risk Score</th>
                <th className="py-3 px-4">Review Decision</th>
                <th className="py-3 px-4">Investigator Notes</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredAlerts.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    No alerts in this view. Queue is clear!
                  </td>
                </tr>
              ) : (
                filteredAlerts.map((alert) => {
                  const draft = getDraft(alert);
                  const score = alert.risk_score;
                  const isModified =
                    draft.status !== alert.review_status || draft.reason !== (alert.review_reason || '');

                  // Color code risk: green <0.4, yellow 0.4-0.7, red >0.7
                  const riskColorClass =
                    score >= 0.70
                      ? 'bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30'
                      : score >= 0.40
                      ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30'
                      : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30';

                  const badgeBg =
                    score >= 0.70
                      ? 'bg-red-500'
                      : score >= 0.40
                      ? 'bg-amber-500'
                      : 'bg-emerald-500';

                  return (
                    <tr
                      key={alert.alert_id}
                      className={`hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors ${
                        score >= 0.70 ? 'bg-red-500/[0.02]' : ''
                      }`}
                    >
                      {/* Alert ID */}
                      <td className="py-3.5 px-4 font-mono font-medium text-slate-700 dark:text-slate-300">
                        ALT-{alert.alert_id.toString().padStart(4, '0')}
                      </td>

                      {/* Customer & TX */}
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-900 dark:text-slate-100">
                          {alert.customer_code}
                        </div>
                        <div className="text-[11px] text-slate-500 font-mono">
                          TX #{alert.transaction_id} • {new Date(alert.transaction_datetime).toLocaleDateString()}
                        </div>
                      </td>

                      {/* Amount & Channel */}
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-900 dark:text-slate-100">
                          ₹{alert.amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                        <div className="text-[11px] text-slate-500 capitalize">
                          {alert.channel.replace('_', ' ')} {alert.region ? `(${alert.region})` : ''}
                        </div>
                      </td>

                      {/* Triggered Rule & Reason */}
                      <td className="py-3.5 px-4 max-w-xs">
                        <div className="inline-block px-1.5 py-0.5 rounded text-[10px] font-bold font-mono uppercase bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 mb-1">
                          {alert.rule_name.replace('_', ' ')}
                        </div>
                        <div className="text-[11px] text-slate-600 dark:text-slate-400 leading-tight">
                          {alert.review_reason || 'Anomaly flag generated by heuristic engine'}
                        </div>
                      </td>

                      {/* Risk Score with visual progress pill */}
                      <td className="py-3.5 px-4 text-center">
                        <div className="inline-flex flex-col items-center gap-1">
                          <span
                            className={`px-2.5 py-0.5 rounded-full border text-xs font-bold font-mono ${riskColorClass}`}
                          >
                            {score.toFixed(2)}
                          </span>
                          <div className="w-16 bg-slate-200 dark:bg-slate-700 rounded-full h-1 overflow-hidden">
                            <div
                              className={`h-full ${badgeBg}`}
                              style={{ width: `${Math.round(score * 100)}%` }}
                            />
                          </div>
                        </div>
                      </td>

                      {/* Review Status dropdown */}
                      <td className="py-3.5 px-4">
                        <select
                          value={draft.status}
                          onChange={(e) =>
                            handleStatusChange(
                              alert.alert_id,
                              e.target.value as 'pending' | 'approved' | 'rejected'
                            )
                          }
                          className={`w-28 px-2.5 py-1 text-xs rounded-lg font-semibold border transition-all focus:outline-none ${
                            draft.status === 'approved'
                              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                              : draft.status === 'rejected'
                              ? 'bg-red-500/10 border-red-500/30 text-red-600 dark:text-red-400'
                              : 'bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400'
                          }`}
                        >
                          <option value="pending">Pending</option>
                          <option value="approved">Approved</option>
                          <option value="rejected">Rejected</option>
                        </select>
                      </td>

                      {/* Notes / Reason Input */}
                      <td className="py-3.5 px-4 min-w-[200px]">
                        <input
                          type="text"
                          value={draft.reason}
                          onChange={(e) => handleReasonChange(alert.alert_id, e.target.value)}
                          placeholder="Analyst notes on verification..."
                          className="w-full px-2.5 py-1 text-xs rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                        />
                        <div className="mt-1 flex items-center gap-1.5 text-[10px] text-slate-400">
                          <span className="font-semibold">Quick notes:</span>
                          <button
                            type="button"
                            onClick={() =>
                              applyQuickTemplate(alert.alert_id, 'Verified via 2FA authorization')
                            }
                            className="hover:text-emerald-500 underline"
                          >
                            +2FA Verified
                          </button>
                          <span>•</span>
                          <button
                            type="button"
                            onClick={() =>
                              applyQuickTemplate(alert.alert_id, 'Customer confirmed legitimate travel')
                            }
                            className="hover:text-emerald-500 underline"
                          >
                            +Travel
                          </button>
                          <span>•</span>
                          <button
                            type="button"
                            onClick={() =>
                              applyQuickTemplate(alert.alert_id, 'Cardholder reported card stolen')
                            }
                            className="hover:text-red-500 underline"
                          >
                            +Stolen
                          </button>
                        </div>
                      </td>

                      {/* Save Button */}
                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={() => handleSave(alert)}
                          disabled={draft.isSaving || !isModified}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 ml-auto transition-all ${
                            isModified
                              ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
                          }`}
                        >
                          <Save className="w-3.5 h-3.5" />
                          {draft.isSaving ? 'Saving...' : 'Save'}
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
