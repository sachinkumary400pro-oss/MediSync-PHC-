import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { 
  ArrowLeftRight, 
  CheckCircle2, 
  Clock, 
  Truck, 
  Printer, 
  FileText, 
  AlertTriangle, 
  Sparkles, 
  PlusCircle, 
  Send, 
  Check, 
  X,
  Thermometer,
  Building2,
  Calendar
} from 'lucide-react';

export default function TransfersPage() {
  const { currentUser, t } = useAuth();
  const [searchParams] = useSearchParams();
  const openParamId = searchParams.get('open');
  const activePhcId = currentUser.phc_id || 'phc_cpt_01';

  const [activeTab, setActiveTab] = useState('transfers'); // 'transfers' or 'indents'
  const [transfers, setTransfers] = useState([]);
  const [indents, setIndents] = useState([]);
  const [loading, setLoading] = useState(true);

  // Transfer Slip Printable Modal
  const [viewingSlip, setViewingSlip] = useState(null);
  const [slipLoading, setSlipLoading] = useState(false);

  // New Emergency Indent Form
  const [showIndentModal, setShowIndentModal] = useState(false);
  const [autoDrafting, setAutoDrafting] = useState(false);
  const [indentReason, setIndentReason] = useState('Critical stockout outside regular monthly cycle');
  const [indentItemCount, setIndentItemCount] = useState(2);

  useEffect(() => {
    loadData();
    if (openParamId) {
      loadTransferSlip(openParamId);
    }
  }, [openParamId, activePhcId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [trRes, indRes] = await Promise.all([
        api.getTransfers(`phc_id=${activePhcId}`),
        api.getIndents(`phc_id=${activePhcId}`)
      ]);
      setTransfers(trRes.transfers || []);
      setIndents(indRes.indents || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const loadTransferSlip = async (id) => {
    setSlipLoading(true);
    try {
      const data = await api.getTransferSlip(id);
      setViewingSlip(data.transfer);
    } catch (e) {
      console.error(e);
    } finally {
      setSlipLoading(false);
    }
  };

  const handleUpdateStatus = async (transferId, nextStatus) => {
    try {
      await api.patchTransferStatus(transferId, nextStatus);
      loadData();
      if (viewingSlip && viewingSlip.id === transferId) {
        loadTransferSlip(transferId);
      }
    } catch (e) {
      alert('Error updating status: ' + e.message);
    }
  };

  const handleAutoDraftIndent = async () => {
    setAutoDrafting(true);
    try {
      const res = await api.postAutoDraftIndent(activePhcId);
      if (res.drafted) {
        alert(`AI Engine successfully drafted Emergency Indent ${res.drafted.indent_number} for ${res.drafted.items.length} critical shortages!`);
        loadData();
      } else {
        alert(res.message || 'No critical shortages detected.');
      }
    } catch (e) {
      alert('Error auto-drafting indent: ' + e.message);
    } finally {
      setAutoDrafting(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <ArrowLeftRight className="w-6 h-6 text-emerald-600" />
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Inter-PHC Transfers & Emergency Indents</h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Redistribution approval workflow • {currentUser.phc_name || 'PHC Alapakkam'}
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleAutoDraftIndent}
            disabled={autoDrafting}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white font-bold text-xs shadow-md cursor-pointer disabled:opacity-50"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            {autoDrafting ? 'Drafting...' : 'AI Auto-Draft Emergency Indent'}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200">
        <button
          onClick={() => setActiveTab('transfers')}
          className={`pb-3 px-4 text-xs font-bold transition-all cursor-pointer border-b-2 flex items-center gap-2 ${
            activeTab === 'transfers'
              ? 'border-emerald-600 text-emerald-700'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <ArrowLeftRight className="w-4 h-4" />
          Inter-PHC Transfers ({transfers.length})
        </button>

        <button
          onClick={() => setActiveTab('indents')}
          className={`pb-3 px-4 text-xs font-bold transition-all cursor-pointer border-b-2 flex items-center gap-2 ${
            activeTab === 'indents'
              ? 'border-emerald-600 text-emerald-700'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <FileText className="w-4 h-4" />
          Warehouse Emergency Indents ({indents.length})
        </button>
      </div>

      {/* TRANSFERS TAB */}
      {activeTab === 'transfers' && (
        <div className="space-y-4">
          {loading ? (
            <div className="p-12 text-center text-xs text-slate-400">Loading transfers...</div>
          ) : transfers.length === 0 ? (
            <div className="p-12 bg-white rounded-2xl border border-slate-200 text-center text-xs text-slate-400">
              No inter-PHC transfers found for this centre. Use the "Nearby Stock Finder" to initiate one.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {transfers.map((t) => {
                const isDonor = t.from_phc_id === activePhcId;
                const isReceiver = t.to_phc_id === activePhcId;

                return (
                  <div key={t.id} className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-4">
                    <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-slate-900">{t.request_number}</span>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                            t.status === 'completed'
                              ? 'bg-emerald-100 text-emerald-800'
                              : t.status === 'approved'
                              ? 'bg-blue-100 text-blue-800'
                              : t.status === 'in_transit'
                              ? 'bg-purple-100 text-purple-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}>
                            {t.status.replace('_', ' ')}
                          </span>
                        </div>
                        <span className="text-[11px] text-slate-400">
                          {new Date(t.created_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}
                        </span>
                      </div>

                      <button
                        onClick={() => loadTransferSlip(t.id)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold cursor-pointer"
                      >
                        <Printer className="w-3.5 h-3.5 text-emerald-600" />
                        Slip
                      </button>
                    </div>

                    {/* From / To Details */}
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                        <span className="text-[10px] font-bold text-slate-400 uppercase">Donor Centre</span>
                        <div className="font-bold text-slate-800 mt-0.5">{t.from_phc_name}</div>
                        <div className="text-[11px] text-slate-500 mt-0.5">{t.distance_km} km distance</div>
                      </div>

                      <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                        <span className="text-[10px] font-bold text-slate-400 uppercase">Receiving Centre</span>
                        <div className="font-bold text-slate-800 mt-0.5">{t.to_phc_name}</div>
                        <div className="text-[11px] text-slate-500 mt-0.5">{isReceiver ? '(Your PHC)' : ''}</div>
                      </div>
                    </div>

                    {/* Items List */}
                    <div className="space-y-1.5 pt-1">
                      <span className="text-[11px] font-bold text-slate-500 uppercase">Transfer Items:</span>
                      {t.items?.map((item) => (
                        <div key={item.id} className="p-2 rounded-lg bg-emerald-50/50 border border-emerald-100 text-xs flex items-center justify-between">
                          <span className="font-medium text-slate-800">{item.medicine_name}</span>
                          <span className="font-black text-emerald-800">
                            {item.approved_qty || item.requested_qty} {item.unit}
                          </span>
                        </div>
                      ))}
                    </div>

                    {/* Cold Chain Badge */}
                    {t.cold_chain_verified === 1 && (
                      <div className="text-[11px] bg-sky-50 text-sky-800 font-bold px-2 py-1 rounded-lg flex items-center gap-1 border border-sky-200">
                        <Thermometer className="w-3.5 h-3.5" />
                        Cold-Chain Verified (Carrier & Ice Packs Ready)
                      </div>
                    )}

                    {/* Status Workflow Action Buttons */}
                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                      <span className="text-[11px] text-slate-500">
                        By: {t.created_by?.split(',')[0]}
                      </span>

                      {/* Workflow state transitions */}
                      <div className="flex gap-2">
                        {t.status === 'requested' && (
                          <button
                            onClick={() => handleUpdateStatus(t.id, 'approved')}
                            className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold cursor-pointer"
                          >
                            Approve (MO)
                          </button>
                        )}

                        {t.status === 'approved' && (
                          <button
                            onClick={() => handleUpdateStatus(t.id, 'in_transit')}
                            className="px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold flex items-center gap-1 cursor-pointer"
                          >
                            <Truck className="w-3 h-3" />
                            Dispatch 108 / Van
                          </button>
                        )}

                        {t.status === 'in_transit' && (
                          <button
                            onClick={() => handleUpdateStatus(t.id, 'completed')}
                            className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1 cursor-pointer shadow-xs"
                          >
                            <Check className="w-3 h-3" />
                            Confirm Receipt & Add Stock
                          </button>
                        )}

                        {t.status === 'completed' && (
                          <span className="text-emerald-700 font-bold text-xs flex items-center gap-1">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Completed
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* INDENTS TAB */}
      {activeTab === 'indents' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {indents.map((ind) => (
              <div key={ind.id} className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-3">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-slate-900">{ind.indent_number}</span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-blue-100 text-blue-800">
                        {ind.status}
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-400">{ind.phc_name} • TNMSC Warehouse</span>
                  </div>

                  {ind.auto_drafted === 1 && (
                    <span className="text-[10px] font-bold bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full flex items-center gap-1">
                      <Sparkles className="w-3 h-3 text-amber-600" /> Auto-Drafted
                    </span>
                  )}
                </div>

                <p className="text-xs text-slate-600 bg-slate-50 p-2 rounded-lg border border-slate-100">
                  <strong>Justification:</strong> {ind.reason}
                </p>

                <div className="space-y-1">
                  <span className="text-[11px] font-bold text-slate-400 uppercase">Indent Items:</span>
                  {ind.items?.map((itm) => (
                    <div key={itm.id} className="p-2 rounded-lg bg-slate-50 border border-slate-100 text-xs flex items-center justify-between">
                      <span className="font-semibold text-slate-800">{itm.medicine_name}</span>
                      <span className="font-bold text-slate-900">{itm.requested_qty} {itm.unit}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* OFFICIAL PRINTABLE TRANSFER SLIP MODAL */}
      {viewingSlip && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-8 shadow-2xl border border-slate-200 relative my-8">
            <button
              onClick={() => setViewingSlip(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 no-print"
            >
              <X className="w-6 h-6" />
            </button>

            {/* Printable Slip Content */}
            <div id="transfer-slip-print" className="space-y-6">
              {/* Slip Header */}
              <div className="text-center pb-4 border-b-2 border-slate-900">
                <div className="text-xs font-bold tracking-widest uppercase text-slate-600">
                  Government of Tamil Nadu • Department of Public Health
                </div>
                <h2 className="text-xl font-black text-slate-950 mt-1 uppercase tracking-tight">
                  Inter-PHC Medicine Redistribution Delivery Slip
                </h2>
                <div className="text-xs font-bold text-emerald-800 mt-0.5">
                  Chengalpattu District Health Administration (MediSync Network)
                </div>
              </div>

              {/* Slip Meta */}
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <div>Transfer Voucher: <strong className="font-mono text-slate-900">{viewingSlip.request_number}</strong></div>
                  <div>Date of Issue: <strong>{new Date(viewingSlip.created_at).toLocaleDateString('en-IN')}</strong></div>
                  <div>Urgency: <strong className="uppercase text-rose-600">{viewingSlip.urgency}</strong></div>
                  <div>Transit Distance: <strong>{viewingSlip.distance_km} km</strong></div>
                </div>

                <div className="text-right">
                  <div>Status: <strong className="uppercase text-emerald-700">{viewingSlip.status}</strong></div>
                  <div>Cold-Chain Protocol: <strong>{viewingSlip.cold_chain_verified ? 'VERIFIED (2-8°C)' : 'Standard (Room Temp)'}</strong></div>
                  <div>Created By: <strong>{viewingSlip.created_by}</strong></div>
                </div>
              </div>

              {/* Centers info */}
              <div className="grid grid-cols-2 gap-4 text-xs p-3 bg-slate-50 border border-slate-200 rounded-xl">
                <div>
                  <div className="font-bold text-slate-500 uppercase text-[10px]">Source Dispatched From:</div>
                  <div className="font-black text-sm text-slate-900">{viewingSlip.from_phc_name}</div>
                  <div className="text-[11px] text-slate-600">MO: {viewingSlip.from_mo || 'Dr. In-Charge'}</div>
                  <div className="text-[11px] text-slate-500">Phone: {viewingSlip.from_phc_phone}</div>
                </div>

                <div>
                  <div className="font-bold text-slate-500 uppercase text-[10px]">Delivered & Received At:</div>
                  <div className="font-black text-sm text-slate-900">{viewingSlip.to_phc_name}</div>
                  <div className="text-[11px] text-slate-600">MO: {viewingSlip.to_mo || 'Dr. In-Charge'}</div>
                  <div className="text-[11px] text-slate-500">Phone: {viewingSlip.to_phc_phone}</div>
                </div>
              </div>

              {/* Medicines Table */}
              <div>
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-100 border-b border-slate-300 font-bold text-slate-700">
                      <th className="py-2 px-3">Item #</th>
                      <th className="py-2 px-3">Medicine Description</th>
                      <th className="py-2 px-3">Category</th>
                      <th className="py-2 px-3 text-right">Qty Dispatched</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {viewingSlip.items?.map((itm, idx) => (
                      <tr key={itm.id}>
                        <td className="py-2.5 px-3 font-mono">{idx + 1}</td>
                        <td className="py-2.5 px-3">
                          <strong className="text-slate-900">{itm.medicine_name}</strong>
                          <div className="text-[10px] text-slate-500">{itm.form} • {itm.strength}</div>
                        </td>
                        <td className="py-2.5 px-3">{itm.unit}</td>
                        <td className="py-2.5 px-3 text-right font-black text-slate-950 text-sm">
                          {itm.approved_qty || itm.requested_qty}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Signatures and Stamps */}
              <div className="pt-12 grid grid-cols-3 gap-4 text-center text-xs text-slate-700">
                <div className="border-t border-slate-300 pt-2">
                  <div className="font-bold">Dispatched By</div>
                  <div className="text-[10px] text-slate-400">Pharmacist Signature & Stamp</div>
                </div>
                <div className="border-t border-slate-300 pt-2">
                  <div className="font-bold">Transit Escort / Driver</div>
                  <div className="text-[10px] text-slate-400">Vehicle # / 108 Ambulance</div>
                </div>
                <div className="border-t border-slate-300 pt-2">
                  <div className="font-bold">Received & Inspected By</div>
                  <div className="text-[10px] text-slate-400">Medical Officer / Pharmacist</div>
                </div>
              </div>
            </div>

            {/* Print button bar */}
            <div className="mt-8 pt-4 border-t border-slate-100 flex items-center justify-end gap-3 no-print">
              <button
                onClick={() => window.print()}
                className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-2 cursor-pointer shadow-md"
              >
                <Printer className="w-4 h-4" />
                Print / Save PDF Slip
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
