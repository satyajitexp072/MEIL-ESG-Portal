import React, { useState, useEffect } from 'react';
import {
  Flame,
  Zap,
  Gauge,
  ShieldCheck,
  FileCheck,
  TrendingUp,
  AlertTriangle,
  ArrowRight,
  Layers,
  Sparkles
} from 'lucide-react';
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid
} from 'recharts';
import { reportAPI, metricAPI, entityAPI } from '../services/api';

const COLORS = ['#0284c7', '#0d9488', '#f59e0b', '#6366f1', '#ec4899'];

export default function Dashboard({ setTab, onInspectMetric }) {
  const [loading, setLoading] = useState(true);
  const [brsrData, setBrsrData] = useState(null);
  const [metrics, setMetrics] = useState([]);
  const [entities, setEntities] = useState([]);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const [reportRes, metricRes, entityRes] = await Promise.all([
        reportAPI.getBRSRSectionC({ financialYear: 'FY 2024-25' }),
        metricAPI.getAll(),
        entityAPI.getAll()
      ]);

      setBrsrData(reportRes.data.brsrDisclosure);
      setMetrics(metricRes.data.metrics);
      setEntities(entityRes.data.entities);
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-2">
          <div className="w-8 h-8 border-4 border-meil-blue border-t-transparent rounded-full animate-spin mx-auto"></div>
          <div className="text-xs text-slate-500 font-medium">Loading Consolidated ESG Disclosures...</div>
        </div>
      </div>
    );
  }

  const indicator1 = brsrData?.essentialIndicator1_Energy?.table || {};
  const indicator4 = brsrData?.essentialIndicator4_GHG?.table || {};
  const auditSummary = brsrData?.auditSummary || {};

  // Unit and value resolution: handle both CO2-only factors (null tCO2e) and full GHG factors
  const isCO2e = indicator4.totalScope1And2_tCO2e !== null && indicator4.totalScope1And2_tCO2e !== undefined;
  const unitLabel = isCO2e ? 'tCO₂e' : 'tCO₂';

  const scope1Val = indicator4.scope1_tCO2e !== null && indicator4.scope1_tCO2e !== undefined
    ? indicator4.scope1_tCO2e
    : (indicator4.scope1_tCO2 ?? 0);

  const scope2Val = indicator4.scope2_tCO2e !== null && indicator4.scope2_tCO2e !== undefined
    ? indicator4.scope2_tCO2e
    : (indicator4.scope2_Reportable_tCO2 ?? indicator4.scope2_LocationBased_tCO2 ?? 0);

  const totalVal = indicator4.totalScope1And2_tCO2e !== null && indicator4.totalScope1And2_tCO2e !== undefined
    ? indicator4.totalScope1And2_tCO2e
    : (indicator4.totalScope1And2_tCO2 ?? (scope1Val + scope2Val));

  const hasData = (scope1Val > 0 || scope2Val > 0);

  // Chart data: Scope 1 vs Scope 2 Breakdown
  const scopeData = [
    {
      name: 'Scope 1 (Direct)',
      value: Number(scope1Val.toFixed(2)),
      fill: '#f97316',
      color: '#f97316'
    },
    {
      name: 'Scope 2 (Grid & Purchased)',
      value: Number(scope2Val.toFixed(2)),
      fill: '#0284c7',
      color: '#0284c7'
    }
  ];
  const scopeChartData = scopeData;

  // Bar chart data by Entity (using same reporting period and verified filter as underlying report)
  const reportingFY = brsrData?.meta?.financialYear || 'FY 2024-25';
  const eligibleMetrics = (brsrData?.rawDataTrace && brsrData.rawDataTrace.length > 0)
    ? brsrData.rawDataTrace
    : metrics.filter(m =>
        (m.reportingPeriod?.financialYear === reportingFY || m.financialYear === reportingFY) &&
        m.status === 'Verified'
      );

  const entityEmissionsMap = {};
  eligibleMetrics.forEach(m => {
    const eName = m.entity?.name ? m.entity.name.split('(')[0].trim() : 'Other';
    if (!entityEmissionsMap[eName]) {
      entityEmissionsMap[eName] = { name: eName.substring(0, 18), scope1: 0, scope2: 0 };
    }
    const metricCo2 = m.calculatedEmissions?.co2Tonnes ?? m.calculatedEmissions?.co2eTonnes ?? 0;
    if (m.scope === 1) {
      entityEmissionsMap[eName].scope1 = Number((entityEmissionsMap[eName].scope1 + metricCo2).toFixed(2));
    } else if (m.scope === 2) {
      entityEmissionsMap[eName].scope2 = Number((entityEmissionsMap[eName].scope2 + metricCo2).toFixed(2));
    }
  });

  const entityChartData = Object.values(entityEmissionsMap);
  const hasEntityData = entityChartData.length > 0 && entityChartData.some(e => e.scope1 > 0 || e.scope2 > 0);

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-meil-dark to-slate-900 rounded-2xl p-6 text-white shadow-md relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[11px] font-semibold border border-emerald-500/30">
              <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
              <span>SEBI BRSR Principle 6 Disclosure Ready</span>
            </div>
            <h2 className="text-xl md:text-2xl font-bold">
              MEIL Group ESG & Carbon Accounting Dashboard
            </h2>
            <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
              Centralized sustainability performance reporting covering subsidiaries (Olectra Greentech, Megha City Gas) and heavy EPC project sites with full mathematical traceability and human expert review.
            </p>
          </div>

          <div className="flex items-center space-x-3 flex-shrink-0">
            <button
              onClick={() => setTab('data-entry')}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition-all shadow-sm"
            >
              + Ingest Site Data
            </button>
            <button
              onClick={() => setTab('brsr-report')}
              className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg text-xs font-semibold backdrop-blur-sm border border-white/20 transition-all"
            >
              View BRSR Section C
            </button>
          </div>
        </div>
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Scope 1 */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Scope 1 (Direct GHG)</span>
            <div className="p-1.5 bg-orange-50 text-orange-600 rounded-lg">
              <Flame className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900">
            {scope1Val.toLocaleString()} <span className="text-xs font-semibold text-slate-500">{unitLabel}</span>
          </div>
          <div className="mt-1 text-[11px] text-slate-500 flex items-center space-x-1">
            <span>DG Sets, Excavators, Fuel Gas</span>
          </div>
        </div>

        {/* Scope 2 */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Scope 2 (Indirect Grid)</span>
            <div className="p-1.5 bg-sky-50 text-sky-600 rounded-lg">
              <Zap className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900">
            {scope2Val.toLocaleString()} <span className="text-xs font-semibold text-slate-500">{unitLabel}</span>
          </div>
          <div className="mt-1 text-[11px] text-slate-500 flex items-center space-x-1">
            <span>CEA Grid Baseline v19 (0.716)</span>
          </div>
        </div>

        {/* Total Energy Consumed */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Total Energy Consumed</span>
            <div className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg">
              <Gauge className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900">
            {(indicator1.totalEnergy_MWh ?? 0).toLocaleString()} <span className="text-xs font-semibold text-slate-500">MWh</span>
          </div>
          <div className="mt-1 text-[11px] text-emerald-600 font-semibold flex items-center space-x-1">
            <span>{indicator1.renewableEnergyPercentage ?? 0}% Renewable Share</span>
            <span className="text-slate-400 font-normal">({indicator1.renewableEnergy_MWh ?? 0} MWh)</span>
          </div>
        </div>

        {/* GHG Intensity */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>GHG Emission Intensity</span>
            <div className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900">
            {indicator4.ghgIntensityPerTurnoverCrores !== null && indicator4.ghgIntensityPerTurnoverCrores !== undefined
              ? indicator4.ghgIntensityPerTurnoverCrores
              : 'N/A'}
          </div>
          <div className="mt-1 text-[11px] text-slate-500">
            {unitLabel} / ₹ Crore Turnover (SEBI metric)
          </div>
        </div>
      </div>

      {/* Assurance & Traceability Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="p-2 rounded-lg bg-emerald-50 text-emerald-700">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs font-bold text-slate-800">
              Traceability & Human Review Verification Status
            </div>
            <div className="text-[11px] text-slate-500">
              Maker-Checker audit assurance rate across operational data submissions
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4 text-xs">
          <div className="flex items-center space-x-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
            <span className="text-slate-600">Verified: <strong>{auditSummary.verifiedDataPoints}</strong></span>
          </div>
          <div className="flex items-center space-x-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
            <span className="text-slate-600">Under Review: <strong>{auditSummary.pendingReviewPoints}</strong></span>
          </div>
          <div className="flex items-center space-x-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500"></span>
            <span className="text-slate-600">Rejected: <strong>{auditSummary.rejectedPoints}</strong></span>
          </div>
          <div className="pl-3 border-l border-slate-200 flex items-center space-x-1.5">
            <FileCheck className="w-4 h-4 text-meil-blue" />
            <span className="text-slate-700">Evidence Rate: <strong>{auditSummary.evidenceAttachmentRate}%</strong></span>
          </div>
          <button
            onClick={() => setTab('verifications')}
            className="text-xs font-semibold text-meil-blue hover:underline flex items-center space-x-1 ml-2"
          >
            <span>Review Queue</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart 1: Scope 1 vs Scope 2 Breakdown */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-800">
              GHG Emissions Breakdown (Scope 1 vs Scope 2)
            </h3>
            <span className="text-[11px] text-slate-500">
              Total: {Number(totalVal.toFixed(2)).toLocaleString()} {unitLabel}
            </span>
          </div>

          {hasData ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={scopeData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(value) => [`${Number(value).toFixed(2)} ${unitLabel}`, 'Emissions']} />
                  <Legend
                    payload={[
                      { value: 'Scope 1 (Direct)', type: 'rect', id: 'scope1', color: '#f97316' },
                      { value: 'Scope 2 (Grid & Purchased)', type: 'rect', id: 'scope2', color: '#0284c7' }
                    ]}
                  />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={60}>
                    {scopeData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill || entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-64 flex flex-col items-center justify-center text-center p-6 bg-slate-50 rounded-xl border border-dashed border-slate-200">
              <Layers className="w-8 h-8 text-slate-300 mb-2" />
              <p className="text-xs font-semibold text-slate-600">No Verified Emission Data Available</p>
              <p className="text-[11px] text-slate-400 mt-0.5 max-w-xs">
                No eligible verified Scope 1 or Scope 2 records were found for {brsrData?.meta?.financialYear || 'the selected period'}.
              </p>
            </div>
          )}
        </div>

        {/* Chart 2: Emissions by Entity / Site */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-800">
              Emissions by Entity & Project Site ({unitLabel})
            </h3>
            <span className="text-[11px] text-slate-500">Multi-Subsidiary Boundary</span>
          </div>

          {hasEntityData ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={entityChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(value) => [`${value} ${unitLabel}`]} />
                  <Legend />
                  <Bar dataKey="scope1" name="Scope 1 Direct" fill="#f97316" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="scope2" name="Scope 2 Grid" fill="#0284c7" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-64 flex flex-col items-center justify-center text-center p-6 bg-slate-50 rounded-xl border border-dashed border-slate-200">
              <Layers className="w-8 h-8 text-slate-300 mb-2" />
              <p className="text-xs font-semibold text-slate-600">No Entity Emissions Data Available</p>
              <p className="text-[11px] text-slate-400 mt-0.5 max-w-xs">
                No eligible verified Scope 1 or Scope 2 records were found for {brsrData?.meta?.financialYear || 'the selected period'}.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Recent Traceable Data Entries Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-800">Recent Reported Figures & Traceability Status</h3>
            <p className="text-xs text-slate-500">Every record is linked to source evidence and verifiable calculation steps</p>
          </div>
          <button
            onClick={() => setTab('verifications')}
            className="text-xs font-semibold text-meil-blue hover:underline flex items-center space-x-1"
          >
            <span>All Data Entries</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                <th className="py-2.5 px-4">Entity / Site</th>
                <th className="py-2.5 px-4">Scope & Activity</th>
                <th className="py-2.5 px-4">Quantity Reported</th>
                <th className="py-2.5 px-4">GHG Impact</th>
                <th className="py-2.5 px-4">Evidence</th>
                <th className="py-2.5 px-4">Verification Status</th>
                <th className="py-2.5 px-4 text-right">Audit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {metrics.slice(0, 5).map((m) => {
                const statusColors = {
                  Verified: 'bg-emerald-100 text-emerald-800 border-emerald-200',
                  Submitted: 'bg-amber-100 text-amber-800 border-amber-200',
                  Under_Review: 'bg-blue-100 text-blue-800 border-blue-200',
                  Rejected: 'bg-red-100 text-red-800 border-red-200',
                };

                return (
                  <tr key={m._id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4 font-medium text-slate-900">
                      {m.entity?.name}
                      <div className="text-[10px] text-slate-400">{m.entity?.location?.state || 'India'}</div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-semibold text-slate-800">Scope {m.scope}:</span> {m.subCategory}
                      <div className="text-[10px] text-slate-400 font-mono">
                        {m.emissionFactor?.sourceCitation?.substring(0, 40)}...
                      </div>
                    </td>
                    <td className="py-3 px-4 font-mono">
                      {m.activityData?.value?.toLocaleString()} {m.activityData?.unit}
                    </td>
                    <td className="py-3 px-4 font-bold text-slate-800">
                      {m.calculatedEmissions?.co2Tonnes ?? m.calculatedEmissions?.co2eTonnes} {m.calculatedEmissions?.gasCoverage === 'CO2_ONLY' ? 'tCO₂' : 'tCO₂e'}
                    </td>
                    <td className="py-3 px-4">
                      {m.evidenceDocuments?.length > 0 ? (
                        <span className="inline-flex items-center space-x-1 text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 text-[10px] font-medium">
                          <FileCheck className="w-3 h-3" />
                          <span>{m.evidenceDocuments.length} Attached</span>
                        </span>
                      ) : (
                        <span className="text-slate-400 text-[11px]">None</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold border ${statusColors[m.status] || 'bg-slate-100 text-slate-700'}`}>
                        {m.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => onInspectMetric(m)}
                        className="text-xs font-semibold text-meil-blue hover:text-blue-800 underline"
                      >
                        Inspect Trace
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
