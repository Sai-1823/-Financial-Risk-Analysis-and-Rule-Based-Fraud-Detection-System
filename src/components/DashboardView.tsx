import React from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Line, Bar } from 'react-chartjs-2';
import {
  CreditCard,
  AlertTriangle,
  Flame,
  IndianRupee,
  TrendingUp,
  ShieldAlert,
  ArrowRight,
  Clock,
  MapPin,
  Activity,
  Zap,
} from 'lucide-react';
import { AnalyticsSummary, TrendDataPoint, AlertItem } from '../types';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface DashboardViewProps {
  summary: AnalyticsSummary;
  trends: TrendDataPoint[];
  recentAlerts: AlertItem[];
  onNavigateToAlerts: () => void;
  onNavigateToRules: () => void;
  darkMode: boolean;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  summary,
  trends,
  recentAlerts,
  onNavigateToAlerts,
  onNavigateToRules,
  darkMode,
}) => {
  // Chart Colors based on darkMode
  const textColor = darkMode ? '#94a3b8' : '#64748b';
  const gridColor = darkMode ? 'rgba(51, 65, 85, 0.4)' : 'rgba(226, 232, 240, 0.8)';

  // 1. Line Chart Data: Daily Trends
  const trendLabels = trends.map((t) => t.date);
  const lineChartData = {
    labels: trendLabels,
    datasets: [
      {
        label: 'Transactions Evaluated',
        data: trends.map((t) => t.transactions),
        borderColor: '#3b82f6',
        backgroundColor: 'rgba(59, 130, 246, 0.08)',
        fill: true,
        tension: 0.35,
        pointRadius: 3,
        borderWidth: 2,
      },
      {
        label: 'Alerts Flagged',
        data: trends.map((t) => t.alerts),
        borderColor: '#f59e0b',
        backgroundColor: 'rgba(245, 158, 11, 0.15)',
        fill: true,
        tension: 0.35,
        pointRadius: 4,
        pointBackgroundColor: '#f59e0b',
        borderWidth: 2,
      },
    ],
  };

  const lineChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
        labels: { color: textColor, font: { size: 12 } },
      },
      tooltip: {
        backgroundColor: darkMode ? '#1e293b' : '#ffffff',
        titleColor: darkMode ? '#f8fafc' : '#0f172a',
        bodyColor: darkMode ? '#cbd5e1' : '#334155',
        borderColor: darkMode ? '#334155' : '#e2e8f0',
        borderWidth: 1,
        padding: 10,
        boxPadding: 4,
      },
    },
    animation: {
      duration: 650,
      easing: 'easeOutQuart' as const,
    },
    scales: {
      x: {
        grid: { color: gridColor },
        ticks: { color: textColor, font: { size: 11 } },
      },
      y: {
        grid: { color: gridColor },
        ticks: { color: textColor, font: { size: 11 } },
        beginAtZero: true,
      },
    },
  };

  // 2. Bar Chart Data: Risk Score Histogram
  const histogramLabels = Object.keys(summary.risk_histogram);
  const histogramValues = Object.values(summary.risk_histogram);

  const barChartData = {
    labels: histogramLabels,
    datasets: [
      {
        label: 'Flagged Transactions Count',
        data: histogramValues,
        backgroundColor: [
          'rgba(16, 185, 129, 0.75)', // Low (green)
          'rgba(245, 158, 11, 0.75)', // Moderate (amber)
          'rgba(249, 115, 22, 0.85)', // Elevated (orange)
          'rgba(239, 68, 68, 0.90)',  // Critical (red)
        ],
        borderColor: [
          '#10b981',
          '#f59e0b',
          '#f97316',
          '#ef4444',
        ],
        borderWidth: 1,
        borderRadius: 6,
      },
    ],
  };

  const barChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: darkMode ? '#1e293b' : '#ffffff',
        titleColor: darkMode ? '#f8fafc' : '#0f172a',
        bodyColor: darkMode ? '#cbd5e1' : '#334155',
        borderColor: darkMode ? '#334155' : '#e2e8f0',
        borderWidth: 1,
      },
    },
    animation: {
      duration: 650,
      easing: 'easeOutQuart' as const,
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { color: textColor, font: { size: 10 } },
      },
      y: {
        grid: { color: gridColor },
        ticks: { color: textColor, font: { size: 11 }, precision: 0 },
        beginAtZero: true,
      },
    },
  };

  return (
    <div className="space-y-6">
      {/* Notice Banner */}
      <div className="p-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5 dark:bg-emerald-500/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Rule-Based Manual Review Directive Active
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Evaluates synthetic transactions against 4 behavioral heuristics. Flagged transactions require human analyst verification.
            </p>
          </div>
        </div>
        <button
          onClick={onNavigateToRules}
          className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1 shrink-0"
        >
          View Rule Weights <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* 4 KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Total Transactions */}
        <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs transition-all duration-200 hover:-translate-y-1 hover:shadow-md cursor-default">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Total Transactions
            </span>
            <div className="p-2 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
              <CreditCard className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900 dark:text-slate-100">
              {summary.total_transactions.toLocaleString()}
            </span>
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              synthetic items
            </span>
          </div>
          <div className="mt-2 text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
            <TrendingUp className="w-3.5 h-3.5 text-blue-500" />
            <span>Volume: ₹{summary.total_volume.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
          </div>
        </div>

        {/* KPI 2: Total Alerts */}
        <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs transition-all duration-200 hover:-translate-y-1 hover:shadow-md cursor-default">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Total Alerts Flagged
            </span>
            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-amber-600 dark:text-amber-400">
              {summary.total_alerts}
            </span>
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              ({summary.alert_rate_percentage}% alert rate)
            </span>
          </div>
          <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
            Threshold: score &gt; 0.30 triggers alert
          </div>
        </div>

        {/* KPI 3: High Risk Alerts (> 0.70) */}
        <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs transition-all duration-200 hover:-translate-y-1 hover:shadow-md cursor-default">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              High Risk (&gt;0.70)
            </span>
            <div className="p-2 rounded-lg bg-red-500/10 text-red-600 dark:text-red-400">
              <Flame className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-red-600 dark:text-red-400">
              {summary.high_risk_alerts}
            </span>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-red-500/10 text-red-600 dark:text-red-400">
              Priority Review
            </span>
          </div>
          <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
            Compound anomaly indicators
          </div>
        </div>

        {/* KPI 4: Avg Transaction Amount */}
        <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs transition-all duration-200 hover:-translate-y-1 hover:shadow-md cursor-default">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Average Amount
            </span>
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <IndianRupee className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900 dark:text-slate-100">
              ₹{summary.average_amount.toFixed(2)}
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400">mean</span>
          </div>
          <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
            {summary.pending_reviews} pending triage reviews
          </div>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart 1: Daily Trends */}
        <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                14-Day Velocity & Alert Trends
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Evaluated transaction count vs flagged alert events
              </p>
            </div>
            <span className="text-xs font-medium px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
              Chart.js Time Series
            </span>
          </div>
          <div className="h-64">
            <Line data={lineChartData} options={lineChartOptions} />
          </div>
        </div>

        {/* Chart 2: Risk Score Histogram */}
        <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Risk Score Distribution Histogram
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Frequency distribution across risk severity tiers
              </p>
            </div>
            <span className="text-xs font-medium px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
              Distribution
            </span>
          </div>
          <div className="h-64">
            <Bar data={barChartData} options={barChartOptions} />
          </div>
        </div>
      </div>

      {/* Heuristic Rules Breakdown & High Risk Alert Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Rule Breakdown Cards */}
        <div className="lg:col-span-1 p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              Active Rule Trigger Breakdown
            </h3>
            <button
              onClick={onNavigateToRules}
              className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline"
            >
              Config
            </button>
          </div>

          <div className="space-y-3">
            {/* Rule 1 */}
            <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded bg-purple-500/10 text-purple-600 dark:text-purple-400">
                  <Zap className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                    Unusual Amount
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">
                    &gt; 3x customer average (w: 0.40)
                  </div>
                </div>
              </div>
              <span className="text-sm font-bold text-slate-900 dark:text-slate-100">
                {summary.rule_breakdown['unusual_amount'] || 0}
              </span>
            </div>

            {/* Rule 2 */}
            <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400">
                  <Activity className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                    High Frequency
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">
                    &gt; 5 tx in 60 min (w: 0.30)
                  </div>
                </div>
              </div>
              <span className="text-sm font-bold text-slate-900 dark:text-slate-100">
                {summary.rule_breakdown['high_frequency'] || 0}
              </span>
            </div>

            {/* Rule 3 */}
            <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400">
                  <MapPin className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                    Location Change
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">
                    Unseen foreign region (w: 0.20)
                  </div>
                </div>
              </div>
              <span className="text-sm font-bold text-slate-900 dark:text-slate-100">
                {summary.rule_breakdown['location_change'] || 0}
              </span>
            </div>

            {/* Rule 4 */}
            <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                  <Clock className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                    Unusual Time
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">
                    22:00 - 06:00 window (w: 0.10)
                  </div>
                </div>
              </div>
              <span className="text-sm font-bold text-slate-900 dark:text-slate-100">
                {summary.rule_breakdown['unusual_time'] || 0}
              </span>
            </div>
          </div>
        </div>

        {/* Priority Triage Queue Preview */}
        <div className="lg:col-span-2 p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Priority Review Queue (High Risk &gt; 0.70)
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Pending manual triage by compliance officer
                </p>
              </div>
              <button
                onClick={onNavigateToAlerts}
                className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors flex items-center gap-1"
              >
                Open Full Queue <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="divide-y divide-slate-100 dark:divide-slate-800/60 overflow-hidden">
              {recentAlerts.slice(0, 4).map((alert) => (
                <div key={alert.alert_id} className="py-2.5 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="px-2 py-0.5 text-xs font-bold rounded bg-red-500/10 text-red-600 dark:text-red-400">
                      Score: {alert.risk_score.toFixed(2)}
                    </span>
                    <div>
                      <div className="text-xs font-medium text-slate-800 dark:text-slate-200 flex items-center gap-2">
                        <span>{alert.customer_code}</span>
                        <span className="text-slate-400">•</span>
                        <span>₹{alert.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                        <span className="text-slate-400">•</span>
                        <span className="capitalize">{alert.channel}</span>
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate max-w-md">
                        {alert.review_reason}
                      </div>
                    </div>
                  </div>

                  <span
                    className={`shrink-0 px-2 py-0.5 text-[11px] font-semibold rounded-full capitalize ${
                      alert.review_status === 'pending'
                        ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                        : alert.review_status === 'approved'
                        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                        : 'bg-red-500/10 text-red-600 dark:text-red-400'
                    }`}
                  >
                    {alert.review_status}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Showing top flagged alerts</span>
            <span>Total Pending: {summary.pending_reviews}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
