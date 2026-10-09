import React, { useState } from 'react';
import { X, FileText, Download, Calendar, Building, Hash, ExternalLink, Loader2 } from 'lucide-react';
import { evidenceAPI } from '../services/api';

export default function EvidenceModal({ isOpen, onClose, metric }) {
  if (!isOpen || !metric) return null;

  const docs = metric.evidenceDocuments || [];
  const [downloadingDoc, setDownloadingDoc] = useState(null);

  const handleDownload = async (doc) => {
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

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full border border-slate-200 overflow-hidden">
        {/* Modal Header */}
        <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <FileText className="w-5 h-5 text-emerald-400" />
            <h3 className="font-bold text-base">Supporting Evidence & Invoices</h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors p-1 rounded-lg hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 space-y-4">
          <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 text-xs space-y-1">
            <div className="font-semibold text-slate-800 text-sm">{metric.subCategory}</div>
            <div className="text-slate-600 flex items-center space-x-4">
              <span>Entity: <strong>{metric.entity?.name}</strong></span>
              <span>Scope: <strong>Scope {metric.scope}</strong></span>
              <span>Period: <strong>{metric.reportingPeriod?.financialYear} - {metric.reportingPeriod?.month}</strong></span>
            </div>
            <div className="text-slate-600">
              Quantity Reported: <strong>{metric.activityData?.value?.toLocaleString()} {metric.activityData?.unit}</strong> ({metric.calculatedEmissions?.co2Tonnes ?? metric.calculatedEmissions?.co2eTonnes} {metric.calculatedEmissions?.gasCoverage === 'CO2_ONLY' ? 'tCO₂' : 'tCO₂e'})
            </div>
          </div>

          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Attached Verification Documents ({docs.length})
          </h4>

          {docs.length === 0 ? (
            <div className="text-center py-8 text-slate-400 text-sm">
              No evidence documents attached to this entry.
            </div>
          ) : (
            <div className="space-y-3">
              {docs.map((doc, idx) => (
                <div
                  key={idx}
                  className="border border-slate-200 rounded-lg p-3 hover:border-slate-300 transition-all bg-white flex items-center justify-between"
                >
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded bg-red-50 text-red-600 flex items-center justify-center font-bold text-xs uppercase border border-red-200">
                      PDF
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-slate-800">{doc.originalName}</div>
                      <div className="text-xs text-slate-500 flex items-center space-x-3 mt-0.5">
                        {doc.vendorName && <span>Vendor: {doc.vendorName}</span>}
                        {doc.invoiceNumber && <span>Invoice #: {doc.invoiceNumber}</span>}
                        <span>Size: {Math.round((doc.fileSize || 250000) / 1024)} KB</span>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => handleDownload(doc)}
                    disabled={downloadingDoc === (doc.fileName || (doc.filePath ? doc.filePath.split('/').pop() : ''))}
                    className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold border border-slate-300 transition-colors disabled:opacity-50"
                  >
                    {downloadingDoc === (doc.fileName || (doc.filePath ? doc.filePath.split('/').pop() : '')) ? (
                      <Loader2 className="w-3.5 h-3.5 text-slate-600 animate-spin" />
                    ) : (
                      <Download className="w-3.5 h-3.5 text-slate-600" />
                    )}
                    <span>{downloadingDoc === (doc.fileName || (doc.filePath ? doc.filePath.split('/').pop() : '')) ? 'Downloading...' : 'Download'}</span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="bg-slate-50 px-6 py-3 border-t border-slate-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-slate-800 text-white text-xs font-semibold hover:bg-slate-700 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
