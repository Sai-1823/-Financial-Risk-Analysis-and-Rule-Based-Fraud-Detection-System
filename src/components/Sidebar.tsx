import React, { useState } from 'react';
import {
  LayoutDashboard,
  ReceiptText,
  AlertTriangle,
  Sliders,
  History,
  Moon,
  Sun,
  ShieldCheck,
} from 'lucide-react';

interface SidebarProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  pendingAlertsCount: number;
  darkMode: boolean;
  setDarkMode: (val: boolean) => void;
  isCollapsed: boolean;
  setIsCollapsed: (val: boolean) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  setCurrentTab,
  pendingAlertsCount,
  darkMode,
  setDarkMode,
  isCollapsed,
  setIsCollapsed,
}) => {
  const [isHovered, setIsHovered] = useState(false);

  // If collapsed but hovered, expand temporarily to allow easy navigation
  const isExpanded = !isCollapsed || isHovered;

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'transactions', label: 'Transactions', icon: ReceiptText },
    {
      id: 'alerts',
      label: 'Alert Queue',
      icon: AlertTriangle,
      badge: pendingAlertsCount > 0 ? pendingAlertsCount : undefined,
    },
    { id: 'rules', label: 'Rule Config', icon: Sliders },
    { id: 'audit', label: 'Audit Logs', icon: History },
  ];

  return (
    <aside
      onMouseEnter={() => {
        if (isCollapsed) setIsHovered(true);
      }}
      onMouseLeave={() => {
        if (isCollapsed) setIsHovered(false);
      }}
      className={`relative z-30 flex flex-col shrink-0 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 transition-all duration-200 ease-in-out ${
        isExpanded ? 'w-64' : 'w-18'
      } ${isCollapsed && isHovered ? 'shadow-2xl' : ''}`}
    >
      {/* Brand Header */}
      <div className="h-16 px-4 flex items-center border-b border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="flex items-center gap-2.5 overflow-hidden">
          <div className="w-9 h-9 shrink-0 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
            <ShieldCheck className="w-5 h-5" />
          </div>
          {isExpanded && (
            <div className="truncate transition-opacity duration-200">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                RiskShield
              </div>
              <div className="text-sm font-bold text-slate-900 dark:text-slate-100 leading-tight truncate">
                Fraud Detection
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Navigation List */}
      <nav className="flex-1 px-2.5 py-4 space-y-1.5 overflow-y-auto overflow-x-hidden">
        {isExpanded && (
          <div className="px-2.5 pb-1 text-[11px] font-semibold tracking-wider text-slate-400 dark:text-slate-500 uppercase">
            Navigation
          </div>
        )}
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setCurrentTab(item.id)}
              className={`w-full flex items-center rounded-lg text-sm font-medium transition-all ${
                isExpanded ? 'px-3 py-2.5 justify-between' : 'p-2.5 justify-center'
              } ${
                isActive
                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
              title={!isExpanded ? item.label : undefined}
            >
              <div className="flex items-center gap-3">
                <Icon
                  className={`w-4 h-4 shrink-0 ${
                    isActive ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'
                  }`}
                />
                {isExpanded && <span className="truncate">{item.label}</span>}
              </div>
              {item.badge !== undefined && (
                isExpanded ? (
                  <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 shrink-0">
                    {item.badge}
                  </span>
                ) : (
                  <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-amber-500" />
                )
              )}
            </button>
          );
        })}
      </nav>

      {/* Bottom Controls */}
      <div className="p-3 border-t border-slate-200 dark:border-slate-800 space-y-2.5 overflow-hidden">
        <div className={`flex items-center gap-1.5 ${!isExpanded ? 'flex-col' : ''}`}>
          <button
            onClick={() => setDarkMode(!darkMode)}
            className={`p-1.5 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg border border-slate-300 dark:border-slate-700 transition-colors ${
              !isExpanded ? 'w-full flex justify-center' : ''
            }`}
            title={darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          >
            {darkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-600" />}
          </button>
        </div>
      </div>
    </aside>
  );
};
