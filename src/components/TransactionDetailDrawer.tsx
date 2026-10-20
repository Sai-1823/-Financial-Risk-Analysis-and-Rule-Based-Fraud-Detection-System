import React from 'react';
import { X, AlertTriangle, ShieldCheck, Clock, MapPin, IndianRupee, Activity, FileText } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Transaction } from '../types';

interface TransactionDetailDrawerProps {
  transaction: Transaction | null;
  onClose: () => void;
  onNavigateToAlertQueue?: () => void;
}

export const TransactionDetailDrawer: React.FC<TransactionDetailDrawerProps> = ({
  transaction,
  onClose,
  onNavigateToAlertQueue,
}) => {
  if (!transaction) return null;

  const score = transaction.max_risk_score || 0.0;
  const isFlagged = transaction.is_flagged;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-xs transition-opacity duration-200">
      <motion.div
        initial={{ x: 80, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: 80, opacity: 0 }}
        transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-md h-full bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div
              className={`p-2 rounded-lg ${
                isFlagged
                  ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                  : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
              }`}
            >
              {isFlagged ? <AlertTriangle className="w-5 h-5" /> : <ShieldCheck className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Transaction #{transaction.transaction_id}
              </h3>
              <p className="text-xs text-slate-500">{transaction.customer_code || 'Synthetic Account'}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6 text-xs">
          {/* Risk Score Pill Card */}
          <div
            className={`p-4 rounded-xl border flex items-center justify-between ${
              score >= 0.70
                ? 'bg-red-500/10 border-red-500/20 text-red-700 dark:text-red-300'
                : score >= 0.40
                ? 'bg-amber-500/10 border-amber-500/20 text-amber-700 dark:text-amber-300'
                : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-700 dark:text-emerald-300'
            }`}
          >
            <div>
              <div className="font-semibold text-xs uppercase tracking-wider">Automated Risk Score</div>
              <div className="text-[11px] opacity-80">
                {isFlagged ? 'Flagged for Human Manual Review' : 'Within Benign Parameters'}
              </div>
            </div>
            <div className="text-2xl font-bold font-mono">{score.toFixed(2)}</div>
          </div>

          {/* Core Properties */}
          <div className="space-y-3">
            <h4 className="font-semibold text-slate-900 dark:text-slate-100 uppercase tracking-wider text-[11px] text-slate-400">
              Transaction Details
            </h4>
            <div className="grid grid-cols-2 gap-3 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800">
              <div>
                <span className="text-slate-400 text-[11px]">Amount:</span>
                <p className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                  ₹{transaction.amount.toFixed(2)}
                </p>
              </div>
              <div>
                <span className="text-slate-400 text-[11px]">Type:</span>
                <p className="font-semibold capitalize text-slate-800 dark:text-slate-200">
                  {transaction.transaction_type}
                </p>
              </div>
              <div>
                <span className="text-slate-400 text-[11px]">Channel:</span>
                <p className="font-semibold capitalize text-slate-800 dark:text-slate-200">
                  {transaction.channel.replace('_', ' ')}
                </p>
              </div>
              <div>
                <span className="text-slate-400 text-[11px]">Geographic Region:</span>
                <p className="font-semibold font-mono text-slate-800 dark:text-slate-200">
                  {transaction.region_optional || 'Unspecified'}
                </p>
              </div>
              <div className="col-span-2">
                <span className="text-slate-400 text-[11px]">Execution Time:</span>
                <p className="font-mono text-slate-700 dark:text-slate-300">
                  {new Date(transaction.transaction_datetime).toUTCString()}
                </p>
              </div>
            </div>
          </div>

          {/* Triggered Alerts & Rationale */}
          <div className="space-y-3">
            <h4 className="font-semibold text-slate-900 dark:text-slate-100 uppercase tracking-wider text-[11px] text-slate-400">
              Heuristic Flags & Reasons
            </h4>
            {transaction.alerts && transaction.alerts.length > 0 ? (
              <div className="space-y-2">
                {transaction.alerts.map((a) => (
                  <div
                    key={a.alert_id}
                    className="p-3.5 rounded-xl border border-amber-500/20 bg-amber-500/5 dark:bg-amber-500/10 space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-amber-700 dark:text-amber-300 uppercase font-mono text-[10px]">
                        ALT-{a.alert_id} • {a.rule_name}
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold capitalize bg-amber-500/20 text-amber-700 dark:text-amber-300">
                        {a.review_status}
                      </span>
                    </div>
                    <p className="text-slate-600 dark:text-slate-400 text-[11px] leading-relaxed">
                      {a.review_reason}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/20 text-slate-500 text-center">
                No rules were triggered for this transaction.
              </div>
            )}
          </div>

          {/* Ethical disclaimer reminder */}
          <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 text-[11px] text-slate-500 leading-normal">
            <strong>RiskShield Policy:</strong> Flags generated by heuristic rules represent risk alerts for human manual review only. They must never be classified as confirmed fraud without verification.
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex justify-end gap-2">
          {isFlagged && onNavigateToAlertQueue && (
            <button
              onClick={() => {
                onClose();
                onNavigateToAlertQueue();
              }}
              className="px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-amber-600 hover:bg-amber-700 text-white transition-colors"
            >
              Open in Alert Queue
            </button>
          )}
          <button
            onClick={onClose}
            className="px-3.5 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            Close
          </button>
        </div>
      </motion.div>
    </div>
  );
};
