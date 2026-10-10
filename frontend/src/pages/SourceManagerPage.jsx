import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import {
  Package,
  Plus,
  Upload,
  RefreshCw,
  AlertTriangle,
  Clock,
  CheckCircle2,
  FileSpreadsheet,
  Save,
  Search,
  Filter,
  ShieldCheck,
  Building2,
  Calendar,
  DollarSign
} from 'lucide-react';

export default function SourceManagerPage() {
  const { currentUser, t } = useAuth();
  const sourceId = currentUser.source_id || currentUser.phc_id || 'src_pharm_01';

  const [stockData, setStockData] = useState(null);
  const [medicines, setMedicines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [feedback, setFeedback] = useState(null);

  // New Item / Edit modal state
  const [editItem, setEditItem] = useState(null);
  const [savingItem, setSavingItem] = useState(false);

  // CSV Upload state
  const [csvFile, setCsvFile] = useState(null);
  const [uploadingCsv, setUploadingCsv] = useState(false);
  const [csvResult, setCsvResult] = useState(null);

  useEffect(() => {
    loadSourceData();
    loadMedicines();
  }, [sourceId]);

  const loadSourceData = async () => {
    setLoading(true);
    try {
      const data = await api.getSourceStockList(sourceId, 'page_size=100');
      setStockData(data);
    } catch (e) {
      console.error('Failed to load source stock:', e);
    } finally {
      setLoading(false);
    }
  };

  const loadMedicines = async () => {
    try {
      const data = await api.getMedicines();
      if (data && data.medicines) {
        setMedicines(data.medicines);
      }
    } catch (e) {
      console.error('Failed to load medicines:', e);
    }
  };

  // Quick save single stock item
  const handleSaveStockItem = async (e) => {
    e.preventDefault();
    if (!editItem) return;
    setSavingItem(true);
    setFeedback(null);

    try {
      const payload = {
        medicine_id: editItem.medicine_id,
        quantity: Number(editItem.quantity || 0),
        price_per_unit: Number(editItem.price_per_unit || 0),
        batch_no: editItem.batch_no || '',
        expiry_date: editItem.expiry_date || '',
      };

      await api.updateSourceStock(sourceId, payload);
      setFeedback({ type: 'success', message: 'Stock updated successfully!' });
      setEditItem(null);
      await loadSourceData();
    } catch (err) {
      setFeedback({ type: 'error', message: err.message || 'Failed to update stock' });
    } finally {
      setSavingItem(false);
    }
  };

  // CSV Upload handler
  const handleUploadCsv = async () => {
    if (!csvFile) return;
    setUploadingCsv(true);
    setCsvResult(null);

    try {
      const res = await api.uploadCsvSourceStock(sourceId, csvFile);
      setCsvResult({ success: true, message: `Successfully updated ${res.rows_processed} items from ${res.filename}` });
      setCsvFile(null);
      await loadSourceData();
    } catch (err) {
      setCsvResult({ success: false, message: err.message || 'CSV upload failed' });
    } finally {
      setUploadingCsv(false);
    }
  };

  // CSV Sample Template download
  const downloadCsvTemplate = () => {
    const csvContent = "data:text/csv;charset=utf-8,medicine_id,quantity,price,batch_no,expiry_date\nmed_01,100,45.0,APL-101,2027-12-31\nmed_03,250,24.0,APL-102,2027-08-31\nmed_04,80,75.0,APL-103,2026-11-30\n";
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `stock_template_${sourceId}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Compute stock health metrics
  const stats = React.useMemo(() => {
    if (!stockData || !stockData.items) return { total: 0, inStock: 0, lowStock: 0, nearExpiry: 0, stale: 0 };
    const items = stockData.items;
    return {
      total: items.length,
      inStock: items.filter((i) => i.quantity > 0).length,
      lowStock: items.filter((i) => i.quantity > 0 && i.quantity < 20).length,
      nearExpiry: items.filter((i) => i.is_near_expiry).length,
      stale: items.filter((i) => i.is_stale).length,
    };
  }, [stockData]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 font-sans">
      {/* 1. Header Banner */}
      <div className="bg-slate-900 rounded-2xl p-6 text-white shadow-xl mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-teal-500/20 text-teal-300 font-bold border border-teal-500/30">
              Facility Stock Manager Portal
            </span>
            <span className="text-xs text-slate-400">Scoped to {sourceId}</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            {stockData?.source.name || 'Facility Stock Portal'}
          </h1>
          <p className="text-xs text-slate-300 mt-1">
            Maintain real-time inventory for nearby public discovery, transfer requests, and out-of-stock mitigation.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setEditItem({
                medicine_id: medicines[0]?.id || 'med_01',
                quantity: 100,
                price_per_unit: 45.0,
                batch_no: 'BAT-2026-01',
                expiry_date: '2027-12-31',
              });
            }}
            className="px-4 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>Add / Edit Item</span>
          </button>
          <button
            onClick={loadSourceData}
            className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {feedback && (
        <div
          className={`p-4 rounded-xl mb-6 text-xs flex items-center justify-between ${
            feedback.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'
          }`}
        >
          <span>{feedback.message}</span>
          <button onClick={() => setFeedback(null)} className="font-bold ml-2">✕</button>
        </div>
      )}

      {/* 2. KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="text-[11px] font-bold text-slate-500 uppercase">Formulary Items</div>
          <div className="text-2xl font-extrabold text-slate-900 mt-1">{stats.total}</div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="text-[11px] font-bold text-emerald-600 uppercase">In Stock</div>
          <div className="text-2xl font-extrabold text-emerald-700 mt-1">{stats.inStock}</div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="text-[11px] font-bold text-amber-600 uppercase">Low Stock (&lt;20)</div>
          <div className="text-2xl font-extrabold text-amber-700 mt-1">{stats.lowStock}</div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="text-[11px] font-bold text-rose-600 uppercase">Near Expiry (&lt;30d)</div>
          <div className="text-2xl font-extrabold text-rose-700 mt-1">{stats.nearExpiry}</div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="text-[11px] font-bold text-slate-400 uppercase">Stale (&gt;24h)</div>
          <div className="text-2xl font-extrabold text-slate-600 mt-1">{stats.stale}</div>
        </div>
      </div>

      {/* 3. CSV Bulk Upload Box */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
              <FileSpreadsheet className="w-4 h-4 text-teal-600" />
              <span>Bulk Stock Ingestion via CSV</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Upload stock exports from your pharmacy POS or warehouse ERP. Idempotent matching by medicine code.
            </p>
          </div>
          <button
            onClick={downloadCsvTemplate}
            className="text-xs text-teal-600 hover:text-teal-800 font-semibold underline self-start"
          >
            Download Sample CSV Template
          </button>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-3">
          <input
            type="file"
            accept=".csv"
            onChange={(e) => setCsvFile(e.target.files[0])}
            className="text-xs text-slate-600 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-teal-50 file:text-teal-700 hover:file:bg-teal-100 cursor-pointer w-full sm:w-auto"
          />
          <button
            onClick={handleUploadCsv}
            disabled={!csvFile || uploadingCsv}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors shrink-0"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>{uploadingCsv ? 'Ingesting...' : 'Upload & Sync'}</span>
          </button>
        </div>

        {csvResult && (
          <div className={`mt-3 p-3 rounded-xl text-xs ${csvResult.success ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'}`}>
            {csvResult.message}
          </div>
        )}
      </div>

      {/* 4. Stock Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-sm">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search current stock items..."
              className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-1 focus:ring-teal-500"
            />
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
          </div>
          <div className="text-xs text-slate-500">
            Showing {stockData?.items?.length || 0} items
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-100 text-slate-500 uppercase tracking-wider font-bold">
              <tr>
                <th className="py-3 px-4">Medicine Name</th>
                <th className="py-3 px-3">Form & Strength</th>
                <th className="py-3 px-3">Current Quantity</th>
                <th className="py-3 px-3">Unit Price (₹)</th>
                <th className="py-3 px-3">Batch & Expiry</th>
                <th className="py-3 px-3">Last Updated</th>
                <th className="py-3 px-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    Loading facility inventory...
                  </td>
                </tr>
              ) : stockData?.items?.filter((it) => {
                  if (!searchTerm.trim()) return true;
                  const q = searchTerm.toLowerCase();
                  return it.medicine_name.toLowerCase().includes(q) || it.generic_name.toLowerCase().includes(q);
                }).map((item) => (
                <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-3 px-4 font-bold text-slate-900">
                    <div>{item.medicine_name}</div>
                    <div className="text-[11px] text-slate-400 font-normal">{item.generic_name}</div>
                  </td>
                  <td className="py-3 px-3 text-slate-600">
                    {item.strength} ({item.form})
                  </td>
                  <td className="py-3 px-3 font-extrabold text-slate-800">
                    <span className={item.quantity === 0 ? 'text-rose-600' : item.quantity < 20 ? 'text-amber-600' : 'text-slate-800'}>
                      {item.quantity} units
                    </span>
                  </td>
                  <td className="py-3 px-3 text-slate-700 font-semibold">
                    {item.is_free ? <span className="text-emerald-700">₹0 (Free)</span> : `₹${item.price_per_unit?.toFixed(2)}`}
                  </td>
                  <td className="py-3 px-3 text-slate-600">
                    <div>{item.batch_no || 'N/A'}</div>
                    <div className={`text-[11px] ${item.is_near_expiry ? 'text-rose-600 font-bold' : 'text-slate-400'}`}>
                      {item.expiry_date || 'Standard'}
                    </div>
                  </td>
                  <td className="py-3 px-3 text-slate-500 text-[11px]">
                    {item.is_stale ? (
                      <span className="text-amber-600 font-semibold flex items-center gap-1">
                        <Clock className="w-3 h-3" /> Stale (&gt;24h)
                      </span>
                    ) : (
                      <span className="text-emerald-600 font-medium">Fresh</span>
                    )}
                  </td>
                  <td className="py-3 px-3 text-right">
                    <button
                      onClick={() => {
                        setEditItem({
                          medicine_id: item.medicine_id,
                          medicine_name: item.medicine_name,
                          quantity: item.quantity,
                          price_per_unit: item.price_per_unit,
                          batch_no: item.batch_no,
                          expiry_date: item.expiry_date,
                        });
                      }}
                      className="px-2.5 py-1 rounded-lg bg-teal-50 hover:bg-teal-100 text-teal-700 font-bold text-xs transition-colors"
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Item Modal */}
      {editItem && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <h3 className="text-base font-bold text-slate-900 mb-1">
              Update Stock Entry
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Enter updated counts, batch number, and shelf life for this formulary item.
            </p>

            <form onSubmit={handleSaveStockItem} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-700 font-bold mb-1">Medicine</label>
                <select
                  value={editItem.medicine_id}
                  onChange={(e) => setEditItem({ ...editItem, medicine_id: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold"
                >
                  {medicines.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({m.strength})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Quantity</label>
                  <input
                    type="number"
                    min="0"
                    value={editItem.quantity}
                    onChange={(e) => setEditItem({ ...editItem, quantity: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold"
                    required
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Unit Price (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={editItem.price_per_unit}
                    onChange={(e) => setEditItem({ ...editItem, price_per_unit: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Batch Number</label>
                  <input
                    type="text"
                    value={editItem.batch_no || ''}
                    onChange={(e) => setEditItem({ ...editItem, batch_no: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Expiry Date</label>
                  <input
                    type="date"
                    value={editItem.expiry_date || ''}
                    onChange={(e) => setEditItem({ ...editItem, expiry_date: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                  />
                </div>
              </div>

              <div className="pt-3 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditItem(null)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingItem}
                  className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{savingItem ? 'Saving...' : 'Save Stock'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
