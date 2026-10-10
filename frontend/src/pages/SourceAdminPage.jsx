import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import {
  Building2,
  ShieldCheck,
  ShieldAlert,
  Plus,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  MapPin,
  Clock,
  Phone,
  Layers,
  Sparkles,
  AlertCircle
} from 'lucide-react';

export default function SourceAdminPage() {
  const { currentUser } = useAuth();
  const [sources, setSources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('All');
  const [blockFilter, setBlockFilter] = useState('All');

  // New source modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [newSource, setNewSource] = useState({
    name: '',
    source_type: 'private_pharmacy',
    address: '',
    block: 'Chengalpattu Block',
    district: 'Chengalpattu',
    latitude: 12.6841,
    longitude: 79.9830,
    phone: '',
    opening_hours: '08:00 - 22:00',
    is_24x7: false,
    ownership: 'private',
    is_verified: true,
    is_active: true,
    visibility: 'public',
  });
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState(null);

  useEffect(() => {
    loadSources();
  }, []);

  const loadSources = async () => {
    setLoading(true);
    try {
      const data = await api.getAdminSources();
      if (data) {
        setSources(data);
      }
    } catch (e) {
      console.error('Failed to load admin sources:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleVerified = async (source) => {
    try {
      const updated = await api.patchAdminSource(source.id, {
        is_verified: !source.is_verified,
      });
      setSources(sources.map((s) => (s.id === source.id ? updated : s)));
      setFeedback({ type: 'success', message: `${source.name} verification status updated!` });
    } catch (e) {
      setFeedback({ type: 'error', message: e.message || 'Failed to update verification' });
    }
  };

  const handleToggleActive = async (source) => {
    try {
      const updated = await api.patchAdminSource(source.id, {
        is_active: !source.is_active,
      });
      setSources(sources.map((s) => (s.id === source.id ? updated : s)));
      setFeedback({ type: 'success', message: `${source.name} active status updated!` });
    } catch (e) {
      setFeedback({ type: 'error', message: e.message || 'Failed to update status' });
    }
  };

  const handleCreateSource = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setFeedback(null);
    try {
      const created = await api.createAdminSource(newSource);
      setSources([...sources, created]);
      setFeedback({ type: 'success', message: `Registered new facility: ${created.name}` });
      setShowAddModal(false);
    } catch (e) {
      setFeedback({ type: 'error', message: e.message || 'Failed to register facility' });
    } finally {
      setSubmitting(false);
    }
  };

  const filteredSources = sources.filter((s) => {
    if (typeFilter !== 'All' && s.source_type !== typeFilter) return false;
    if (blockFilter !== 'All' && s.block !== blockFilter) return false;
    if (!searchTerm.trim()) return true;
    const q = searchTerm.toLowerCase();
    return s.name.toLowerCase().includes(q) || s.address.toLowerCase().includes(q) || s.phone.includes(q);
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 font-sans">
      {/* Header Banner */}
      <div className="bg-slate-900 rounded-2xl p-6 text-white shadow-xl mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-teal-500/20 text-teal-300 font-bold border border-teal-500/30">
              District Health Administration
            </span>
            <span className="text-xs text-slate-400">79 Registered Medical Facilities</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Facility Directory & Verification Control
          </h1>
          <p className="text-xs text-slate-300 mt-1">
            Audit governance, approve private pharmacies, manage cooperative Jan Aushadhi hubs, and oversee visibility rules.
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-sm self-start md:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Register New Facility</span>
        </button>
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

      {/* Filter Toolbar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs mb-6 grid grid-cols-1 sm:grid-cols-4 gap-3">
        <div className="sm:col-span-2 relative">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search facilities by name, street, or phone..."
            className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-1 focus:ring-teal-500"
          />
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
        </div>

        <div>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 focus:bg-white focus:outline-none"
          >
            <option value="All">All Types (79)</option>
            <option value="phc">PHCs (15)</option>
            <option value="sub_centre">Sub-Centres / HWCs (20)</option>
            <option value="chc_hospital">CHCs & Hospitals (4)</option>
            <option value="warehouse">TNMSC Warehouses (1)</option>
            <option value="jan_aushadhi_coop">Jan Aushadhi / Amma (5)</option>
            <option value="private_pharmacy">Private Pharmacies (30)</option>
            <option value="private_hospital">Private Hospital Pharmacies (4)</option>
          </select>
        </div>

        <div>
          <select
            value={blockFilter}
            onChange={(e) => setBlockFilter(e.target.value)}
            className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 focus:bg-white focus:outline-none"
          >
            <option value="All">All Medical Blocks</option>
            <option value="Chengalpattu Block">Chengalpattu Block</option>
            <option value="Maduranthakam Block">Maduranthakam Block</option>
            <option value="Tirukalukundram Block">Tirukalukundram Block</option>
          </select>
        </div>
      </div>

      {/* Directory Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-100 text-slate-500 uppercase tracking-wider font-bold">
              <tr>
                <th className="py-3 px-4">Facility Name & Address</th>
                <th className="py-3 px-3">Type & Ownership</th>
                <th className="py-3 px-3">Block & District</th>
                <th className="py-3 px-3">Operating Hours</th>
                <th className="py-3 px-3">Contact</th>
                <th className="py-3 px-3">Verification</th>
                <th className="py-3 px-3">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400">
                    Loading facility directory...
                  </td>
                </tr>
              ) : filteredSources.map((s) => (
                <tr key={s.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-3 px-4 font-bold text-slate-900">
                    <div className="line-clamp-1">{s.name}</div>
                    <div className="text-[11px] text-slate-400 font-normal line-clamp-1">{s.address}</div>
                  </td>
                  <td className="py-3 px-3">
                    <span className="font-semibold text-slate-800 block">
                      {s.source_type.replace('_', ' ').toUpperCase()}
                    </span>
                    <span className="text-[10px] text-slate-400 capitalize">
                      {s.ownership} • {s.visibility}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-slate-700">
                    {s.block}
                  </td>
                  <td className="py-3 px-3 text-slate-600">
                    <div>{s.opening_hours}</div>
                    {s.is_24x7 && <span className="text-[10px] text-blue-600 font-bold">24x7</span>}
                  </td>
                  <td className="py-3 px-3 text-slate-600">
                    <a href={`tel:${s.phone}`} className="text-teal-600 hover:underline font-semibold">
                      {s.phone}
                    </a>
                  </td>
                  <td className="py-3 px-3">
                    {s.is_verified ? (
                      <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full font-bold flex items-center gap-1 w-fit">
                        <CheckCircle2 className="w-3 h-3" /> Verified
                      </span>
                    ) : (
                      <span className="text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full font-bold flex items-center gap-1 w-fit">
                        <AlertCircle className="w-3 h-3" /> Pending
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-3">
                    {s.is_active ? (
                      <span className="text-slate-800 font-semibold flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-emerald-500" /> Active
                      </span>
                    ) : (
                      <span className="text-slate-400 font-medium flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-slate-300" /> Suspended
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-right space-x-1">
                    <button
                      onClick={() => handleToggleVerified(s)}
                      className="px-2 py-1 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-700 font-semibold text-[11px]"
                    >
                      {s.is_verified ? 'Unverify' : 'Verify'}
                    </button>
                    <button
                      onClick={() => handleToggleActive(s)}
                      className="px-2 py-1 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-700 font-semibold text-[11px]"
                    >
                      {s.is_active ? 'Suspend' : 'Activate'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add New Facility Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200">
            <h3 className="text-base font-bold text-slate-900 mb-1">
              Register New Health Facility
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Add a new facility to the district directory with coordinates for Haversine matching.
            </p>

            <form onSubmit={handleCreateSource} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-700 font-bold mb-1">Facility Name</label>
                <input
                  type="text"
                  value={newSource.name}
                  onChange={(e) => setNewSource({ ...newSource, name: e.target.value })}
                  placeholder="e.g. Apollo Pharmacy - Kelambakkam Road"
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Facility Type</label>
                  <select
                    value={newSource.source_type}
                    onChange={(e) => setNewSource({ ...newSource, source_type: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium"
                  >
                    <option value="private_pharmacy">Private Retail Pharmacy</option>
                    <option value="jan_aushadhi_coop">Jan Aushadhi / Amma Marundhagam</option>
                    <option value="phc">Primary Health Centre</option>
                    <option value="sub_centre">Sub-Centre / HWC</option>
                    <option value="chc_hospital">CHC / Hospital</option>
                    <option value="private_hospital">Private Hospital Pharmacy</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Ownership</label>
                  <select
                    value={newSource.ownership}
                    onChange={(e) => setNewSource({ ...newSource, ownership: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium"
                  >
                    <option value="private">Private</option>
                    <option value="cooperative">Cooperative</option>
                    <option value="government">Government</option>
                    <option value="ngo">NGO</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Physical Address</label>
                <input
                  type="text"
                  value={newSource.address}
                  onChange={(e) => setNewSource({ ...newSource, address: e.target.value })}
                  placeholder="Door No, Street Name, Landmark"
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Latitude</label>
                  <input
                    type="number"
                    step="0.0001"
                    value={newSource.latitude}
                    onChange={(e) => setNewSource({ ...newSource, latitude: parseFloat(e.target.value) })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                    required
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Longitude</label>
                  <input
                    type="number"
                    step="0.0001"
                    value={newSource.longitude}
                    onChange={(e) => setNewSource({ ...newSource, longitude: parseFloat(e.target.value) })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Phone Number</label>
                  <input
                    type="text"
                    value={newSource.phone}
                    onChange={(e) => setNewSource({ ...newSource, phone: e.target.value })}
                    placeholder="044-xxxxxxxx"
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                    required
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Opening Hours</label>
                  <input
                    type="text"
                    value={newSource.opening_hours}
                    onChange={(e) => setNewSource({ ...newSource, opening_hours: e.target.value })}
                    placeholder="08:00 - 22:00"
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>
              </div>

              <div className="pt-3 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl font-semibold"
                >
                  {submitting ? 'Registering...' : 'Register Facility'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
