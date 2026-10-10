import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  LineChart, 
  Line 
} from 'recharts';
import { 
  BrainCircuit, 
  TrendingDown, 
  AlertTriangle, 
  Sparkles, 
  Calendar, 
  ShieldAlert, 
  ArrowRight, 
  Share2, 
  Activity, 
  CloudRain,
  MapPin,
  Clock,
  Layers
} from 'lucide-react';

export default function AiForecastPage() {
  const { currentUser, t } = useAuth();
  const activePhcId = currentUser.phc_id || 'phc_cpt_01';

  const [medicines, setMedicines] = useState([]);
  const [selectedMedId, setSelectedMedId] = useState('med_01'); // Paracetamol Syrup default
  const [forecastData, setForecastData] = useState(null);
  const [anomalies, setAnomalies] = useState([]);
  const [seasonal, setSeasonal] = useState(null);
  const [redistributionPlan, setRedistributionPlan] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadBaseData();
  }, [activePhcId]);

  useEffect(() => {
    if (selectedMedId) {
      loadForecast(selectedMedId);
    }
  }, [selectedMedId, activePhcId]);

  const loadBaseData = async () => {
    setLoading(true);
    try {
      const [mRes, anomRes, seasRes, redisRes] = await Promise.all([
        api.getMedicines(),
        api.getAnomalies(activePhcId),
        api.getSeasonalProfile(),
        api.getRedistributionPlan('dist_01')
      ]);
      setMedicines(mRes.medicines || []);
      setAnomalies(anomRes.anomalies || []);
      setSeasonal(seasRes.profile);
      setRedistributionPlan(redisRes);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const loadForecast = async (medId) => {
    try {
      const data = await api.getForecast(activePhcId, medId);
      setForecastData(data);
    } catch (e) {
      console.error(e);
    }
  };

  // Combine historical 30 days and 30 days projected depletion for Recharts
  const chartData = [];
  if (forecastData) {
    forecastData.history?.forEach((h) => {
      chartData.push({
        date: h.entry_date.slice(5),
        actual_stock: h.closing_stock,
        projected_stock: null,
        type: 'Historical'
      });
    });

    // Add today anchor
    chartData.push({
      date: 'Today',
      actual_stock: forecastData.metrics.current_stock,
      projected_stock: forecastData.metrics.current_stock,
      type: 'Today'
    });

    forecastData.projections?.forEach((p) => {
      chartData.push({
        date: p.date.slice(5),
        actual_stock: null,
        projected_stock: p.projected_stock,
        type: 'Projected'
      });
    });
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-900 via-emerald-950 to-teal-950 rounded-2xl p-6 text-white shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <BrainCircuit className="w-6 h-6 text-emerald-400" />
            <h1 className="text-2xl font-black tracking-tight">AI Stock Forecasting & Predictive Analytics</h1>
          </div>
          <p className="text-xs text-slate-300 mt-1">
            Time-Series Run-Out Depletion • Statistical Z-Score Outlier Detection • Tamil Nadu Seasonal Multipliers
          </p>
        </div>

        <div className="flex items-center gap-2 bg-emerald-900/60 border border-emerald-500/30 px-3.5 py-1.5 rounded-xl text-xs font-semibold text-emerald-200">
          <CloudRain className="w-4 h-4 text-emerald-400" />
          Active: {seasonal?.season_name || 'Northeast Monsoon'}
        </div>
      </div>

      {/* Main Section: Forecast Visualizer */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-6">
        {/* Medicine Selector and Summary Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div className="flex-1 max-w-md">
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
              Select Medicine to Forecast Depletion Slope
            </label>
            <select
              value={selectedMedId}
              onChange={(e) => setSelectedMedId(e.target.value)}
              className="w-full py-2 px-3 text-xs rounded-xl border border-slate-200 bg-slate-50/50 font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              {medicines.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} ({m.strength})
                </option>
              ))}
            </select>
          </div>

          {forecastData && (
            <div className="flex flex-wrap gap-4 text-xs">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 text-center">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Current Stock</span>
                <div className="font-black text-slate-900 text-base">
                  {forecastData.metrics.current_stock} {forecastData.metrics.unit}
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 text-center">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Consumption Rate</span>
                <div className="font-black text-slate-900 text-base">
                  {forecastData.metrics.effective_daily_rate} /day
                </div>
              </div>

              <div className={`p-3 rounded-xl border text-center ${
                forecastData.metrics.days_left < 15 ? 'bg-rose-50 border-rose-200 text-rose-800' : 'bg-emerald-50 border-emerald-200 text-emerald-800'
              }`}>
                <span className="text-[10px] font-bold uppercase">Estimated Run-Out</span>
                <div className="font-black text-base">
                  {forecastData.metrics.days_left} Days
                </div>
                <div className="text-[10px] font-medium">{forecastData.metrics.run_out_date || 'Depleted'}</div>
              </div>
            </div>
          )}
        </div>

        {/* Recharts Timeline Chart */}
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorActual" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.8}/>
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0.05}/>
                </linearGradient>
                <linearGradient id="colorProj" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ef4444" stopOpacity={0.8}/>
                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0.05}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#64748b' }} />
              <YAxis tick={{ fontSize: 11, fill: '#64748b' }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#0f172a',
                  border: 'none',
                  borderRadius: '12px',
                  color: 'white',
                  fontSize: '12px'
                }}
              />
              <Area type="monotone" dataKey="actual_stock" stroke="#10b981" strokeWidth={2.5} fillOpacity={1} fill="url(#colorActual)" name="Actual Stock (Past 30 Days)" />
              <Area type="monotone" dataKey="projected_stock" stroke="#ef4444" strokeWidth={2.5} strokeDasharray="4 4" fillOpacity={1} fill="url(#colorProj)" name="AI Projected Depletion (Next 30 Days)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Seasonal Advisory Card */}
        {forecastData?.seasonal && (
          <div className="p-4 rounded-xl bg-amber-50/60 border border-amber-200 text-xs flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <CloudRain className="w-5 h-5 text-amber-600 shrink-0" />
              <div>
                <strong className="text-amber-900 font-bold">
                  Monsoon Sensitivity Adjustment ({forecastData.seasonal.multiplier}x Surge Factor):
                </strong>
                <p className="text-amber-800 text-[11px] mt-0.5">
                  Due to current {forecastData.seasonal.season}, recommended safety buffer is increased to <strong>{forecastData.seasonal.recommendedBufferDays} days ({forecastData.seasonal.suggestedBufferQty} units)</strong>.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Two Column Grid: Anomaly Detection Feed & District Redistribution Plan */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Z-Score Anomaly Detection Feed */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-500" />
                Consumption Anomaly Detection (Z-Score)
              </h2>
              <p className="text-xs text-slate-500">Flags unusual demand spikes exceeding 2 standard deviations</p>
            </div>
            <span className="text-xs font-bold px-2 py-0.5 rounded bg-rose-100 text-rose-800">
              {anomalies.length} spikes detected
            </span>
          </div>

          <div className="space-y-3 max-h-96 overflow-y-auto">
            {anomalies.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-8">
                No consumption velocity anomalies detected. Daily dispensing is following standard gaussian baseline.
              </p>
            ) : (
              anomalies.map((anom) => (
                <div key={anom.id} className="p-3.5 rounded-xl border border-rose-200 bg-rose-50/40 text-xs space-y-1.5">
                  <div className="flex items-center justify-between font-bold text-slate-800">
                    <span className="text-rose-700">{anom.medicine_name}</span>
                    <span className="text-[10px] bg-rose-600 text-white px-2 py-0.5 rounded-full font-black">
                      Z = +{anom.z_score}σ
                    </span>
                  </div>
                  <p className="text-slate-600 text-[11px] leading-relaxed">
                    {anom.description}
                  </p>
                  <div className="text-[10px] text-slate-400 flex items-center justify-between pt-1 border-t border-rose-100">
                    <span>Observed: <strong>{anom.observed_qty} units</strong> (Baseline: {anom.baseline_mean})</span>
                    <span>Date: {anom.entry_date}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* District Rebalancing Engine */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-emerald-600" />
                District Automated Rebalancing Plan
              </h2>
              <p className="text-xs text-slate-500">Consolidated inter-PHC transport routes (max 35 km)</p>
            </div>
            <span className="text-xs font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
              {redistributionPlan?.grouped_delivery_runs?.length || 0} delivery runs
            </span>
          </div>

          <div className="space-y-3 max-h-96 overflow-y-auto">
            {!redistributionPlan?.grouped_delivery_runs || redistributionPlan.grouped_delivery_runs.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-8">
                District is currently in equilibrium. No urgent inter-PHC balancing required.
              </p>
            ) : (
              redistributionPlan.grouped_delivery_runs.map((run, idx) => (
                <div key={idx} className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 text-xs space-y-2">
                  <div className="flex items-center justify-between font-bold text-slate-900">
                    <span className="flex items-center gap-1.5 text-emerald-800">
                      <Share2 className="w-3.5 h-3.5" />
                      Run #{idx + 1}: {run.from_phc.name} &rarr; {run.to_phc.name}
                    </span>
                    <span className="text-[11px] font-bold text-slate-600 bg-white px-2 py-0.5 rounded border border-slate-200">
                      {run.distance_km} km
                    </span>
                  </div>

                  <div className="space-y-1">
                    {run.items.map((itm, i) => (
                      <div key={i} className="flex justify-between text-[11px] text-slate-600 bg-white p-2 rounded border border-slate-100">
                        <span>• {itm.medicine_name}</span>
                        <strong className="text-emerald-700">{itm.quantity} {itm.unit}</strong>
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center justify-between pt-1 text-[11px]">
                    <span className="text-slate-400 font-medium">Consolidated into 1 ambulance/van trip</span>
                    <span className="text-emerald-700 font-bold">Automated Recommendation</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
