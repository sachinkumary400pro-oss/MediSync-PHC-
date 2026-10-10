import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { 
  PlusCircle, 
  Save, 
  Mic, 
  Camera, 
  CheckCircle2, 
  AlertTriangle, 
  Wifi, 
  WifiOff, 
  RefreshCw, 
  FileText,
  Calendar,
  Layers,
  Sparkles
} from 'lucide-react';

export default function StockEntryPage() {
  const { currentUser, t, isOnline, offlineQueue, queueOfflineEntry, clearOfflineQueue } = useAuth();
  const activePhcId = currentUser.phc_id || 'phc_cpt_01';

  const [medicines, setMedicines] = useState([]);
  const [selectedMedId, setSelectedMedId] = useState('med_01');
  const [entryDate, setEntryDate] = useState(new Date().toISOString().split('T')[0]);
  
  // Stock entry fields
  const [openingStock, setOpeningStock] = useState(0);
  const [receivedQty, setReceivedQty] = useState(0);
  const [issuedQty, setIssuedQty] = useState(0);
  const [closingStock, setClosingStock] = useState(0);
  const [batchNumber, setBatchNumber] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [remarks, setRemarks] = useState('Routine OPD dispensing');

  const [loading, setLoading] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(null);
  const [voiceListening, setVoiceListening] = useState(false);
  const [ocrScanning, setOcrScanning] = useState(false);

  useEffect(() => {
    loadMedicines();
  }, []);

  useEffect(() => {
    if (selectedMedId) {
      loadMedicineStockStatus(selectedMedId);
    }
  }, [selectedMedId, activePhcId]);

  // Auto-calculate closing stock: Closing = Opening + Received - Issued
  useEffect(() => {
    const calc = Math.max(0, (parseInt(openingStock) || 0) + (parseInt(receivedQty) || 0) - (parseInt(issuedQty) || 0));
    setClosingStock(calc);
  }, [openingStock, receivedQty, issuedQty]);

  const loadMedicines = async () => {
    try {
      const data = await api.getMedicines();
      setMedicines(data.medicines || []);
    } catch (e) {
      console.error(e);
    }
  };

  const loadMedicineStockStatus = async (medId) => {
    try {
      const data = await api.getStock(activePhcId);
      const matched = data.stock?.find(s => s.medicine_id === medId);
      if (matched) {
        setOpeningStock(matched.current_stock);
        setIssuedQty(0);
        setReceivedQty(0);
      }
      const bData = await api.getBatches(activePhcId, medId);
      if (bData.batches && bData.batches.length > 0) {
        const topBatch = bData.batches[0];
        setBatchNumber(topBatch.batch_number);
        setExpiryDate(topBatch.expiry_date);
      } else {
        setBatchNumber(`TN26-${Math.floor(1000 + Math.random() * 9000)}`);
        const nextYear = new Date();
        nextYear.setFullYear(nextYear.getFullYear() + 2);
        setExpiryDate(nextYear.toISOString().split('T')[0]);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleSaveStock = async (e) => {
    e.preventDefault();
    setLoading(true);

    const payload = {
      phc_id: activePhcId,
      medicine_id: selectedMedId,
      entry_date: entryDate,
      opening_stock: parseInt(openingStock) || 0,
      received_qty: parseInt(receivedQty) || 0,
      issued_qty: parseInt(issuedQty) || 0,
      closing_stock: parseInt(closingStock) || 0,
      batch_number: batchNumber,
      expiry_date: expiryDate,
      remarks
    };

    if (!isOnline) {
      // Queue offline
      queueOfflineEntry(payload);
      setSaveSuccess({ offline: true, message: 'Saved to local offline queue. Will sync when network reconnects.' });
      setLoading(false);
      return;
    }

    try {
      const result = await api.postStockEntry(payload);
      setSaveSuccess({ offline: false, result });
      loadMedicineStockStatus(selectedMedId);
      setTimeout(() => setSaveSuccess(null), 3500);
    } catch (err) {
      alert('Error saving stock entry: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Voice Entry Simulation (Tamil / English)
  const handleVoiceSimulation = (langType) => {
    setVoiceListening(true);
    setTimeout(() => {
      setVoiceListening(false);
      if (langType === 'ta') {
        // "பாராசிட்டமால் 25 வழங்கப்பட்டது" (25 Paracetamol dispensed)
        setIssuedQty(25);
        setRemarks('Voice entry (Tamil): பாராசிட்டமால் 25 சிரப் வழங்கப்பட்டது');
      } else {
        setIssuedQty(30);
        setRemarks('Voice entry (English): Dispensed 30 units during pediatric OP clinic');
      }
    }, 1200);
  };

  // OCR Physical Register Photo Upload Simulation
  const handleOcrSimulation = () => {
    setOcrScanning(true);
    setTimeout(() => {
      setOcrScanning(false);
      setOpeningStock(openingStock > 0 ? openingStock : 100);
      setReceivedQty(50);
      setIssuedQty(18);
      setRemarks('Scanned from physical stock register Page #42 via OCR');
    }, 1500);
  };

  // Sync Offline Entries
  const handleSyncOffline = async () => {
    if (offlineQueue.length === 0) return;
    setLoading(true);
    try {
      for (const item of offlineQueue) {
        await api.postStockEntry(item);
      }
      clearOfflineQueue();
      alert('All offline stock entries synced successfully with the district database!');
    } catch (e) {
      alert('Sync error: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  const selectedMed = medicines.find(m => m.id === selectedMedId);

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Daily Stock Entry & Dispensing Log</h1>
          <p className="text-xs text-slate-500 mt-1">
            Logging for <span className="font-bold text-slate-700">{currentUser.phc_name || 'PHC Alapakkam'}</span> • Mobile optimized
          </p>
        </div>

        {/* Offline Queue Badge */}
        {offlineQueue.length > 0 && (
          <button
            onClick={handleSyncOffline}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-900 font-bold text-xs shadow-md transition-all cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            Sync {offlineQueue.length} Offline Entries
          </button>
        )}
      </div>

      {/* Smart Assist Tools Bar: Voice Entry & Register Scan */}
      <div className="bg-gradient-to-r from-emerald-50 via-teal-50 to-slate-50 p-4 rounded-2xl border border-emerald-200/80 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-emerald-600" />
          <span className="text-xs font-bold text-slate-800">Smart Data Capture:</span>
          <span className="text-xs text-slate-500 hidden sm:inline">Hands-free voice or physical register scan</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => handleVoiceSimulation('en')}
            disabled={voiceListening}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-semibold shadow-2xs transition-all cursor-pointer"
          >
            <Mic className={`w-3.5 h-3.5 ${voiceListening ? 'text-rose-500 animate-pulse' : 'text-slate-500'}`} />
            {voiceListening ? 'Listening...' : 'Voice (EN)'}
          </button>

          <button
            type="button"
            onClick={() => handleVoiceSimulation('ta')}
            disabled={voiceListening}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-semibold shadow-2xs transition-all cursor-pointer"
          >
            <Mic className={`w-3.5 h-3.5 ${voiceListening ? 'text-rose-500 animate-pulse' : 'text-emerald-600'}`} />
            குரல் பதிவு (தமிழ்)
          </button>

          <button
            type="button"
            onClick={handleOcrSimulation}
            disabled={ocrScanning}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-semibold shadow-2xs transition-all cursor-pointer"
          >
            <Camera className={`w-3.5 h-3.5 ${ocrScanning ? 'text-emerald-600 animate-spin' : 'text-slate-500'}`} />
            {ocrScanning ? 'OCR Scanning...' : 'Scan Register Photo'}
          </button>
        </div>
      </div>

      {/* Main Stock Entry Card */}
      <form onSubmit={handleSaveStock} className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-6">
        {/* Medicine Selector & Date */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Select Formulary Medicine
            </label>
            <select
              value={selectedMedId}
              onChange={(e) => setSelectedMedId(e.target.value)}
              className="w-full p-2.5 text-xs rounded-xl border border-slate-200 bg-slate-50/50 font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              {medicines.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} ({m.form} - {m.strength}) {m.critical ? '⭐ [Critical]' : ''} {m.cold_chain ? '❄️ [Cold-Chain]' : ''}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Entry Date
            </label>
            <input
              type="date"
              value={entryDate}
              onChange={(e) => setEntryDate(e.target.value)}
              className="w-full p-2.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-semibold"
            />
          </div>
        </div>

        {/* Big Numbers Grid: Opening, Received, Issued, Closing */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-100">
          {/* Opening Stock */}
          <div className="space-y-1">
            <span className="text-[11px] font-bold text-slate-500 uppercase">Opening Stock</span>
            <input
              type="number"
              min="0"
              value={openingStock}
              onChange={(e) => setOpeningStock(e.target.value)}
              className="w-full p-2 text-base font-black text-slate-800 rounded-xl border border-slate-200 bg-white"
            />
            <span className="text-[10px] text-slate-400">{selectedMed?.unit || 'units'}</span>
          </div>

          {/* Received */}
          <div className="space-y-1">
            <span className="text-[11px] font-bold text-emerald-700 uppercase">+ Received</span>
            <input
              type="number"
              min="0"
              value={receivedQty}
              onChange={(e) => setReceivedQty(e.target.value)}
              className="w-full p-2 text-base font-black text-emerald-700 rounded-xl border border-emerald-200 bg-white"
            />
            <span className="text-[10px] text-slate-400">from warehouse/transfer</span>
          </div>

          {/* Issued / Dispensed */}
          <div className="space-y-1">
            <span className="text-[11px] font-bold text-rose-700 uppercase">- Dispensed (OPD)</span>
            <input
              type="number"
              min="0"
              value={issuedQty}
              onChange={(e) => setIssuedQty(e.target.value)}
              className="w-full p-2 text-base font-black text-rose-700 rounded-xl border border-rose-200 bg-white"
            />
            <span className="text-[10px] text-slate-400">to patients</span>
          </div>

          {/* Calculated Closing Stock */}
          <div className="space-y-1 bg-white p-2 rounded-xl border border-slate-200 shadow-2xs">
            <span className="text-[11px] font-black text-slate-900 uppercase">= Closing Stock</span>
            <div className={`text-xl font-black ${closingStock === 0 ? 'text-rose-600' : 'text-slate-900'}`}>
              {closingStock.toLocaleString()}
            </div>
            <span className="text-[10px] text-slate-400">{selectedMed?.unit || 'units'} left</span>
          </div>
        </div>

        {/* Batch Number & Expiry Date */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Batch Number
            </label>
            <input
              type="text"
              value={batchNumber}
              onChange={(e) => setBatchNumber(e.target.value)}
              placeholder="e.g. TN26-1042"
              className="w-full p-2.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Batch Expiry Date
            </label>
            <input
              type="date"
              value={expiryDate}
              onChange={(e) => setExpiryDate(e.target.value)}
              className="w-full p-2.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
        </div>

        {/* Remarks */}
        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
            Clinical / Register Remarks
          </label>
          <input
            type="text"
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            placeholder="e.g. Regular daily OP dispensing, higher fever footfall"
            className="w-full p-2.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        {/* Success Alert */}
        {saveSuccess && (
          <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-300 flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <div className="text-xs text-emerald-900">
              <strong>Stock entry saved successfully!</strong>
              {saveSuccess.result?.generated_alert && (
                <span className="block mt-0.5 text-rose-700 font-bold">
                  ⚠️ Alert triggered: {saveSuccess.result.generated_alert}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Submit Button */}
        <div className="pt-2 flex justify-end">
          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-md transition-all cursor-pointer disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {loading ? 'Saving...' : 'Save Stock Record'}
          </button>
        </div>
      </form>
    </div>
  );
}
