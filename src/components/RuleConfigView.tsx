import React, { useState } from 'react';
import {
  Sliders,
  RotateCcw,
  Save,
  CheckCircle,
  HelpCircle,
  Calculator,
  ShieldAlert,
  ArrowRight,
  Info,
} from 'lucide-react';
import { RuleWeightConfig } from '../types';
import { evaluateTransactionRules } from '../services/syntheticEngine';

interface RuleConfigViewProps {
  weights: RuleWeightConfig;
  onSaveWeights: (newWeights: RuleWeightConfig) => void;
  onResetWeights: () => void;
}

export const RuleConfigView: React.FC<RuleConfigViewProps> = ({
  weights,
  onSaveWeights,
  onResetWeights,
}) => {
  const [formData, setFormData] = useState<RuleWeightConfig>({ ...weights });
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Interactive Sandbox state
  const [testAmount, setTestAmount] = useState<number>(450);
  const [testAvg, setTestAvg] = useState<number>(100);
  const [testRecentCount, setTestRecentCount] = useState<number>(6);
  const [testRegion, setTestRegion] = useState<string>('APAC-SG');
  const [testKnownRegions, setTestKnownRegions] = useState<string>('US-East, US-West');
  const [testHour, setTestHour] = useState<number>(3); // 3 AM

  const sumWeights =
    formData.unusual_amount +
    formData.high_frequency +
    formData.location_change +
    formData.unusual_time;

  const handleSliderChange = (key: keyof RuleWeightConfig, val: number) => {
    setFormData((prev) => ({
      ...prev,
      [key]: Math.round(val * 100) / 100,
    }));
    setSaveSuccess(false);
  };

  const handleSave = () => {
    onSaveWeights(formData);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  // Evaluate sandbox live
  const sandboxDate = new Date();
  sandboxDate.setHours(testHour, 15, 0);

  const sandboxResult = evaluateTransactionRules(
    {
      amount: testAmount,
      transaction_datetime: sandboxDate.toISOString(),
      region_optional: testRegion,
      account_id: 101,
    },
    {
      customer_avg_amount: testAvg,
      recent_60m_count: testRecentCount,
      known_regions: testKnownRegions.split(',').map((s) => s.trim()),
    },
    formData
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Sliders className="w-5 h-5 text-emerald-500" />
            Rule Engine & Weight Calibration
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Configure risk scoring parameters for the 4 fraud heuristics in accordance with Project 21 specifications
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              onResetWeights();
              setFormData({
                unusual_amount: 0.40,
                high_frequency: 0.30,
                location_change: 0.20,
                unusual_time: 0.10,
                alert_threshold: 0.30,
              });
            }}
            className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition-colors flex items-center gap-1.5"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset Defaults
          </button>

          <button
            onClick={handleSave}
            className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition-all flex items-center gap-1.5"
          >
            <Save className="w-3.5 h-3.5" />
            Save Configuration
          </button>
        </div>
      </div>

      {saveSuccess && (
        <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-xs flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-emerald-500" />
          Weights successfully saved to browser local config. Active evaluations will use updated parameters!
        </div>
      )}

      {/* Main Grid: Config Sliders & Live Sandbox */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Weight Tuning Sliders */}
        <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Heuristic Weight Multipliers
              </h3>
              <p className="text-xs text-slate-500">Total weight sum: {sumWeights.toFixed(2)} (Standard: 1.00)</p>
            </div>
            <span
              className={`px-2 py-0.5 text-xs font-bold font-mono rounded ${
                Math.abs(sumWeights - 1.0) < 0.01
                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                  : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
              }`}
            >
              Sum: {sumWeights.toFixed(2)}
            </span>
          </div>

          {/* Rule 1: Unusual Amount */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <label className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1">
                <span>1. Unusual Amount (`unusual_amount`)</span>
              </label>
              <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 text-sm">
                {formData.unusual_amount.toFixed(2)}
              </span>
            </div>
            <input
              type="range"
              min="0.05"
              max="0.80"
              step="0.05"
              value={formData.unusual_amount}
              onChange={(e) => handleSliderChange('unusual_amount', parseFloat(e.target.value))}
              className="w-full accent-emerald-500 cursor-pointer"
            />
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Triggered when transaction amount &gt; 3x customer historical average. (Default: 0.40)
            </p>
          </div>

          {/* Rule 2: High Frequency */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <label className="font-semibold text-slate-800 dark:text-slate-200">
                2. High Frequency (`high_frequency`)
              </label>
              <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 text-sm">
                {formData.high_frequency.toFixed(2)}
              </span>
            </div>
            <input
              type="range"
              min="0.05"
              max="0.80"
              step="0.05"
              value={formData.high_frequency}
              onChange={(e) => handleSliderChange('high_frequency', parseFloat(e.target.value))}
              className="w-full accent-emerald-500 cursor-pointer"
            />
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Triggered when &gt; 5 transactions occur within trailing 60 minutes. (Default: 0.30)
            </p>
          </div>

          {/* Rule 3: Location Change */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <label className="font-semibold text-slate-800 dark:text-slate-200">
                3. Location Change (`location_change`)
              </label>
              <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 text-sm">
                {formData.location_change.toFixed(2)}
              </span>
            </div>
            <input
              type="range"
              min="0.05"
              max="0.80"
              step="0.05"
              value={formData.location_change}
              onChange={(e) => handleSliderChange('location_change', parseFloat(e.target.value))}
              className="w-full accent-emerald-500 cursor-pointer"
            />
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Triggered when transaction region is not present in customer history. (Default: 0.20)
            </p>
          </div>

          {/* Rule 4: Unusual Time */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <label className="font-semibold text-slate-800 dark:text-slate-200">
                4. Unusual Time (`unusual_time`)
              </label>
              <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 text-sm">
                {formData.unusual_time.toFixed(2)}
              </span>
            </div>
            <input
              type="range"
              min="0.05"
              max="0.80"
              step="0.05"
              value={formData.unusual_time}
              onChange={(e) => handleSliderChange('unusual_time', parseFloat(e.target.value))}
              className="w-full accent-emerald-500 cursor-pointer"
            />
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Triggered during off-hours nocturnal window (22:00 - 06:00). (Default: 0.10)
            </p>
          </div>

          {/* Alert Threshold Setting */}
          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <label className="font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1">
                <ShieldAlert className="w-4 h-4" />
                Alert Queue Threshold
              </label>
              <span className="font-mono font-bold text-amber-600 dark:text-amber-400 text-sm">
                {formData.alert_threshold.toFixed(2)}
              </span>
            </div>
            <input
              type="range"
              min="0.10"
              max="0.70"
              step="0.05"
              value={formData.alert_threshold}
              onChange={(e) => handleSliderChange('alert_threshold', parseFloat(e.target.value))}
              className="w-full accent-amber-500 cursor-pointer"
            />
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Transactions yielding a composite risk score &gt; threshold are flagged into the Alert Queue. (Default: 0.30)
            </p>
          </div>
        </div>

        {/* Right: Interactive Evaluation Sandbox */}
        <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm flex flex-col justify-between space-y-5">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Calculator className="w-4 h-4 text-emerald-500" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Interactive Rule Sandbox
                </h3>
              </div>
              <span className="text-[11px] text-slate-400">Live Formula Preview</span>
            </div>

            {/* Sandbox Inputs */}
            <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block text-slate-500 mb-1">Transaction Amount (₹)</label>
                <input
                  type="number"
                  value={testAmount}
                  onChange={(e) => setTestAmount(parseFloat(e.target.value) || 0)}
                  className="w-full px-2.5 py-1.5 rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block text-slate-500 mb-1">Customer Historical Avg (₹)</label>
                <input
                  type="number"
                  value={testAvg}
                  onChange={(e) => setTestAvg(parseFloat(e.target.value) || 0)}
                  className="w-full px-2.5 py-1.5 rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block text-slate-500 mb-1">Trailing 60m Count (Threshold &gt; 5)</label>
                <input
                  type="number"
                  value={testRecentCount}
                  onChange={(e) => setTestRecentCount(parseInt(e.target.value) || 0)}
                  className="w-full px-2.5 py-1.5 rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block text-slate-500 mb-1">Execution Hour (0-23)</label>
                <input
                  type="number"
                  min="0"
                  max="23"
                  value={testHour}
                  onChange={(e) => setTestHour(parseInt(e.target.value) || 0)}
                  className="w-full px-2.5 py-1.5 rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block text-slate-500 mb-1">Current Region</label>
                <input
                  type="text"
                  value={testRegion}
                  onChange={(e) => setTestRegion(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block text-slate-500 mb-1">Known Prior Regions</label>
                <input
                  type="text"
                  value={testKnownRegions}
                  onChange={(e) => setTestKnownRegions(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
              </div>
            </div>

            {/* Sandbox Evaluation Output */}
            <div className="mt-5 p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Calculated Risk Score:
                </span>
                <span
                  className={`text-xl font-bold font-mono px-3 py-0.5 rounded-lg border ${
                    sandboxResult.score >= 0.70
                      ? 'bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30'
                      : sandboxResult.score >= formData.alert_threshold
                      ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30'
                      : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                  }`}
                >
                  {sandboxResult.score.toFixed(2)}
                </span>
              </div>

              <div className="text-xs">
                <span className="text-slate-500">Alert Triage Action: </span>
                <span
                  className={`font-semibold ${
                    sandboxResult.score > formData.alert_threshold
                      ? 'text-amber-600 dark:text-amber-400'
                      : 'text-emerald-600 dark:text-emerald-400'
                  }`}
                >
                  {sandboxResult.score > formData.alert_threshold
                    ? '⚠️ Alert Created & Staged for Review'
                    : '✓ Approved (Below Threshold)'}
                </span>
              </div>

              {sandboxResult.triggeredRules.length > 0 && (
                <div className="space-y-1.5 pt-2 border-t border-slate-200 dark:border-slate-700 text-xs">
                  <span className="font-semibold text-slate-700 dark:text-slate-300">
                    Triggered Rules ({sandboxResult.triggeredRules.length}):
                  </span>
                  <div className="space-y-1">
                    {sandboxResult.reasons.map((r, i) => (
                      <div
                        key={i}
                        className="text-[11px] text-slate-600 dark:text-slate-400 flex items-start gap-1.5"
                      >
                        <span className="text-amber-500">•</span>
                        <span>{r}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5" />
            <span>
              Matches backend formula in <code>app/rules/engine.py</code>: <code>calculate_risk_score(tx, context)</code>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
