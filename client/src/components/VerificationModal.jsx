import React, { useState } from 'react';
import { X, CheckCircle2, XCircle, ShieldCheck, FileText, Calculator, History, Download, Loader2 } from 'lucide-react';
import { evidenceAPI } from '../services/api';

export default function VerificationModal({ isOpen, onClose, metric, onConfirmReview, currentUser }) {
  const [remarks, setRemarks] = useState('');
  const [verifiedScope2Claim, setVerifiedScope2Claim] = useState(false);
  const [claimCheckDetails, setClaimCheckDetails] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [downloadingDoc, setDownloadingDoc] = useState(null);

  const handleDownloadDoc = async (doc) => {
    const filename = doc.fileName || (doc.filePath ? doc.filePath.split('/').pop() : 'evidence.pdf');
    try {
      setDownloadingDoc(filename);
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
      console.error('Evidence download failed:', err);
      alert('Unable to download evidence file. Please verify permissions.');
    } finally {
      setDownloadingDoc(null);
    }
  };

  if (!isOpen || !metric) return null;

  const handleAction = async (action) => {
    if (!remarks.trim()) {
      setError('Audit review remarks are required to ensure strict traceability.');
      return;
    }
    setError('');
    setIsSubmitting(true);
    try {
      await onConfirmReview(metric._id, {
        action,
        remarks: remarks.trim(),
        verifiedScope2Claim,
        claimCheckDetails: claimCheckDetails.trim()
      });
      setRemarks('');
      setVerifiedScope2Claim(false);
      setClaimCheckDetails('');
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Verification update failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full border border-slate-200 overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center space-x-2">
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
            <h3 className="font-bold text-base">Human Expert Review & Assurance Audit</h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors p-1 rounded-lg hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-6 space-y-5 overflow-y-auto flex-1">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg">
              {error}
            </div>
          )}

          {/* Metric Overview */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs">
            <div>
              <span className="text-slate-500">Reporting Entity / Site:</span>
              <div className="font-bold text-slate-800 text-sm">{metric.entity?.name}</div>
              <div className="text-slate-500 mt-0.5">Location: {metric.entity?.location?.city}, {metric.entity?.location?.state}</div>
            </div>
            <div>
              <span className="text-slate-500">GHG Scope & Category:</span>
              <div className="font-bold text-slate-800 text-sm">Scope {metric.scope} — {metric.category}</div>
              <div className="text-slate-500 mt-0.5">{metric.subCategory}</div>
            </div>
            <div>
              <span className="text-slate-500">Period:</span>
              <div className="font-semibold text-slate-800">{metric.reportingPeriod?.financialYear} ({metric.reportingPeriod?.month})</div>
            </div>
            <div>
              <span className="text-slate-500">Reported Activity Data:</span>
              <div className="font-semibold text-emerald-700 text-sm">
                {metric.activityData?.value?.toLocaleString()} {metric.activityData?.unit}
              </div>
            </div>
          </div>

          {/* Mathematical Traceability & Formula Breakdown */}
          <div className="bg-emerald-50/60 border border-emerald-200 rounded-xl p-4 space-y-2">
            <div className="flex items-center space-x-2 text-emerald-900 font-bold text-xs uppercase tracking-wide">
              <Calculator className="w-4 h-4 text-emerald-700" />
              <span>Mathematical Calculation & Traceability Audit</span>
            </div>
            <div className="font-mono text-xs text-emerald-900 bg-white p-2.5 rounded-lg border border-emerald-200">
              {metric.calculatedEmissions?.formulaApplied}
            </div>
            <div className="text-xs text-slate-700 space-y-1 mt-2">
              <div className="font-semibold text-slate-800">Calculation Steps:</div>
              {metric.calculatedEmissions?.calculationSteps?.map((step, i) => (
                <div key={i} className="text-[11px] text-slate-600 pl-2 border-l-2 border-emerald-300">
                  {step}
                </div>
              ))}
            </div>
            <div className="pt-2 text-xs text-slate-600 border-t border-emerald-200 flex items-center justify-between">
              <span>Emission Factor Citation: <strong>{metric.emissionFactor?.sourceCitation} ({metric.emissionFactor?.publicationYear})</strong></span>
              <span className="font-bold text-emerald-800 text-sm">{metric.calculatedEmissions?.co2Tonnes ?? metric.calculatedEmissions?.co2eTonnes} {metric.calculatedEmissions?.gasCoverage === 'CO2_ONLY' ? 'tCO₂' : 'tCO₂e'}</span>
            </div>
          </div>

          {/* Supporting Evidence Details */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center space-x-1.5 mb-2">
              <FileText className="w-3.5 h-3.5 text-slate-500" />
              <span>Supporting Evidence Documents ({metric.evidenceDocuments?.length || 0})</span>
            </h4>
            {metric.evidenceDocuments?.length > 0 ? (
              <div className="space-y-2">
                {metric.evidenceDocuments.map((doc, idx) => (
                  <div key={idx} className="flex items-center justify-between p-2.5 bg-slate-50 rounded-lg border border-slate-200 text-xs">
                    <div>
                      <div className="font-semibold text-slate-800">{doc.originalName}</div>
                      <div className="text-[11px] text-slate-500">Invoice: {doc.invoiceNumber || 'N/A'} • Vendor: {doc.vendorName || 'N/A'}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDownloadDoc(doc)}
                      disabled={downloadingDoc === (doc.fileName || (doc.filePath ? doc.filePath.split('/').pop() : ''))}
                      className="flex items-center space-x-1.5 text-xs font-semibold text-meil-blue hover:text-blue-800 bg-white hover:bg-slate-100 px-2.5 py-1 rounded border border-slate-300 transition-colors disabled:opacity-50"
                    >
                      {downloadingDoc === (doc.fileName || (doc.filePath ? doc.filePath.split('/').pop() : '')) ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-meil-blue" />
                      ) : (
                        <Download className="w-3.5 h-3.5 text-meil-blue" />
                      )}
                      <span>{downloadingDoc === (doc.fileName || (doc.filePath ? doc.filePath.split('/').pop() : '')) ? 'Downloading...' : 'Download Invoice'}</span>
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-3 bg-amber-50 text-amber-800 text-xs rounded-lg border border-amber-200">
                Warning: No supporting document attached. Reviewer should verify meter records or request invoice re-submission.
              </div>
            )}
          </div>

          {/* Review History Timeline */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center space-x-1.5 mb-2">
              <History className="w-3.5 h-3.5 text-slate-500" />
              <span>Audit Review History</span>
            </h4>
            <div className="space-y-2 max-h-36 overflow-y-auto">
              {metric.reviewHistory?.map((rh, idx) => (
                <div key={idx} className="p-2.5 bg-slate-50 rounded border border-slate-200 text-xs space-y-0.5">
                  <div className="flex items-center justify-between font-semibold text-slate-800">
                    <span>{rh.performedByName} ({rh.role})</span>
                    <span className="text-[11px] text-slate-500 font-normal">
                      {new Date(rh.timestamp).toLocaleString()}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-600">Action: <strong className="uppercase">{rh.action}</strong></div>
                  <div className="text-xs text-slate-700 italic">"{rh.remarks}"</div>
                </div>
              ))}
            </div>
          </div>

          {/* Scope 2 Zero-Emission Specific Claim Audit Checklist */}
          {metric.scope === 2 && metric.emissionFactor?.factorValue === 0.0 && (
            <div className="p-3 bg-amber-50 border border-amber-300 rounded-lg space-y-2">
              <div className="flex items-start space-x-2">
                <input
                  type="checkbox"
                  id="auditScope2Claim"
                  checked={verifiedScope2Claim}
                  onChange={(e) => setVerifiedScope2Claim(e.target.checked)}
                  className="mt-0.5 rounded border-amber-400 text-emerald-600 focus:ring-emerald-500"
                />
                <label htmlFor="auditScope2Claim" className="text-xs font-semibold text-amber-900 cursor-pointer">
                  Specific Scope 2 Zero-Emission Instrument Audit Verified
                </label>
              </div>
              <p className="text-[11px] text-amber-800 pl-6">
                Regulatory Mandate: Zero emissions requires certified contractual instruments (PPA/REC) or captive behind-the-meter telemetry. Without checking this box and verifying qualifying attached documents, the system will apply the conservative location-based grid proxy (0.716 tCO₂/MWh).
              </p>
            </div>
          )}

          {/* Review Remarks Input */}
          <div className="space-y-1.5 pt-2 border-t border-slate-200">
            <label className="block text-xs font-bold text-slate-800">
              Auditor / Reviewer Remarks <span className="text-red-500">* (Mandatory)</span>
            </label>
            <textarea
              rows={3}
              className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-meil-blue"
              placeholder="Enter audit review observations, fuel receipt verification notes, or reasons for rejection..."
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="bg-slate-50 px-6 py-4 border-t border-slate-200 flex items-center justify-between flex-shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-semibold transition-colors"
          >
            Cancel
          </button>
          <div className="flex items-center space-x-3">
            <button
              disabled={isSubmitting}
              onClick={() => handleAction('REJECTED')}
              className="flex items-center space-x-1.5 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-semibold transition-colors disabled:opacity-50"
            >
              <XCircle className="w-4 h-4" />
              <span>Reject / Request Revision</span>
            </button>
            <button
              disabled={isSubmitting}
              onClick={() => handleAction('VERIFIED')}
              className="flex items-center space-x-1.5 px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors disabled:opacity-50 shadow-sm"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Verify & Approve Figure</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
