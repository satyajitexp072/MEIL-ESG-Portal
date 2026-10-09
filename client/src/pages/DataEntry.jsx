import React, { useState, useEffect } from 'react';
import {
  FilePlus2,
  Calculator,
  Upload,
  CheckCircle2,
  AlertCircle,
  FileText,
  Info,
  HelpCircle,
  Sparkles,
  ShieldCheck
} from 'lucide-react';
import { entityAPI, factorAPI, metricAPI } from '../services/api';

export default function DataEntry({ onCreated, currentUser, setTab }) {
  const [entities, setEntities] = useState([]);
  const [factors, setFactors] = useState([]);
  const [loading, setLoading] = useState(true);

  // Form state
  const [selectedEntity, setSelectedEntity] = useState('');
  const [selectedScope, setSelectedScope] = useState(1);
  const [selectedFactorId, setSelectedFactorId] = useState('');
  const [subCategory, setSubCategory] = useState('');
  const [activityValue, setActivityValue] = useState('');
  const [activityUnit, setActivityUnit] = useState('Liters');
  const [financialYear, setFinancialYear] = useState('FY 2024-25');
  const [quarter, setQuarter] = useState('Q1');
  const [month, setMonth] = useState('June');
  const [notes, setNotes] = useState('');
  const [isDemoData, setIsDemoData] = useState(true);

  // Evidence state
  const [evidenceFiles, setEvidenceFiles] = useState([]);
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [vendorName, setVendorName] = useState('');

  // Live preview state
  const [preview, setPreview] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    loadPrerequisites();
  }, []);

  const loadPrerequisites = async () => {
    setLoading(true);
    try {
      const [entRes, facRes] = await Promise.all([
        entityAPI.getAll(),
        factorAPI.getAll()
      ]);
      setEntities(entRes.data.entities);
      setFactors(facRes.data.factors);

      if (entRes.data.entities.length > 0) {
        // Pre-select entity based on current user if assigned, otherwise first
        const userEntity = currentUser?.assignedEntity?._id || entRes.data.entities[0]._id;
        setSelectedEntity(userEntity);
      }

      // Default factor for scope 1
      const initialFactors = facRes.data.factors.filter(f => f.scope === 1);
      if (initialFactors.length > 0) {
        setSelectedFactorId(initialFactors[0]._id);
        setSubCategory(initialFactors[0].subCategory);
        setActivityUnit(initialFactors[0].factorUnit.includes('liter') ? 'Liters' : 'SCM');
      }
    } catch (err) {
      console.error('Failed to load prerequisites:', err);
    } finally {
      setLoading(false);
    }
  };

  // Update available factors when scope changes
  useEffect(() => {
    if (selectedScope === 3) {
      setPreview(null);
      return;
    }
    const filtered = factors.filter(f => f.scope === selectedScope);
    if (filtered.length > 0) {
      setSelectedFactorId(filtered[0]._id);
      setSubCategory(filtered[0].subCategory);
      if (selectedScope === 2) {
        setActivityUnit('kWh');
      } else {
        setActivityUnit(filtered[0].factorUnit.includes('liter') ? 'Liters' : 'SCM');
      }
    }
  }, [selectedScope, factors]);

  // Handle factor change
  const handleFactorChange = (factorId) => {
    setSelectedFactorId(factorId);
    const fac = factors.find(f => f._id === factorId);
    if (fac) {
      setSubCategory(fac.subCategory);
      if (fac.scope === 2) {
        setActivityUnit('kWh');
      } else if (fac.factorUnit.includes('liter')) {
        setActivityUnit('Liters');
      } else if (fac.factorUnit.includes('SCM')) {
        setActivityUnit('SCM');
      } else {
        setActivityUnit('Metric Tonnes');
      }
    }
  };

  // Trigger live calculation preview
  useEffect(() => {
    if (!activityValue || isNaN(activityValue) || Number(activityValue) <= 0 || !selectedFactorId || selectedScope === 3) {
      setPreview(null);
      return;
    }

    const timer = setTimeout(async () => {
      setPreviewLoading(true);
      try {
        const res = await metricAPI.preview({
          activityValue: Number(activityValue),
          activityUnit,
          emissionFactorId: selectedFactorId
        });
        setPreview(res.data);
      } catch (err) {
        console.error('Calculation preview error:', err);
      } finally {
        setPreviewLoading(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [activityValue, activityUnit, selectedFactorId, selectedScope]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (selectedScope === 3) {
      setErrorMsg('Scope 3 is an architectural placeholder for Phase 2 and cannot be submitted.');
      return;
    }
    if (!activityValue || Number(activityValue) <= 0) {
      setErrorMsg('Please enter a valid activity quantity.');
      return;
    }

    setErrorMsg('');
    setSuccessMsg('');
    setSubmitting(true);

    try {
      const formData = new FormData();
      formData.append('entityId', selectedEntity);
      formData.append('scope', selectedScope);
      const chosenFactor = factors.find(f => f._id === selectedFactorId);
      formData.append('category', chosenFactor?.category || 'Combustion');
      formData.append('subCategory', subCategory || chosenFactor?.subCategory);
      formData.append('financialYear', financialYear);
      formData.append('quarter', quarter);
      formData.append('month', month);
      formData.append('activityValue', activityValue);
      formData.append('activityUnit', activityUnit);
      formData.append('emissionFactorId', selectedFactorId);
      formData.append('notes', notes);
      formData.append('isDemoData', isDemoData);

      if (invoiceNumber) formData.append('invoiceNumber', invoiceNumber);
      if (vendorName) formData.append('vendorName', vendorName);

      // Append evidence files
      for (let i = 0; i < evidenceFiles.length; i++) {
        formData.append('evidenceFiles', evidenceFiles[i]);
      }

      const res = await metricAPI.create(formData);
      setSuccessMsg(`Metric entry successfully recorded with status "Submitted" (Calculation ID: ${res.data.metric._id})`);
      setActivityValue('');
      setNotes('');
      setEvidenceFiles([]);
      setInvoiceNumber('');
      setVendorName('');
      if (onCreated) onCreated();
    } catch (err) {
      setErrorMsg(err.response?.data?.message || err.message || 'Submission failed.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 text-center text-xs text-slate-500">Loading form options...</div>
    );
  }

  const currentFactorDoc = factors.find(f => f._id === selectedFactorId);

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Title & Instructions */}
      <div>
        <h2 className="text-xl font-bold text-slate-900">
          ESG Activity Data Ingestion & Calculation Engine
        </h2>
        <p className="text-xs text-slate-500 mt-1">
          Record operational fuel consumption, mobile machinery fleet usage, or grid electricity meters. Calculations apply verified SEBI & CEA emission baselines with full mathematical traceability.
        </p>
      </div>

      {successMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between text-xs text-emerald-800">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <span>{successMsg}</span>
          </div>
          <button
            onClick={() => setTab('verifications')}
            className="font-bold underline text-emerald-700 hover:text-emerald-900 ml-4"
          >
            Go to Review Queue &rarr;
          </button>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-center space-x-2 text-xs text-red-800">
          <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Step 1: Organizational Entity & Scope */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-5">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center space-x-2">
            <span className="w-5 h-5 rounded-full bg-slate-900 text-white flex items-center justify-center text-[10px]">1</span>
            <span>Reporting Entity & Greenhouse Gas Scope</span>
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Subsidiary / Project Site <span className="text-red-500">*</span>
              </label>
              <select
                className="w-full text-xs p-2.5 bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-meil-blue"
                value={selectedEntity}
                onChange={(e) => setSelectedEntity(e.target.value)}
                required
              >
                {entities.map((ent) => (
                  <option key={ent._id} value={ent._id}>
                    {ent.name} [{ent.type}] — {ent.location?.state || 'India'}
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-slate-400 mt-1">
                Data automatically tags to parent corporate entity MEIL Corporate HQ.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                GHG Accounting Scope <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedScope(1)}
                  className={`p-2 rounded-lg text-xs font-semibold border text-center transition-all ${
                    selectedScope === 1
                      ? 'bg-orange-50 text-orange-900 border-orange-400 shadow-sm'
                      : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <div className="font-bold">Scope 1</div>
                  <div className="text-[10px] opacity-75">Direct Fuel</div>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedScope(2)}
                  className={`p-2 rounded-lg text-xs font-semibold border text-center transition-all ${
                    selectedScope === 2
                      ? 'bg-sky-50 text-sky-900 border-sky-400 shadow-sm'
                      : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <div className="font-bold">Scope 2</div>
                  <div className="text-[10px] opacity-75">Purchased Grid</div>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedScope(3)}
                  className={`p-2 rounded-lg text-xs font-semibold border text-center transition-all ${
                    selectedScope === 3
                      ? 'bg-purple-50 text-purple-900 border-purple-400 shadow-sm'
                      : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <div className="font-bold">Scope 3</div>
                  <div className="text-[10px] opacity-75">Roadmap Preview</div>
                </button>
              </div>
            </div>
          </div>

          {selectedScope === 3 && (
            <div className="p-4 bg-purple-50 border border-purple-200 rounded-xl text-xs text-purple-900 space-y-2">
              <div className="flex items-center space-x-2 font-bold">
                <Info className="w-4 h-4 text-purple-600" />
                <span>Scope 3 Extensible Architecture Notice</span>
              </div>
              <p>
                As required by the project specifications, Scope 3 accounting is designed as an extensible placeholder for future development (Purchased goods, Upstream freight, Employee travel). The prototype computes Scope 1 and Scope 2 only.
              </p>
              <button
                type="button"
                onClick={() => setTab('scope3')}
                className="underline font-bold text-purple-800 hover:text-purple-950"
              >
                Inspect Scope 3 Category Architecture Matrix &rarr;
              </button>
            </div>
          )}
        </div>

        {/* Step 2: Activity Data & Emission Factor */}
        {selectedScope !== 3 && (
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center space-x-2">
              <span className="w-5 h-5 rounded-full bg-slate-900 text-white flex items-center justify-center text-[10px]">2</span>
              <span>Activity Consumption & Emission Baseline</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Emission Factor Baseline <span className="text-red-500">*</span>
                </label>
                <select
                  className="w-full text-xs p-2.5 bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-meil-blue"
                  value={selectedFactorId}
                  onChange={(e) => handleFactorChange(e.target.value)}
                  required
                >
                  {factors
                    .filter(f => f.scope === selectedScope)
                    .map((fac) => (
                      <option key={fac._id} value={fac._id}>
                        {fac.name} — {fac.factorValue} {fac.factorUnit}
                      </option>
                    ))}
                </select>
                {currentFactorDoc && (
                  <div className="text-[11px] text-slate-500 mt-1 space-y-0.5">
                    <div>Authority: <span className="font-medium text-slate-700">{currentFactorDoc.sourceCitation}</span></div>
                    <div>Publication: <span className="font-mono text-slate-600">{currentFactorDoc.publicationYear}</span></div>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Specific Machinery / Application Description
                </label>
                <input
                  type="text"
                  className="w-full text-xs p-2.5 bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-meil-blue"
                  placeholder="e.g. 500kVA DG Set Portal West or Heavy Excavator Fleet"
                  value={subCategory}
                  onChange={(e) => setSubCategory(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Activity Quantity Consumed <span className="text-red-500">*</span>
                </label>
                <div className="flex">
                  <input
                    type="number"
                    step="any"
                    min="0"
                    className="w-full text-xs p-2.5 bg-slate-50 border border-slate-300 rounded-l-lg focus:outline-none focus:ring-2 focus:ring-meil-blue font-mono text-base font-bold text-slate-900"
                    placeholder="Enter quantity (e.g. 15000)"
                    value={activityValue}
                    onChange={(e) => setActivityValue(e.target.value)}
                    required
                  />
                  <select
                    className="text-xs bg-slate-200 border-y border-r border-slate-300 rounded-r-lg px-3 font-semibold text-slate-700 focus:outline-none"
                    value={activityUnit}
                    onChange={(e) => setActivityUnit(e.target.value)}
                  >
                    {selectedScope === 1 ? (
                      <>
                        <option value="Liters">Liters</option>
                        <option value="SCM">SCM</option>
                        <option value="Metric Tonnes">Metric Tonnes</option>
                      </>
                    ) : (
                      <>
                        <option value="kWh">kWh</option>
                        <option value="MWh">MWh</option>
                      </>
                    )}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Reporting Period <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-2 gap-1.5">
                  <select
                    className="text-xs p-2.5 bg-slate-50 border border-slate-300 rounded-lg"
                    value={quarter}
                    onChange={(e) => setQuarter(e.target.value)}
                  >
                    <option value="Q1">Q1</option>
                    <option value="Q2">Q2</option>
                    <option value="Q3">Q3</option>
                    <option value="Q4">Q4</option>
                  </select>
                  <select
                    className="text-xs p-2.5 bg-slate-50 border border-slate-300 rounded-lg"
                    value={month}
                    onChange={(e) => setMonth(e.target.value)}
                  >
                    <option value="April">April</option>
                    <option value="May">May</option>
                    <option value="June">June</option>
                    <option value="July">July</option>
                    <option value="August">August</option>
                    <option value="September">September</option>
                    <option value="October">October</option>
                    <option value="November">November</option>
                    <option value="December">December</option>
                    <option value="January">January</option>
                    <option value="February">February</option>
                    <option value="March">March</option>
                  </select>
                </div>
              </div>
            </div>

            {/* LIVE MATHEMATICAL TRACEABILITY PREVIEW */}
            {preview && preview.calculation && (
              <div className="p-4 bg-emerald-50/70 border border-emerald-300 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2 text-emerald-900 font-bold text-xs uppercase tracking-wide">
                    <Calculator className="w-4 h-4 text-emerald-700" />
                    <span>Real-Time Algorithmic Calculation Preview</span>
                  </div>
                  <span className="text-[11px] font-mono text-emerald-800 bg-white px-2 py-0.5 rounded border border-emerald-300">
                    Traceable Result: <strong>{preview.calculation.co2Tonnes} {preview.calculation.gasCoverage === 'CO2_ONLY' ? 'tCO₂ (CO₂ only)' : 'tCO₂e'}</strong>
                  </span>
                </div>

                <div className="font-mono text-xs text-emerald-950 bg-white p-2.5 rounded-lg border border-emerald-200">
                  {preview.calculation.formulaApplied}
                </div>

                <div className="text-[11px] text-slate-600 space-y-0.5 pt-1">
                  {preview.calculation.calculationSteps?.map((step, idx) => (
                    <div key={idx} className="pl-2 border-l-2 border-emerald-400">
                      {step}
                    </div>
                  ))}
                </div>

                <div className="pt-2 border-t border-emerald-200 text-[11px] text-slate-500 flex items-center justify-between">
                  <span>BRSR Energy Disclosure: <strong>{preview.calculation.energyMWh} MWh</strong></span>
                  <span>Factor Authority: {preview.factor?.sourceCitation}</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Step 3: Supporting Evidence & Human Review Attachment */}
        {selectedScope !== 3 && (
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center space-x-2">
              <span className="w-5 h-5 rounded-full bg-slate-900 text-white flex items-center justify-center text-[10px]">3</span>
              <span>Supporting Evidence Documents & Audit Metadata</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Attach Source Evidence (Utility Bill / Fuel Voucher PDF or Image)
                </label>
                <input
                  type="file"
                  multiple
                  accept=".pdf,image/*,.csv,.xlsx"
                  className="w-full text-xs p-2 bg-slate-50 border border-slate-300 rounded-lg file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-slate-800 file:text-white hover:file:bg-slate-700 cursor-pointer"
                  onChange={(e) => setEvidenceFiles(e.target.files)}
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Upload DISCOM electricity invoices, fuel dispenser receipts, or CEMS calibration reports.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Invoice / Receipt #
                  </label>
                  <input
                    type="text"
                    className="w-full text-xs p-2.5 bg-slate-50 border border-slate-300 rounded-lg"
                    placeholder="e.g. TSSPDCL-2024-06"
                    value={invoiceNumber}
                    onChange={(e) => setInvoiceNumber(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Vendor / Utility Name
                  </label>
                  <input
                    type="text"
                    className="w-full text-xs p-2.5 bg-slate-50 border border-slate-300 rounded-lg"
                    placeholder="e.g. HPCL or TSSPDCL"
                    value={vendorName}
                    onChange={(e) => setVendorName(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Operational Notes for Auditor / Reviewer
              </label>
              <textarea
                rows={2}
                className="w-full text-xs p-2.5 bg-slate-50 border border-slate-300 rounded-lg"
                placeholder="Provide context regarding generator run hours, grid outages, or machine telemetry..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>

            <div className="flex items-center space-x-2 pt-2">
              <input
                type="checkbox"
                id="demoToggle"
                checked={isDemoData}
                onChange={(e) => setIsDemoData(e.target.checked)}
                className="rounded border-slate-300 text-meil-blue focus:ring-meil-blue"
              />
              <label htmlFor="demoToggle" className="text-xs text-slate-600 select-none cursor-pointer">
                <strong>Tag as Demonstration Data:</strong> Clearly flags this entry as sample data to distinguish from real organizational filings.
              </label>
            </div>
          </div>
        )}

        {/* Submit Bar */}
        {selectedScope !== 3 && (
          <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-200">
            <div className="flex items-center space-x-2 text-xs text-slate-600">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Submission enters the <strong>Maker-Checker Queue</strong> for Human Sustainability Reviewer sign-off.</span>
            </div>

            <button
              type="submit"
              disabled={submitting || !activityValue || Number(activityValue) <= 0}
              className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold transition-all shadow-md disabled:opacity-50 flex items-center space-x-2"
            >
              {submitting ? (
                <span>Computing & Submitting...</span>
              ) : (
                <>
                  <FilePlus2 className="w-4 h-4 text-emerald-400" />
                  <span>Submit Operational Figure</span>
                </>
              )}
            </button>
          </div>
        )}
      </form>
    </div>
  );
}
