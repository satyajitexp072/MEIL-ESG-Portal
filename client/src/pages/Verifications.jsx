import React, { useState, useEffect } from 'react';
import {
  CheckCheck,
  Filter,
  FileCheck,
  AlertCircle,
  Clock,
  ShieldCheck,
  Search,
  ExternalLink,
  ChevronRight
} from 'lucide-react';
import { metricAPI, verificationAPI } from '../services/api';
import VerificationModal from '../components/VerificationModal';
import EvidenceModal from '../components/EvidenceModal';

export default function Verifications({ currentUser, onVerifiedRefresh }) {
  const [metrics, setMetrics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  // Modals state
  const [selectedMetricForReview, setSelectedMetricForReview] = useState(null);
  const [selectedMetricForEvidence, setSelectedMetricForEvidence] = useState(null);

  useEffect(() => {
    fetchMetrics();
  }, [filterStatus]);

  const fetchMetrics = async () => {
    setLoading(true);
    try {
      const params = {};
      if (filterStatus !== 'ALL') {
        params.status = filterStatus;
      }
      const res = await metricAPI.getAll(params);
      setMetrics(res.data.metrics);
    } catch (err) {
      console.error('Failed to load metrics for verification:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmReview = async (metricId, reviewData) => {
    await verificationAPI.review(metricId, reviewData);
    await fetchMetrics();
    if (onVerifiedRefresh) onVerifiedRefresh();
  };

  const filteredMetrics = metrics.filter((m) => {
    const q = searchTerm.toLowerCase();
    const entityName = (m.entity?.name || '').toLowerCase();
    const subCat = (m.subCategory || '').toLowerCase();
    return entityName.includes(q) || subCat.includes(q);
  });

  const pendingCount = metrics.filter(m => m.status === 'Submitted' || m.status === 'Under_Review').length;
  const verifiedCount = metrics.filter(m => m.status === 'Verified').length;
  const rejectedCount = metrics.filter(m => m.status === 'Rejected').length;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <h2 className="text-xl font-bold text-slate-900">
              Maker-Checker Verification & Assurance Audit Queue
            </h2>
            <span className="bg-emerald-100 text-emerald-800 text-xs font-bold px-2 py-0.5 rounded-full border border-emerald-200">
              Human-in-the-Loop
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Independent review screen for BU Sustainability Reviewers & Assurance Auditors. Verify activity logs, mathematical calculations, and uploaded utility bills before inclusion in the official BRSR Section C disclosure.
          </p>
        </div>

        {/* Status Count Badges */}
        <div className="flex items-center space-x-2 text-xs flex-shrink-0">
          <div className="px-3 py-1 rounded-lg bg-amber-50 text-amber-800 border border-amber-200 font-semibold">
            {pendingCount} Pending Review
          </div>
          <div className="px-3 py-1 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 font-semibold">
            {verifiedCount} Verified
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Status Tabs */}
        <div className="flex items-center space-x-1.5 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
          <button
            onClick={() => setFilterStatus('ALL')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              filterStatus === 'ALL'
                ? 'bg-slate-900 text-white'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            All Submissions ({metrics.length})
          </button>
          <button
            onClick={() => setFilterStatus('Submitted')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              filterStatus === 'Submitted'
                ? 'bg-amber-600 text-white'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Awaiting Review
          </button>
          <button
            onClick={() => setFilterStatus('Under_Review')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              filterStatus === 'Under_Review'
                ? 'bg-blue-600 text-white'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Under Review
          </button>
          <button
            onClick={() => setFilterStatus('Verified')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              filterStatus === 'Verified'
                ? 'bg-emerald-600 text-white'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Verified & Approved
          </button>
          <button
            onClick={() => setFilterStatus('Rejected')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              filterStatus === 'Rejected'
                ? 'bg-red-600 text-white'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Rejected / Revisions
          </button>
        </div>

        {/* Search */}
        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            className="w-full text-xs pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-meil-blue"
            placeholder="Search site, machinery, or entity..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* Main Review Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-xs text-slate-500">Loading verification items...</div>
        ) : filteredMetrics.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-xs">
            No entries found matching the selected filter.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                  <th className="py-3 px-4">Entity & Site</th>
                  <th className="py-3 px-4">Scope & Activity</th>
                  <th className="py-3 px-4">Reported Activity Data</th>
                  <th className="py-3 px-4">CO₂e Impact</th>
                  <th className="py-3 px-4">Supporting Evidence</th>
                  <th className="py-3 px-4">Status & Last Audit Note</th>
                  <th className="py-3 px-4 text-right">Human Review Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredMetrics.map((m) => {
                  const statusBadges = {
                    Verified: 'bg-emerald-100 text-emerald-800 border-emerald-300',
                    Submitted: 'bg-amber-100 text-amber-800 border-amber-300',
                    Under_Review: 'bg-blue-100 text-blue-800 border-blue-300',
                    Rejected: 'bg-red-100 text-red-800 border-red-300',
                  };

                  const lastReview = m.reviewHistory && m.reviewHistory.length > 0
                    ? m.reviewHistory[m.reviewHistory.length - 1]
                    : null;

                  return (
                    <tr key={m._id} className="hover:bg-slate-50/80 transition-colors">
                      {/* Entity & Location */}
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-800">{m.entity?.name}</div>
                        <div className="text-[10px] text-slate-500 flex items-center space-x-1 mt-0.5">
                          <span>{m.entity?.type}</span>
                          <span>•</span>
                          <span>{m.entity?.location?.state || 'India'}</span>
                          {m.isDemoData && (
                            <span className="bg-slate-100 text-slate-600 font-mono text-[9px] px-1 rounded">
                              DEMO
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Scope & Activity */}
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-800">
                          Scope {m.scope}: {m.subCategory}
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          Period: {m.reportingPeriod?.financialYear} ({m.reportingPeriod?.month})
                        </div>
                      </td>

                      {/* Quantity */}
                      <td className="py-3.5 px-4 font-mono font-medium text-slate-800">
                        {m.activityData?.value?.toLocaleString()} {m.activityData?.unit}
                      </td>

                      {/* Computed CO2e */}
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-emerald-700 font-mono text-sm">
                          {m.calculatedEmissions?.co2Tonnes ?? m.calculatedEmissions?.co2eTonnes} {m.calculatedEmissions?.gasCoverage === 'CO2_ONLY' ? 'tCO₂' : 'tCO₂e'}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {m.calculatedEmissions?.energyMWh} MWh
                        </div>
                      </td>

                      {/* Evidence */}
                      <td className="py-3.5 px-4">
                        {m.evidenceDocuments?.length > 0 ? (
                          <button
                            onClick={() => setSelectedMetricForEvidence(m)}
                            className="inline-flex items-center space-x-1 text-meil-blue hover:text-blue-800 font-semibold bg-blue-50 px-2 py-1 rounded border border-blue-200 text-[10px]"
                          >
                            <FileCheck className="w-3.5 h-3.5" />
                            <span>{m.evidenceDocuments.length} Document(s)</span>
                          </button>
                        ) : (
                          <span className="text-slate-400 italic text-[11px]">No file</span>
                        )}
                      </td>

                      {/* Status & Last Review */}
                      <td className="py-3.5 px-4 max-w-xs">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold border ${statusBadges[m.status]}`}>
                          {m.status.replace('_', ' ')}
                        </span>
                        {lastReview && (
                          <div className="text-[10px] text-slate-500 mt-1 truncate" title={lastReview.remarks}>
                            <strong>{lastReview.performedByName}:</strong> {lastReview.remarks}
                          </div>
                        )}
                      </td>

                      {/* Review Action */}
                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={() => setSelectedMetricForReview(m)}
                          className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs transition-colors shadow-sm inline-flex items-center space-x-1"
                        >
                          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Inspect & Verify</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modals */}
      <VerificationModal
        isOpen={!!selectedMetricForReview}
        onClose={() => setSelectedMetricForReview(null)}
        metric={selectedMetricForReview}
        onConfirmReview={handleConfirmReview}
        currentUser={currentUser}
      />

      <EvidenceModal
        isOpen={!!selectedMetricForEvidence}
        onClose={() => setSelectedMetricForEvidence(null)}
        metric={selectedMetricForEvidence}
      />
    </div>
  );
}
