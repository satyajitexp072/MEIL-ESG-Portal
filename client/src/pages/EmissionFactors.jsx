import React, { useState, useEffect } from 'react';
import { BookOpenCheck, ExternalLink, ShieldAlert, Search } from 'lucide-react';
import { factorAPI } from '../services/api';

export default function EmissionFactors() {
  const [factors, setFactors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchFactors();
  }, []);

  const fetchFactors = async () => {
    try {
      const res = await factorAPI.getAll();
      setFactors(res.data.factors);
    } catch (err) {
      console.error('Failed to load emission factors:', err);
    } finally {
      setLoading(false);
    }
  };

  const filtered = factors.filter(f =>
    f.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    f.sourceCitation.toLowerCase().includes(searchTerm.toLowerCase()) ||
    f.fuelOrGridType.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div>
        <div className="flex items-center space-x-2">
          <h2 className="text-xl font-bold text-slate-900">
            Official Emission Factor & Baseline Registry
          </h2>
          <span className="bg-emerald-100 text-emerald-800 text-xs font-bold px-2 py-0.5 rounded-full border border-emerald-200">
            Govt & IPCC Verified
          </span>
        </div>
        <p className="text-xs text-slate-500 mt-1">
          Strict regulatory integrity: The portal enforces official national and international emission baselines. No synthetic or invented factors are permitted.
        </p>
      </div>

      {/* Notice Banner */}
      <div className="p-4 bg-sky-50 border border-sky-200 rounded-xl flex items-start space-x-3 text-xs text-sky-900">
        <ShieldAlert className="w-4 h-4 text-sky-700 flex-shrink-0 mt-0.5" />
        <div>
          <strong>Integrity Mandate:</strong> Grid factors reflect the official <em>Central Electricity Authority (CEA) CO2 Baseline Database for the Indian Power Sector, User Guide Version 19.0 (2024)</em>. Primary fuel combustion baselines adhere to the <em>IPCC 2006 Guidelines for National Greenhouse Gas Inventories</em>.
        </div>
      </div>

      {/* Search */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            className="w-full text-xs pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-meil-blue"
            placeholder="Search by factor name, fuel type, or citation authority..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* Factor Cards */}
      {loading ? (
        <div className="p-12 text-center text-xs text-slate-500">Loading emission baselines...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map((f) => (
            <div key={f._id} className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                    f.scope === 1 ? 'bg-orange-100 text-orange-800' : 'bg-sky-100 text-sky-800'
                  }`}>
                    Scope {f.scope} • {f.category}
                  </span>
                  <h3 className="font-bold text-sm text-slate-800 mt-1">{f.name}</h3>
                  <div className="text-xs text-slate-500">{f.subCategory}</div>
                </div>
                <div className="text-right">
                  <div className="font-mono text-base font-bold text-emerald-700">
                    {f.factorValue}
                  </div>
                  <div className="text-[11px] font-mono text-slate-500">{f.factorUnit}</div>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100 text-xs space-y-1">
                <div>
                  <span className="text-slate-400">Official Citation:</span>{' '}
                  <span className="font-semibold text-slate-700">{f.sourceCitation}</span>
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-500">
                  <span>Year: {f.publicationYear}</span>
                  {f.referenceUrl && (
                    <a
                      href={f.referenceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-meil-blue hover:underline flex items-center space-x-1"
                    >
                      <span>Authority Source</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              </div>

              {f.notes && (
                <div className="p-2 bg-slate-50 rounded text-[11px] text-slate-600">
                  {f.notes}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
