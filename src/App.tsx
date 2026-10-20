/**
 * Project 21: Financial Risk Analysis and Rule-Based Fraud Detection System
 * Main Application Dashboard
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  ShieldAlert,
  Server,
  Zap,
  RefreshCw,
  Sun,
  Moon,
  Sparkles,
  Info,
  CheckCircle2,
  PanelLeftOpen,
  PanelLeftClose,
  Download,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Sidebar } from './components/Sidebar';
import { DashboardView } from './components/DashboardView';
import { TransactionsView } from './components/TransactionsView';
import { AlertQueueView } from './components/AlertQueueView';
import { RuleConfigView } from './components/RuleConfigView';
import { AuditLogsView } from './components/AuditLogsView';
import { ImportModal } from './components/ImportModal';
import { ManualTransactionModal } from './components/ManualTransactionModal';
import { TransactionDetailDrawer } from './components/TransactionDetailDrawer';

import {
  Transaction,
  AlertItem,
  AnalyticsSummary,
  TrendDataPoint,
  RuleWeightConfig,
  AuditLogEntry,
} from './types';
import {
  DEFAULT_WEIGHTS,
  generateSyntheticDataset,
  computeAnalytics,
  computeDailyTrends,
  evaluateTransactionRules,
} from './services/syntheticEngine';
import {
  checkBackendHealth,
  BackendStatus,
  fetchLiveTransactions,
  fetchLiveAlerts,
  fetchLiveAnalyticsSummary,
  fetchLiveAnalyticsTrends,
  patchLiveAlertReview,
  postLiveTransactionsBatch,
  triggerLiveSeed,
} from './services/apiClient';

export default function App() {
  // Theme state
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    return (
      localStorage.getItem('p21_dark_mode') === 'true' ||
      window.matchMedia('(prefers-color-scheme: dark)').matches
    );
  });

  useEffect(() => {
    localStorage.setItem('p21_dark_mode', darkMode.toString());
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  // Active view tab
  const [currentTab, setCurrentTab] = useState<string>('dashboard');

  // Sidebar collapse state
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(() => {
    return localStorage.getItem('p21_sidebar_collapsed') === 'true';
  });

  useEffect(() => {
    localStorage.setItem('p21_sidebar_collapsed', isSidebarCollapsed.toString());
  }, [isSidebarCollapsed]);

  // Rule weights configuration (stored in localStorage)
  const [ruleWeights, setRuleWeights] = useState<RuleWeightConfig>(() => {
    try {
      const saved = localStorage.getItem('p21_rule_weights');
      return saved ? JSON.parse(saved) : DEFAULT_WEIGHTS;
    } catch {
      return DEFAULT_WEIGHTS;
    }
  });

  // Backend status
  const [backendStatus, setBackendStatus] = useState<BackendStatus>({
    isOnline: false,
    lastChecked: new Date(),
  });

  // In-memory data repository
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);

  // Initialize data: check backend first, fallback to in-memory generator
  const loadData = useCallback(async () => {
    setIsRefreshing(true);
    const status = await checkBackendHealth();
    setBackendStatus(status);

    if (status.isOnline) {
      // Load live from FastAPI backend
      const [txRes, alertsRes] = await Promise.all([
        fetchLiveTransactions({ limit: 300 }),
        fetchLiveAlerts({ limit: 150 }),
      ]);

      if (txRes && txRes.items.length > 0) {
        setTransactions(txRes.items);
      } else {
        // Auto trigger initial seed on backend
        await triggerLiveSeed(500);
        const refetchTx = await fetchLiveTransactions({ limit: 300 });
        if (refetchTx) setTransactions(refetchTx.items);
      }

      if (alertsRes && alertsRes.items) {
        setAlerts(alertsRes.items);
      }
    } else {
      // Standalone simulation mode
      const dataset = generateSyntheticDataset(500, ruleWeights);
      setTransactions(dataset.transactions);
      setAlerts(dataset.alerts);
      setAuditLogs(dataset.auditLogs);
    }
    setIsRefreshing(false);
  }, [ruleWeights]);

  useEffect(() => {
    loadData();
  }, []);

  // Compute analytics
  const analyticsSummary = useMemo(() => {
    return computeAnalytics(transactions, alerts);
  }, [transactions, alerts]);

  // Compute trends
  const analyticsTrends = useMemo(() => {
    return computeDailyTrends(transactions, alerts, 14);
  }, [transactions, alerts]);

  // Pending alerts count for sidebar badge
  const pendingAlertsCount = useMemo(() => {
    return alerts.filter((a) => a.review_status === 'pending').length;
  }, [alerts]);

  // Handle re-seeding
  const handleReseed = async () => {
    setIsRefreshing(true);
    if (backendStatus.isOnline) {
      await triggerLiveSeed(500);
      await loadData();
    } else {
      const dataset = generateSyntheticDataset(500, ruleWeights);
      setTransactions(dataset.transactions);
      setAlerts(dataset.alerts);
      setAuditLogs(dataset.auditLogs);
    }
    setIsRefreshing(false);
  };

  // Handle saving new weights
  const handleSaveWeights = (newWeights: RuleWeightConfig) => {
    setRuleWeights(newWeights);
    localStorage.setItem('p21_rule_weights', JSON.stringify(newWeights));

    // Re-evaluate existing in-memory transactions with new weights
    const customerAmounts: Record<string, number[]> = {};
    const customerRegions: Record<string, Set<string>> = {};
    const accountTimes: Record<number, number[]> = {};

    const updatedTx = transactions.map((tx) => {
      const custCode = tx.customer_code || 'CUST-1001';
      if (!customerAmounts[custCode]) {
        customerAmounts[custCode] = [];
        customerRegions[custCode] = new Set();
      }
      if (!accountTimes[tx.account_id]) {
        accountTimes[tx.account_id] = [];
      }

      const txTimeMs = new Date(tx.transaction_datetime).getTime();
      const hist = customerAmounts[custCode];
      const avgAmt = hist.length > 0 ? hist.reduce((a, b) => a + b, 0) / hist.length : 0;
      const recent60m = accountTimes[tx.account_id].filter(
        (t) => txTimeMs - t >= 0 && txTimeMs - t <= 3600000
      ).length;

      const evalRes = evaluateTransactionRules(
        {
          amount: tx.amount,
          transaction_datetime: tx.transaction_datetime,
          region_optional: tx.region_optional,
          account_id: tx.account_id,
        },
        {
          customer_avg_amount: avgAmt,
          recent_60m_count: recent60m,
          known_regions: Array.from(customerRegions[custCode]),
        },
        newWeights
      );

      customerAmounts[custCode].push(tx.amount);
      if (tx.region_optional) customerRegions[custCode].add(tx.region_optional);
      accountTimes[tx.account_id].push(txTimeMs);

      return {
        ...tx,
        max_risk_score: evalRes.score,
        is_flagged: evalRes.score > newWeights.alert_threshold,
      };
    });

    setTransactions(updatedTx);
  };

  // Reset weights
  const handleResetWeights = () => {
    handleSaveWeights(DEFAULT_WEIGHTS);
  };

  // Review alert action
  const handleReviewAlert = async (
    alertId: number,
    status: 'pending' | 'approved' | 'rejected',
    reason: string
  ) => {
    // If backend is active, send PATCH
    if (backendStatus.isOnline) {
      await patchLiveAlertReview(alertId, status, reason);
    }

    const targetAlert = alerts.find((a) => a.alert_id === alertId);
    const prevStatus = targetAlert?.review_status || 'pending';

    // Update alert in state
    setAlerts((prev) =>
      prev.map((a) => (a.alert_id === alertId ? { ...a, review_status: status, review_reason: reason } : a))
    );

    // Update corresponding transaction alert summary
    setTransactions((prev) =>
      prev.map((tx) => {
        if (!tx.alerts) return tx;
        return {
          ...tx,
          alerts: tx.alerts.map((al) =>
            al.alert_id === alertId ? { ...al, review_status: status, review_reason: reason } : al
          ),
        };
      })
    );

    // Record audit log
    if (targetAlert) {
      const newLog: AuditLogEntry = {
        id: `audit-${Date.now()}`,
        timestamp: new Date().toISOString(),
        alert_id: alertId,
        transaction_id: targetAlert.transaction_id,
        customer_code: targetAlert.customer_code,
        analyst: 'Compliance Analyst Team',
        previous_status: prevStatus,
        new_status: status,
        reason: reason || 'Reviewed and updated in manual queue',
      };
      setAuditLogs((prev) => [newLog, ...prev]);
    }
  };

  // Bulk approve low risk
  const handleBulkApproveLowRisk = () => {
    const lowRiskAlerts = alerts.filter((a) => a.risk_score < 0.40 && a.review_status === 'pending');
    if (lowRiskAlerts.length === 0) return;

    lowRiskAlerts.forEach((a) => {
      handleReviewAlert(a.alert_id, 'approved', 'Bulk verified: Risk score < 0.40 under benign threshold');
    });
  };

  // Batch import transactions
  const handleImportTransactions = async (items: any[]) => {
    if (backendStatus.isOnline) {
      const res = await postLiveTransactionsBatch(items);
      await loadData();
      return {
        imported: res?.imported_count || items.length,
        alertsCreated: res?.alerts_created_count || 0,
      };
    }

    // Client mode evaluation
    let createdAlertsCount = 0;
    const newTxList: Transaction[] = [];
    const newAlertList: AlertItem[] = [];

    const now = new Date();
    let nextTxId = Math.max(...transactions.map((t) => t.transaction_id), 0) + 1;
    let nextAlertId = Math.max(...alerts.map((a) => a.alert_id), 0) + 1;

    for (const item of items) {
      const amount = parseFloat(item.amount) || 100;
      const accId = parseInt(item.account_id) || 11;
      const txTime = item.transaction_datetime || now.toISOString();
      const region = item.region_optional || 'US-East';

      // Use provided context or customer baseline
      const custAvg = item.customer_avg_amount !== undefined ? Number(item.customer_avg_amount) : 50.0;
      const recentVelocity = item.recent_60m_count !== undefined ? Number(item.recent_60m_count) : 1;

      // Evaluate against current weights
      const evalRes = evaluateTransactionRules(
        {
          amount,
          transaction_datetime: txTime,
          region_optional: region,
          account_id: accId,
        },
        {
          customer_avg_amount: custAvg,
          recent_60m_count: recentVelocity,
          known_regions: ['US-East', 'US-West'],
        },
        ruleWeights
      );

      const tx: Transaction = {
        transaction_id: nextTxId++,
        account_id: accId,
        customer_code: `CUST-${1000 + (accId % 20)}`,
        transaction_datetime: txTime,
        amount,
        transaction_type: item.transaction_type || 'payment',
        channel: item.channel || 'web',
        region_optional: region,
        created_at: now.toISOString(),
        is_flagged: evalRes.score > ruleWeights.alert_threshold,
        max_risk_score: evalRes.score,
        alerts: [],
      };

      if (evalRes.score > ruleWeights.alert_threshold && evalRes.triggeredRules.length > 0) {
        const primaryRule = evalRes.triggeredRules.length === 1 ? evalRes.triggeredRules[0] : 'multi_rule';
        const alertItem: AlertItem = {
          alert_id: nextAlertId++,
          transaction_id: tx.transaction_id,
          customer_code: tx.customer_code!,
          account_id: tx.account_id,
          amount: tx.amount,
          channel: tx.channel,
          region: tx.region_optional,
          transaction_datetime: tx.transaction_datetime,
          rule_name: primaryRule,
          risk_score: evalRes.score,
          review_status: 'pending',
          review_reason: evalRes.reasons.join('; '),
          created_at: now.toISOString(),
        };

        newAlertList.push(alertItem);
        tx.alerts = [
          {
            alert_id: alertItem.alert_id,
            transaction_id: tx.transaction_id,
            rule_name: primaryRule,
            risk_score: evalRes.score,
            review_status: 'pending',
            review_reason: alertItem.review_reason,
            created_at: alertItem.created_at,
          },
        ];
        createdAlertsCount++;
      }

      newTxList.push(tx);
    }

    setTransactions((prev) => [...newTxList, ...prev]);
    if (newAlertList.length > 0) {
      setAlerts((prev) => [...newAlertList, ...prev]);
    }

    return { imported: newTxList.length, alertsCreated: createdAlertsCount };
  };

  // Quick Anomaly Injector helper
  const handleInjectAnomaly = (type: 'amount' | 'burst' | 'region' | 'night') => {
    const now = new Date();
    let payload: any = {};

    if (type === 'amount') {
      payload = {
        account_id: 11,
        amount: 8850.0,
        transaction_type: 'transfer',
        channel: 'wire',
        region_optional: 'US-East',
        transaction_datetime: now.toISOString(),
      };
    } else if (type === 'burst') {
      const items = Array.from({ length: 6 }, (_, idx) => ({
        account_id: 21,
        amount: 45.0 + idx * 5,
        transaction_type: 'pos',
        channel: 'mobile_app',
        region_optional: 'US-East',
        transaction_datetime: new Date(now.getTime() - idx * 2 * 60000).toISOString(),
      }));
      handleImportTransactions(items);
      return;
    } else if (type === 'region') {
      payload = {
        account_id: 31,
        amount: 280.0,
        transaction_type: 'online',
        channel: 'web',
        region_optional: 'RU-East',
        transaction_datetime: now.toISOString(),
      };
    } else if (type === 'night') {
      const nightDate = new Date(now);
      nightDate.setHours(3, 20, 0);
      payload = {
        account_id: 41,
        amount: 140.0,
        transaction_type: 'withdrawal',
        channel: 'atm',
        region_optional: 'US-East',
        transaction_datetime: nightDate.toISOString(),
      };
    }

    handleImportTransactions([payload]);
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 transition-colors duration-200">
      {/* Sidebar Navigation */}
      <Sidebar
        currentTab={currentTab}
        setCurrentTab={setCurrentTab}
        pendingAlertsCount={pendingAlertsCount}
        darkMode={darkMode}
        setDarkMode={setDarkMode}
        backendStatus={backendStatus}
        onRefreshData={handleReseed}
        isRefreshing={isRefreshing}
        isCollapsed={isSidebarCollapsed}
        setIsCollapsed={setIsSidebarCollapsed}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Top Header Bar */}
        <header className="h-16 px-6 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              title={isSidebarCollapsed ? 'Pin Sidebar Expanded' : 'Collapse Sidebar (Hover to reveal)'}
            >
              {isSidebarCollapsed ? (
                <PanelLeftOpen className="w-4 h-4" />
              ) : (
                <PanelLeftClose className="w-4 h-4" />
              )}
            </button>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-md bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20 font-mono">
              PROJECT 21
            </span>
            <div className="h-4 w-px bg-slate-200 dark:border-slate-800" />
            <span className="text-sm font-semibold capitalize text-slate-700 dark:text-slate-200">
              {currentTab.replace('_', ' ')}
            </span>
          </div>

          <div className="flex items-center gap-3">
            {/* Direct Code Download Button */}
            <a
              href="/project-21-fraud-detection.zip"
              download="project-21-fraud-detection.zip"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-colors"
              title="Download entire project code as a .zip file directly to your laptop"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download Code (.zip)</span>
            </a>

            {/* Backend connectivity pill */}
            <div
              className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border ${
                backendStatus.isOnline
                  ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-700 dark:text-emerald-300'
                  : 'bg-indigo-500/10 border-indigo-500/20 text-indigo-700 dark:text-indigo-300'
              }`}
              title={
                backendStatus.isOnline
                  ? 'FastAPI + SQLAlchemy active on port 8000'
                  : 'FastAPI not detected on :8000. Running in zero-config client simulation mode.'
              }
            >
              <Server className="w-3.5 h-3.5" />
              <span>
                {backendStatus.isOnline ? '🟢 Live API (:8000)' : '⚡ Client Sandbox Mode'}
              </span>
            </div>
          </div>
        </header>

        {/* Viewport Content */}
        <main className="flex-1 overflow-y-auto p-6">
          <div className="max-w-7xl mx-auto pb-12">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentTab}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.16, ease: 'easeOut' }}
              >
                {currentTab === 'dashboard' && (
                  <DashboardView
                    summary={analyticsSummary}
                    trends={analyticsTrends}
                    recentAlerts={alerts}
                    onNavigateToAlerts={() => setCurrentTab('alerts')}
                    onNavigateToRules={() => setCurrentTab('rules')}
                    darkMode={darkMode}
                  />
                )}

                {currentTab === 'transactions' && (
                  <TransactionsView
                    transactions={transactions}
                    onOpenImportModal={() => setIsImportModalOpen(true)}
                    onOpenManualModal={() => setIsManualModalOpen(true)}
                    onInjectAnomaly={handleInjectAnomaly}
                    onSelectTransaction={(tx) => setSelectedTx(tx)}
                  />
                )}

                {currentTab === 'alerts' && (
                  <AlertQueueView
                    alerts={alerts}
                    onReviewAlert={handleReviewAlert}
                    onBulkApproveLowRisk={handleBulkApproveLowRisk}
                  />
                )}

                {currentTab === 'rules' && (
                  <RuleConfigView
                    weights={ruleWeights}
                    onSaveWeights={handleSaveWeights}
                    onResetWeights={handleResetWeights}
                  />
                )}

                {currentTab === 'audit' && <AuditLogsView logs={auditLogs} />}
              </motion.div>
            </AnimatePresence>
          </div>
        </main>
      </div>

      {/* Transaction Details Drawer */}
      <TransactionDetailDrawer
        transaction={selectedTx}
        onClose={() => setSelectedTx(null)}
        onNavigateToAlertQueue={() => {
          setSelectedTx(null);
          setCurrentTab('alerts');
        }}
      />

      {/* Dedicated Manual Transaction Modal */}
      <ManualTransactionModal
        isOpen={isManualModalOpen}
        onClose={() => setIsManualModalOpen(false)}
        onSubmit={async (tx) => {
          await handleImportTransactions([tx]);
        }}
        weights={ruleWeights}
        transactions={transactions}
      />

      {/* Batch Import Modal */}
      <ImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onImport={handleImportTransactions}
      />
    </div>
  );
}
