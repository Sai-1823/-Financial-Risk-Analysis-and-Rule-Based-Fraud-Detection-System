import React, { useState, useMemo, useEffect } from 'react';
import {
  X,
  PlusCircle,
  AlertTriangle,
  ShieldCheck,
  Zap,
  Clock,
  MapPin,
  DollarSign,
  Activity,
  Layers,
  Info,
  Sparkles,
  CheckCircle2,
  RefreshCw,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { evaluateTransactionRules, DEFAULT_WEIGHTS } from '../services/syntheticEngine';
import { RuleWeightConfig, Transaction } from '../types';

interface ManualTransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (transaction: {
    account_id: number;
    amount: number;
    transaction_type: string;
    channel: string;
    region_optional: string;
    transaction_datetime: string;
    customer_avg_amount?: number;
    recent_60m_count?: number;
  }) => Promise<void>;
  weights: RuleWeightConfig;
  transactions?: Transaction[];
}

export const ManualTransactionModal: React.FC<ManualTransactionModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  weights = DEFAULT_WEIGHTS,
  transactions = [],
}) => {
  // Account list derived from existing transactions if available
  const availableAccounts = useMemo(() => {
    if (!transactions || transactions.length === 0) {
      return [
        { accountId: 11, customerCode: 'CUST-1001', avg: 50.0, regions: ['US-East', 'US-West'] },
        { accountId: 21, customerCode: 'CUST-1002', avg: 65.0, regions: ['US-East', 'US-Central'] },
        { accountId: 31, customerCode: 'CUST-1003', avg: 45.0, regions: ['US-West', 'EU-West'] },
        { accountId: 41, customerCode: 'CUST-1004', avg: 80.0, regions: ['APAC-SG', 'US-East'] },
      ];
    }

    const map: Record<number, { accountId: number; customerCode: string; amounts: number[]; regions: Set<string> }> = {};
    for (const tx of transactions) {
      if (!map[tx.account_id]) {
        map[tx.account_id] = {
          accountId: tx.account_id,
          customerCode: tx.customer_code || `CUST-${1000 + (tx.account_id % 25)}`,
          amounts: [],
          regions: new Set<string>(),
        };
      }
      map[tx.account_id].amounts.push(tx.amount);
      if (tx.region_optional) map[tx.account_id].regions.add(tx.region_optional);
    }

    return Object.values(map)
      .slice(0, 15)
      .map((acc) => ({
        accountId: acc.accountId,
        customerCode: acc.customerCode,
        avg: acc.amounts.length > 0 ? Math.round((acc.amounts.reduce((a, b) => a + b, 0) / acc.amounts.length) * 100) / 100 : 50.0,
        regions: acc.regions.size > 0 ? Array.from(acc.regions) : ['US-East', 'US-West'],
      }));
  }, [transactions]);

  // Form State
  const [accountId, setAccountId] = useState<number>(11);
  const [amountInput, setAmountInput] = useState<string>('250.00');
  const [customerAvgInput, setCustomerAvgInput] = useState<string>('50.00');
  const [recentCount, setRecentCount] = useState<number>(1);
  const [transactionType, setTransactionType] = useState<string>('transfer');
  const [channel, setChannel] = useState<string>('web');
  const [region, setRegion] = useState<string>('US-East');
  const [dateTime, setDateTime] = useState<string>(() => {
    const now = new Date();
    // Return local YYYY-MM-DDTHH:mm
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  });
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Sync customer baseline whenever account is selected
  const selectedAccountInfo = useMemo(() => {
    return availableAccounts.find((a) => a.accountId === accountId) || {
      accountId,
      customerCode: `CUST-${1000 + (accountId % 25)}`,
      avg: 50.0,
      regions: ['US-East', 'US-West'],
    };
  }, [availableAccounts, accountId]);

  const handleAccountChange = (newAccId: number) => {
    setAccountId(newAccId);
    const found = availableAccounts.find((a) => a.accountId === newAccId);
    if (found) {
      setCustomerAvgInput(found.avg.toFixed(2));
      if (found.regions.length > 0) {
        setRegion(found.regions[0]);
      }
    }
  };

  if (!isOpen) return null;

  // Numerical coerction with safe fallbacks
  const currentAmount = parseFloat(amountInput) || 0;
  const currentAvg = parseFloat(customerAvgInput) > 0 ? parseFloat(customerAvgInput) : 50.0;
  const threshold3x = currentAvg * 3.0;

  // Safe date parsing
  const dt = new Date(dateTime);
  const validIso = isNaN(dt.getTime()) ? new Date().toISOString() : dt.toISOString();
  const executionHour = isNaN(dt.getHours()) ? new Date().getHours() : dt.getHours();

  // Real-time evaluation preview against baseline customer context
  const evalResult = evaluateTransactionRules(
    {
      amount: currentAmount,
      transaction_datetime: validIso,
      region_optional: region,
      account_id: accountId,
    },
    {
      customer_avg_amount: currentAvg,
      recent_60m_count: recentCount,
      known_regions: selectedAccountInfo.regions,
    },
    weights
  );

  const isAmountTriggered = currentAvg > 0 && currentAmount > threshold3x;
  const isTimeTriggered = executionHour < 6 || executionHour >= 22;
  const isRegionTriggered = !selectedAccountInfo.regions.includes(region);
  const isFrequencyTriggered = recentCount > 5;
  const isAlertThresholdExceeded = evalResult.score > (weights?.alert_threshold ?? 0.30);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (currentAmount <= 0) {
      setErrorMsg('Transaction amount must be greater than zero.');
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit({
        account_id: accountId,
        amount: currentAmount,
        transaction_type: transactionType,
        channel,
        region_optional: region,
        transaction_datetime: validIso,
        customer_avg_amount: currentAvg,
        recent_60m_count: recentCount,
      });
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to record transaction');
    } finally {
      setIsSubmitting(false);
    }
  };

  const applyPreset = (type: 'spike250' | 'extreme' | 'burst' | 'region' | 'night' | 'compound' | 'normal') => {
    if (type === 'normal') {
      setAmountInput('45.00');
      setCustomerAvgInput('50.00');
      setRecentCount(1);
      setRegion('US-East');
      const d = new Date();
      d.setHours(14, 30, 0);
      setDateTime(d.toISOString().slice(0, 16));
    } else if (type === 'spike250') {
      setAmountInput('250.00');
      setCustomerAvgInput('50.00');
      setRecentCount(1);
      setRegion('US-East');
    } else if (type === 'extreme') {
      setAmountInput('4500.00');
      setCustomerAvgInput('50.00');
    } else if (type === 'burst') {
      setRecentCount(7);
    } else if (type === 'region') {
      setRegion('RU-East');
    } else if (type === 'night') {
      const d = new Date();
      d.setHours(3, 15, 0);
      setDateTime(d.toISOString().slice(0, 16));
    } else if (type === 'compound') {
      setAmountInput('1850.00');
      setCustomerAvgInput('50.00');
      setRecentCount(8);
      setRegion('AF-North');
      const d = new Date();
      d.setHours(2, 45, 0);
      setDateTime(d.toISOString().slice(0, 16));
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs transition-opacity duration-200">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 12 }}
        transition={{ duration: 0.18, ease: 'easeOut' }}
        className="w-full max-w-2xl rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/30">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              <PlusCircle className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  Originate Transaction
                </h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  Heuristic Rule Engine
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Live risk score calculation evaluating customer historical baseline & velocity
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Quick Scenario Injectors */}
        <div className="px-6 py-2.5 bg-slate-100/60 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 flex items-center gap-1.5 overflow-x-auto text-[11px]">
          <span className="text-slate-400 shrink-0 font-medium flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-emerald-500" />
            Quick Presets:
          </span>
          <button
            type="button"
            onClick={() => applyPreset('spike250')}
            className={`px-2 py-1 rounded-md font-semibold shrink-0 transition-colors border ${
              amountInput === '250.00' || amountInput === '250'
                ? 'bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/40'
                : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-amber-400'
            }`}
          >
            ₹250 Spike (Score: 0.40)
          </button>
          <button
            type="button"
            onClick={() => applyPreset('burst')}
            className="px-2 py-1 rounded-md font-semibold shrink-0 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:border-amber-400"
          >
            Burst 7 tx (+0.30)
          </button>
          <button
            type="button"
            onClick={() => applyPreset('region')}
            className="px-2 py-1 rounded-md font-semibold shrink-0 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:border-amber-400"
          >
            Foreign RU-East (+0.20)
          </button>
          <button
            type="button"
            onClick={() => applyPreset('night')}
            className="px-2 py-1 rounded-md font-semibold shrink-0 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:border-amber-400"
          >
            3:15 AM Nocturnal (+0.10)
          </button>
          <button
            type="button"
            onClick={() => applyPreset('compound')}
            className="px-2 py-1 rounded-md font-semibold shrink-0 bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20 hover:bg-red-500/20"
          >
            Multi-Rule (1.00 Critical)
          </button>
          <button
            type="button"
            onClick={() => applyPreset('normal')}
            className="px-2 py-1 rounded-md font-medium shrink-0 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
          >
            Reset Normal
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 flex-1 overflow-y-auto space-y-4 text-xs">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Real-Time Live Scoring Hero Banner */}
          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/40 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="font-bold text-slate-800 dark:text-slate-200 text-sm flex items-center gap-1.5">
                  <Activity className="w-4 h-4 text-emerald-500" />
                  Live Heuristic Risk Score
                </span>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  Calculated dynamically from the 4 rule factors defined in <code>app/rules/engine.py</code>
                </p>
              </div>

              {/* Score Badge */}
              <div className="text-right">
                <div
                  className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl font-mono text-base font-extrabold border shadow-xs transition-all ${
                    evalResult.score >= 0.70
                      ? 'bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30'
                      : isAlertThresholdExceeded
                      ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30'
                      : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                  }`}
                >
                  <span>Score:</span>
                  <span className="text-lg">{evalResult.score.toFixed(2)}</span>
                </div>
                <div className="text-[10px] font-semibold mt-1">
                  {isAlertThresholdExceeded ? (
                    <span className="text-amber-600 dark:text-amber-400 flex items-center justify-end gap-1">
                      <AlertTriangle className="w-3 h-3" />
                      Flags Alert Queue (&gt; {weights.alert_threshold.toFixed(2)})
                    </span>
                  ) : (
                    <span className="text-emerald-600 dark:text-emerald-400 flex items-center justify-end gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      Benign (&le; {weights.alert_threshold.toFixed(2)})
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* 4 Factor Visual Check Matrix */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] pt-1">
              {/* Factor 1: Unusual Amount */}
              <div
                className={`p-2.5 rounded-lg border transition-all ${
                  isAmountTriggered
                    ? 'bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-300 font-medium'
                    : 'bg-white dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-500'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold">1. Amount Spike (&gt; 3x Avg):</span>
                  <span className="font-mono font-bold">
                    {isAmountTriggered ? `+${(weights.unusual_amount ?? 0.4).toFixed(2)}` : '0.00'}
                  </span>
                </div>
                <p className="text-[10px] mt-1 text-slate-500 dark:text-slate-400">
                  {isAmountTriggered ? (
                    <span className="text-amber-600 dark:text-amber-400 font-semibold">
                      Triggered: ₹{currentAmount.toFixed(2)} exceeds 3x limit (₹{threshold3x.toFixed(2)}) by {(currentAmount / Math.max(currentAvg, 1)).toFixed(1)}x
                    </span>
                  ) : (
                    <span>
                      Normal: ₹{currentAmount.toFixed(2)} &le; ₹{threshold3x.toFixed(2)} (enter &gt; ₹{threshold3x.toFixed(2)} to trigger)
                    </span>
                  )}
                </p>
              </div>

              {/* Factor 2: High Velocity */}
              <div
                className={`p-2.5 rounded-lg border transition-all ${
                  isFrequencyTriggered
                    ? 'bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-300 font-medium'
                    : 'bg-white dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-500'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold">2. Velocity (&gt; 5 in 60m):</span>
                  <span className="font-mono font-bold">
                    {isFrequencyTriggered ? `+${(weights.high_frequency ?? 0.3).toFixed(2)}` : '0.00'}
                  </span>
                </div>
                <p className="text-[10px] mt-1 text-slate-500 dark:text-slate-400">
                  {isFrequencyTriggered ? (
                    <span className="text-amber-600 dark:text-amber-400 font-semibold">
                      Triggered: {recentCount} transactions in 60m (&gt; 5 limit)
                    </span>
                  ) : (
                    <span>Normal: {recentCount} transaction in 60m (limit &le; 5)</span>
                  )}
                </p>
              </div>

              {/* Factor 3: Location Change */}
              <div
                className={`p-2.5 rounded-lg border transition-all ${
                  isRegionTriggered
                    ? 'bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-300 font-medium'
                    : 'bg-white dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-500'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold">3. Location Change:</span>
                  <span className="font-mono font-bold">
                    {isRegionTriggered ? `+${(weights.location_change ?? 0.2).toFixed(2)}` : '0.00'}
                  </span>
                </div>
                <p className="text-[10px] mt-1 text-slate-500 dark:text-slate-400">
                  {isRegionTriggered ? (
                    <span className="text-amber-600 dark:text-amber-400 font-semibold">
                      Triggered: Region '{region}' not in customer profile
                    </span>
                  ) : (
                    <span>Known: '{region}' matches profile history</span>
                  )}
                </p>
              </div>

              {/* Factor 4: Nocturnal Hours */}
              <div
                className={`p-2.5 rounded-lg border transition-all ${
                  isTimeTriggered
                    ? 'bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-300 font-medium'
                    : 'bg-white dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-500'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold">4. Nocturnal Hour:</span>
                  <span className="font-mono font-bold">
                    {isTimeTriggered ? `+${(weights.unusual_time ?? 0.1).toFixed(2)}` : '0.00'}
                  </span>
                </div>
                <p className="text-[10px] mt-1 text-slate-500 dark:text-slate-400">
                  {isTimeTriggered ? (
                    <span className="text-amber-600 dark:text-amber-400 font-semibold">
                      Triggered: Executing at {String(executionHour).padStart(2, '0')}:{String(dt.getMinutes() || 0).padStart(2, '0')} (window 22:00 - 06:00)
                    </span>
                  ) : (
                    <span>Daytime: Standard business hours (06:00 - 22:00)</span>
                  )}
                </p>
              </div>
            </div>
          </div>

          {/* Amount & Customer Baseline Configuration */}
          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <span className="font-bold text-slate-800 dark:text-slate-200 text-xs uppercase tracking-wider">
                Transaction Value & Customer Baseline
              </span>
              <span className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400 font-semibold">
                3x Spike Trigger: ₹{threshold3x.toFixed(2)}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Amount Input */}
              <div>
                <label className="block text-slate-700 dark:text-slate-300 mb-1 font-semibold flex items-center justify-between">
                  <span>Transaction Amount (₹ INR)</span>
                  <span className="text-[10px] font-normal text-slate-400 font-mono">
                    {currentAmount > threshold3x ? '⚠️ Above 3x limit' : '✓ Normal'}
                  </span>
                </label>
                <div className="relative">
                  <span className="text-slate-400 font-bold absolute left-3 top-2.5 text-sm">₹</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={amountInput}
                    onChange={(e) => setAmountInput(e.target.value)}
                    className="w-full pl-8 pr-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-bold text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                    placeholder="250.00"
                    required
                  />
                </div>
                <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => setAmountInput('45.00')}
                    className="px-2 py-0.5 rounded text-[11px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200"
                  >
                    ₹45 Normal
                  </button>
                  <button
                    type="button"
                    onClick={() => setAmountInput('250.00')}
                    className="px-2 py-0.5 rounded text-[11px] bg-amber-500/15 text-amber-700 dark:text-amber-300 font-semibold hover:bg-amber-500/25"
                  >
                    ₹250 (5x of ₹50)
                  </button>
                  <button
                    type="button"
                    onClick={() => setAmountInput('1500.00')}
                    className="px-2 py-0.5 rounded text-[11px] bg-red-500/15 text-red-700 dark:text-red-300 font-semibold hover:bg-red-500/25"
                  >
                    ₹1,500 Spike
                  </button>
                </div>
              </div>

              {/* Customer Average Baseline */}
              <div>
                <label className="block text-slate-700 dark:text-slate-300 mb-1 font-semibold flex items-center justify-between">
                  <span>Customer Historical Avg (₹)</span>
                  <span className="text-[10px] text-slate-400 font-normal">Context Baseline</span>
                </label>
                <div className="relative">
                  <span className="text-slate-400 font-bold absolute left-3 top-2.5 text-sm">₹</span>
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    value={customerAvgInput}
                    onChange={(e) => setCustomerAvgInput(e.target.value)}
                    className="w-full pl-8 pr-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-bold text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                    placeholder="50.00"
                    required
                  />
                </div>
                <div className="flex items-center justify-between mt-2 text-[10px] text-slate-500">
                  <span>Threshold = 3 &times; ₹{currentAvg.toFixed(2)} = ₹{threshold3x.toFixed(2)}</span>
                  <button
                    type="button"
                    onClick={() => setCustomerAvgInput('50.00')}
                    className="text-emerald-600 dark:text-emerald-400 font-semibold hover:underline"
                  >
                    Reset to ₹50.00
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Account & Velocity Settings */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-slate-700 dark:text-slate-300 mb-1 font-semibold flex items-center justify-between">
                <span>Account & Customer Profile</span>
                <span className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400">
                  {selectedAccountInfo.customerCode}
                </span>
              </label>
              <select
                value={accountId}
                onChange={(e) => handleAccountChange(parseInt(e.target.value) || 11)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              >
                {availableAccounts.map((acc) => (
                  <option key={acc.accountId} value={acc.accountId}>
                    Account #{acc.accountId} ({acc.customerCode} — Avg: ₹{acc.avg.toFixed(2)})
                  </option>
                ))}
              </select>
              <span className="text-[10px] text-slate-400 mt-1 block">
                Known history: {selectedAccountInfo.regions.join(', ')}
              </span>
            </div>

            <div>
              <label className="block text-slate-700 dark:text-slate-300 mb-1 font-semibold flex items-center justify-between">
                <span>Trailing 60m Velocity Count</span>
                <span className="text-[10px] text-slate-400">Rule limit: &gt; 5</span>
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="0"
                  max="25"
                  value={recentCount}
                  onChange={(e) => setRecentCount(parseInt(e.target.value) || 0)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-bold focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
                <button
                  type="button"
                  onClick={() => setRecentCount(recentCount > 5 ? 1 : 7)}
                  className={`px-3 py-2 rounded-lg text-xs font-semibold whitespace-nowrap border transition-colors ${
                    recentCount > 5
                      ? 'bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400'
                      : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  {recentCount > 5 ? 'Burst (7)' : 'Normal (1)'}
                </button>
              </div>
            </div>
          </div>

          {/* Type & Channel */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-slate-700 dark:text-slate-300 mb-1 font-semibold">
                Transaction Type
              </label>
              <select
                value={transactionType}
                onChange={(e) => setTransactionType(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none"
              >
                <option value="transfer">Transfer</option>
                <option value="payment">Payment</option>
                <option value="withdrawal">Withdrawal</option>
                <option value="pos">POS Terminal</option>
                <option value="online">Online Purchase</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-700 dark:text-slate-300 mb-1 font-semibold">
                Channel
              </label>
              <select
                value={channel}
                onChange={(e) => setChannel(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none"
              >
                <option value="web">Web Portal</option>
                <option value="mobile_app">Mobile App</option>
                <option value="wire">Wire Transfer</option>
                <option value="atm">ATM</option>
                <option value="pos">POS</option>
              </select>
            </div>
          </div>

          {/* Geographic Region & Execution Timestamp */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-slate-700 dark:text-slate-300 mb-1 font-semibold flex items-center justify-between">
                <span>Geographic Region</span>
                <span className="text-[10px] text-slate-400">
                  {isRegionTriggered ? '⚠️ New Location (+0.20)' : '✓ Known'}
                </span>
              </label>
              <input
                type="text"
                value={region}
                onChange={(e) => setRegion(e.target.value)}
                placeholder="e.g. US-East, RU-East, APAC-SG"
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
              <div className="flex items-center gap-1.5 mt-1.5 text-[10px]">
                <button
                  type="button"
                  onClick={() => setRegion('US-East')}
                  className={`px-2 py-0.5 rounded ${
                    region === 'US-East' ? 'bg-emerald-500/15 text-emerald-600 font-bold' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                  }`}
                >
                  US-East (Known)
                </button>
                <button
                  type="button"
                  onClick={() => setRegion('RU-East')}
                  className={`px-2 py-0.5 rounded ${
                    region === 'RU-East' ? 'bg-amber-500/15 text-amber-600 font-bold' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                  }`}
                >
                  RU-East (+0.20)
                </button>
                <button
                  type="button"
                  onClick={() => setRegion('AF-North')}
                  className={`px-2 py-0.5 rounded ${
                    region === 'AF-North' ? 'bg-amber-500/15 text-amber-600 font-bold' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                  }`}
                >
                  AF-North (+0.20)
                </button>
              </div>
            </div>

            <div>
              <label className="block text-slate-700 dark:text-slate-300 mb-1 font-semibold flex items-center justify-between">
                <span>Execution Timestamp</span>
                <span className="text-[10px] text-slate-400">
                  {isTimeTriggered ? '⚠️ Nocturnal (+0.10)' : '✓ Daytime'}
                </span>
              </label>
              <input
                type="datetime-local"
                value={dateTime}
                onChange={(e) => setDateTime(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
              <div className="flex items-center gap-1.5 mt-1.5 text-[10px]">
                <button
                  type="button"
                  onClick={() => {
                    const d = new Date();
                    d.setHours(14, 30, 0);
                    setDateTime(d.toISOString().slice(0, 16));
                  }}
                  className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200"
                >
                  Daytime (14:30)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const d = new Date();
                    d.setHours(3, 15, 0);
                    setDateTime(d.toISOString().slice(0, 16));
                  }}
                  className="px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-semibold hover:bg-indigo-500/20"
                >
                  Night (03:15 AM: +0.10)
                </button>
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
              <Info className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span>
                Record saves transaction directly to ledger and auto-stages review alert if score &gt; {weights.alert_threshold.toFixed(2)}.
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className={`px-5 py-2 text-xs font-semibold rounded-lg text-white shadow-sm transition-all flex items-center gap-2 disabled:opacity-50 ${
                  isAlertThresholdExceeded
                    ? 'bg-amber-600 hover:bg-amber-700'
                    : 'bg-emerald-600 hover:bg-emerald-700'
                }`}
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Evaluating...</span>
                  </>
                ) : (
                  <>
                    <PlusCircle className="w-3.5 h-3.5" />
                    <span>Record Transaction (Score: {evalResult.score.toFixed(2)})</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </motion.div>
    </div>
  );
};
