import React, { useState, useMemo } from 'react';
import {
  Search,
  Filter,
  Upload,
  Download,
  AlertTriangle,
  ArrowUpDown,
  X,
  ExternalLink,
  Zap,
  Info,
  Plus,
} from 'lucide-react';
import { Transaction } from '../types';

interface TransactionsViewProps {
  transactions: Transaction[];
  onOpenImportModal: () => void;
  onOpenManualModal: () => void;
  onInjectAnomaly: (type: 'amount' | 'burst' | 'region' | 'night') => void;
  onSelectTransaction: (tx: Transaction) => void;
}

export const TransactionsView: React.FC<TransactionsViewProps> = ({
  transactions,
  onOpenImportModal,
  onOpenManualModal,
  onInjectAnomaly,
  onSelectTransaction,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedChannel, setSelectedChannel] = useState<string>('all');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [flaggedOnly, setFlaggedOnly] = useState<boolean>(false);
  const [minAmount, setMinAmount] = useState<string>('');
  const [maxAmount, setMaxAmount] = useState<string>('');
  const [sortField, setSortField] = useState<'transaction_datetime' | 'amount' | 'max_risk_score'>('transaction_datetime');
  const [sortAsc, setSortAsc] = useState<boolean>(false);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [isAnomalyMenuOpen, setIsAnomalyMenuOpen] = useState<boolean>(false);
  const pageSize = 20;

  // Filter transactions
  const filteredTransactions = useMemo(() => {
    return transactions.filter((tx) => {
      if (flaggedOnly && !tx.is_flagged) return false;
      if (selectedChannel !== 'all' && tx.channel !== selectedChannel) return false;
      if (selectedType !== 'all' && tx.transaction_type !== selectedType) return false;
      if (minAmount && tx.amount < parseFloat(minAmount)) return false;
      if (maxAmount && tx.amount > parseFloat(maxAmount)) return false;

      if (searchTerm) {
        const lower = searchTerm.toLowerCase();
        const matchesCust = tx.customer_code?.toLowerCase().includes(lower);
        const matchesId = tx.transaction_id.toString().includes(lower);
        const matchesRegion = tx.region_optional?.toLowerCase().includes(lower);
        const matchesChannel = tx.channel.toLowerCase().includes(lower);
        if (!matchesCust && !matchesId && !matchesRegion && !matchesChannel) return false;
      }
      return true;
    });
  }, [transactions, searchTerm, selectedChannel, selectedType, flaggedOnly, minAmount, maxAmount]);

  // Sort
  const sortedTransactions = useMemo(() => {
    return [...filteredTransactions].sort((a, b) => {
      let valA: any = a[sortField];
      let valB: any = b[sortField];
      if (sortField === 'transaction_datetime') {
        valA = new Date(valA).getTime();
        valB = new Date(valB).getTime();
      }
      if (valA < valB) return sortAsc ? -1 : 1;
      if (valA > valB) return sortAsc ? 1 : -1;
      return 0;
    });
  }, [filteredTransactions, sortField, sortAsc]);

  // Pagination
  const totalPages = Math.ceil(sortedTransactions.length / pageSize) || 1;
  const safePage = Math.min(Math.max(1, currentPage), totalPages);
  const paginatedData = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return sortedTransactions.slice(start, start + pageSize);
  }, [sortedTransactions, safePage, pageSize]);

  const handleSort = (field: 'transaction_datetime' | 'amount' | 'max_risk_score') => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  const handleExportCSV = () => {
    const headers = ['Transaction ID', 'Customer Code', 'Account ID', 'Datetime', 'Amount', 'Type', 'Channel', 'Region', 'Flagged', 'Risk Score'];
    const rows = sortedTransactions.map((tx) => [
      tx.transaction_id,
      tx.customer_code || 'N/A',
      tx.account_id,
      tx.transaction_datetime,
      tx.amount,
      tx.transaction_type,
      tx.channel,
      tx.region_optional || 'N/A',
      tx.is_flagged ? 'YES' : 'NO',
      tx.max_risk_score || 0.0,
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `transactions_export_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-4">
      {/* Top Header & Quick Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
            Transaction Ledger
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Search, filter, and inspect synthetic financial transactions and automated risk flags
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Quick Anomaly Injector */}
          <div className="relative">
            <button
              onClick={() => setIsAnomalyMenuOpen(!isAnomalyMenuOpen)}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 hover:bg-indigo-500/20 transition-colors flex items-center gap-1.5"
            >
              <Zap className="w-3.5 h-3.5" />
              + Quick Anomaly
            </button>
            {isAnomalyMenuOpen && (
              <div className="absolute right-0 mt-1 w-48 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg py-1 z-20">
                <button
                  onClick={() => {
                    onInjectAnomaly('amount');
                    setIsAnomalyMenuOpen(false);
                  }}
                  className="w-full text-left px-3 py-1.5 text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
                >
                  Huge Amount Spike (8x)
                </button>
                <button
                  onClick={() => {
                    onInjectAnomaly('burst');
                    setIsAnomalyMenuOpen(false);
                  }}
                  className="w-full text-left px-3 py-1.5 text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
                >
                  Rapid Burst (7 in 10m)
                </button>
                <button
                  onClick={() => {
                    onInjectAnomaly('region');
                    setIsAnomalyMenuOpen(false);
                  }}
                  className="w-full text-left px-3 py-1.5 text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
                >
                  Foreign Region (RU-East)
                </button>
                <button
                  onClick={() => {
                    onInjectAnomaly('night');
                    setIsAnomalyMenuOpen(false);
                  }}
                  className="w-full text-left px-3 py-1.5 text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
                >
                  3:20 AM Nocturnal Tx
                </button>
              </div>
            )}
          </div>

          <button
            onClick={onOpenManualModal}
            className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-colors flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            Record Transaction
          </button>

          <button
            onClick={onOpenImportModal}
            className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition-colors flex items-center gap-1.5"
          >
            <Upload className="w-3.5 h-3.5" />
            Import Batch
          </button>

          <button
            onClick={handleExportCSV}
            className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition-colors flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            Export CSV
          </button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        <div className="flex-1 flex items-center gap-2">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search by customer, ID, or region..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          {/* Flagged only toggle */}
          <button
            onClick={() => {
              setFlaggedOnly(!flaggedOnly);
              setCurrentPage(1);
            }}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-all flex items-center gap-1.5 ${
              flaggedOnly
                ? 'bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400 font-semibold'
                : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            Flagged Only
          </button>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Channel dropdown */}
          <select
            value={selectedChannel}
            onChange={(e) => {
              setSelectedChannel(e.target.value);
              setCurrentPage(1);
            }}
            className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 focus:outline-none"
          >
            <option value="all">All Channels</option>
            <option value="web">Web</option>
            <option value="mobile_app">Mobile App</option>
            <option value="atm">ATM</option>
            <option value="pos">POS Terminal</option>
            <option value="wire">Wire Transfer</option>
          </select>

          {/* Type dropdown */}
          <select
            value={selectedType}
            onChange={(e) => {
              setSelectedType(e.target.value);
              setCurrentPage(1);
            }}
            className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 focus:outline-none"
          >
            <option value="all">All Types</option>
            <option value="payment">Payment</option>
            <option value="transfer">Transfer</option>
            <option value="withdrawal">Withdrawal</option>
            <option value="pos">POS</option>
            <option value="online">Online</option>
          </select>

          {/* Amount range */}
          <div className="flex items-center gap-1 text-xs text-slate-500">
            <span>₹</span>
            <input
              type="number"
              placeholder="Min"
              value={minAmount}
              onChange={(e) => {
                setMinAmount(e.target.value);
                setCurrentPage(1);
              }}
              className="w-16 px-2 py-1 text-xs rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
            />
            <span>-</span>
            <input
              type="number"
              placeholder="Max"
              value={maxAmount}
              onChange={(e) => {
                setMaxAmount(e.target.value);
                setCurrentPage(1);
              }}
              className="w-16 px-2 py-1 text-xs rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
            />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">TX ID</th>
                <th className="py-3 px-4">Customer</th>
                <th
                  onClick={() => handleSort('transaction_datetime')}
                  className="py-3 px-4 cursor-pointer hover:text-slate-700 dark:hover:text-slate-200 select-none"
                >
                  <div className="flex items-center gap-1">
                    Timestamp
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('amount')}
                  className="py-3 px-4 cursor-pointer hover:text-slate-700 dark:hover:text-slate-200 select-none"
                >
                  <div className="flex items-center gap-1">
                    Amount (₹)
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th className="py-3 px-4">Type</th>
                <th className="py-3 px-4">Channel</th>
                <th className="py-3 px-4">Region</th>
                <th
                  onClick={() => handleSort('max_risk_score')}
                  className="py-3 px-4 cursor-pointer hover:text-slate-700 dark:hover:text-slate-200 select-none text-center"
                >
                  <div className="flex items-center justify-center gap-1">
                    Risk Score
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {paginatedData.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-400">
                    No transactions found matching active filters.
                  </td>
                </tr>
              ) : (
                paginatedData.map((tx) => {
                  const isFlagged = tx.is_flagged;
                  const score = tx.max_risk_score || 0.0;
                  const formattedTime = new Date(tx.transaction_datetime).toLocaleString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: false,
                  });

                  return (
                    <tr
                      key={tx.transaction_id}
                      onClick={() => onSelectTransaction(tx)}
                      className={`hover:bg-slate-50/80 dark:hover:bg-slate-800/40 cursor-pointer transition-colors ${
                        isFlagged
                          ? score >= 0.70
                            ? 'bg-red-500/5 dark:bg-red-500/10'
                            : 'bg-amber-500/5 dark:bg-amber-500/10'
                          : ''
                      }`}
                    >
                      <td className="py-3 px-4 font-mono font-medium text-slate-700 dark:text-slate-300">
                        #{tx.transaction_id}
                      </td>
                      <td className="py-3 px-4 font-semibold text-slate-900 dark:text-slate-100">
                        {tx.customer_code || `Account #${tx.account_id}`}
                      </td>
                      <td className="py-3 px-4 text-slate-600 dark:text-slate-400 font-mono">
                        {formattedTime}
                      </td>
                      <td className="py-3 px-4 font-semibold text-slate-900 dark:text-slate-100">
                        ₹{tx.amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="py-3 px-4 capitalize text-slate-600 dark:text-slate-400">
                        {tx.transaction_type}
                      </td>
                      <td className="py-3 px-4 text-slate-600 dark:text-slate-400">
                        <span className="capitalize">{tx.channel.replace('_', ' ')}</span>
                      </td>
                      <td className="py-3 px-4 text-slate-600 dark:text-slate-400 font-mono">
                        {tx.region_optional || '—'}
                      </td>
                      <td className="py-3 px-4 text-center">
                        {isFlagged ? (
                          <span
                            className={`inline-block px-2 py-0.5 rounded font-mono font-bold text-xs ${
                              score >= 0.70
                                ? 'bg-red-500/15 text-red-600 dark:text-red-400 border border-red-500/20'
                                : score >= 0.40
                                ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                                : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                            }`}
                          >
                            {score.toFixed(2)}
                          </span>
                        ) : score > 0 ? (
                          <span className="inline-block px-2 py-0.5 rounded font-mono font-medium text-xs bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                            {score.toFixed(2)}
                          </span>
                        ) : (
                          <span className="text-slate-400 font-mono text-xs">0.00</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        {isFlagged ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full">
                            <AlertTriangle className="w-3 h-3" />
                            Flagged
                          </span>
                        ) : (
                          <span className="text-[11px] text-slate-400">Benign</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline">
                          View
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="p-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
          <div>
            Showing {(currentPage - 1) * pageSize + 1} to{' '}
            {Math.min(currentPage * pageSize, sortedTransactions.length)} of {sortedTransactions.length} items
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-2.5 py-1 rounded border border-slate-200 dark:border-slate-700 disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              Prev
            </button>
            <span className="px-2 font-medium">
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="px-2.5 py-1 rounded border border-slate-200 dark:border-slate-700 disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
