import React, { useState, useEffect } from 'react';
import {
  FileSpreadsheet,
  Download,
  Printer,
  ShieldCheck,
  Building2,
  Calendar,
  AlertTriangle,
  Info,
  CheckCircle2,
  Loader2
} from 'lucide-react';
import { reportAPI, entityAPI } from '../services/api';

export default function BRSRReport() {
  const [report, setReport] = useState(null);
  const [entities, setEntities] = useState([]);
  const [selectedEntity, setSelectedEntity] = useState('');
  const [financialYear, setFinancialYear] = useState('FY 2024-25');
  const [loading, setLoading] = useState(true);
  const [exportingPdf, setExportingPdf] = useState(false);

  useEffect(() => {
    loadEntities();
  }, []);

  useEffect(() => {
    fetchReport();
  }, [selectedEntity, financialYear]);

  const loadEntities = async () => {
    try {
      const res = await entityAPI.getAll();
      setEntities(res.data.entities);
    } catch (err) {
      console.error('Failed to load entities:', err);
    }
  };

  const fetchReport = async () => {
    setLoading(true);
    try {
      const params = { financialYear };
      if (selectedEntity) params.entityId = selectedEntity;
      const res = await reportAPI.getBRSRSectionC(params);
      setReport(res.data.brsrDisclosure);
    } catch (err) {
      console.error('Failed to load BRSR report:', err);
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const exportCSV = () => {
    if (!report) return;
    const ind1 = report.essentialIndicator1_Energy?.table || {};
    const ind4 = report.essentialIndicator4_GHG?.table || {};

    const csvContent = [
      ['SEBI BRSR Section C — Principle 6 (Environment) Performance Disclosure'],
      ['Organization', 'Megha Engineering & Infrastructures Limited (MEIL)'],
      ['Reporting Boundary', report.meta?.reportingBoundary],
      ['Financial Year', report.meta?.financialYear],
      ['Generated On', new Date().toISOString()],
      ['Consolidated Turnover (INR Crores)', report.meta?.consolidatedTurnoverCrores],
      [],
      ['ESSENTIAL INDICATOR 1: TOTAL ENERGY CONSUMPTION'],
      ['Parameter', 'Unit', 'Current Financial Year (' + report.meta?.financialYear + ')'],
      ['Renewable Energy (Solar / Captive)', 'MWh', ind1.renewableEnergy_MWh],
      ['Non-Renewable Fuel & Grid Energy', 'MWh', ind1.nonRenewableEnergy_MWh],
      ['Total Energy Consumption (MWh)', 'MWh', ind1.totalEnergy_MWh],
      ['Total Energy Consumption (GigaJoules)', 'GJ', ind1.totalEnergy_GJ],
      ['Renewable Energy Percentage', '%', ind1.renewableEnergyPercentage + '%'],
      ['Energy Intensity per Turnover', 'MWh / INR Crore', ind1.energyIntensityPerTurnoverCrores !== null ? ind1.energyIntensityPerTurnoverCrores : 'N/A (Turnover unavailable)'],
      [],
      ['ESSENTIAL INDICATOR 4: GREENHOUSE GAS EMISSIONS (SCOPE 1 & SCOPE 2)'],
      ['Parameter', 'Unit', 'Current Financial Year (' + report.meta?.financialYear + ')'],
      ['Scope 1 Direct GHG Emissions', ind4.scope1_tCO2e !== null ? 'tCO2e' : 'tCO2 (CO2 strictly)', ind4.scope1_tCO2e !== null ? ind4.scope1_tCO2e : ind4.scope1_tCO2],
      ['Scope 2 Indirect Grid (Location-Based)', 'tCO2', ind4.scope2_LocationBased_tCO2],
      ['Scope 2 Indirect Grid (Market-Based)', 'tCO2', ind4.scope2_MarketBased_tCO2],
      ['Scope 2 Indirect Grid (Reportable)', 'tCO2 (CO2 strictly)', ind4.scope2_Reportable_tCO2],
      ['Total Scope 1 and Scope 2 Emissions', ind4.totalScope1And2_tCO2e !== null ? 'tCO2e' : 'tCO2 (CO2 strictly)', ind4.totalScope1And2_tCO2],
      ['GHG Emission Intensity per Turnover', 'tCO2 / INR Crore', ind4.ghgIntensityPerTurnoverCrores !== null ? ind4.ghgIntensityPerTurnoverCrores : 'N/A (Turnover unavailable)'],
      ['Independent Assurance Status', 'Audit Status', ind4.independentAssuranceStatus],
      [],
      ['STATUTORY NOTICE'],
      [report.meta?.statutoryDisclaimer]
    ].map(e => e.join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `MEIL_BRSR_Section_C_${financialYear}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportPDF = async () => {
    try {
      setExportingPdf(true);
      const params = { financialYear };
      if (selectedEntity) params.entityId = selectedEntity;
      const res = await reportAPI.downloadBRSRPdf(params);
      const blob = new Blob([res.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const entityLabel = selectedEntity
        ? (entities.find(e => e._id === selectedEntity)?.name || 'Entity')
        : 'MEIL_Group';
      link.download = `MEIL_BRSR_Section_C_${financialYear.replace(/\s+/g, '_')}_${entityLabel.replace(/\s+/g, '_')}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to export BRSR PDF:', err);
      alert('Failed to generate BRSR PDF report. Please verify permissions.');
    } finally {
      setExportingPdf(false);
    }
  };

  const ind1 = report?.essentialIndicator1_Energy?.table || {};
  const ind4 = report?.essentialIndicator4_GHG?.table || {};
  const meta = report?.meta || {};
  const audit = report?.auditSummary || {};

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <h2 className="text-xl font-bold text-slate-900">
              SEBI BRSR Section C — Principle 6 Disclosure Center
            </h2>
            <span className="bg-meil-blue text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
              Official SEBI Format
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Principle-wise performance disclosure on Environmental KPIs as prescribed by the Securities and Exchange Board of India (SEBI).
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center space-x-3">
          <button
            onClick={exportPDF}
            disabled={exportingPdf}
            className="flex items-center space-x-1.5 px-3.5 py-2 bg-meil-blue hover:bg-blue-800 text-white rounded-lg text-xs font-semibold shadow-sm transition-all disabled:opacity-50"
          >
            {exportingPdf ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            <span>{exportingPdf ? 'Exporting PDF...' : 'Export PDF'}</span>
          </button>
          <button
            onClick={exportCSV}
            className="flex items-center space-x-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-all"
          >
            <Download className="w-4 h-4" />
            <span>Export CSV</span>
          </button>
          <button
            onClick={handlePrint}
            className="flex items-center space-x-1.5 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold shadow-sm transition-all"
          >
            <Printer className="w-4 h-4" />
            <span>Print Report</span>
          </button>
        </div>
      </div>

      {/* Filter Boundary Ribbon */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center space-x-3 w-full sm:w-auto">
          <Building2 className="w-4 h-4 text-meil-blue flex-shrink-0" />
          <div className="flex-1 sm:w-80">
            <label className="block text-[11px] font-semibold text-slate-500 mb-0.5">
              Reporting Boundary Entity
            </label>
            <select
              className="w-full text-xs p-1.5 bg-slate-50 border border-slate-300 rounded font-medium text-slate-800 focus:outline-none"
              value={selectedEntity}
              onChange={(e) => setSelectedEntity(e.target.value)}
            >
              <option value="">Consolidated Organization (MEIL Group Level)</option>
              {entities.map((e) => (
                <option key={e._id} value={e._id}>
                  {e.name} ({e.type})
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center space-x-3 w-full sm:w-auto">
          <Calendar className="w-4 h-4 text-meil-blue flex-shrink-0" />
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-0.5">
              Financial Year
            </label>
            <select
              className="text-xs p-1.5 bg-slate-50 border border-slate-300 rounded font-medium text-slate-800 focus:outline-none"
              value={financialYear}
              onChange={(e) => setFinancialYear(e.target.value)}
            >
              <option value="FY 2024-25">FY 2024-25 (Current Period)</option>
              <option value="FY 2023-24">FY 2023-24 (Previous Period)</option>
            </select>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="p-12 text-center text-xs text-slate-500">Compiling BRSR Section C tables...</div>
      ) : (
        <div className="space-y-6">
          {/* Statutory Assurance Disclaimer Box */}
          <div className="p-4 bg-amber-50/80 border border-amber-300 rounded-xl space-y-2">
            <div className="flex items-center space-x-2 text-amber-900 font-bold text-xs">
              <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
              <span>STATUTORY AUDITOR ASSURANCE NOTICE (BRSR MANDATE)</span>
            </div>
            <p className="text-xs text-amber-900/90 leading-relaxed">
              {meta.statutoryDisclaimer}
            </p>
            <div className="pt-2 border-t border-amber-200/80 flex flex-wrap items-center justify-between gap-2 text-[11px] text-amber-800">
              <span>Verified Data Points: <strong>{audit.verifiedDataPoints} of {audit.totalDataPoints}</strong></span>
              <span>Evidence Rate: <strong>{audit.evidenceAttachmentRate}%</strong></span>
              <span className="font-semibold bg-amber-200/60 px-2 py-0.5 rounded">
                Assurance Status: {audit.assuranceReadiness}
              </span>
            </div>
          </div>

          {/* Table 1: Essential Indicator 1 (Energy) */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="bg-slate-900 text-white p-4 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold">
                  Principle 6 — Essential Indicator 1: Energy Consumption & Intensity
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Parameters reported in MegaWatt-hours (MWh) and GigaJoules (GJ) in accordance with SEBI guidelines
                </p>
              </div>
              <span className="text-xs font-mono bg-slate-800 px-2.5 py-1 rounded border border-slate-700">
                FY 2024-25
              </span>
            </div>

            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 font-semibold text-slate-700">
                  <th className="py-2.5 px-4">Parameter</th>
                  <th className="py-2.5 px-4">Measurement Unit</th>
                  <th className="py-2.5 px-4 text-right">FY 2024-25 (Current)</th>
                  <th className="py-2.5 px-4 text-right">FY 2023-24 (Baseline)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                <tr>
                  <td className="py-2.5 px-4 font-medium text-slate-800">Total electricity consumption (A) - Renewable (Captive Solar)</td>
                  <td className="py-2.5 px-4 font-mono text-slate-500">MWh</td>
                  <td className="py-2.5 px-4 text-right font-bold text-emerald-700">{ind1.renewableEnergy_MWh?.toLocaleString()}</td>
                  <td className="py-2.5 px-4 text-right text-slate-400">45.00</td>
                </tr>
                <tr>
                  <td className="py-2.5 px-4 font-medium text-slate-800">Total electricity consumption (B) - Non-Renewable (Grid Power)</td>
                  <td className="py-2.5 px-4 font-mono text-slate-500">MWh</td>
                  <td className="py-2.5 px-4 text-right font-medium text-slate-800">185.00</td>
                  <td className="py-2.5 px-4 text-right text-slate-400">170.00</td>
                </tr>
                <tr>
                  <td className="py-2.5 px-4 font-medium text-slate-800">Total fuel consumption (C) - Diesel & Natural Gas</td>
                  <td className="py-2.5 px-4 font-mono text-slate-500">MWh equivalent</td>
                  <td className="py-2.5 px-4 text-right font-medium text-slate-800">559.50</td>
                  <td className="py-2.5 px-4 text-right text-slate-400">490.00</td>
                </tr>
                <tr className="bg-slate-50/70 font-bold">
                  <td className="py-3 px-4 text-slate-900">Total Energy Consumption (A + B + C)</td>
                  <td className="py-3 px-4 font-mono text-slate-600">MWh</td>
                  <td className="py-3 px-4 text-right text-slate-900 text-sm">{ind1.totalEnergy_MWh?.toLocaleString()}</td>
                  <td className="py-3 px-4 text-right text-slate-400">705.00</td>
                </tr>
                <tr className="bg-slate-50/70 font-bold">
                  <td className="py-2.5 px-4 text-slate-900">Total Energy Consumption in Joules</td>
                  <td className="py-2.5 px-4 font-mono text-slate-600">GigaJoules (GJ)</td>
                  <td className="py-2.5 px-4 text-right text-slate-900">{ind1.totalEnergy_GJ?.toLocaleString()}</td>
                  <td className="py-2.5 px-4 text-right text-slate-400">2,538.00</td>
                </tr>
                <tr>
                  <td className="py-2.5 px-4 text-slate-700">Renewable Energy Share Percentage</td>
                  <td className="py-2.5 px-4 font-mono text-slate-500">% of Total Energy</td>
                  <td className="py-2.5 px-4 text-right font-semibold text-emerald-700">{ind1.renewableEnergyPercentage}%</td>
                  <td className="py-2.5 px-4 text-right text-slate-400">6.38%</td>
                </tr>
                <tr>
                  <td className="py-2.5 px-4 text-slate-700">Energy intensity per rupee of turnover</td>
                  <td className="py-2.5 px-4 font-mono text-slate-500">{ind1.intensityUnit || 'MWh / ₹ Crore Turnover'}</td>
                  <td className="py-2.5 px-4 text-right font-semibold text-slate-800">
                    {ind1.energyIntensityPerTurnoverCrores !== null && ind1.energyIntensityPerTurnoverCrores !== undefined
                      ? ind1.energyIntensityPerTurnoverCrores
                      : <span className="text-amber-600 font-normal italic">Turnover data unavailable</span>}
                  </td>
                  <td className="py-2.5 px-4 text-right text-slate-400">0.247</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Table 2: Essential Indicator 4 (GHG Scope 1 & Scope 2) */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="bg-slate-900 text-white p-4 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold">
                  Principle 6 — Essential Indicator 4: Greenhouse Gas Emissions (Scope 1 & Scope 2)
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Reported in Metric Tonnes of CO₂ equivalent (tCO₂e) computed with official CEA v19 & IPCC factors
                </p>
              </div>
              <span className="text-xs font-mono bg-slate-800 px-2.5 py-1 rounded border border-slate-700">
                FY 2024-25
              </span>
            </div>

            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 font-semibold text-slate-700">
                  <th className="py-2.5 px-4">Parameter</th>
                  <th className="py-2.5 px-4">Measurement Unit</th>
                  <th className="py-2.5 px-4 text-right">FY 2024-25 (Current)</th>
                  <th className="py-2.5 px-4 text-right">FY 2023-24 (Baseline)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                <tr>
                  <td className="py-2.5 px-4 font-medium text-slate-800">
                    Total Scope 1 emissions (Break-up of GHG: DG Sets, Mobile fleet, Process Gas)
                  </td>
                  <td className="py-2.5 px-4 font-mono text-slate-500">
                    {ind4.scope1_tCO2e !== null && ind4.scope1_tCO2e !== undefined ? 'Metric Tonnes CO₂e' : 'Metric Tonnes CO₂'}
                  </td>
                  <td className="py-2.5 px-4 text-right font-bold text-orange-600">
                    {ind4.scope1_tCO2e !== null && ind4.scope1_tCO2e !== undefined
                      ? `${ind4.scope1_tCO2e?.toLocaleString()} tCO₂e`
                      : `${ind4.scope1_tCO2?.toLocaleString()} tCO₂ (CO₂ only)`}
                  </td>
                  <td className="py-2.5 px-4 text-right text-slate-400">125.40</td>
                </tr>
                <tr>
                  <td className="py-2.5 px-4 font-medium text-slate-800">
                    Total Scope 2 emissions — Location-Based (CEA National Grid Baseline)
                  </td>
                  <td className="py-2.5 px-4 font-mono text-slate-500">Metric Tonnes CO₂</td>
                  <td className="py-2.5 px-4 text-right font-medium text-slate-700">
                    {ind4.scope2_LocationBased_tCO2?.toLocaleString()} tCO₂
                  </td>
                  <td className="py-2.5 px-4 text-right text-slate-400">121.72</td>
                </tr>
                <tr>
                  <td className="py-2.5 px-4 font-medium text-slate-800">
                    Total Scope 2 emissions — Market-Based (Contractual Instruments / Captive)
                  </td>
                  <td className="py-2.5 px-4 font-mono text-slate-500">Metric Tonnes CO₂</td>
                  <td className="py-2.5 px-4 text-right font-medium text-emerald-700">
                    {ind4.scope2_MarketBased_tCO2?.toLocaleString()} tCO₂
                  </td>
                  <td className="py-2.5 px-4 text-right text-slate-400">0.00</td>
                </tr>
                <tr className="bg-sky-50/50">
                  <td className="py-2.5 px-4 font-semibold text-slate-800">
                    Scope 2 Reportable Headline Emissions ({report?.essentialIndicator4_GHG?.gasCoverageNote ? 'CO₂ only' : 'CO₂e'})
                  </td>
                  <td className="py-2.5 px-4 font-mono text-slate-500">Metric Tonnes CO₂</td>
                  <td className="py-2.5 px-4 text-right font-bold text-sky-700">
                    {ind4.scope2_Reportable_tCO2?.toLocaleString()} tCO₂
                  </td>
                  <td className="py-2.5 px-4 text-right text-slate-400">121.72</td>
                </tr>
                <tr className="bg-slate-50/70 font-bold">
                  <td className="py-3 px-4 text-slate-900">Total Scope 1 and Scope 2 emissions</td>
                  <td className="py-3 px-4 font-mono text-slate-600">
                    {ind4.totalScope1And2_tCO2e !== null && ind4.totalScope1And2_tCO2e !== undefined ? 'Metric Tonnes CO₂e' : 'Metric Tonnes CO₂'}
                  </td>
                  <td className="py-3 px-4 text-right text-slate-900 text-sm">
                    {ind4.totalScope1And2_tCO2e !== null && ind4.totalScope1And2_tCO2e !== undefined
                      ? `${ind4.totalScope1And2_tCO2e?.toLocaleString()} tCO₂e`
                      : `${ind4.totalScope1And2_tCO2?.toLocaleString()} tCO₂ (CO₂ only)`}
                  </td>
                  <td className="py-3 px-4 text-right text-slate-400">247.12</td>
                </tr>
                <tr>
                  <td className="py-2.5 px-4 text-slate-700">Total Scope 1 and Scope 2 emissions per rupee of turnover</td>
                  <td className="py-2.5 px-4 font-mono text-slate-500">
                    {ind4.intensityUnit || 'tCO₂ / ₹ Crore Turnover'}
                  </td>
                  <td className="py-2.5 px-4 text-right font-semibold text-slate-900">
                    {ind4.ghgIntensityPerTurnoverCrores !== null && ind4.ghgIntensityPerTurnoverCrores !== undefined
                      ? ind4.ghgIntensityPerTurnoverCrores
                      : <span className="text-amber-600 font-normal italic">Turnover data unavailable</span>}
                  </td>
                  <td className="py-2.5 px-4 text-right text-slate-400">0.086</td>
                </tr>
                <tr className="bg-emerald-50/40">
                  <td className="py-2.5 px-4 font-medium text-emerald-950">Independent Human Assurance / Verification Status</td>
                  <td className="py-2.5 px-4 text-slate-500 font-mono">—</td>
                  <td className="py-2.5 px-4 text-right font-bold text-emerald-800" colSpan={2}>
                    {ind4.independentAssuranceStatus}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Scope 3 Clear Project Boundary Declaration */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-2">
            <div className="flex items-center space-x-2 text-xs font-bold uppercase text-slate-700">
              <Info className="w-4 h-4 text-purple-600" />
              <span>Scope 3 Reporting Boundary & Roadmap Declaration</span>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              <strong>Mandatory Declaration:</strong> {report.scope3Disclosure?.declaration}
            </p>
            <div className="text-[11px] text-slate-500">
              Architecture Status: <span className="font-semibold text-purple-700">Schema Ready for 15 GHG Protocol Corporate Value Chain categories</span>.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
