import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  ArrowRight, 
  Package, 
  MapPin, 
  ArrowLeftRight, 
  BrainCircuit, 
  PlusCircle, 
  TrendingDown, 
  TrendingUp, 
  ShieldAlert, 
  Thermometer, 
  Share2, 
  Send,
  Building2,
  Calendar,
  Sparkles
} from 'lucide-react';

export default function DashboardPage() {
  const { currentUser, t, lang } = useAuth();
  const navigate = useNavigate();
  const [stockSummary, setStockSummary] = useState(null);
  const [districtData, setDistrictData] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [transfers, setTransfers] = useState([]);
  const [loading, setLoading] = useState(true);

  const activePhcId = currentUser.phc_id || 'phc_cpt_01';

  useEffect(() => {
    loadDashboardData();
  }, [currentUser]);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      if (currentUser.role === 'district_admin') {
        const dOverview = await api.getDistrictOverview();
        setDistrictData(dOverview);
      } else {
        const [stockRes, alertsRes, transfersRes] = await Promise.all([
          api.getStockDaysLeft(activePhcId),
          api.getAlerts(`phc_id=${activePhcId}&status=new`),
          api.getTransfers(`phc_id=${activePhcId}`)
        ]);
        setStockSummary(stockRes);
        setAlerts(alertsRes.alerts || []);
        setTransfers((transfersRes.transfers || []).slice(0, 4));
      }
    } catch (err) {
      console.error('Error loading dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  // Helper for Days-Left color coding
  const getStatusBadge = (item) => {
    if (item.current_stock === 0) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-300">
          <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
          Out of Stock (0 days)
        </span>
      );
    } else if (item.days_left < item.min_threshold) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-red-100 text-red-800 border border-red-300">
          <AlertTriangle className="w-3.5 h-3.5 text-red-600" />
          Critical ({item.days_left} days left)
        </span>
      );
    } else if (item.days_left <= 30) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-300">
          <Clock className="w-3.5 h-3.5 text-amber-600" />
          Low Stock ({item.days_left} days)
        </span>
      );
    } else if (item.days_left > 60) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-purple-100 text-purple-800 border border-purple-300">
          <Share2 className="w-3.5 h-3.5 text-purple-600" />
          Surplus ({item.days_left} days)
        </span>
      );
    } else {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
          Adequate ({item.days_left} days)
        </span>
      );
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="mt-4 text-sm font-medium text-slate-600">Loading MediSync PHC Telemetry...</p>
      </div>
    );
  }

  // DISTRICT ADMIN VIEW
  if (currentUser.role === 'district_admin' && districtData) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* District Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-slate-900 via-emerald-950 to-slate-900 p-6 rounded-2xl text-white shadow-xl">
          <div>
            <div className="flex items-center gap-2">
              <Building2 className="w-6 h-6 text-emerald-400" />
              <h1 className="text-2xl font-black tracking-tight">District Health Command Center</h1>
            </div>
            <p className="text-sm text-slate-300 mt-1">
              Chengalpattu District • 3 Medical Blocks • 15 Primary Health Centres Monitored
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              to="/ai"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold text-xs shadow-md transition-all cursor-pointer"
            >
              <Sparkles className="w-4 h-4" />
              Run District Rebalancing AI
            </Link>
            <Link
              to="/reports"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-semibold text-xs border border-white/20 transition-all"
            >
              Export District Reports
            </Link>
          </div>
        </div>

        {/* District KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-2xl border border-rose-200 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500">Active Stockouts</span>
              <span className="p-2 rounded-lg bg-rose-50 text-rose-600"><AlertTriangle className="w-4 h-4" /></span>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-3xl font-black text-rose-600">{districtData.kpis.total_stockouts}</span>
              <span className="text-xs text-rose-600 font-medium">PHC instances</span>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">Immediate transfer or indent needed</p>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-amber-200 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500">Critical Shortages (&lt;15d)</span>
              <span className="p-2 rounded-lg bg-amber-50 text-amber-600"><Clock className="w-4 h-4" /></span>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-3xl font-black text-amber-600">{districtData.kpis.critical_shortages}</span>
              <span className="text-xs text-amber-600 font-medium">at risk</span>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">Under 15 days velocity</p>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-purple-200 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500">Surplus Batches Available</span>
              <span className="p-2 rounded-lg bg-purple-50 text-purple-600"><Share2 className="w-4 h-4" /></span>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-3xl font-black text-purple-600">{districtData.kpis.surplus_stock}</span>
              <span className="text-xs text-purple-600 font-medium">spareable</span>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">&gt;60 days stock holding</p>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-emerald-200 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500">Avg Transfer Time</span>
              <span className="p-2 rounded-lg bg-emerald-50 text-emerald-600"><ArrowLeftRight className="w-4 h-4" /></span>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-3xl font-black text-emerald-600">{districtData.kpis.avg_transfer_turnaround_hrs}</span>
              <span className="text-xs text-emerald-600 font-medium">turnaround</span>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">{districtData.kpis.completed_transfers} completed transfers</p>
          </div>
        </div>

        {/* Block Comparison & Top Shortages */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Block Breakdown */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
            <h2 className="text-base font-bold text-slate-900 mb-4 flex items-center gap-2">
              <Building2 className="w-5 h-5 text-emerald-600" />
              Medical Blocks Overview
            </h2>
            <div className="space-y-4">
              {districtData.block_breakdown.map((b) => (
                <div key={b.block_id} className="p-4 rounded-xl border border-slate-100 bg-slate-50/50 flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-sm text-slate-800">{b.block_name}</h3>
                    <p className="text-xs text-slate-500">{b.phc_count} PHCs connected</p>
                  </div>
                  <div className="text-right">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                      b.risk_level === 'High' ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'
                    }`}>
                      {b.shortages_detected} Shortages
                    </span>
                    <p className="text-[11px] text-slate-400 mt-1 font-medium">{b.risk_level} Risk</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Top Shortage Medicines across District */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
            <h2 className="text-base font-bold text-slate-900 mb-4 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-rose-500" />
              Top Shortage Medicines District-Wide
            </h2>
            <div className="space-y-3">
              {districtData.top_shortages.map((item, idx) => (
                <div key={idx} className="p-3.5 rounded-xl border border-slate-100 flex items-center justify-between hover:bg-slate-50">
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-full bg-slate-100 font-bold text-xs text-slate-600 flex items-center justify-center">
                      {idx + 1}
                    </span>
                    <span className="font-semibold text-xs text-slate-800">{item.medicine_name}</span>
                  </div>
                  <span className="text-xs font-bold px-2 py-0.5 rounded bg-rose-50 text-rose-700">
                    Deficit in {item.phc_shortage_count} PHCs
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // PHC / BLOCK MEDICAL OFFICER / PHARMACIST VIEW
  const criticalItems = stockSummary ? stockSummary.items.filter(s => s.status === 'out_of_stock' || s.status === 'critical') : [];
  const surplusItems = stockSummary ? stockSummary.items.filter(s => s.status === 'surplus') : [];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-emerald-800 via-teal-800 to-emerald-900 rounded-2xl p-6 text-white shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-emerald-300" />
            <h1 className="text-2xl font-black tracking-tight">{currentUser.phc_name || 'PHC Alapakkam'}</h1>
          </div>
          <p className="text-xs text-emerald-100 mt-1">
            Logged in as <span className="font-bold">{currentUser.full_name}</span> • {currentUser.role.replace(/_/g, ' ').toUpperCase()}
          </p>
        </div>

        {/* Fast Action Buttons */}
        <div className="flex flex-wrap gap-2.5">
          <Link
            to={`/nearby?from_source_id=${activePhcId}`}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-500 text-slate-950 font-bold text-xs shadow-md transition-all cursor-pointer"
          >
            <MapPin className="w-4 h-4" />
            {t('btn_find_nearby')}
          </Link>
          <Link
            to="/entry"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white/15 hover:bg-white/25 text-white font-semibold text-xs border border-white/20 transition-all cursor-pointer"
          >
            <PlusCircle className="w-4 h-4" />
            {t('nav_entry')}
          </Link>
          <Link
            to="/chat"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white/15 hover:bg-white/25 text-white font-semibold text-xs border border-white/20 transition-all cursor-pointer"
          >
            <BrainCircuit className="w-4 h-4 text-emerald-200" />
            AI Chatbot
          </Link>
        </div>
      </div>

      {/* Critical Stock Alert Notification Bar (Live Seed Scenario) */}
      {criticalItems.length > 0 && (
        <div className="bg-rose-50 border-2 border-rose-300 p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-start sm:items-center gap-3">
            <div className="p-2 rounded-xl bg-rose-500 text-white shrink-0">
              <AlertTriangle className="w-6 h-6 animate-bounce" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-rose-900">
                Action Required: {criticalItems.length} Critical Stock-out / Shortage Items at {currentUser.phc_name || 'this PHC'}
              </h2>
              <p className="text-xs text-rose-700 mt-0.5">
                Paracetamol Pediatric Suspension is at <strong className="underline">0 bottles</strong>. Nearby PHC Melamaiyur (2.9 km away) holds 380 surplus bottles.
              </p>
            </div>
          </div>
          <Link
            to={`/nearby?medicine_id=med_01&from_source_id=${activePhcId}`}
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-md transition-all shrink-0 cursor-pointer"
          >
            <Share2 className="w-3.5 h-3.5" />
            Transfer from Melamaiyur
          </Link>
        </div>
      )}

      {/* Metric KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-rose-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Critical / Stockouts</span>
            <span className="p-1.5 rounded-lg bg-rose-50 text-rose-600"><AlertTriangle className="w-4 h-4" /></span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-black text-rose-600">{stockSummary?.critical_count || 0}</span>
            <span className="text-xs text-rose-600 font-medium">medicines</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">&lt; 15 days of stock</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-amber-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Low Stock</span>
            <span className="p-1.5 rounded-lg bg-amber-50 text-amber-600"><Clock className="w-4 h-4" /></span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-black text-amber-600">{stockSummary?.low_count || 0}</span>
            <span className="text-xs text-amber-600 font-medium">medicines</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">15 to 30 days remaining</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-emerald-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Adequate Stock</span>
            <span className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600"><CheckCircle2 className="w-4 h-4" /></span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-black text-emerald-600">{stockSummary?.adequate_count || 0}</span>
            <span className="text-xs text-emerald-600 font-medium">medicines</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">&gt; 30 days of stock</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-purple-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Surplus to Share</span>
            <span className="p-1.5 rounded-lg bg-purple-50 text-purple-600"><Share2 className="w-4 h-4" /></span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-black text-purple-600">{surplusItems.length}</span>
            <span className="text-xs text-purple-600 font-medium">medicines</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Can donate to neighbours</p>
        </div>
      </div>

      {/* Main Content Split: Critical Shortages Table & Active Transfers */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column (2 Cols): Days-of-Stock Urgent Action Table */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-xs p-6">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <div>
              <h2 className="text-base font-bold text-slate-900">Urgent Days-of-Stock Watchlist</h2>
              <p className="text-xs text-slate-500">Real-time depletion rate calculated from 7-day and 30-day velocity</p>
            </div>
            <Link to="/inventory" className="text-xs font-bold text-emerald-600 hover:text-emerald-700 flex items-center gap-1">
              View All 30 Medicines <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="divide-y divide-slate-100 mt-2">
            {stockSummary?.items.slice(0, 6).map((item) => (
              <div key={item.medicine_id} className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/70 p-2 rounded-xl transition-colors">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-slate-800">{item.medicine_name}</span>
                    {item.critical && (
                      <span className="text-[10px] bg-red-100 text-red-700 font-bold px-1.5 py-0.2 rounded" title="Life Saving / Critical">
                        Critical
                      </span>
                    )}
                    {item.cold_chain && (
                      <span className="text-[10px] bg-sky-100 text-sky-700 font-bold px-1.5 py-0.2 rounded flex items-center gap-0.5">
                        <Thermometer className="w-2.5 h-2.5" /> Cold Chain
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-slate-500">
                    <span>Stock: <strong className="text-slate-800">{item.current_stock} {item.unit}</strong></span>
                    <span>•</span>
                    <span>Daily rate: <strong className="text-slate-800">{item.effective_daily_rate} {item.unit}/day</strong></span>
                    <span>•</span>
                    <span className="flex items-center gap-1 font-medium">
                      Trend: 
                      {item.trend === 'increasing' ? (
                        <span className="text-rose-600 flex items-center gap-0.5"><TrendingUp className="w-3 h-3" /> Accelerating</span>
                      ) : item.trend === 'decreasing' ? (
                        <span className="text-emerald-600 flex items-center gap-0.5"><TrendingDown className="w-3 h-3" /> Decelerating</span>
                      ) : (
                        <span className="text-slate-500">Stable</span>
                      )}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3 self-end sm:self-center">
                  {getStatusBadge(item)}

                  {(item.status === 'out_of_stock' || item.status === 'critical' || item.status === 'low') && (
                    <button
                      onClick={() => navigate(`/nearby?medicine_id=${item.medicine_id}&from_source_id=${activePhcId}`)}
                      className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs flex items-center gap-1 shadow-xs transition-colors cursor-pointer"
                    >
                      <MapPin className="w-3 h-3" />
                      Find Nearby
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Column: Inter-PHC Transfers & Indents Status */}
        <div className="space-y-6">
          {/* Active Transfers Card */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <ArrowLeftRight className="w-4 h-4 text-emerald-600" />
                Inter-PHC Transfers
              </h2>
              <Link to="/transfers" className="text-xs font-semibold text-emerald-600 hover:text-emerald-700">
                Manage
              </Link>
            </div>

            <div className="space-y-3 mt-4">
              {transfers.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-4">No recent transfers.</p>
              ) : (
                transfers.map((t) => (
                  <div key={t.id} className="p-3.5 rounded-xl border border-slate-100 bg-slate-50/60 text-xs">
                    <div className="flex items-center justify-between font-bold text-slate-800">
                      <span>{t.request_number}</span>
                      <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-extrabold ${
                        t.status === 'completed'
                          ? 'bg-emerald-100 text-emerald-800'
                          : t.status === 'approved'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}>
                        {t.status}
                      </span>
                    </div>

                    <div className="mt-2 text-slate-600 flex items-center justify-between">
                      <span>From: <strong>{t.from_phc_name}</strong></span>
                      <span className="text-slate-400">({t.distance_km} km)</span>
                    </div>

                    <div className="mt-2 flex items-center justify-between pt-2 border-t border-slate-200/60">
                      <span className="text-[11px] text-slate-500">{t.items?.length || 1} medicine items</span>
                      <Link to={`/transfers?open=${t.id}`} className="text-emerald-700 font-bold hover:underline">
                        View Slip &rarr;
                      </Link>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Pluggable Weather & Seasonal Monsoon Alert Card */}
          <div className="bg-gradient-to-br from-blue-900 to-indigo-950 rounded-2xl p-5 text-white shadow-md">
            <div className="flex items-center gap-2 text-amber-300 font-bold text-xs uppercase tracking-wider">
              <Sparkles className="w-4 h-4" />
              TN Health Climate Advisory
            </div>
            <h3 className="font-bold text-sm text-white mt-2">Northeast Monsoon Buffer Protocol</h3>
            <p className="text-xs text-blue-100 mt-1 leading-relaxed">
              Coastal Chengalpattu block experiencing increased seasonal viral fever cases. Recommended safety buffer raised to <strong>45 days</strong> for Paracetamol, ORS, and Amoxicillin.
            </p>
            <Link
              to="/ai"
              className="inline-flex items-center gap-1 text-xs text-amber-300 font-bold mt-3 hover:underline"
            >
              Inspect Seasonal Demand Projections &rarr;
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
