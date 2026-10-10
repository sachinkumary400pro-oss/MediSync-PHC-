import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { 
  Search, 
  Filter, 
  MapPin, 
  AlertTriangle, 
  Clock, 
  CheckCircle2, 
  Share2, 
  Thermometer, 
  Layers, 
  TrendingUp, 
  TrendingDown, 
  Calendar,
  X,
  FileSpreadsheet
} from 'lucide-react';

export default function InventoryPage() {
  const { currentUser, t } = useAuth();
  const navigate = useNavigate();
  const activePhcId = currentUser.phc_id || 'phc_cpt_01';

  const [stock, setStock] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [filterCritical, setFilterCritical] = useState(false);
  const [filterColdChain, setFilterColdChain] = useState(false);
  const [filterStatus, setFilterStatus] = useState('ALL'); // ALL, CRITICAL, LOW, ADEQUATE, SURPLUS

  // Batch view modal
  const [selectedMedBatches, setSelectedMedBatches] = useState(null);
  const [batchLoading, setBatchLoading] = useState(false);

  useEffect(() => {
    loadInventory();
  }, [activePhcId]);

  const loadInventory = async () => {
    setLoading(true);
    try {
      const [stockRes, medRes] = await Promise.all([
        api.getStock(activePhcId),
        api.getMedicines()
      ]);
      setStock(stockRes.stock || []);
      setCategories(medRes.categories || []);
    } catch (err) {
      console.error('Failed to load stock inventory:', err);
    } finally {
      setLoading(false);
    }
  };

  const openBatchesModal = async (med) => {
    setBatchLoading(true);
    setSelectedMedBatches({ medicine: med, batches: [] });
    try {
      const data = await api.getBatches(activePhcId, med.medicine_id);
      setSelectedMedBatches({ medicine: med, batches: data.batches || [] });
    } catch (e) {
      console.error(e);
    } finally {
      setBatchLoading(false);
    }
  };

  // Filtered medicines
  const filteredStock = stock.filter((item) => {
    const matchesSearch = item.medicine_name.toLowerCase().includes(search.toLowerCase()) ||
                          item.code.toLowerCase().includes(search.toLowerCase()) ||
                          item.category.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = !selectedCategory || item.category === selectedCategory;
    const matchesCritical = !filterCritical || item.critical;
    const matchesColdChain = !filterColdChain || item.cold_chain;

    let matchesStatus = true;
    if (filterStatus === 'OUT') matchesStatus = item.current_stock === 0;
    else if (filterStatus === 'CRITICAL') matchesStatus = item.status === 'critical' || item.status === 'out_of_stock';
    else if (filterStatus === 'LOW') matchesStatus = item.status === 'low';
    else if (filterStatus === 'SURPLUS') matchesStatus = item.status === 'surplus';

    return matchesSearch && matchesCategory && matchesCritical && matchesColdChain && matchesStatus;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Medicine Stock & Days-of-Stock Tracking</h1>
          <p className="text-xs text-slate-500 mt-1">
            Real-time monitoring across all 30 formulary medicines at <span className="font-bold text-slate-700">{currentUser.phc_name || 'PHC Alapakkam'}</span>
          </p>
        </div>

        <button
          onClick={() => window.open(`/api/reports/export-stock-csv?phc_id=${activePhcId}`, '_blank')}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors cursor-pointer"
        >
          <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
          Export Stock CSV
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row items-center gap-3">
          {/* Search Box */}
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
            <input
              type="text"
              placeholder="Search by medicine name, generic code, or category..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50/50"
            />
          </div>

          {/* Category Dropdown */}
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="w-full md:w-56 py-2 px-3 text-xs rounded-xl border border-slate-200 bg-slate-50/50 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-700"
          >
            <option value="">All Categories</option>
            {categories.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        {/* Quick Filter Pills */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 text-xs">
          <span className="text-slate-400 text-[11px] font-medium mr-1 flex items-center gap-1">
            <Filter className="w-3 h-3" /> Quick Filter:
          </span>

          <button
            onClick={() => setFilterStatus('ALL')}
            className={`px-2.5 py-1 rounded-lg font-medium transition-all cursor-pointer ${
              filterStatus === 'ALL' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            All ({stock.length})
          </button>

          <button
            onClick={() => setFilterStatus('CRITICAL')}
            className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
              filterStatus === 'CRITICAL' ? 'bg-rose-600 text-white' : 'bg-rose-50 text-rose-700 hover:bg-rose-100'
            }`}
          >
            Critical & Stockouts (&lt;15d)
          </button>

          <button
            onClick={() => setFilterStatus('LOW')}
            className={`px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
              filterStatus === 'LOW' ? 'bg-amber-600 text-white' : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
            }`}
          >
            Low Stock (15-30d)
          </button>

          <button
            onClick={() => setFilterStatus('SURPLUS')}
            className={`px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
              filterStatus === 'SURPLUS' ? 'bg-purple-600 text-white' : 'bg-purple-50 text-purple-700 hover:bg-purple-100'
            }`}
          >
            Surplus Available (&gt;60d)
          </button>

          <button
            onClick={() => setFilterCritical(!filterCritical)}
            className={`px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
              filterCritical ? 'bg-red-700 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Critical Flag Only ⭐
          </button>

          <button
            onClick={() => setFilterColdChain(!filterColdChain)}
            className={`px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
              filterColdChain ? 'bg-sky-700 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Cold-Chain Only ❄️
          </button>
        </div>
      </div>

      {/* Stock Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-400 text-xs">Loading inventory telemetry...</div>
        ) : filteredStock.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-xs">No medicines match current filter criteria.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
                  <th className="py-3 px-4">Medicine Details</th>
                  <th className="py-3 px-4">Category / Form</th>
                  <th className="py-3 px-4 text-right">Current Stock</th>
                  <th className="py-3 px-4 text-right">Daily Consumption</th>
                  <th className="py-3 px-4 text-center">Days-of-Stock Status</th>
                  <th className="py-3 px-4 text-center">Trend Velocity</th>
                  <th className="py-3 px-4 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredStock.map((item) => (
                  <tr key={item.medicine_id} className="hover:bg-slate-50/70 transition-colors">
                    {/* Medicine Name & Code */}
                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-800 text-xs">{item.medicine_name}</div>
                      <div className="text-[11px] text-slate-400 font-mono mt-0.5 flex items-center gap-2">
                        <span>{item.code}</span>
                        {item.critical && (
                          <span className="bg-red-50 text-red-600 font-bold px-1 rounded text-[10px]">Critical</span>
                        )}
                        {item.cold_chain && (
                          <span className="bg-sky-50 text-sky-600 font-bold px-1 rounded text-[10px] flex items-center gap-0.5">
                            <Thermometer className="w-2.5 h-2.5" /> Cold Chain
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Category & Form */}
                    <td className="py-3 px-4 text-slate-600">
                      <div>{item.category}</div>
                      <div className="text-[11px] text-slate-400">{item.form} • {item.strength}</div>
                    </td>

                    {/* Current Stock */}
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => openBatchesModal(item)}
                        className="text-right group cursor-pointer"
                        title="Click to view batches & expiry dates"
                      >
                        <div className={`font-black text-sm ${
                          item.current_stock === 0 ? 'text-rose-600' : 'text-slate-800'
                        }`}>
                          {item.current_stock.toLocaleString()} <span className="text-[11px] font-normal text-slate-400">{item.unit}</span>
                        </div>
                        <div className="text-[10px] text-emerald-600 group-hover:underline flex items-center justify-end gap-1">
                          <Layers className="w-2.5 h-2.5" /> batches
                        </div>
                      </button>
                    </td>

                    {/* Daily Consumption Rate */}
                    <td className="py-3 px-4 text-right">
                      <div className="font-semibold text-slate-700">{item.effective_daily_rate} {item.unit}/day</div>
                      <div className="text-[10px] text-slate-400">7d: {item.avg_daily_7} | 30d: {item.avg_daily_30}</div>
                    </td>

                    {/* Days Left Status Badge */}
                    <td className="py-3 px-4 text-center">
                      {item.current_stock === 0 ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-rose-100 text-rose-800 border border-rose-300">
                          <AlertTriangle className="w-3 h-3 text-rose-600" /> Out of Stock (0d)
                        </span>
                      ) : item.days_left < item.min_threshold ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-red-100 text-red-800 border border-red-300">
                          <AlertTriangle className="w-3 h-3 text-red-600" /> Critical ({item.days_left}d)
                        </span>
                      ) : item.days_left <= 30 ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-800 border border-amber-300">
                          <Clock className="w-3 h-3 text-amber-600" /> Low ({item.days_left}d)
                        </span>
                      ) : item.days_left > 60 ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-purple-100 text-purple-800 border border-purple-300">
                          <Share2 className="w-3 h-3 text-purple-600" /> Surplus ({item.days_left}d)
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Adequate ({item.days_left}d)
                        </span>
                      )}
                    </td>

                    {/* Trend Velocity */}
                    <td className="py-3 px-4 text-center">
                      {item.trend === 'increasing' ? (
                        <span className="inline-flex items-center gap-0.5 text-rose-600 font-bold text-[11px]">
                          <TrendingUp className="w-3.5 h-3.5" /> High Demand
                        </span>
                      ) : item.trend === 'decreasing' ? (
                        <span className="inline-flex items-center gap-0.5 text-emerald-600 font-medium text-[11px]">
                          <TrendingDown className="w-3.5 h-3.5" /> Slowing
                        </span>
                      ) : (
                        <span className="text-slate-400 text-[11px]">Stable</span>
                      )}
                    </td>

                    {/* Action: Nearby Finder Button */}
                    <td className="py-3 px-4 text-center">
                      <button
                        onClick={() => navigate(`/nearby?medicine_id=${item.medicine_id}&from_source_id=${activePhcId}`)}
                        className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold shadow-xs transition-all cursor-pointer ${
                          item.current_stock === 0 || item.days_left < item.min_threshold
                            ? 'bg-rose-600 hover:bg-rose-700 text-white ring-2 ring-rose-200'
                            : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                        }`}
                        title="Search nearby PHCs in block/district for surplus stock"
                      >
                        <MapPin className="w-3 h-3" />
                        Find Nearby
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Batch Breakdown Modal */}
      {selectedMedBatches && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="font-bold text-sm text-slate-900">{selectedMedBatches.medicine.medicine_name}</h3>
                <p className="text-xs text-slate-400">Batch Breakdown & Expiry Calendar</p>
              </div>
              <button onClick={() => setSelectedMedBatches(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-4 space-y-3">
              {batchLoading ? (
                <p className="text-xs text-slate-400 text-center py-4">Fetching batch details...</p>
              ) : selectedMedBatches.batches.length === 0 ? (
                <div className="p-4 rounded-xl bg-rose-50 text-rose-700 text-xs text-center font-medium">
                  Zero active batches recorded for this medicine at current PHC. Stock depletion confirmed.
                </div>
              ) : (
                selectedMedBatches.batches.map((b) => (
                  <div key={b.id} className="p-3 rounded-xl border border-slate-200 bg-slate-50/50 text-xs flex items-center justify-between">
                    <div>
                      <div className="font-bold text-slate-800">Batch: {b.batch_number}</div>
                      <div className="text-[11px] text-slate-500 mt-0.5">Source: {b.supplier_source}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-black text-slate-900 text-sm">{b.quantity} {b.unit}</div>
                      <div className="text-[11px] text-slate-500 flex items-center gap-1 justify-end">
                        <Calendar className="w-3 h-3 text-slate-400" />
                        Expires: <strong className={new Date(b.expiry_date) < new Date(Date.now() + 3600000*24*90) ? 'text-amber-600' : 'text-slate-700'}>{b.expiry_date}</strong>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="mt-5 pt-3 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setSelectedMedBatches(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
