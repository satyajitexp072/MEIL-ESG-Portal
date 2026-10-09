import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  FileCheck,
  ArrowRight,
  RotateCcw,
  Upload,
  UserCheck,
  Building,
  Flame,
  Zap,
  Info,
  Calendar,
  Layers,
  Sparkles,
  Download,
  Send,
  CornerUpLeft,
  XCircle,
  Clock,
  Eye,
  FileSpreadsheet
} from 'lucide-react';
import { demoAPI, entityAPI, factorAPI, metricAPI, authAPI, evidenceAPI } from '../services/api';

const DEMO_PERSONAS = [
  {
    email: 'collector@meil.in',
    name: 'Vikram Sharma',
    roleTitle: 'Site ESG Data Collector',
    role: 'site_engineer',
    stepNumber: 1,
    description: 'Submits operational fuel/electricity activity data with attached invoices & meter logs.'
  },
  {
    email: 'manager@meil.in',
    name: 'Priya Iyer',
    roleTitle: 'BU Sustainability Reviewer',
    role: 'bu_manager',
    stepNumber: 2,
    description: 'Performs primary BU sanity check. Approves forward, returns for correction, or rejects.'
  },
  {
    email: 'auditor@meil.in',
    name: 'Dr. Arun Nambiar',
    roleTitle: 'Lead ESG Assurance Auditor',
    role: 'sustainability_auditor',
    stepNumber: 3,
    description: 'Independent third-party checker. Audits calculations, evidence, and validates Scope 2 claims.'
  },
  {
    email: 'admin@meil.in',
    name: 'Chief Sustainability Officer',
    roleTitle: 'CSO & Corporate Admin',
    role: 'corporate_admin',
    stepNumber: 4,
    description: 'Executive governance. Performs final corporate statutory sign-off and safe workspace resets.'
  }
];

export default function JuryDemo({ currentUser, onSwitchUser }) {
  const [entries, setEntries] = useState([]);
  const [summary, setSummary] = useState(null);
  const [entities, setEntities] = useState([]);
  const [factors, setFactors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('pipeline'); // 'pipeline' | 'summary'

  // Submission Form State
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [entityId, setEntityId] = useState('');
  const [scope, setScope] = useState(1);
  const [emissionFactorId, setEmissionFactorId] = useState('');
  const [category, setCategory] = useState('Liquid Fuel');
  const [subCategory, setSubCategory] = useState('Stationary Diesel DG Set');
  const [activityValue, setActivityValue] = useState('1000');
  const [activityUnit, setActivityUnit] = useState('liter');
  const [invoiceNumber, setInvoiceNumber] = useState('INV-DEMO-2024-001');
  const [notes, setNotes] = useState('Operational site generation for Himalayan tunnel excavation.');
  const [evidenceFiles, setEvidenceFiles] = useState([]);
  const [calcPreview, setCalcPreview] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Review / Correction Action State
  const [actionModal, setActionModal] = useState(null); // { type: 'bu'|'auditor'|'corporate'|'resubmit', entry: obj }
  const [reviewAction, setReviewAction] = useState('BU_APPROVE');
  const [reviewRemarks, setReviewRemarks] = useState('');
  const [verifiedScope2Claim, setVerifiedScope2Claim] = useState(false);
  const [resubmitValue, setResubmitValue] = useState('');
  const [resubmitUnit, setResubmitUnit] = useState('');
  const [resubmitRemarks, setResubmitRemarks] = useState('');
  const [resubmitFiles, setResubmitFiles] = useState([]);
  const [actionLoading, setActionLoading] = useState(false);

  // Reset Confirmation State
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [switchingRole, setSwitchingRole] = useState(false);

  const handleRoleSelect = async (persona) => {
    if (switchingRole || currentUser?.email === persona.email) return;
    setSwitchingRole(true);
    try {
      await onSwitchUser(persona);
    } catch (err) {
      console.error('Role switch failed:', err);
    } finally {
      setSwitchingRole(false);
    }
  };

  const handleOpenSubmitModal = async () => {
    if (currentUser?.email !== 'collector@meil.in') {
      const collectorPersona = DEMO_PERSONAS.find(p => p.role === 'site_engineer');
      if (collectorPersona) {
        setSwitchingRole(true);
        try {
          await onSwitchUser(collectorPersona);
        } catch (err) {
          return;
        } finally {
          setSwitchingRole(false);
        }
      }
    }
    setShowSubmitModal(true);
  };

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [entriesRes, summaryRes, entRes, facRes] = await Promise.all([
        demoAPI.getEntries(),
        demoAPI.getSummary().catch(() => ({ data: null })),
        entityAPI.getAll(),
        factorAPI.getAll()
      ]);
      setEntries(entriesRes.data.entries || []);
      setSummary(summaryRes?.data || null);
      setEntities(entRes.data.entities || []);
      setFactors(facRes.data.factors || []);

      if (entRes.data.entities?.length > 0) {
        setEntityId(entRes.data.entities[0]._id);
      }
      if (facRes.data.factors?.length > 0) {
        setEmissionFactorId(facRes.data.factors[0]._id);
      }
    } catch (err) {
      console.error('Failed to load demo workspace data:', err);
    } finally {
      setLoading(false);
    }
  };

  // Live calculation preview
  useEffect(() => {
    if (activityValue && emissionFactorId && activityUnit) {
      runPreview();
    }
  }, [activityValue, emissionFactorId, activityUnit]);

  const runPreview = async () => {
    try {
      const res = await metricAPI.preview({
        scope,
        activityData: { value: Number(activityValue), unit: activityUnit },
        emissionFactorId
      });
      setCalcPreview(res.data.preview);
    } catch {
      setCalcPreview(null);
    }
  };

  const handleSelectFactor = (facId) => {
    setEmissionFactorId(facId);
    const selected = factors.find(f => f._id === facId);
    if (selected) {
      setScope(selected.scope);
      setCategory(selected.category);
      setSubCategory(selected.subCategory);
      if (selected.factorUnit.includes('liter')) setActivityUnit('liter');
      else if (selected.factorUnit.includes('SCM')) setActivityUnit('SCM');
      else if (selected.factorUnit.includes('MT') || selected.factorUnit.includes('tonne')) setActivityUnit('metric tonne');
      else if (selected.factorUnit.includes('MWh') || selected.factorUnit.includes('kWh')) setActivityUnit('kWh');
    }
  };

  const handleSubmitNewEntry = async (e) => {
    e.preventDefault();
    if (currentUser?.role !== 'site_engineer' && currentUser?.role !== 'corporate_admin') {
      alert('Role restriction: Only Site ESG Data Collectors (or Corporate Admin) can submit operational data. Please switch to Vikram Sharma.');
      return;
    }
    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('entityId', entityId);
      formData.append('scope', scope);
      formData.append('category', category);
      formData.append('subCategory', subCategory);
      formData.append('activityValue', activityValue);
      formData.append('activityUnit', activityUnit);
      formData.append('emissionFactorId', emissionFactorId);
      formData.append('invoiceNumber', invoiceNumber);
      formData.append('notes', notes);

      for (let i = 0; i < evidenceFiles.length; i++) {
        formData.append('evidenceFiles', evidenceFiles[i]);
      }

      await demoAPI.submit(formData);
      setShowSubmitModal(false);
      setEvidenceFiles([]);
      await loadData();
    } catch (err) {
      alert(err.response?.data?.message || err.message || 'Submission failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleExecuteAction = async () => {
    if (!actionModal) return;
    setActionLoading(true);
    try {
      const { type, entry } = actionModal;
      if (type === 'bu') {
        await demoAPI.buReview(entry._id, {
          action: reviewAction,
          remarks: reviewRemarks
        });
      } else if (type === 'auditor') {
        await demoAPI.auditorReview(entry._id, {
          action: reviewAction,
          remarks: reviewRemarks,
          verifiedScope2Claim
        });
      } else if (type === 'corporate') {
        await demoAPI.corporateSignoff(entry._id, {
          action: reviewAction,
          remarks: reviewRemarks
        });
      } else if (type === 'resubmit') {
        const formData = new FormData();
        if (resubmitValue) formData.append('activityValue', resubmitValue);
        if (resubmitUnit) formData.append('activityUnit', resubmitUnit);
        formData.append('resubmissionRemarks', resubmitRemarks);
        for (let i = 0; i < resubmitFiles.length; i++) {
          formData.append('evidenceFiles', resubmitFiles[i]);
        }
        await demoAPI.resubmit(entry._id, formData);
      }
      setActionModal(null);
      setReviewRemarks('');
      setResubmitRemarks('');
      setResubmitFiles([]);
      await loadData();
    } catch (err) {
      alert(err.response?.data?.message || err.message || 'Review action failed');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSafeReset = async () => {
    setResetting(true);
    try {
      await demoAPI.resetWorkspace();
      setShowResetConfirm(false);
      await loadData();
    } catch (err) {
      alert(err.response?.data?.message || err.message || 'Reset failed');
    } finally {
      setResetting(false);
    }
  };

  const handleDownloadEvidence = async (doc) => {
    try {
      const filename = doc.fileName || (doc.filePath ? doc.filePath.split('/').pop() : 'evidence.pdf');
      const res = await evidenceAPI.download(filename);
      const blob = new Blob([res.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = doc.originalName || doc.fileName || 'evidence.pdf';
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert('Evidence download failed: Access denied or file missing.');
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'SUBMITTED':
        return <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-2 py-0.5 rounded border border-amber-200">1. Submitted (Pending BU Review)</span>;
      case 'RESUBMITTED':
        return <span className="bg-sky-100 text-sky-800 text-[10px] font-bold px-2 py-0.5 rounded border border-sky-200">1b. Resubmitted (Pending BU Review)</span>;
      case 'RETURNED_FOR_CORRECTION':
        return <span className="bg-orange-100 text-orange-800 text-[10px] font-bold px-2 py-0.5 rounded border border-orange-200">Returned for Correction</span>;
      case 'BU_APPROVED':
        return <span className="bg-indigo-100 text-indigo-800 text-[10px] font-bold px-2 py-0.5 rounded border border-indigo-200">2. BU Approved (Pending Auditor Assurance)</span>;
      case 'AUDITOR_VERIFIED':
        return <span className="bg-purple-100 text-purple-800 text-[10px] font-bold px-2 py-0.5 rounded border border-purple-200">3. Auditor Verified (Pending Corporate Sign-Off)</span>;
      case 'CORPORATE_APPROVED':
        return <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded border border-emerald-200">4. Corporate Approved (Disclosure Ready)</span>;
      case 'REJECTED':
        return <span className="bg-red-100 text-red-800 text-[10px] font-bold px-2 py-0.5 rounded border border-red-200">Rejected</span>;
      default:
        return <span className="bg-slate-100 text-slate-700 text-[10px] font-bold px-2 py-0.5 rounded">{status}</span>;
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* 1. Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-2xl p-6 text-white shadow-md relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[11px] font-semibold border border-emerald-500/30">
              <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
              <span>Isolated Jury Demonstration Environment</span>
            </div>
            <h2 className="text-xl md:text-2xl font-bold">
              Four-Role Maker-Checker & Assurance Workflow
            </h2>
            <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
              Experience the end-to-end statutory governance lifecycle from remote operational site data ingestion, BU review, independent third-party auditor assurance, to final corporate BRSR sign-off.
            </p>
          </div>

          <div className="flex items-center space-x-2 flex-shrink-0">
            {currentUser?.role === 'corporate_admin' && (
              <button
                onClick={() => setShowResetConfirm(true)}
                className="px-3.5 py-2 bg-red-600/20 hover:bg-red-600/30 text-red-300 border border-red-500/30 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-all"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset Demo Workspace</span>
              </button>
            )}
            <button
              onClick={handleOpenSubmitModal}
              disabled={switchingRole}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition-all shadow-sm flex items-center space-x-1.5"
            >
              <span>+ Ingest Demo Activity</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. Fast Persona Switcher for Hackathon Jury */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
        <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100">
          <div className="flex items-center space-x-2 text-xs font-bold text-slate-800">
            <UserCheck className="w-4 h-4 text-meil-blue" />
            <span>Interactive Jury Role Switcher: Click a Role to Test Its Specific Permissions</span>
          </div>
          <span className="text-[11px] text-slate-400">
            Current Actor: <strong className="text-slate-800">{currentUser?.name}</strong> ({currentUser?.roleTitle || currentUser?.role})
            {switchingRole && <span className="ml-2 text-meil-blue font-semibold">(Switching session...)</span>}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {DEMO_PERSONAS.map((p) => {
            const isActive = currentUser?.email === p.email;
            return (
              <button
                key={p.email}
                onClick={() => handleRoleSelect(p)}
                disabled={switchingRole}
                className={`text-left p-3 rounded-lg border transition-all ${
                  isActive
                    ? 'border-meil-blue bg-blue-50/60 ring-2 ring-meil-blue/20 shadow-sm'
                    : 'border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50/50'
                } ${switchingRole ? 'opacity-60 cursor-not-allowed' : ''}`}
              >
                <div className="flex items-center justify-between">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                    isActive ? 'bg-meil-blue text-white' : 'bg-slate-100 text-slate-600'
                  }`}>
                    Step {p.stepNumber}
                  </span>
                  {isActive && <CheckCircle2 className="w-4 h-4 text-meil-blue" />}
                </div>
                <div className="font-bold text-xs text-slate-900 mt-2">{p.name}</div>
                <div className="text-[11px] font-semibold text-meil-blue">{p.roleTitle}</div>
                <p className="text-[10px] text-slate-500 mt-1 line-clamp-2 leading-tight">
                  {p.description}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. Navigation Tabs */}
      <div className="flex items-center space-x-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => setActiveTab('pipeline')}
          className={`px-4 py-2 text-xs font-bold rounded-lg transition-all flex items-center space-x-1.5 ${
            activeTab === 'pipeline'
              ? 'bg-slate-900 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Active Submissions & Audit Pipeline ({entries.length})</span>
        </button>
        <button
          onClick={() => setActiveTab('summary')}
          className={`px-4 py-2 text-xs font-bold rounded-lg transition-all flex items-center space-x-1.5 ${
            activeTab === 'summary'
              ? 'bg-slate-900 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <FileSpreadsheet className="w-4 h-4" />
          <span>Jury Demo Disclosure Summary ({summary?.meta?.approvedForDisclosureCount || 0} Signed-Off)</span>
        </button>
      </div>

      {/* 4. Tab 1: Submissions & Multi-Role Action Pipeline */}
      {activeTab === 'pipeline' && (
        <div className="space-y-4">
          {entries.length === 0 ? (
            <div className="bg-white rounded-xl border border-dashed border-slate-300 p-12 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
                <Layers className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-slate-800 text-sm">Demo Workspace is Currently Empty</h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                No demo submissions exist in this isolated workspace. Switch to the <strong>Site ESG Data Collector</strong> persona and click <strong>+ Ingest Demo Activity</strong> to begin the demonstration.
              </p>
              <button
                onClick={handleOpenSubmitModal}
                disabled={switchingRole}
                className="px-4 py-2 bg-meil-blue text-white rounded-lg text-xs font-bold hover:bg-blue-600 transition-all shadow-sm"
              >
                Create First Demo Submission
              </button>
            </div>
          ) : (
            entries.map((entry) => {
              const calc = entry.calculatedEmissions || {};
              const canBUReview = ['bu_manager', 'corporate_admin'].includes(currentUser?.role) && ['SUBMITTED', 'RESUBMITTED'].includes(entry.status);
              const canAuditorReview = ['sustainability_auditor', 'corporate_admin'].includes(currentUser?.role) && entry.status === 'BU_APPROVED';
              const canCorporateSignoff = currentUser?.role === 'corporate_admin' && entry.status === 'AUDITOR_VERIFIED';
              const canCollectorResubmit = ['site_engineer', 'corporate_admin'].includes(currentUser?.role) && entry.status === 'RETURNED_FOR_CORRECTION';

              return (
                <div key={entry._id} className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
                  {/* Card Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-sm text-slate-900">{entry.subCategory}</span>
                        <span className="bg-slate-100 text-slate-700 text-[10px] font-bold px-2 py-0.5 rounded">
                          Scope {entry.scope}
                        </span>
                        {getStatusBadge(entry.status)}
                      </div>
                      <div className="text-xs text-slate-500 flex items-center space-x-3 mt-1">
                        <span>Entity: <strong>{entry.entity?.name}</strong></span>
                        <span>•</span>
                        <span>Period: <strong>{entry.reportingPeriod?.financialYear} - {entry.reportingPeriod?.month}</strong></span>
                        {entry.invoiceNumber && <span>• Invoice #: <strong>{entry.invoiceNumber}</strong></span>}
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-sm font-bold text-slate-900">
                        {calc.co2Tonnes} <span className="text-xs font-semibold text-slate-500">{calc.gasCoverage === 'CO2_ONLY' ? 'tCO₂' : 'tCO₂e'}</span>
                      </div>
                      <div className="text-[11px] text-slate-400">
                        Energy: {calc.energyMWh?.toLocaleString()} MWh
                      </div>
                    </div>
                  </div>

                  {/* Mathematical Provenance & Calculation Breakdown */}
                  <div className="bg-slate-50 rounded-lg p-3 text-xs space-y-1.5 border border-slate-100">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-700">Mathematical Calculation Formula:</span>
                      <span className="text-[11px] text-slate-500 font-mono">
                        {entry.activityData?.value} {entry.activityData?.unit} × Factor
                      </span>
                    </div>
                    <div className="font-mono text-[11px] text-meil-blue bg-white p-2 rounded border border-slate-200">
                      {calc.formulaApplied}
                    </div>
                    <div className="text-[11px] text-slate-500 flex items-center justify-between pt-1">
                      <span>Source Factor: <strong>{entry.emissionFactor?.name}</strong></span>
                      <span className="italic">{entry.emissionFactor?.sourceCitation?.substring(0, 50)}...</span>
                    </div>
                  </div>

                  {/* Attached Evidence Files */}
                  <div className="flex items-center justify-between text-xs pt-1">
                    <div className="flex items-center space-x-2">
                      <FileCheck className="w-4 h-4 text-emerald-600" />
                      <span className="font-semibold text-slate-700">Verification Evidence Documents:</span>
                      {entry.evidenceDocuments?.length > 0 ? (
                        <div className="flex items-center space-x-2">
                          {entry.evidenceDocuments.map((doc, idx) => (
                            <button
                              key={idx}
                              onClick={() => handleDownloadEvidence(doc)}
                              className="px-2 py-1 bg-white hover:bg-slate-100 border border-slate-300 rounded text-[11px] text-slate-700 font-medium flex items-center space-x-1 transition-all"
                            >
                              <Download className="w-3 h-3 text-slate-500" />
                              <span>{doc.originalName || doc.fileName}</span>
                            </button>
                          ))}
                        </div>
                      ) : (
                        <span className="text-slate-400 italic">No evidence document attached.</span>
                      )}
                    </div>

                    {/* Role-Specific Action Buttons */}
                    <div className="flex items-center space-x-2">
                      {canCollectorResubmit ? (
                        <button
                          onClick={() => {
                            setActionModal({ type: 'resubmit', entry });
                            setResubmitValue(entry.activityData?.value);
                            setResubmitUnit(entry.activityData?.unit);
                          }}
                          className="px-3 py-1.5 bg-orange-600 hover:bg-orange-500 text-white rounded-lg text-xs font-bold transition-all shadow-sm flex items-center space-x-1"
                        >
                          <CornerUpLeft className="w-3.5 h-3.5" />
                          <span>Correct & Resubmit</span>
                        </button>
                      ) : entry.status === 'RETURNED_FOR_CORRECTION' ? (
                        <button
                          onClick={async () => {
                            const p = DEMO_PERSONAS.find(x => x.role === 'site_engineer');
                            if (p) {
                              await handleRoleSelect(p);
                              setActionModal({ type: 'resubmit', entry });
                              setResubmitValue(entry.activityData?.value);
                              setResubmitUnit(entry.activityData?.unit);
                            }
                          }}
                          disabled={switchingRole}
                          className="px-3 py-1.5 bg-orange-50 hover:bg-orange-100 text-orange-700 border border-orange-200 rounded-lg text-xs font-bold transition-all shadow-sm flex items-center space-x-1"
                        >
                          <CornerUpLeft className="w-3.5 h-3.5" />
                          <span>Switch to Collector & Resubmit</span>
                        </button>
                      ) : null}

                      {canBUReview ? (
                        <button
                          onClick={() => {
                            setActionModal({ type: 'bu', entry });
                            setReviewAction('BU_APPROVE');
                          }}
                          className="px-3 py-1.5 bg-meil-blue hover:bg-blue-600 text-white rounded-lg text-xs font-bold transition-all shadow-sm flex items-center space-x-1"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Perform BU Review</span>
                        </button>
                      ) : ['SUBMITTED', 'RESUBMITTED'].includes(entry.status) ? (
                        <button
                          onClick={async () => {
                            const p = DEMO_PERSONAS.find(x => x.role === 'bu_manager');
                            if (p) {
                              await handleRoleSelect(p);
                              setActionModal({ type: 'bu', entry });
                              setReviewAction('BU_APPROVE');
                            }
                          }}
                          disabled={switchingRole}
                          className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-meil-blue border border-blue-200 rounded-lg text-xs font-bold transition-all shadow-sm flex items-center space-x-1"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Switch to BU Reviewer & Review</span>
                        </button>
                      ) : null}

                      {canAuditorReview ? (
                        <button
                          onClick={() => {
                            setActionModal({ type: 'auditor', entry });
                            setReviewAction('AUDIT_VERIFY');
                          }}
                          className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-bold transition-all shadow-sm flex items-center space-x-1"
                        >
                          <ShieldCheck className="w-3.5 h-3.5" />
                          <span>Audit & Verify</span>
                        </button>
                      ) : entry.status === 'BU_APPROVED' ? (
                        <button
                          onClick={async () => {
                            const p = DEMO_PERSONAS.find(x => x.role === 'sustainability_auditor');
                            if (p) {
                              await handleRoleSelect(p);
                              setActionModal({ type: 'auditor', entry });
                              setReviewAction('AUDIT_VERIFY');
                            }
                          }}
                          disabled={switchingRole}
                          className="px-3 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 rounded-lg text-xs font-bold transition-all shadow-sm flex items-center space-x-1"
                        >
                          <ShieldCheck className="w-3.5 h-3.5" />
                          <span>Switch to Auditor & Verify</span>
                        </button>
                      ) : null}

                      {canCorporateSignoff ? (
                        <button
                          onClick={() => {
                            setActionModal({ type: 'corporate', entry });
                            setReviewAction('CORPORATE_SIGNOFF');
                          }}
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition-all shadow-sm flex items-center space-x-1"
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>Corporate Sign-Off</span>
                        </button>
                      ) : entry.status === 'AUDITOR_VERIFIED' ? (
                        <button
                          onClick={async () => {
                            const p = DEMO_PERSONAS.find(x => x.role === 'corporate_admin');
                            if (p) {
                              await handleRoleSelect(p);
                              setActionModal({ type: 'corporate', entry });
                              setReviewAction('CORPORATE_SIGNOFF');
                            }
                          }}
                          disabled={switchingRole}
                          className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-bold transition-all shadow-sm flex items-center space-x-1"
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>Switch to CSO & Sign Off</span>
                        </button>
                      ) : null}
                    </div>
                  </div>

                  {/* Audit History Timeline */}
                  <div className="pt-3 border-t border-slate-100">
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-2">
                      Traceable Multi-Role Audit Trail ({entry.reviewHistory?.length} Actions Recorded)
                    </span>
                    <div className="space-y-2">
                      {entry.reviewHistory?.map((step, sIdx) => (
                        <div key={sIdx} className="flex items-start space-x-2 text-xs bg-slate-50/70 p-2.5 rounded-lg border border-slate-100">
                          <Clock className="w-3.5 h-3.5 text-slate-400 mt-0.5 flex-shrink-0" />
                          <div className="flex-1">
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-slate-800">
                                {step.performedByName} <span className="font-normal text-slate-500">({step.roleTitle || step.role})</span>
                              </span>
                              <span className="text-[10px] text-slate-400">
                                {new Date(step.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-600 mt-0.5">
                              Action: <strong className="text-meil-blue">{step.action}</strong>
                              {step.previousStatus && step.newStatus && (
                                <span className="text-slate-400"> ({step.previousStatus} → {step.newStatus})</span>
                              )}
                            </div>
                            {step.remarks && (
                              <p className="text-[11px] text-slate-700 bg-white p-1.5 rounded mt-1 border border-slate-200/80">
                                "{step.remarks}"
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* 5. Tab 2: Jury Demo Disclosure Summary */}
      {activeTab === 'summary' && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-6">
          <div>
            <div className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 text-[11px] font-bold border border-emerald-200 mb-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>Jury Demonstration Disclosure Summary (Isolated Demo Workspace)</span>
            </div>
            <h3 className="text-lg font-bold text-slate-900">
              BRSR Principle 6 Disclosure Summary (Demo Boundary)
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Consolidates only demo submissions that have successfully achieved final CSO / Corporate Admin statutory sign-off. Operational records remain strictly isolated.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 bg-orange-50/60 rounded-xl border border-orange-200 space-y-1">
              <span className="text-xs font-semibold text-orange-800">Scope 1 (Direct GHG)</span>
              <div className="text-2xl font-bold text-slate-900">
                {summary?.summary?.scope1_Direct_tCO2 ?? 0} <span className="text-xs text-slate-500">tCO₂</span>
              </div>
              <span className="text-[10px] text-slate-500">Stationary & Mobile Fuels</span>
            </div>

            <div className="p-4 bg-sky-50/60 rounded-xl border border-sky-200 space-y-1">
              <span className="text-xs font-semibold text-sky-800">Scope 2 (Location-Based)</span>
              <div className="text-2xl font-bold text-slate-900">
                {summary?.summary?.scope2_LocationBased_tCO2 ?? 0} <span className="text-xs text-slate-500">tCO₂</span>
              </div>
              <span className="text-[10px] text-slate-500">CEA Grid Baseline v19 (0.716)</span>
            </div>

            <div className="p-4 bg-indigo-50/60 rounded-xl border border-indigo-200 space-y-1">
              <span className="text-xs font-semibold text-indigo-800">Scope 2 (Market-Based)</span>
              <div className="text-2xl font-bold text-slate-900">
                {summary?.summary?.scope2_MarketBased_tCO2 ?? 0} <span className="text-xs text-slate-500">tCO₂</span>
              </div>
              <span className="text-[10px] text-slate-500">Audited Contractual Instruments</span>
            </div>

            <div className="p-4 bg-emerald-50/60 rounded-xl border border-emerald-200 space-y-1">
              <span className="text-xs font-semibold text-emerald-800">Total Energy Consumption</span>
              <div className="text-2xl font-bold text-slate-900">
                {summary?.summary?.totalEnergy_MWh?.toLocaleString() ?? 0} <span className="text-xs text-slate-500">MWh</span>
              </div>
              <span className="text-[10px] text-emerald-600 font-bold">
                {summary?.summary?.renewablePercentage ?? 0}% Renewable Share
              </span>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>Status: <strong>{summary?.meta?.approvedForDisclosureCount || 0} of {summary?.meta?.totalSubmissions || 0} Submissions Officially Signed-Off</strong></span>
            <span className="italic">Isolation Guard: Official MEIL consolidated records contain 0 demo entries.</span>
          </div>
        </div>
      )}

      {/* 6. Modal: Ingest Demo Activity */}
      {showSubmitModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full border border-slate-200 overflow-hidden">
            <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Upload className="w-5 h-5 text-emerald-400" />
                <h3 className="font-bold text-sm">Step 1: Ingest Demo Operational Activity</h3>
              </div>
              <button onClick={() => setShowSubmitModal(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <form onSubmit={handleSubmitNewEntry} className="p-6 space-y-4 text-xs">
              <div className="p-3 bg-emerald-50/80 border border-emerald-200 rounded-lg flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <UserCheck className="w-4 h-4 text-emerald-700 flex-shrink-0" />
                  <div className="text-[11px] text-slate-700">
                    Active Submitter: <strong className="text-emerald-900">{currentUser?.name}</strong> ({currentUser?.roleTitle || currentUser?.role}) — <em>Maker Persona</em>
                  </div>
                </div>
                {currentUser?.email !== 'collector@meil.in' && (
                  <button
                    type="button"
                    onClick={() => handleRoleSelect(DEMO_PERSONAS[0])}
                    disabled={switchingRole}
                    className="text-[10px] bg-emerald-600 text-white font-bold px-2 py-1 rounded hover:bg-emerald-700"
                  >
                    Switch to Collector
                  </button>
                )}
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Reporting Entity / Project Site</label>
                <select
                  value={entityId}
                  onChange={(e) => setEntityId(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded bg-white text-slate-800 font-medium"
                  required
                >
                  {entities.map(e => (
                    <option key={e._id} value={e._id}>{e.name} ({e.type})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Official Emission Factor</label>
                <select
                  value={emissionFactorId}
                  onChange={(e) => handleSelectFactor(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded bg-white text-slate-800 font-medium"
                  required
                >
                  {factors.map(f => (
                    <option key={f._id} value={f._id}>{f.name} (Scope {f.scope})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Activity Quantity</label>
                  <input
                    type="number"
                    value={activityValue}
                    onChange={(e) => setActivityValue(e.target.value)}
                    className="w-full p-2 border border-slate-300 rounded text-slate-800 font-medium"
                    required
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Unit</label>
                  <input
                    type="text"
                    value={activityUnit}
                    onChange={(e) => setActivityUnit(e.target.value)}
                    className="w-full p-2 border border-slate-300 rounded text-slate-800 font-medium"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Vendor Invoice / Log Ref</label>
                <input
                  type="text"
                  value={invoiceNumber}
                  onChange={(e) => setInvoiceNumber(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded text-slate-800 font-medium"
                  placeholder="e.g. INV-2024-001"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Attach Verification Evidence (PDF/Images)</label>
                <input
                  type="file"
                  multiple
                  onChange={(e) => setEvidenceFiles(Array.from(e.target.files))}
                  className="w-full p-1.5 border border-slate-300 rounded text-slate-600"
                />
              </div>

              {calcPreview && (
                <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200 space-y-1">
                  <span className="font-bold text-emerald-800 text-[11px] block">Calculated Emissions Preview:</span>
                  <div className="text-sm font-bold text-emerald-900">
                    {calcPreview.co2Tonnes} tCO₂ ({calcPreview.energyMWh?.toFixed(2)} MWh)
                  </div>
                  <div className="text-[10px] font-mono text-emerald-700">{calcPreview.formulaApplied}</div>
                </div>
              )}

              <div className="flex justify-end space-x-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowSubmitModal(false)}
                  className="px-3 py-1.5 rounded bg-slate-100 text-slate-700 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-bold"
                >
                  {submitting ? 'Submitting...' : 'Submit Activity & Evidence'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 7. Modal: Action Dialog (BU Review / Auditor Review / Corporate Sign-Off / Resubmit) */}
      {actionModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full border border-slate-200 overflow-hidden">
            <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
              <h3 className="font-bold text-sm">
                {actionModal.type === 'bu' && 'Step 2: BU Sustainability Review'}
                {actionModal.type === 'auditor' && 'Step 3: Independent Auditor Assurance'}
                {actionModal.type === 'corporate' && 'Step 4: Executive Corporate Sign-Off'}
                {actionModal.type === 'resubmit' && 'Step 1b: Correct & Resubmit'}
              </h3>
              <button onClick={() => setActionModal(null)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              {actionModal.type !== 'resubmit' ? (
                <>
                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">Decision Action</label>
                    <select
                      value={reviewAction}
                      onChange={(e) => setReviewAction(e.target.value)}
                      className="w-full p-2 border border-slate-300 rounded bg-white text-slate-800 font-semibold"
                    >
                      {actionModal.type === 'bu' && (
                        <>
                          <option value="BU_APPROVE">Approve & Forward to Independent Auditor</option>
                          <option value="RETURN_FOR_CORRECTION">Return to Collector for Correction</option>
                          <option value="REJECT">Reject Entry</option>
                        </>
                      )}
                      {actionModal.type === 'auditor' && (
                        <>
                          <option value="AUDIT_VERIFY">Verify & Issue Independent Assurance</option>
                          <option value="RETURN_FOR_CORRECTION">Return for Correction</option>
                          <option value="REJECT">Reject Entry</option>
                        </>
                      )}
                      {actionModal.type === 'corporate' && (
                        <>
                          <option value="CORPORATE_SIGNOFF">Executive Sign-Off for Statutory BRSR</option>
                          <option value="RETURN_FOR_CORRECTION">Return for Correction</option>
                        </>
                      )}
                    </select>
                  </div>

                  {actionModal.type === 'auditor' && actionModal.entry?.scope === 2 && (
                    <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-1">
                      <label className="flex items-center space-x-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={verifiedScope2Claim}
                          onChange={(e) => setVerifiedScope2Claim(e.target.checked)}
                          className="rounded text-purple-600 focus:ring-purple-500"
                        />
                        <span className="font-semibold text-slate-800 text-[11px]">Audit & Verify Scope 2 Contractual Instrument Claim</span>
                      </label>
                      <p className="text-[10px] text-slate-500">
                        Check if attached PPA/REC evidence fulfills market-based accounting rules.
                      </p>
                    </div>
                  )}

                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">
                      Audit Remarks & Explanation <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      value={reviewRemarks}
                      onChange={(e) => setReviewRemarks(e.target.value)}
                      rows={3}
                      className="w-full p-2 border border-slate-300 rounded text-slate-800"
                      placeholder="Mandatory audit trail remarks justifying this decision..."
                      required
                    />
                  </div>
                </>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="font-semibold text-slate-700 block mb-1">Corrected Quantity</label>
                      <input
                        type="number"
                        value={resubmitValue}
                        onChange={(e) => setResubmitValue(e.target.value)}
                        className="w-full p-2 border border-slate-300 rounded"
                        required
                      />
                    </div>
                    <div>
                      <label className="font-semibold text-slate-700 block mb-1">Unit</label>
                      <input
                        type="text"
                        value={resubmitUnit}
                        onChange={(e) => setResubmitUnit(e.target.value)}
                        className="w-full p-2 border border-slate-300 rounded"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">Attach Revised Evidence (Optional)</label>
                    <input
                      type="file"
                      multiple
                      onChange={(e) => setResubmitFiles(Array.from(e.target.files))}
                      className="w-full p-1.5 border border-slate-300 rounded text-slate-600"
                    />
                  </div>

                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">Resubmission Correction Notes</label>
                    <textarea
                      value={resubmitRemarks}
                      onChange={(e) => setResubmitRemarks(e.target.value)}
                      rows={3}
                      className="w-full p-2 border border-slate-300 rounded text-slate-800"
                      placeholder="Explain what corrections were made based on reviewer feedback..."
                    />
                  </div>
                </>
              )}

              <div className="flex justify-end space-x-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setActionModal(null)}
                  className="px-3 py-1.5 rounded bg-slate-100 text-slate-700 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleExecuteAction}
                  disabled={actionLoading || (actionModal.type !== 'resubmit' && !reviewRemarks.trim())}
                  className="px-4 py-1.5 rounded bg-meil-blue hover:bg-blue-600 text-white font-bold disabled:opacity-50"
                >
                  {actionLoading ? 'Saving Action...' : 'Confirm & Commit Action'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 8. Modal: Reset Workspace Confirmation */}
      {showResetConfirm && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full border border-slate-200 p-6 space-y-4 text-center">
            <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto text-red-600">
              <RotateCcw className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-slate-900 text-sm">Safe Reset Demo Workspace?</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              This action will delete <strong>only the records inside the Jury Demo workspace</strong>. Official operational data, entity hierarchies, and emission factors will remain completely untouched.
            </p>
            <div className="flex space-x-2 pt-2">
              <button
                onClick={() => setShowResetConfirm(false)}
                className="flex-1 py-2 rounded bg-slate-100 text-slate-700 font-semibold text-xs"
              >
                Cancel
              </button>
              <button
                onClick={handleSafeReset}
                disabled={resetting}
                className="flex-1 py-2 rounded bg-red-600 hover:bg-red-500 text-white font-bold text-xs"
              >
                {resetting ? 'Resetting...' : 'Yes, Reset Demo'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
