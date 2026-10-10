import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import L from 'leaflet';
import { 
  Search, 
  MapPin, 
  Phone, 
  ArrowRight, 
  Thermometer, 
  CheckCircle2, 
  AlertTriangle, 
  Share2, 
  Layers, 
  Sliders,
  Send,
  X,
  Package,
  Sparkles
} from 'lucide-react';

// Custom Leaflet Icons using SVG DivIcons
const createMarkerIcon = (color, label) => {
  return L.divIcon({
    className: 'custom-map-marker',
    html: `
      <div style="background-color: ${color}; width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: 11px; border: 3px solid white; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.3);">
        ${label}
      </div>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 16]
  });
};

export default function NearbyFinderPage() {
  const { currentUser, t } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const requestingPhcId = currentUser.phc_id || 'phc_cpt_01';
  const initialMedId = searchParams.get('medicine_id') || 'med_01'; // Defaults to Paracetamol Syrup

  const [medicines, setMedicines] = useState([]);
  const [selectedMedIds, setSelectedMedIds] = useState([initialMedId]);
  const [radiusKm, setRadiusKm] = useState(45);
  const [nearbyData, setNearbyData] = useState(null);
  const [loading, setLoading] = useState(true);

  // Transfer Request Modal
  const [activeTransferModal, setActiveTransferModal] = useState(null);
  const [transferUrgency, setTransferUrgency] = useState('critical');
  const [transferNotes, setTransferNotes] = useState('');
  const [coldChainConfirmed, setColdChainConfirmed] = useState(false);
  const [submittingTransfer, setSubmittingTransfer] = useState(false);
  const [transferSuccess, setTransferSuccess] = useState(null);

  useEffect(() => {
    loadMedicines();
  }, []);

  useEffect(() => {
    if (selectedMedIds.length > 0) {
      searchNearbySurplus();
    }
  }, [selectedMedIds, radiusKm, requestingPhcId]);

  const loadMedicines = async () => {
    try {
      const data = await api.getMedicines();
      setMedicines(data.medicines || []);
    } catch (e) {
      console.error(e);
    }
  };

  const searchNearbySurplus = async () => {
    setLoading(true);
    try {
      if (selectedMedIds.length === 1) {
        const res = await api.getNearbyStock(requestingPhcId, selectedMedIds[0], radiusKm);
        setNearbyData(res);
      } else {
        const res = await api.postNearbyStockMulti(requestingPhcId, selectedMedIds, radiusKm);
        setNearbyData(res);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleMedicine = (medId) => {
    if (selectedMedIds.includes(medId)) {
      if (selectedMedIds.length > 1) {
        setSelectedMedIds(selectedMedIds.filter(id => id !== medId));
      }
    } else {
      setSelectedMedIds([...selectedMedIds, medId]);
    }
  };

  const openTransferModal = (donor, match) => {
    const isColdChain = match.cold_chain;
    setActiveTransferModal({
      donor,
      match,
      requested_qty: Math.min(match.spareable_surplus, 150),
      isColdChain
    });
    setColdChainConfirmed(false);
    setTransferNotes(`Urgent shortage replenishment for ${currentUser.phc_name || 'PHC'}.`);
  };

  const handleCreateTransfer = async () => {
    if (!activeTransferModal) return;

    if (activeTransferModal.isColdChain && !coldChainConfirmed) {
      alert('Cold-chain handling confirmation is mandatory for vaccines/insulin/antidotes.');
      return;
    }

    setSubmittingTransfer(true);
    try {
      const payload = {
        from_phc_id: activeTransferModal.donor.donor_phc_id,
        to_phc_id: requestingPhcId,
        urgency: transferUrgency,
        notes: transferNotes,
        cold_chain_verified: coldChainConfirmed ? 1 : 0,
        items: [
          {
            medicine_id: activeTransferModal.match.medicine_id,
            requested_qty: activeTransferModal.requested_qty
          }
        ]
      };

      const result = await api.postTransfer(payload);
      setTransferSuccess(result);
      setTimeout(() => {
        setActiveTransferModal(null);
        setTransferSuccess(null);
        navigate('/transfers');
      }, 1800);
    } catch (err) {
      alert('Error creating transfer: ' + err.message);
    } finally {
      setSubmittingTransfer(false);
    }
  };

  const centerCoords = nearbyData?.requesting_phc
    ? [nearbyData.requesting_phc.latitude, nearbyData.requesting_phc.longitude]
    : [12.6841, 79.9830];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <MapPin className="w-6 h-6 text-emerald-600" />
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Geospatial Nearby Stock Finder</h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Haversine Distance matching • Requesting PHC: <span className="font-bold text-slate-800">{currentUser.phc_name || 'PHC Alapakkam'}</span>
          </p>
        </div>

        {/* Multi-Medicine Search Indicator */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200">
            {selectedMedIds.length} medicine{selectedMedIds.length > 1 ? 's' : ''} in search bundle
          </span>
        </div>
      </div>

      {/* Control Filters Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row items-center gap-4">
          {/* Medicine Selector Dropdown */}
          <div className="flex-1 w-full">
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Select Primary Shortage Medicine
            </label>
            <select
              value={selectedMedIds[0] || ''}
              onChange={(e) => setSelectedMedIds([e.target.value])}
              className="w-full py-2.5 px-3 text-xs rounded-xl border border-slate-200 bg-slate-50/50 font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              {medicines.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} ({m.form} - {m.strength}) {m.critical ? '⭐ [CRITICAL]' : ''} {m.cold_chain ? '❄️ [COLD-CHAIN]' : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Search Radius Slider */}
          <div className="w-full md:w-64">
            <div className="flex justify-between text-xs font-semibold text-slate-600 mb-1">
              <span>Search Radius</span>
              <span className="font-black text-emerald-700">{radiusKm} km</span>
            </div>
            <input
              type="range"
              min="10"
              max="50"
              step="5"
              value={radiusKm}
              onChange={(e) => setRadiusKm(parseInt(e.target.value))}
              className="w-full accent-emerald-600 cursor-pointer"
            />
          </div>
        </div>

        {/* Multi-Medicine Bundle Quick Chips */}
        <div className="pt-2 border-t border-slate-100">
          <span className="text-[11px] text-slate-400 font-medium mr-2">Combine delivery run with:</span>
          <div className="inline-flex flex-wrap gap-1.5 mt-1">
            {[
              { id: 'med_01', name: 'Paracetamol Syrup' },
              { id: 'med_05', name: 'Amoxicillin Dry Syrup' },
              { id: 'med_03', name: 'ORS Sachets' },
              { id: 'med_12', name: 'Anti-Snake Venom (ASV)' },
              { id: 'med_11', name: 'Insulin' }
            ].map((m) => (
              <button
                key={m.id}
                onClick={() => handleToggleMedicine(m.id)}
                className={`text-[11px] px-2.5 py-0.5 rounded-full transition-all cursor-pointer font-medium ${
                  selectedMedIds.includes(m.id)
                    ? 'bg-emerald-600 text-white font-bold ring-2 ring-emerald-300'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                + {m.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Split: Interactive Leaflet Map & Ranked Donor Table */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Side: Ranked Nearby Surplus Table (5 Cols) */}
        <div className="lg:col-span-6 bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h2 className="text-base font-bold text-slate-900">Nearby PHC Donor Candidates</h2>
              <p className="text-xs text-slate-500">Sorted nearest first via Haversine distance</p>
            </div>
            <span className="text-xs font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
              {nearbyData?.donors?.length || 0} donors found
            </span>
          </div>

          {loading ? (
            <div className="py-16 text-center text-slate-400 text-xs">Computing geodesic distances...</div>
          ) : !nearbyData?.donors || nearbyData.donors.length === 0 ? (
            <div className="py-12 text-center text-slate-500 text-xs bg-slate-50 rounded-xl p-4">
              <AlertTriangle className="w-6 h-6 text-amber-500 mx-auto mb-2" />
              No PHCs within {radiusKm} km have surplus stock above their safety buffer for these medicines.
              <div className="mt-3">
                <button
                  onClick={() => navigate('/transfers?tab=indent')}
                  className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white font-bold text-xs"
                >
                  Raise Emergency Indent to District Warehouse &rarr;
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3 max-h-[560px] overflow-y-auto pr-1">
              {nearbyData.donors.map((donor, idx) => (
                <div
                  key={donor.donor_phc_id}
                  className={`p-4 rounded-xl border transition-all ${
                    idx === 0
                      ? 'border-emerald-300 bg-emerald-50/40 shadow-xs ring-1 ring-emerald-300'
                      : 'border-slate-200 hover:border-slate-300 bg-white'
                  }`}
                >
                  {/* Donor Header */}
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-slate-900">{donor.donor_phc_name}</span>
                        {idx === 0 && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] bg-emerald-600 text-white font-black uppercase">
                            Nearest
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-500 flex items-center gap-2 mt-0.5">
                        <span className="flex items-center gap-1 font-semibold text-emerald-700">
                          <MapPin className="w-3 h-3" /> {donor.distance_km} km away
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-1 text-slate-500">
                          <Phone className="w-3 h-3" /> {donor.phone}
                        </span>
                      </div>
                    </div>

                    <span className="text-[11px] text-slate-400 font-medium">MO: {donor.medical_officer_name?.split(',')[0]}</span>
                  </div>

                  {/* Matching Medicines Surplus */}
                  <div className="mt-3 space-y-2 pt-2 border-t border-slate-200/60">
                    {donor.matches.map((match) => (
                      <div key={match.medicine_id} className="p-2.5 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-between text-xs">
                        <div>
                          <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                            {match.medicine_name}
                            {match.cold_chain && (
                              <span className="text-[10px] bg-sky-100 text-sky-700 px-1 rounded flex items-center gap-0.5">
                                <Thermometer className="w-2.5 h-2.5" /> 2-8°C
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-slate-400 mt-0.5">
                            Total stock: {match.total_stock} • Earliest batch exp: <strong>{match.earliest_expiry}</strong>
                          </div>
                        </div>

                        <div className="text-right flex items-center gap-3">
                          <div>
                            <div className="font-black text-emerald-600 text-sm">
                              +{match.spareable_surplus} {match.unit}
                            </div>
                            <div className="text-[10px] text-slate-400">surplus buffer</div>
                          </div>

                          <button
                            onClick={() => openTransferModal(donor, match)}
                            className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition-colors cursor-pointer"
                          >
                            Request
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right Side: Leaflet Map Visualizer (6 Cols) */}
        <div className="lg:col-span-6 bg-white rounded-2xl border border-slate-200 shadow-xs p-4 flex flex-col">
          <div className="flex items-center justify-between pb-3 mb-2">
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
              <MapPin className="w-4 h-4 text-emerald-600" />
              Live Geospatial Rebalancing Map
            </h2>
            <div className="flex items-center gap-3 text-[11px] text-slate-500 font-medium">
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span> Requesting PHC
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span> Surplus Donor
              </span>
            </div>
          </div>

          <div className="flex-1 min-h-[500px] w-full rounded-xl overflow-hidden border border-slate-200">
            {nearbyData && (
              <MapContainer
                center={centerCoords}
                zoom={11}
                scrollWheelZoom={false}
                style={{ height: '100%', width: '100%' }}
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />

                {/* Requesting PHC Pin (Red) */}
                {nearbyData.requesting_phc && (
                  <Marker
                    position={[nearbyData.requesting_phc.latitude, nearbyData.requesting_phc.longitude]}
                    icon={createMarkerIcon('#ef4444', 'REQ')}
                  >
                    <Popup>
                      <div className="text-xs p-1">
                        <strong className="text-rose-600">Requesting PHC:</strong> {nearbyData.requesting_phc.name}
                        <br />
                        <span className="text-slate-500">Stock deficit centre</span>
                      </div>
                    </Popup>
                  </Marker>
                )}

                {/* Donor PHCs Pins (Green) & Geodesic Routing Lines */}
                {nearbyData.donors?.map((d) => (
                  <React.Fragment key={d.donor_phc_id}>
                    <Marker
                      position={[d.latitude, d.longitude]}
                      icon={createMarkerIcon('#10b981', 'DON')}
                    >
                      <Popup>
                        <div className="text-xs p-1">
                          <strong className="text-emerald-700">{d.donor_phc_name}</strong>
                          <br />
                          <span>Distance: <strong>{d.distance_km} km</strong></span>
                          <br />
                          <span>Phone: {d.phone}</span>
                        </div>
                      </Popup>
                    </Marker>

                    {/* Polyline connecting requesting PHC to donor */}
                    {nearbyData.requesting_phc && (
                      <Polyline
                        positions={[
                          [nearbyData.requesting_phc.latitude, nearbyData.requesting_phc.longitude],
                          [d.latitude, d.longitude]
                        ]}
                        color="#10b981"
                        dashArray="6, 6"
                        weight={3}
                      />
                    )}
                  </React.Fragment>
                ))}
              </MapContainer>
            )}
          </div>
        </div>
      </div>

      {/* Transfer Request Modal */}
      {activeTransferModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Share2 className="w-5 h-5 text-emerald-600" />
                <h3 className="font-bold text-base text-slate-900">Initiate Inter-PHC Stock Transfer</h3>
              </div>
              <button onClick={() => setActiveTransferModal(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {transferSuccess ? (
              <div className="py-8 text-center space-y-3">
                <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto animate-bounce" />
                <h4 className="font-bold text-base text-slate-900">Transfer Request Submitted!</h4>
                <p className="text-xs text-slate-500">
                  Request <strong className="text-emerald-700">{transferSuccess.request_number}</strong> dispatched to {activeTransferModal.donor.donor_phc_name}.
                  Redirecting to Transfer Slip workflow...
                </p>
              </div>
            ) : (
              <div className="mt-4 space-y-4">
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Source Donor:</span>
                    <strong className="text-slate-800">{activeTransferModal.donor.donor_phc_name} ({activeTransferModal.donor.distance_km} km away)</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Receiving PHC:</span>
                    <strong className="text-slate-800">{currentUser.phc_name || 'PHC Alapakkam'}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Medicine:</span>
                    <strong className="text-slate-800">{activeTransferModal.match.medicine_name}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Available Surplus:</span>
                    <strong className="text-emerald-700">{activeTransferModal.match.spareable_surplus} {activeTransferModal.match.unit}</strong>
                  </div>
                </div>

                {/* Requested Quantity */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Requested Transfer Quantity ({activeTransferModal.match.unit})
                  </label>
                  <input
                    type="number"
                    min="1"
                    max={activeTransferModal.match.spareable_surplus}
                    value={activeTransferModal.requested_qty}
                    onChange={(e) => setActiveTransferModal({
                      ...activeTransferModal,
                      requested_qty: parseInt(e.target.value) || 1
                    })}
                    className="w-full p-2.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-bold"
                  />
                </div>

                {/* Urgency */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Urgency Level</label>
                  <select
                    value={transferUrgency}
                    onChange={(e) => setTransferUrgency(e.target.value)}
                    className="w-full p-2.5 text-xs rounded-xl border border-slate-200 bg-white"
                  >
                    <option value="normal">Normal Routine Rebalancing</option>
                    <option value="critical">Critical Shortage (&lt;15 days)</option>
                    <option value="emergency">Zero Stock Emergency Depletion</option>
                  </select>
                </div>

                {/* Cold-Chain Mandatory Checkbox */}
                {activeTransferModal.isColdChain && (
                  <div className="p-3.5 rounded-xl bg-sky-50 border border-sky-300">
                    <div className="flex items-start gap-2.5">
                      <input
                        type="checkbox"
                        id="cold_chain_check"
                        checked={coldChainConfirmed}
                        onChange={(e) => setColdChainConfirmed(e.target.checked)}
                        className="mt-0.5 rounded text-sky-600 focus:ring-sky-500 cursor-pointer"
                      />
                      <label htmlFor="cold_chain_check" className="text-xs text-sky-900 font-semibold cursor-pointer">
                        ❄️ Cold-Chain Protocol Acknowledgment:
                        <p className="text-[11px] text-sky-700 font-normal mt-0.5">
                          I confirm that certified cold-chain carriers with frozen ice packs (2°C - 8°C) are arranged for this transit in accordance with Tamil Nadu immunization guidelines.
                        </p>
                      </label>
                    </div>
                  </div>
                )}

                {/* Reason / Notes */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Clinical Justification</label>
                  <textarea
                    rows="2"
                    value={transferNotes}
                    onChange={(e) => setTransferNotes(e.target.value)}
                    className="w-full p-2 text-xs rounded-xl border border-slate-200"
                    placeholder="Enter reason for transfer..."
                  />
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                  <button
                    onClick={() => setActiveTransferModal(null)}
                    className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCreateTransfer}
                    disabled={submittingTransfer}
                    className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md cursor-pointer disabled:opacity-50"
                  >
                    {submittingTransfer ? 'Dispatching...' : 'Confirm & Request Transfer'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
