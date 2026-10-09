import React, { useState, useEffect } from 'react';
import { Network, Building2, MapPin, IndianRupee, Layers, FileText, ExternalLink, ShieldAlert, Sparkles } from 'lucide-react';
import { entityAPI, disclosureAPI } from '../services/api';

export default function Entities() {
  const [entities, setEntities] = useState([]);
  const [disclosures, setDisclosures] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [entRes, discRes] = await Promise.all([
        entityAPI.getAll(),
        disclosureAPI.getAll().catch(() => ({ data: { disclosures: [] } }))
      ]);
      setEntities(entRes.data.entities);
      setDisclosures(discRes.data.disclosures || []);
    } catch (err) {
      console.error('Failed to load entities/disclosures:', err);
    } finally {
      setLoading(false);
    }
  };

  const holding = entities.filter(e => e.type === 'Holding');
  const subsidiaries = entities.filter(e => e.type === 'Subsidiary');
  const bus = entities.filter(e => e.type === 'BusinessUnit');
  const sites = entities.filter(e => e.type === 'ProjectSite');

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Title */}
      <div>
        <div className="flex items-center space-x-2">
          <h2 className="text-xl font-bold text-slate-900">
            MEIL Organizational Hierarchy & Subsidiary Registry
          </h2>
          <span className="bg-meil-blue text-white text-xs font-bold px-2 py-0.5 rounded-full">
            Multi-Tier Structure
          </span>
        </div>
        <p className="text-xs text-slate-500 mt-1">
          Hierarchical organizational structure powering bottom-up ESG aggregation from remote infrastructure project sites to corporate board reporting.
        </p>
      </div>

      {loading ? (
        <div className="p-12 text-center text-xs text-slate-500">Loading organizational hierarchy...</div>
      ) : (
        <div className="space-y-6">
          {/* Level 1: Holding */}
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
              Level 1: Corporate Holding & HQ
            </div>
            {holding.map(e => (
              <div key={e._id} className="bg-gradient-to-r from-slate-900 to-meil-dark text-white p-5 rounded-xl shadow-md space-y-2">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="bg-emerald-500 text-slate-900 text-[10px] font-bold px-2 py-0.5 rounded uppercase">
                      Holding Company
                    </span>
                    <h3 className="text-base font-bold mt-1.5">{e.name}</h3>
                    <div className="text-xs text-slate-300">{e.industrySector}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-slate-400">Consolidated Turnover</div>
                    <div className="text-sm font-bold text-emerald-400">₹{e.turnoverINR_Crores?.toLocaleString()} Cr</div>
                  </div>
                </div>
                <div className="text-xs text-slate-300 flex items-center space-x-4 pt-1">
                  <span className="flex items-center space-x-1">
                    <MapPin className="w-3.5 h-3.5 text-slate-400" />
                    <span>{e.location?.city}, {e.location?.state}</span>
                  </span>
                  <span className="font-mono text-slate-400">Code: {e.code}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Level 2: Subsidiaries & BUs */}
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
              Level 2: Subsidiaries & Business Units
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[...subsidiaries, ...bus].map(e => (
                <div key={e._id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-2">
                  <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                    e.type === 'Subsidiary' ? 'bg-blue-100 text-blue-800' : 'bg-slate-100 text-slate-700'
                  }`}>
                    {e.type}
                  </span>
                  <h4 className="font-bold text-xs text-slate-800">{e.name}</h4>
                  <div className="text-[11px] text-slate-500">{e.industrySector}</div>
                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                    <span className="text-slate-500">Turnover:</span>
                    <span className="font-bold text-slate-800">₹{e.turnoverINR_Crores} Cr</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Level 3: Project Sites */}
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
              Level 3: Operational Infrastructure Project Sites
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {sites.map(e => (
                <div key={e._id} className="bg-white p-4 rounded-xl border border-emerald-200/80 shadow-sm space-y-2 bg-gradient-to-b from-white to-emerald-50/20">
                  <span className="inline-block bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded text-[10px] font-bold">
                    Project Site
                  </span>
                  <h4 className="font-bold text-xs text-slate-800">{e.name}</h4>
                  <div className="text-[11px] text-slate-500">{e.industrySector}</div>
                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                    <span className="text-slate-500 flex items-center space-x-1">
                      <MapPin className="w-3 h-3 text-slate-400" />
                      <span>{e.location?.city}, {e.location?.state}</span>
                    </span>
                    <span className="font-mono text-[10px] text-slate-400">{e.code}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Published Subsidiary Annual Disclosures (Public BRSR) */}
          {disclosures.length > 0 && (
            <div className="pt-4 border-t border-slate-200 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center space-x-1.5">
                    <FileText className="w-4 h-4 text-meil-blue" />
                    <span>Public Subsidiary ESG Disclosures (Published Annual Report / BRSR)</span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Published statutory figures reported by standalone subsidiaries. Excluded from MEIL Group operational consolidation.
                  </p>
                </div>
                <span className="bg-slate-100 text-slate-700 text-[10px] font-semibold px-2.5 py-1 rounded-full border border-slate-200">
                  Company-Reported Statutory Data
                </span>
              </div>

              <div className="space-y-4">
                {disclosures.map(d => (
                  <div key={d._id} className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
                      <div>
                        <div className="flex items-center space-x-2">
                          <h4 className="font-bold text-sm text-slate-900">{d.reportingEntityName}</h4>
                          <span className="bg-blue-50 text-blue-700 text-[10px] font-bold px-2 py-0.5 rounded border border-blue-200">
                            {d.financialYear}
                          </span>
                          <span className="bg-amber-50 text-amber-700 text-[10px] font-medium px-2 py-0.5 rounded border border-amber-200">
                            Standalone Subsidiary (Not MEIL Consolidated)
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500 mt-1 flex items-center space-x-2">
                          <span>{d.reportTitle}</span>
                          <span>•</span>
                          <span>{d.sourcePageTable}</span>
                        </div>
                      </div>

                      <a
                        href={d.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center space-x-1 text-xs text-meil-blue hover:text-blue-700 font-semibold"
                      >
                        <span>View Source Document</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </div>

                    {/* Metrics Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                      <div className="p-3 bg-slate-50 rounded-lg">
                        <span className="text-[11px] text-slate-500 block">Scope 1 Direct</span>
                        <strong className="text-sm text-slate-800">{d.ghgEmissions?.scope1_tCO2e} tCO₂e</strong>
                      </div>
                      <div className="p-3 bg-slate-50 rounded-lg">
                        <span className="text-[11px] text-slate-500 block">Scope 2 Indirect</span>
                        <strong className="text-sm text-slate-800">{d.ghgEmissions?.scope2_tCO2e} tCO₂e</strong>
                      </div>
                      <div className="p-3 bg-slate-50 rounded-lg">
                        <span className="text-[11px] text-slate-500 block">Emission Intensity</span>
                        <strong className="text-sm text-slate-800">
                          {d.ghgEmissions?.scope1And2_Intensity_per_Turnover?.value} {d.ghgEmissions?.scope1And2_Intensity_per_Turnover?.unit}
                        </strong>
                      </div>
                      <div className="p-3 bg-slate-50 rounded-lg">
                        <span className="text-[11px] text-slate-500 block">Total Energy</span>
                        <strong className="text-sm text-slate-800">{d.energyConsumption_GJ?.totalEnergy_GJ?.toLocaleString()} GJ</strong>
                      </div>
                    </div>

                    {/* Energy Breakdown */}
                    <div className="bg-slate-50/70 p-3 rounded-lg text-xs space-y-1 text-slate-600">
                      <div className="font-semibold text-[11px] text-slate-700 mb-1">Energy Consumption Breakdown:</div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px]">
                        <div>Non-Renewable Electricity: <strong>{d.energyConsumption_GJ?.nonRenewableElectricity_GJ?.toLocaleString()} GJ</strong></div>
                        <div>Non-Renewable Fuel: <strong>{d.energyConsumption_GJ?.nonRenewableFuel_GJ?.toLocaleString()} GJ</strong></div>
                        <div>Other Non-Renewable: <strong>{d.energyConsumption_GJ?.otherNonRenewableEnergy_GJ?.toLocaleString()} GJ</strong></div>
                      </div>
                      <div className="pt-1 text-[11px] text-emerald-700 flex items-center space-x-2">
                        <span>Renewable Electricity: <strong>{d.energyConsumption_GJ?.renewableElectricity_GJ} GJ</strong></span>
                        <span>•</span>
                        <span>Renewable Fuel: <strong>{d.energyConsumption_GJ?.renewableFuel_GJ} GJ</strong></span>
                        <span>•</span>
                        <span>Other Renewable: <strong>{d.energyConsumption_GJ?.otherRenewableEnergy_GJ} GJ</strong></span>
                      </div>
                    </div>

                    <div className="text-[11px] text-slate-400 italic">
                      Provenance: {d.provenanceStatus} • Imported on {new Date(d.importTimestamp).toLocaleDateString()} • {d.auditAssuranceNotes}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
