import React from 'react';
import { Building2, UserCircle2, ChevronDown, CheckCircle2, AlertCircle } from 'lucide-react';

export default function Navbar({ currentUser, onSwitchUser, users = [], pendingCount = 0 }) {
  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Left: Branding */}
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-meil-blue to-meil-dark flex items-center justify-center text-white font-bold text-xl shadow-sm">
            M
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-lg font-bold text-slate-900 leading-tight">
                MEIL <span className="text-meil-blue">ESG Portal</span>
              </h1>
              <span className="bg-emerald-100 text-emerald-800 text-[10px] font-semibold px-2 py-0.5 rounded-full border border-emerald-200">
                BRSR Core
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Megha Engineering & Infrastructures Limited — ESG Data & Reporting
            </p>
          </div>
        </div>

        {/* Right: Active Role & User Switcher */}
        <div className="flex items-center space-x-4">
          {pendingCount > 0 && (
            <div className="hidden sm:flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-amber-50 text-amber-800 border border-amber-200 text-xs font-medium">
              <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
              <span>{pendingCount} Pending Reviews</span>
            </div>
          )}

          {/* User & Role Switcher for Hackathon Evaluation */}
          <div className="flex items-center space-x-2 bg-slate-50 border border-slate-200 rounded-lg p-1.5 pl-3">
            <UserCircle2 className="w-5 h-5 text-meil-blue" />
            <div className="text-left mr-2">
              <div className="text-xs font-bold text-slate-800">
                {currentUser?.name || 'Logged In User'}
              </div>
              <div className="text-[11px] text-slate-500 flex items-center space-x-1">
                <span className="font-medium text-emerald-700 capitalize">
                  {currentUser?.roleTitle || currentUser?.role?.replace('_', ' ')}
                </span>
              </div>
            </div>

            <div className="relative">
              <select
                className="text-xs bg-white border border-slate-300 rounded px-2 py-1 text-slate-700 font-medium focus:outline-none focus:ring-1 focus:ring-meil-blue cursor-pointer"
                value={currentUser?.email || ''}
                onChange={(e) => {
                  const selected = users.find(u => u.email === e.target.value);
                  if (selected && onSwitchUser) onSwitchUser(selected);
                }}
              >
                {users.map((u) => (
                  <option key={u.email} value={u.email}>
                    Switch to: {u.name} ({u.role?.replace('_', ' ')})
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
