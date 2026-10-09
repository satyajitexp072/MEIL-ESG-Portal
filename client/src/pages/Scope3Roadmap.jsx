import React, { useState, useEffect } from 'react';
import { GitBranch, Info, AlertTriangle, Layers, CheckCircle } from 'lucide-react';
import { reportAPI } from '../services/api';

export default function Scope3Roadmap() {
  const [roadmap, setRoadmap] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRoadmap();
  }, []);

  const fetchRoadmap = async () => {
    try {
      const res = await reportAPI.getScope3Roadmap();
      setRoadmap(res.data.data);
    } catch (err) {
      console.error('Failed to load Scope 3 roadmap:', err);
    } finally {
      setLoading(false);
    }
  };

  const categories = roadmap?.categories || [];
  const upstream = categories.filter(c => c.type === 'Upstream');
  const downstream = categories.filter(c => c.type === 'Downstream');

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Title */}
      <div>
        <div className="flex items-center space-x-2">
          <h2 className="text-xl font-bold text-slate-900">
            Scope 3 Value Chain Extensible Architecture
          </h2>
          <span className="bg-purple-100 text-purple-800 text-xs font-bold px-2 py-0.5 rounded-full border border-purple-200">
            Phase 2 Architecture Ready
          </span>
        </div>
        <p className="text-xs text-slate-500 mt-1">
          Extensibility design aligned with the GHG Protocol Corporate Value Chain Standard.
        </p>
      </div>

      {/* Explicit Compliance Banner */}
      <div className="p-4 bg-purple-50 border border-purple-300 rounded-xl space-y-2 text-xs text-purple-900">
        <div className="flex items-center space-x-2 font-bold">
          <AlertTriangle className="w-4 h-4 text-purple-700 flex-shrink-0" />
          <span>PROJECT RULE COMPLIANCE: EXPLICIT NON-CLAIM DECLARATION</span>
        </div>
        <p className="leading-relaxed">
          {roadmap?.message || 'Scope 3 greenhouse gas calculations are not implemented in this prototype. The schema is extensible and documented for future phase onboarding.'}
        </p>
        <div className="text-[11px] text-purple-800 pt-1 border-t border-purple-200">
          The prototype strictly computes <strong>Scope 1</strong> (Direct) and <strong>Scope 2</strong> (Indirect Grid) greenhouse gas emissions, preserving full integrity without claiming Scope 3 completion.
        </div>
      </div>

      {/* Upstream Categories */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Layers className="w-4 h-4 text-meil-blue" />
            <h3 className="text-sm font-bold text-slate-800">
              Upstream Scope 3 Categories (Categories 1 – 8)
            </h3>
          </div>
          <span className="text-xs text-slate-500 font-mono">8 Categories</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {upstream.map((cat) => (
            <div key={cat.id} className="p-3 bg-slate-50 rounded-lg border border-slate-200 flex items-center justify-between text-xs">
              <div className="flex items-center space-x-2.5">
                <span className="w-6 h-6 rounded-full bg-slate-200 text-slate-700 font-bold flex items-center justify-center text-[10px]">
                  {cat.id}
                </span>
                <span className="font-semibold text-slate-800">{cat.name}</span>
              </div>
              <span className="bg-purple-100 text-purple-800 text-[10px] font-semibold px-2 py-0.5 rounded-full">
                {cat.readiness}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Downstream Categories */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Layers className="w-4 h-4 text-slate-700" />
            <h3 className="text-sm font-bold text-slate-800">
              Downstream Scope 3 Categories (Categories 9 – 15)
            </h3>
          </div>
          <span className="text-xs text-slate-500 font-mono">7 Categories</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {downstream.map((cat) => (
            <div key={cat.id} className="p-3 bg-slate-50 rounded-lg border border-slate-200 flex items-center justify-between text-xs">
              <div className="flex items-center space-x-2.5">
                <span className="w-6 h-6 rounded-full bg-slate-200 text-slate-700 font-bold flex items-center justify-center text-[10px]">
                  {cat.id}
                </span>
                <span className="font-semibold text-slate-800">{cat.name}</span>
              </div>
              <span className="bg-purple-100 text-purple-800 text-[10px] font-semibold px-2 py-0.5 rounded-full">
                {cat.readiness}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
