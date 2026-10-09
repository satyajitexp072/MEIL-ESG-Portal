import React from 'react';
import {
  LayoutDashboard,
  FilePlus2,
  CheckCheck,
  FileSpreadsheet,
  BookOpenCheck,
  GitBranch,
  Network,
  Sparkles
} from 'lucide-react';

export default function Sidebar({ currentTab, setTab, pendingCount = 0 }) {
  const menuItems = [
    { id: 'dashboard', label: 'Executive Dashboard', icon: LayoutDashboard },
    { id: 'jury-demo', label: 'Jury Demo Workspace', icon: Sparkles },
    { id: 'data-entry', label: 'Data Ingestion (Maker)', icon: FilePlus2 },
    {
      id: 'verifications',
      label: 'Maker-Checker Queue',
      icon: CheckCheck,
      badge: pendingCount > 0 ? pendingCount : null
    },
    { id: 'brsr-report', label: 'BRSR Section C Disclosure', icon: FileSpreadsheet },
    { id: 'factors', label: 'Emission Factor Registry', icon: BookOpenCheck },
    { id: 'scope3', label: 'Scope 3 Roadmap', icon: GitBranch },
    { id: 'entities', label: 'Organizational Hierarchy', icon: Network },
  ];

  return (
    <aside className="w-64 bg-slate-900 text-slate-300 flex-shrink-0 flex flex-col min-h-[calc(100vh-64px)]">
      <div className="p-4 border-b border-slate-800">
        <div className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">
          MEIL Enterprise Portal
        </div>
        <div className="text-xs text-slate-300 mt-0.5">
          SEBI BRSR Principle 6 Disclosure
        </div>
      </div>

      <nav className="p-3 space-y-1 flex-1">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setTab(item.id)}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                isActive
                  ? 'bg-meil-blue text-white shadow-sm'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <div className="flex items-center space-x-3">
                <Icon className={`w-4 h-4 ${isActive ? 'text-emerald-400' : 'text-slate-400'}`} />
                <span>{item.label}</span>
              </div>
              {item.badge && (
                <span className="bg-amber-500 text-slate-900 text-[11px] font-bold px-2 py-0.5 rounded-full">
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      <div className="p-4 border-t border-slate-800 text-xs text-slate-400">
        <div className="font-semibold text-slate-300">Accounting Protocol</div>
        <div className="text-[11px] mt-0.5">GHG Protocol Corporate Standard & CEA v19 Grid Baseline</div>
      </div>
    </aside>
  );
}
