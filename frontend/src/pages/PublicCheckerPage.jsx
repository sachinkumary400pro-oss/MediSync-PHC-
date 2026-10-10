import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { 
  Globe, 
  Search, 
  MapPin, 
  Phone, 
  CheckCircle2, 
  AlertTriangle, 
  Clock, 
  Building2, 
  ShieldCheck,
  HeartPulse
} from 'lucide-react';

export default function PublicCheckerPage() {
  const [phcs, setPhcs] = useState([]);
  const [medicines, setMedicines] = useState([]);
  const [selectedPhcId, setSelectedPhcId] = useState('');
  const [selectedMedId, setSelectedMedId] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadPublicLists();
  }, []);

  const loadPublicLists = async () => {
    try {
      const [phcData, medData] = await Promise.all([
        api.getPhcs(),
        api.getMedicines()
      ]);
      setPhcs(phcData.phcs || []);
      setMedicines(medData.medicines || []);
      if (phcData.phcs?.length > 0) setSelectedPhcId(phcData.phcs[0].id);
      if (medData.medicines?.length > 0) setSelectedMedId(medData.medicines[0].id);
    } catch (e) {
      console.error(e);
    }
  };

  const handleCheck = async (e) => {
    e.preventDefault();
    if (!selectedPhcId || !selectedMedId) return;

    setLoading(true);
    try {
      const data = await api.getPublicAvailability(selectedPhcId, selectedMedId);
      setResult(data);
    } catch (e) {
      alert('Error querying medicine availability: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* Citizen Header */}
      <div className="text-center space-y-2">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold border border-emerald-300">
          <HeartPulse className="w-3.5 h-3.5 text-emerald-600" />
          Public Citizen Service • பொதுமக்கள் சேவை
        </div>
        <h1 className="text-3xl font-black text-slate-950 tracking-tight">
          PHC Medicine Availability Checker
        </h1>
        <p className="text-xs text-slate-500 max-w-lg mx-auto">
          Check if essential medicines are currently stocked at your nearest Primary Health Centre before visiting.
        </p>
      </div>

      {/* Query Form */}
      <form onSubmit={handleCheck} className="bg-white rounded-3xl border border-slate-200 shadow-lg p-6 sm:p-8 space-y-6">
        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
            1. Select Primary Health Centre (ஆரம்ப சுகாதார நிலையம்)
          </label>
          <select
            value={selectedPhcId}
            onChange={(e) => setSelectedPhcId(e.target.value)}
            className="w-full p-3.5 text-xs font-semibold rounded-2xl border border-slate-200 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-800"
          >
            {phcs.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.block_name})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
            2. Select Prescribed Medicine (மருந்து பெயர்)
          </label>
          <select
            value={selectedMedId}
            onChange={(e) => setSelectedMedId(e.target.value)}
            className="w-full p-3.5 text-xs font-semibold rounded-2xl border border-slate-200 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-800"
          >
            {medicines.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name} ({m.form} - {m.strength})
              </option>
            ))}
          </select>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-md transition-all cursor-pointer flex items-center justify-center gap-2"
        >
          <Search className="w-4 h-4" />
          {loading ? 'Checking Availability...' : 'Check Availability (சரிபார்க்கவும்)'}
        </button>
      </form>

      {/* Availability Status Result Card */}
      {result && (
        <div className={`rounded-3xl p-6 sm:p-8 border shadow-lg space-y-5 ${
          result.badge_color === 'green'
            ? 'bg-emerald-50/70 border-emerald-300'
            : result.badge_color === 'amber'
            ? 'bg-amber-50/70 border-amber-300'
            : 'bg-rose-50/70 border-rose-300'
        }`}>
          <div className="flex items-start justify-between">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Official Availability Status
              </span>
              <h2 className="text-2xl font-black text-slate-900 mt-1">
                {result.medicine.name}
              </h2>
              <p className="text-xs text-slate-600 mt-0.5 font-medium">
                Form: {result.medicine.form} • Strength: {result.medicine.strength}
              </p>
            </div>

            <div>
              {result.badge_color === 'green' && (
                <span className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-black bg-emerald-600 text-white shadow-xs">
                  <CheckCircle2 className="w-4 h-4" /> AVAILABLE
                </span>
              )}
              {result.badge_color === 'amber' && (
                <span className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-black bg-amber-500 text-slate-950 shadow-xs">
                  <Clock className="w-4 h-4" /> LIMITED STOCK
                </span>
              )}
              {result.badge_color === 'red' && (
                <span className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-black bg-rose-600 text-white shadow-xs">
                  <AlertTriangle className="w-4 h-4" /> OUT OF STOCK
                </span>
              )}
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-white/80 border border-slate-200/80 text-xs space-y-2">
            <div className="text-sm font-bold text-slate-800">
              {result.status_display}
            </div>
            <p className="text-slate-600 text-[11px] leading-relaxed">
              {result.badge_color === 'green'
                ? 'This medicine is currently in stock at the dispensary. Please carry your doctor prescription and Aadhaar/Ration card during OPD timings (8:00 AM - 12:00 PM & 4:00 PM - 5:00 PM).'
                : result.badge_color === 'amber'
                ? 'Stock is running low. Please verify with the centre pharmacist or visit early during OPD hours.'
                : 'This medicine is temporarily out of stock at this centre. Our automated system has flagged this to nearby PHCs for emergency rebalancing.'}
            </p>
          </div>

          {/* Centre Location and Phone */}
          <div className="pt-2 border-t border-slate-200/60 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600">
            <div className="flex items-center gap-1.5">
              <Building2 className="w-4 h-4 text-emerald-600" />
              <span>{result.phc.name} • {result.phc.address}</span>
            </div>
            <div className="flex items-center gap-1.5 font-bold text-slate-800">
              <Phone className="w-4 h-4 text-emerald-600" />
              <span>Contact: {result.phc.phone}</span>
            </div>
          </div>
        </div>
      )}

      {/* Public Trust Notice */}
      <div className="p-4 rounded-2xl bg-slate-100 text-slate-500 text-[11px] text-center flex items-center justify-center gap-2">
        <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
        All medicines in Tamil Nadu Government Primary Health Centres are provided 100% FREE OF COST to all citizens under the Chief Minister Comprehensive Health Scheme.
      </div>
    </div>
  );
}
