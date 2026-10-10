import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { 
  FileText, 
  Download, 
  Printer, 
  Building2, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  Share2, 
  Calendar,
  Layers
} from 'lucide-react';

export default function ReportsPage() {
  const { currentUser, t } = useAuth();
  const [districtData, setDistrictData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadReports();
  }, []);

  const loadReports = async () => {
    setLoading(true);
    try {
      const data = await api.getDistrictOverview();
      setDistrictData(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <FileText className="w-6 h-6 text-emerald-600" />
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">District Stock Reports & Analytics</h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Official periodic audit data for Chengalpattu District PHC network
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all cursor-pointer"
          >
            <Printer className="w-4 h-4 text-emerald-600" />
            Print Report
          </button>
          <button
            onClick={() => window.open(`/api/reports/export-stock-csv?phc_id=${currentUser.phc_id || 'phc_cpt_01'}`, '_blank')}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md transition-all cursor-pointer"
          >
            <Download className="w-4 h-4" />
            Download Full CSV
          </button>
        </div>
      </div>

      {loading ? (
        <div className="p-16 text-center text-xs text-slate-400">Compiling district analytics...</div>
      ) : districtData && (
        <div className="space-y-6">
          {/* Executive Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-xs font-semibold text-slate-500">Total PHCs Connected</span>
              <div className="text-2xl font-black text-slate-900 mt-1">15 Centres</div>
              <span className="text-[11px] text-emerald-600 font-medium">100% online telemetry</span>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-xs font-semibold text-slate-500">Zero Stock Instances</span>
              <div className="text-2xl font-black text-rose-600 mt-1">{districtData.kpis.total_stockouts}</div>
              <span className="text-[11px] text-rose-500 font-medium">Active district deficits</span>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-xs font-semibold text-slate-500">Near-Expiry Risk Batches</span>
              <div className="text-2xl font-black text-amber-600 mt-1">{districtData.kpis.near_expiry_batches}</div>
              <span className="text-[11px] text-amber-600 font-medium">&lt;90 days shelf-life</span>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-xs font-semibold text-slate-500">Transfers Completed</span>
              <div className="text-2xl font-black text-emerald-600 mt-1">{districtData.kpis.completed_transfers}</div>
              <span className="text-[11px] text-slate-400 font-medium">Avg time: {districtData.kpis.avg_transfer_turnaround_hrs}</span>
            </div>
          </div>

          {/* Block Level Detailed Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-4">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Building2 className="w-5 h-5 text-emerald-600" />
              Medical Block Performance Breakdown
            </h2>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 font-semibold text-slate-600">
                    <th className="py-3 px-4">Block Name</th>
                    <th className="py-3 px-4">Connected PHCs</th>
                    <th className="py-3 px-4">Active Shortages</th>
                    <th className="py-3 px-4">Vulnerability Level</th>
                    <th className="py-3 px-4 text-right">Redistribution Priority</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {districtData.block_breakdown.map((b) => (
                    <tr key={b.block_id} className="hover:bg-slate-50/50">
                      <td className="py-3 px-4 font-bold text-slate-800">{b.block_name}</td>
                      <td className="py-3 px-4 text-slate-600">{b.phc_count} Primary Health Centres</td>
                      <td className="py-3 px-4 font-bold text-rose-600">{b.shortages_detected} items</td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                          b.risk_level === 'High' ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'
                        }`}>
                          {b.risk_level}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <span className="text-xs font-semibold text-emerald-700">Immediate Inter-PHC Matching</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
