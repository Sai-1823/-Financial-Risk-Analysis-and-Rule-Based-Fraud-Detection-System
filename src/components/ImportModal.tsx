import React, { useState, useRef } from 'react';
import {
  X,
  Upload,
  FileText,
  CheckCircle2,
  AlertCircle,
  Copy,
  FileCode,
  FolderUp,
} from 'lucide-react';
import { motion } from 'motion/react';

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (items: any[]) => Promise<{ imported: number; alertsCreated: number }>;
}

const SAMPLE_JSON = `[
  {
    "account_id": 11,
    "amount": 7800.00,
    "transaction_type": "transfer",
    "channel": "wire",
    "region_optional": "RU-East",
    "transaction_datetime": "${new Date().toISOString()}"
  },
  {
    "account_id": 11,
    "amount": 45.20,
    "transaction_type": "payment",
    "channel": "web",
    "region_optional": "US-East",
    "transaction_datetime": "${new Date().toISOString()}"
  }
]`;

const SAMPLE_CSV = `account_id,amount,transaction_type,channel,region_optional
11,9200.50,transfer,wire,AF-North
21,35.00,pos,mobile_app,US-East
31,850.00,payment,web,EU-West`;

export const ImportModal: React.FC<ImportModalProps> = ({ isOpen, onClose, onImport }) => {
  const [activeTab, setActiveTab] = useState<'file' | 'json' | 'csv'>('file');

  // Raw Text State (JSON / CSV)
  const [rawText, setRawText] = useState(SAMPLE_JSON);

  // File Upload State
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [resultMsg, setResultMsg] = useState<{ imported: number; alerts: number } | null>(null);

  if (!isOpen) return null;

  const handlePasteSample = () => {
    if (activeTab === 'json') {
      setRawText(SAMPLE_JSON);
    } else if (activeTab === 'csv') {
      setRawText(SAMPLE_CSV);
    } else if (activeTab === 'file') {
      setUploadedFileName('sample_anomalies.csv');
      setFileContent(SAMPLE_CSV);
    }
    setErrorMsg(null);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadedFileName(file.name);
    setErrorMsg(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setFileContent(content);
    };
    reader.onerror = () => {
      setErrorMsg('Failed to read file from disk');
    };
    reader.readAsText(file);
  };

  const parseCsvText = (text: string): any[] => {
    const lines = text
      .trim()
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length < 2) throw new Error('CSV must contain a header row and at least one data row.');
    const headers = lines[0].split(',').map((h) => h.trim());
    const items: any[] = [];

    for (let i = 1; i < lines.length; i++) {
      const parts = lines[i].split(',').map((p) => p.trim());
      const item: any = {};
      headers.forEach((h, idx) => {
        let val: any = parts[idx];
        if (h === 'amount' || h === 'account_id') val = parseFloat(val);
        item[h] = val;
      });
      items.push(item);
    }
    return items;
  };

  const parseInput = (): any[] => {
    if (activeTab === 'file') {
      if (!fileContent) throw new Error('Please select or drop a valid file (.json or .csv).');
      const isJson = uploadedFileName?.toLowerCase().endsWith('.json') || fileContent.trim().startsWith('[');
      if (isJson) {
        const parsed = JSON.parse(fileContent);
        return Array.isArray(parsed) ? parsed : [parsed];
      } else {
        return parseCsvText(fileContent);
      }
    } else if (activeTab === 'json') {
      const parsed = JSON.parse(rawText.trim());
      return Array.isArray(parsed) ? parsed : [parsed];
    } else {
      return parseCsvText(rawText);
    }
  };

  const handleRunImport = async () => {
    setErrorMsg(null);
    setResultMsg(null);
    setIsSubmitting(true);

    try {
      const items = parseInput();
      if (!items || items.length === 0) throw new Error('No valid transactions found to import.');

      const res = await onImport(items);
      setResultMsg({ imported: res.imported, alerts: res.alertsCreated });
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to parse batch payload');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs transition-opacity duration-200">
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.18, ease: 'easeOut' }}
        className="w-full max-w-xl rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <Upload className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Batch Transaction Importer
              </h3>
              <p className="text-xs text-slate-500">
                Import bulk datasets via File Upload, JSON, or CSV
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Format tabs */}
        <div className="px-5 pt-3 pb-2 flex items-center justify-between border-b border-slate-100 dark:border-slate-800 text-xs flex-wrap gap-2">
          <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800/60 p-1 rounded-lg">
            <button
              onClick={() => {
                setActiveTab('file');
                setErrorMsg(null);
              }}
              className={`px-3 py-1 rounded font-semibold flex items-center gap-1.5 transition-all ${
                activeTab === 'file'
                  ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-xs'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <FolderUp className="w-3.5 h-3.5" />
              File Upload (.csv/.json)
            </button>

            <button
              onClick={() => {
                setActiveTab('json');
                setRawText(SAMPLE_JSON);
                setErrorMsg(null);
              }}
              className={`px-3 py-1 rounded font-semibold flex items-center gap-1.5 transition-all ${
                activeTab === 'json'
                  ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-xs'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <FileCode className="w-3.5 h-3.5" />
              JSON Paste
            </button>

            <button
              onClick={() => {
                setActiveTab('csv');
                setRawText(SAMPLE_CSV);
                setErrorMsg(null);
              }}
              className={`px-3 py-1 rounded font-semibold flex items-center gap-1.5 transition-all ${
                activeTab === 'csv'
                  ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-xs'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              CSV Paste
            </button>
          </div>

          <button
            onClick={handlePasteSample}
            className="text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1 font-medium"
          >
            <Copy className="w-3 h-3" /> Fill Anomaly Sample
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 flex-1 flex flex-col space-y-3 overflow-y-auto">
          {/* TAB 1: FILE UPLOAD */}
          {activeTab === 'file' && (
            <div className="space-y-4 text-xs">
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.json,.txt"
                onChange={handleFileChange}
                className="hidden"
              />
              <div
                onClick={() => fileInputRef.current?.click()}
                className="p-8 border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-emerald-500 rounded-xl flex flex-col items-center justify-center cursor-pointer transition-colors text-center"
              >
                <div className="p-3 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 mb-2">
                  <FolderUp className="w-6 h-6 text-emerald-500" />
                </div>
                <div className="font-semibold text-slate-800 dark:text-slate-200 text-sm">
                  {uploadedFileName ? uploadedFileName : 'Click to select or drag and drop a file'}
                </div>
                <p className="text-slate-400 text-[11px] mt-1">
                  Supports .csv, .json, or plain text transaction dumps
                </p>
              </div>

              {fileContent && (
                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
                  <div className="font-semibold text-slate-700 dark:text-slate-300 mb-1 flex items-center justify-between">
                    <span>File Preview ({uploadedFileName}):</span>
                    <span className="text-[10px] text-emerald-500 font-mono">Ready to scan</span>
                  </div>
                  <pre className="text-[10px] font-mono text-slate-600 dark:text-slate-400 max-h-28 overflow-y-auto">
                    {fileContent.slice(0, 400)}...
                  </pre>
                </div>
              )}
            </div>
          )}

          {/* TAB 2 & 3: RAW TEXT (JSON / CSV) */}
          {(activeTab === 'json' || activeTab === 'csv') && (
            <textarea
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              rows={8}
              className="w-full p-3 font-mono text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              placeholder={
                activeTab === 'json' ? '[{"amount": 100, "account_id": 1, ...}]' : 'account_id,amount,...'
              }
            />
          )}

          {errorMsg && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {resultMsg && (
            <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-500" />
              <span>
                Successfully scanned {resultMsg.imported} transaction(s)! Generated{' '}
                <strong>{resultMsg.alerts} new alert(s)</strong> in the review queue.
              </span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2 bg-slate-50/50 dark:bg-slate-800/30">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleRunImport}
            disabled={isSubmitting}
            className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition-colors disabled:opacity-50 flex items-center gap-1.5"
          >
            {isSubmitting ? 'Scanning Heuristics...' : 'Scan & Import Batch'}
          </button>
        </div>
      </motion.div>
    </div>
  );
};
