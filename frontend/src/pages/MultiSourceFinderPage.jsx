import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from 'react-leaflet';
import L from 'leaflet';
import {
  Search,
  MapPin,
  Phone,
  Navigation,
  ArrowRight,
  Thermometer,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ExternalLink,
  Sliders,
  X,
  Package,
  Layers,
  Sparkles,
  Share2,
  Building2,
  Store,
  Warehouse,
  Hospital,
  ShieldCheck,
  ChevronRight,
  TrendingDown,
  Info,
  Compass,
  Check,
  Calendar,
  AlertCircle,
  MessageSquare
} from 'lucide-react';

// Source type metadata: labels, badge colors, and map marker configs
const SOURCE_TYPE_CONFIG = {
  phc: {
    label: 'PHC',
    fullLabel: 'Primary Health Centre (PHC)',
    color: '#0d9488', // Teal
    textColor: 'text-teal-700',
    bgColor: 'bg-teal-50',
    borderColor: 'border-teal-200',
    symbol: '🏥',
    isFree: true,
  },
  sub_centre: {
    label: 'Sub-Centre / HWC',
    fullLabel: 'Sub-Centre / Health & Wellness Centre',
    color: '#059669', // Emerald
    textColor: 'text-emerald-700',
    bgColor: 'bg-emerald-50',
    borderColor: 'border-emerald-200',
    symbol: '➕',
    isFree: true,
  },
  chc_hospital: {
    label: 'CHC / Govt Hospital',
    fullLabel: 'Community Health Centre / District Hospital',
    color: '#2563eb', // Blue
    textColor: 'text-blue-700',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
    symbol: '🏛️',
    isFree: true,
  },
  warehouse: {
    label: 'TNMSC Warehouse',
    fullLabel: 'TNMSC District Drug Warehouse (Staff Only)',
    color: '#475569', // Slate
    textColor: 'text-slate-700',
    bgColor: 'bg-slate-100',
    borderColor: 'border-slate-300',
    symbol: '🏭',
    isFree: true,
  },
  jan_aushadhi_coop: {
    label: 'Jan Aushadhi / Amma',
    fullLabel: 'Jan Aushadhi Kendra / Amma Marundhagam',
    color: '#7c3aed', // Purple
    textColor: 'text-purple-700',
    bgColor: 'bg-purple-50',
    borderColor: 'border-purple-200',
    symbol: '🏷️',
    isFree: false,
    lowCost: true,
  },
  private_pharmacy: {
    label: 'Private Pharmacy',
    fullLabel: 'Private Retail Pharmacy (Apollo, MedPlus, etc.)',
    color: '#ea580c', // Orange
    textColor: 'text-orange-700',
    bgColor: 'bg-orange-50',
    borderColor: 'border-orange-200',
    symbol: '💊',
    isFree: false,
  },
  private_hospital: {
    label: 'Private Hospital Pharmacy',
    fullLabel: 'Private Hospital / Clinic Pharmacy',
    color: '#dc2626', // Red
    textColor: 'text-red-700',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
    symbol: '🏨',
    isFree: false,
  },
  ngo_dispensary: {
    label: 'NGO Dispensary',
    fullLabel: 'NGO / Charitable Dispensary',
    color: '#0891b2', // Cyan
    textColor: 'text-cyan-700',
    bgColor: 'bg-cyan-50',
    borderColor: 'border-cyan-200',
    symbol: '🤝',
    isFree: false,
  },
};

// Custom Leaflet DivIcon factory
const createSourceMarkerIcon = (type, isSelected = false, availabilityStatus = 'available') => {
  const cfg = SOURCE_TYPE_CONFIG[type] || SOURCE_TYPE_CONFIG.private_pharmacy;
  const isOutOfStock = availabilityStatus === 'out_of_stock';
  const size = isSelected ? 42 : 34;
  const opacity = isOutOfStock ? '0.6' : '1.0';

  return L.divIcon({
    className: 'custom-source-pin',
    html: `
      <div style="
        background-color: ${cfg.color};
        width: ${size}px;
        height: ${size}px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: ${isSelected ? '18px' : '14px'};
        border: ${isSelected ? '3px solid #fbbf24' : '2.5px solid white'};
        box-shadow: 0 4px 10px rgba(0,0,0,0.35);
        opacity: ${opacity};
        transition: transform 0.2s ease;
      ">
        ${cfg.symbol}
      </div>
    `,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
};

// Map Viewport Recenter Helper Component
function MapRecenter({ center, zoom }) {
  const map = useMap();
  useEffect(() => {
    if (center && center[0] && center[1]) {
      map.setView(center, zoom || map.getZoom(), { animate: true });
    }
  }, [center, zoom, map]);
  return null;
}

export default function MultiSourceFinderPage() {
  const { currentUser, t, lang } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Primary Anchor & Search State
  const defaultAnchorId = searchParams.get('from_source_id') || searchParams.get('phc_id') || currentUser.phc_id || 'phc_cpt_01';
  const [anchorType, setAnchorType] = useState('phc'); // 'phc' or 'gps'
  const [selectedPhcId, setSelectedPhcId] = useState(defaultAnchorId);
  const [userCoords, setUserCoords] = useState([12.6841, 79.9830]); // Default: Chengalpattu / Alapakkam
  const [radiusKm, setRadiusKm] = useState(25);

  // Medicines
  const [medicines, setMedicines] = useState([]);
  const [selectedMedIds, setSelectedMedIds] = useState(() => {
    const fromUrl = searchParams.get('medicine_id');
    return fromUrl ? [fromUrl] : ['med_01']; // Paracetamol Syrup default
  });
  const [medSearchInput, setMedSearchInput] = useState('');
  const [showMedDropdown, setShowMedDropdown] = useState(false);

  // Filters
  const [selectedTypes, setSelectedTypes] = useState(Object.keys(SOURCE_TYPE_CONFIG));
  const [freeOnly, setFreeOnly] = useState(false);
  const [openNow, setOpenNow] = useState(false);
  const [inStockOnly, setInStockOnly] = useState(false);
  const [sortBy, setSortBy] = useState('best_match'); // 'best_match', 'distance', 'price', 'freshness'

  // Search Results State
  const [searchResults, setSearchResults] = useState([]);
  const [multiResponse, setMultiResponse] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('both'); // 'both', 'map', 'list' for responsive

  // Selected Marker / Side Panel State
  const [selectedSourceId, setSelectedSourceId] = useState(null);
  const [sourceStockData, setSourceStockData] = useState(null);
  const [loadingStockPanel, setLoadingStockPanel] = useState(false);
  const [stockPanelFilter, setStockPanelFilter] = useState('');
  const [stockCategoryFilter, setStockCategoryFilter] = useState('All');
  const [stockInStockOnly, setStockInStockOnly] = useState(false);

  // Transfer modal
  const [showTransferSuccess, setShowTransferSuccess] = useState(null);

  // Load master list of medicines and PHCs
  useEffect(() => {
    loadInitialMasterData();
  }, []);

  const loadInitialMasterData = async () => {
    try {
      const data = await api.getMedicines();
      if (data && data.medicines) {
        setMedicines(data.medicines);
      }
    } catch (e) {
      console.error('Failed to load medicines:', e);
    }
  };

  // Perform search whenever search parameters change
  useEffect(() => {
    executeSearch();
  }, [
    selectedMedIds,
    selectedPhcId,
    userCoords,
    anchorType,
    radiusKm,
    selectedTypes,
    freeOnly,
    openNow,
    inStockOnly,
    sortBy,
  ]);

  const executeSearch = async () => {
    if (selectedMedIds.length === 0) return;
    setLoading(true);

    try {
      const typesQuery = selectedTypes.length < Object.keys(SOURCE_TYPE_CONFIG).length ? selectedTypes.join(',') : '';
      const params = new URLSearchParams({
        medicine_ids: selectedMedIds.join(','),
        radius_km: radiusKm.toString(),
        free_only: freeOnly.toString(),
        open_now: openNow.toString(),
        in_stock_only: inStockOnly.toString(),
        sort: sortBy,
        page_size: '60',
      });

      if (anchorType === 'gps' && userCoords) {
        params.append('lat', userCoords[0].toString());
        params.append('lng', userCoords[1].toString());
      } else {
        params.append('from_source_id', selectedPhcId);
      }

      if (typesQuery) {
        params.append('source_types', typesQuery);
      }

      // Single search
      const res = await api.searchFinderSources(params.toString());
      if (res && res.results) {
        setSearchResults(res.results);
      }

      // If multiple medicines are selected, also query multi-coverage endpoint
      if (selectedMedIds.length > 1) {
        const multiParams = new URLSearchParams({
          medicine_ids: selectedMedIds.join(','),
          radius_km: radiusKm.toString(),
        });
        if (anchorType === 'gps') {
          multiParams.append('lat', userCoords[0].toString());
          multiParams.append('lng', userCoords[1].toString());
        } else {
          multiParams.append('from_source_id', selectedPhcId);
        }
        const mRes = await api.searchFinderMulti(multiParams.toString());
        setMultiResponse(mRes);
      } else {
        setMultiResponse(null);
      }
    } catch (e) {
      console.error('Finder search failed:', e);
    } finally {
      setLoading(false);
    }
  };

  // Fetch full stock list when a source marker is selected
  useEffect(() => {
    if (selectedSourceId) {
      loadSourceStock(selectedSourceId);
    } else {
      setSourceStockData(null);
    }
  }, [selectedSourceId]);

  const loadSourceStock = async (sourceId) => {
    setLoadingStockPanel(true);
    try {
      const data = await api.getSourceStockList(sourceId, 'page_size=80');
      setSourceStockData(data);
    } catch (e) {
      console.error('Failed to load source stock list:', e);
    } finally {
      setLoadingStockPanel(false);
    }
  };

  // GPS geolocation handler
  const handleUseCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setUserCoords([pos.coords.latitude, pos.coords.longitude]);
          setAnchorType('gps');
        },
        (err) => {
          alert('Could not access device GPS. Defaulting to Chengalpattu HQ.');
          setUserCoords([12.6841, 79.9830]);
          setAnchorType('gps');
        }
      );
    } else {
      alert('Geolocation is not supported by your browser.');
    }
  };

  // Quick preset scenario helper
  const loadDemoScenario = () => {
    setSelectedPhcId('phc_cpt_01'); // Alapakkam
    setAnchorType('phc');
    setSelectedMedIds(['med_01']); // Paracetamol syrup
    setRadiusKm(25);
    setFreeOnly(false);
    setInStockOnly(false);
    setSortBy('best_match');
  };

  // Medicine tag toggle
  const toggleMedicineId = (medId) => {
    if (selectedMedIds.includes(medId)) {
      if (selectedMedIds.length > 1) {
        setSelectedMedIds(selectedMedIds.filter((id) => id !== medId));
      }
    } else {
      setSelectedMedIds([...selectedMedIds, medId]);
    }
  };

  // Filtered medicines in dropdown
  const filteredMedOptions = useMemo(() => {
    if (!medSearchInput.trim()) return medicines.slice(0, 8);
    const q = medSearchInput.toLowerCase();
    return medicines
      .filter((m) => m.name.toLowerCase().includes(q) || m.generic_name.toLowerCase().includes(q) || m.code.toLowerCase().includes(q))
      .slice(0, 8);
  }, [medicines, medSearchInput]);

  // Current primary medicine info
  const primaryMed = useMemo(() => {
    return medicines.find((m) => m.id === selectedMedIds[0]) || null;
  }, [medicines, selectedMedIds]);

  // Grouped search results for structured tabbed/accordion display
  const groupedResults = useMemo(() => {
    const gov = [];
    const coop = [];
    const pvt = [];

    searchResults.forEach((r) => {
      if (['phc', 'sub_centre', 'chc_hospital', 'warehouse'].includes(r.source_type)) {
        gov.push(r);
      } else if (r.source_type === 'jan_aushadhi_coop' || r.ownership === 'cooperative') {
        coop.push(r);
      } else {
        pvt.push(r);
      }
    });

    return { gov, coop, pvt };
  }, [searchResults]);

  // Map center calculation
  const mapCenter = useMemo(() => {
    if (selectedSourceId) {
      const found = searchResults.find((s) => s.source_id === selectedSourceId);
      if (found) return [found.latitude, found.longitude];
    }
    return userCoords;
  }, [selectedSourceId, searchResults, userCoords]);

  // Copy share info helper
  const handleShareSource = (source) => {
    const text = `🏥 ${source.name} (${source.source_type.replace('_', ' ').toUpperCase()})\n📍 Distance: ${source.distance_km} km\n📞 Contact: ${source.phone}\n💊 Medicine: ${primaryMed?.name || 'Inquire at counter'}\nStatus: ${source.quantity_status.replace('_', ' ').toUpperCase()}${source.is_free ? ' (FREE)' : ` (₹${source.price_per_unit || 0})`}`;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text);
      alert('Facility stock details copied to clipboard!');
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 font-sans">
      {/* 1. Header Banner & Quick Demo Scenario Alert */}
      <div className="bg-gradient-to-r from-slate-900 via-teal-900 to-indigo-950 rounded-2xl p-6 text-white shadow-xl mb-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 -mt-6 -mr-6 w-56 h-56 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-500/20 text-teal-300 text-xs font-semibold mb-2 border border-teal-500/30">
              <Compass className="w-3.5 h-3.5" />
              <span>Multi-Source Facility Stock Finder</span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Nearby Medicine Availability & Facility Map
            </h1>
            <p className="text-sm text-slate-300 mt-1 max-w-2xl">
              Search across <strong>79 health facilities</strong> in Chengalpattu District: Free Government PHCs & Sub-Centres, Low-Cost Jan Aushadhi Kendras, and Private Pharmacies with live inventory.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={loadDemoScenario}
              className="px-3.5 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm"
              title="Loads PHC Alapakkam stockout scenario for Paracetamol syrup"
            >
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span>Load Out-of-Stock Demo</span>
            </button>
            <button
              onClick={() => navigate('/chat')}
              className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white border border-white/20 text-xs font-medium flex items-center gap-1.5 transition-all"
            >
              <MessageSquare className="w-4 h-4" />
              <span>Ask AI Chatbot</span>
            </button>
          </div>
        </div>

        {/* Highlight Banner if Alapakkam is search origin and Paracetamol is searched */}
        {selectedPhcId === 'phc_cpt_01' && selectedMedIds.includes('med_01') && (
          <div className="mt-4 p-3 bg-amber-500/15 border border-amber-500/30 rounded-xl text-amber-200 text-xs flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-white">Active Scenario:</span> PHC Alapakkam has <strong>0 units</strong> of Paracetamol Oral Suspension. Nearest free surplus is at <strong>PHC Melamaiyur</strong> (2.9 km away, 380 units), low-cost generic at <strong>Jan Aushadhi Kendra</strong> (5 km, ₹18), and retail stock at <strong>Apollo Pharmacy</strong> (3 km, ₹45).
            </div>
          </div>
        )}
      </div>

      {/* 2. Control Bar: Medicine Search + Location Anchor + Radius Slider */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm mb-6">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
          {/* Medicine Search & Selection */}
          <div className="md:col-span-5 relative">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Select Medicines to Locate ({selectedMedIds.length})
            </label>
            <div className="relative">
              <input
                type="text"
                value={medSearchInput}
                onChange={(e) => {
                  setMedSearchInput(e.target.value);
                  setShowMedDropdown(true);
                }}
                onFocus={() => setShowMedDropdown(true)}
                placeholder="Search by medicine name, generic name, or code..."
                className="w-full pl-9 pr-4 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-teal-500 focus:outline-none transition-all"
              />
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              {medSearchInput && (
                <button
                  onClick={() => setMedSearchInput('')}
                  className="absolute right-3 top-3 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Dropdown Options */}
            {showMedDropdown && (
              <div className="absolute left-0 right-0 mt-1.5 bg-white border border-slate-200 rounded-xl shadow-xl z-50 max-h-60 overflow-y-auto divide-y divide-slate-100">
                <div className="p-2 text-[11px] font-semibold text-slate-400 uppercase bg-slate-50 flex justify-between items-center">
                  <span>Suggested TNMSC Formulary Items</span>
                  <button onClick={() => setShowMedDropdown(false)} className="text-slate-500 hover:text-slate-700">
                    Close
                  </button>
                </div>
                {filteredMedOptions.map((m) => {
                  const isSelected = selectedMedIds.includes(m.id);
                  return (
                    <button
                      key={m.id}
                      onClick={() => {
                        toggleMedicineId(m.id);
                        setMedSearchInput('');
                        setShowMedDropdown(false);
                      }}
                      className="w-full text-left px-3.5 py-2.5 text-xs hover:bg-teal-50 flex items-center justify-between transition-colors"
                    >
                      <div>
                        <div className="font-semibold text-slate-800">{m.name}</div>
                        <div className="text-[11px] text-slate-500">{m.generic_name} • {m.strength} ({m.form})</div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {m.cold_chain ? <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">❄️ Cold</span> : null}
                        {isSelected ? (
                          <span className="text-xs font-bold text-teal-600 flex items-center gap-1">
                            <Check className="w-3.5 h-3.5" /> Selected
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400">+ Add</span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Active Medicine Chips */}
            <div className="flex flex-wrap gap-1.5 mt-2">
              {selectedMedIds.map((id) => {
                const med = medicines.find((m) => m.id === id);
                return (
                  <span
                    key={id}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-teal-50 text-teal-800 border border-teal-200 text-xs font-medium"
                  >
                    <span>{med ? med.name.split(' ')[0] + ' ' + (med.form || '') : id}</span>
                    {selectedMedIds.length > 1 && (
                      <button onClick={() => toggleMedicineId(id)} className="text-teal-600 hover:text-teal-900 ml-0.5">
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </span>
                );
              })}
            </div>
          </div>

          {/* Location Anchor Selector */}
          <div className="md:col-span-4">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Search Origin Location
            </label>
            <div className="flex items-center gap-2">
              <select
                value={anchorType === 'gps' ? 'gps' : selectedPhcId}
                onChange={(e) => {
                  if (e.target.value === 'gps') {
                    handleUseCurrentLocation();
                  } else {
                    setAnchorType('phc');
                    setSelectedPhcId(e.target.value);
                  }
                }}
                className="flex-1 py-2.5 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:bg-white focus:ring-2 focus:ring-teal-500 focus:outline-none"
              >
                <option value="phc_cpt_01">PHC Alapakkam (Requesting PHC)</option>
                <option value="phc_cpt_02">PHC Melamaiyur (Surplus Donor PHC)</option>
                <option value="phc_cpt_03">PHC Vallam</option>
                <option value="phc_cpt_04">PHC Singaperumal Koil</option>
                <option value="phc_cpt_05">PHC Maraimalai Nagar</option>
                <option value="phc_mdk_01">PHC Karunguzhi</option>
                <option value="phc_mdk_02">PHC Maduranthakam</option>
                <option value="phc_tkr_01">PHC Tirukalukundram</option>
                <option value="phc_tkr_04">PHC Mamallapuram</option>
                <option value="gps">📍 Current Device GPS</option>
              </select>

              <button
                onClick={handleUseCurrentLocation}
                className="px-2.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-medium flex items-center gap-1 shrink-0 transition-colors"
                title="Detect exact coordinates via browser"
              >
                <MapPin className="w-3.5 h-3.5 text-teal-600" />
                <span className="hidden sm:inline">GPS</span>
              </button>
            </div>
          </div>

          {/* Radius Slider & Sort */}
          <div className="md:col-span-3">
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Radius: <span className="text-teal-600 font-extrabold">{radiusKm} km</span>
              </label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="text-[11px] font-semibold text-slate-600 bg-transparent border-0 underline cursor-pointer focus:outline-none"
              >
                <option value="best_match">Sort: Best Match</option>
                <option value="distance">Sort: Nearest</option>
                <option value="price">Sort: Cheapest</option>
                <option value="freshness">Sort: Freshest Data</option>
              </select>
            </div>
            <input
              type="range"
              min="2"
              max="45"
              step="1"
              value={radiusKm}
              onChange={(e) => setRadiusKm(Number(e.target.value))}
              className="w-full accent-teal-600 h-2 bg-slate-200 rounded-lg cursor-pointer"
            />
          </div>
        </div>

        {/* 3. Facility Type Pills & Filter Checkboxes */}
        <div className="mt-4 pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs">
          {/* Source Type Filter Checkboxes */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-slate-400 font-semibold mr-1">Facilities:</span>
            {Object.entries(SOURCE_TYPE_CONFIG).map(([key, cfg]) => {
              const active = selectedTypes.includes(key);
              return (
                <button
                  key={key}
                  onClick={() => {
                    if (active) {
                      if (selectedTypes.length > 1) {
                        setSelectedTypes(selectedTypes.filter((k) => k !== key));
                      }
                    } else {
                      setSelectedTypes([...selectedTypes, key]);
                    }
                  }}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium border transition-all ${
                    active
                      ? `${cfg.bgColor} ${cfg.textColor} ${cfg.borderColor} shadow-xs font-semibold`
                      : 'bg-slate-50 text-slate-400 border-slate-200 hover:text-slate-600'
                  }`}
                >
                  <span>{cfg.symbol}</span>
                  <span>{cfg.label}</span>
                </button>
              );
            })}
          </div>

          {/* Quick Boolean Filters */}
          <div className="flex items-center gap-2">
            <label className="inline-flex items-center gap-1.5 cursor-pointer bg-slate-50 hover:bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200">
              <input
                type="checkbox"
                checked={freeOnly}
                onChange={(e) => setFreeOnly(e.target.checked)}
                className="accent-teal-600 rounded"
              />
              <span className="text-slate-700 font-medium">Free Only (Govt)</span>
            </label>

            <label className="inline-flex items-center gap-1.5 cursor-pointer bg-slate-50 hover:bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200">
              <input
                type="checkbox"
                checked={openNow}
                onChange={(e) => setOpenNow(e.target.checked)}
                className="accent-teal-600 rounded"
              />
              <span className="text-slate-700 font-medium">Open Now</span>
            </label>

            <label className="inline-flex items-center gap-1.5 cursor-pointer bg-slate-50 hover:bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200">
              <input
                type="checkbox"
                checked={inStockOnly}
                onChange={(e) => setInStockOnly(e.target.checked)}
                className="accent-teal-600 rounded"
              />
              <span className="text-slate-700 font-medium">In Stock Only</span>
            </label>
          </div>
        </div>
      </div>

      {/* 4. Multi-Medicine Minimal-Set Itinerary Recommendation (Shown if >= 2 medicines) */}
      {multiResponse && multiResponse.best_combination && (
        <div className="bg-gradient-to-r from-emerald-50 via-teal-50 to-indigo-50 border border-teal-200 rounded-2xl p-4 sm:p-5 mb-6 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-teal-600 text-white flex items-center justify-center font-bold text-sm shadow-sm">
                🎯
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Optimal Multi-Source Combination (Minimal Stops)
                </h3>
                <p className="text-xs text-slate-600">
                  Algorithmic itinerary to get all <strong>{selectedMedIds.length} medicines</strong> with the fewest trips and lowest cost.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <span className="px-2.5 py-1 rounded-full bg-white font-semibold text-slate-700 border border-slate-200 shadow-2xs">
                Total Travel: <strong>{multiResponse.best_combination.total_itinerary_distance_km} km</strong>
              </span>
              <span className="px-2.5 py-1 rounded-full bg-white font-semibold text-emerald-700 border border-emerald-200 shadow-2xs">
                Est. Cost: <strong>{multiResponse.best_combination.total_estimated_cost === 0 ? 'FREE' : `₹${multiResponse.best_combination.total_estimated_cost}`}</strong>
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {multiResponse.best_combination.suggested_sources.map((stop, index) => {
              const cfg = SOURCE_TYPE_CONFIG[stop.source_type] || SOURCE_TYPE_CONFIG.phc;
              return (
                <div
                  key={stop.source_id}
                  onClick={() => setSelectedSourceId(stop.source_id)}
                  className="bg-white rounded-xl p-3 border border-teal-100 hover:border-teal-400 hover:shadow-md cursor-pointer transition-all"
                >
                  <div className="flex items-start justify-between gap-1.5 mb-1.5">
                    <div className="flex items-center gap-1.5">
                      <span className="w-5 h-5 rounded-full bg-slate-900 text-white text-[11px] font-bold flex items-center justify-center">
                        {index + 1}
                      </span>
                      <span className="text-xs font-bold text-slate-800 line-clamp-1">{stop.name}</span>
                    </div>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${cfg.bgColor} ${cfg.textColor}`}>
                      {cfg.label}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500 mb-2">
                    Distance: <strong>{stop.distance_km} km</strong> • {stop.estimated_cost === 0 ? <strong className="text-emerald-600">FREE</strong> : `₹${stop.estimated_cost}`}
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {stop.covers_medicines.map((mId) => {
                      const med = medicines.find((m) => m.id === mId);
                      return (
                        <span key={mId} className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 font-medium border border-emerald-200">
                          ✓ {med ? med.name.split(' ')[0] : mId}
                        </span>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 5. Main Split View: Map (Left/Right) + Facility List + Slide-out Stock Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start relative">
        {/* Left Column: Result Cards List (5 Cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="flex items-center justify-between text-xs text-slate-500 px-1">
            <span>
              Found <strong>{searchResults.length} places</strong> within {radiusKm} km
            </span>
            <span className="text-[11px]">Click a card to inspect inventory</span>
          </div>

          {loading ? (
            <div className="bg-white rounded-2xl p-8 border border-slate-200 text-center">
              <div className="w-8 h-8 border-3 border-teal-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <div className="text-xs font-semibold text-slate-700">Searching 79 health facilities...</div>
              <div className="text-[11px] text-slate-400 mt-1">Applying Haversine geodesic ranking & inventory buffers</div>
            </div>
          ) : searchResults.length === 0 ? (
            <div className="bg-white rounded-2xl p-8 border border-slate-200 text-center">
              <AlertCircle className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <h4 className="text-sm font-bold text-slate-700">No Facilities Match Your Criteria</h4>
              <p className="text-xs text-slate-500 mt-1">
                Try widening your search radius slider, enabling private pharmacies, or unchecking "In Stock Only".
              </p>
            </div>
          ) : (
            <div className="space-y-3 max-h-[720px] overflow-y-auto pr-1">
              {searchResults.map((item) => {
                const cfg = SOURCE_TYPE_CONFIG[item.source_type] || SOURCE_TYPE_CONFIG.private_pharmacy;
                const isSelected = selectedSourceId === item.source_id;
                const isOutOfStock = item.quantity_status === 'out_of_stock';
                const isLowStock = item.quantity_status === 'low_stock';

                return (
                  <div
                    key={item.source_id}
                    onClick={() => setSelectedSourceId(item.source_id)}
                    className={`bg-white rounded-xl p-4 border transition-all cursor-pointer relative ${
                      isSelected
                        ? 'border-teal-500 ring-2 ring-teal-500/20 shadow-md bg-teal-50/20'
                        : 'border-slate-200/80 hover:border-slate-300 hover:shadow-sm'
                    }`}
                  >
                    {/* Header Row: Type badge, Name, Distance */}
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${cfg.bgColor} ${cfg.textColor} ${cfg.borderColor}`}>
                          {cfg.symbol} {cfg.label}
                        </span>
                        {item.is_free && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded font-bold bg-emerald-100 text-emerald-800">
                            FREE
                          </span>
                        )}
                        {item.is_open ? (
                          <span className="text-[10px] text-emerald-600 font-semibold flex items-center gap-0.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Open
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-400 font-medium">Closed</span>
                        )}
                      </div>
                      <span className="text-xs font-bold text-slate-700 shrink-0">
                        {item.distance_km} km
                      </span>
                    </div>

                    <h4 className="text-sm font-bold text-slate-900 line-clamp-1 mb-1">
                      {item.name}
                    </h4>

                    {/* Searched Medicine Status Row */}
                    <div className="bg-slate-50 rounded-lg p-2.5 my-2 flex items-center justify-between text-xs border border-slate-100">
                      <div>
                        <div className="text-[11px] text-slate-500 font-medium">
                          {item.medicine_name}
                        </div>
                        <div className="font-extrabold text-slate-900 text-xs">
                          {item.quantity !== null ? (
                            <span>{item.quantity} in stock</span>
                          ) : isOutOfStock ? (
                            <span className="text-rose-600">Out of Stock</span>
                          ) : isLowStock ? (
                            <span className="text-amber-600">Low Stock</span>
                          ) : (
                            <span className="text-emerald-700">Available</span>
                          )}
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="text-[11px] text-slate-400">Price</div>
                        <div className="font-extrabold text-xs">
                          {item.is_free ? (
                            <span className="text-emerald-600 font-bold">₹0 (Free Govt)</span>
                          ) : (
                            <span className="text-slate-900 font-bold">₹{item.price_per_unit?.toFixed(2)}</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Score Reason Badges */}
                    <div className="flex flex-wrap gap-1 mt-2">
                      {item.score_reasons.slice(0, 3).map((r, i) => (
                        <span
                          key={i}
                          className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                            r.includes('Free') || r.includes('Ample') || r.includes('close')
                              ? 'bg-emerald-50 text-emerald-700'
                              : r.includes('Warning') || r.includes('Caution')
                              ? 'bg-amber-50 text-amber-700'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {r}
                        </span>
                      ))}
                    </div>

                    {/* Bottom Metadata & Contact Button */}
                    <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3 text-slate-400" /> {item.opening_hours}
                      </span>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleShareSource(item);
                          }}
                          className="text-slate-400 hover:text-slate-600 p-1"
                          title="Share details"
                        >
                          <Share2 className="w-3.5 h-3.5" />
                        </button>
                        <a
                          href={`tel:${item.phone}`}
                          onClick={(e) => e.stopPropagation()}
                          className="font-semibold text-teal-600 hover:text-teal-800 flex items-center gap-1"
                        >
                          <Phone className="w-3 h-3" /> Call
                        </a>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Column: Interactive Leaflet Map (7 Cols) */}
        <div className="lg:col-span-7 sticky top-6">
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm relative">
            {/* Map Legend Overlay */}
            <div className="absolute top-3 left-3 z-[1000] bg-white/95 backdrop-blur-xs p-2.5 rounded-xl border border-slate-200 shadow-md text-xs max-w-xs">
              <div className="font-bold text-slate-800 mb-1 flex items-center justify-between">
                <span>Facility Legend</span>
                <span className="text-[10px] text-slate-400">{searchResults.length} pins</span>
              </div>
              <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[10px] text-slate-600">
                <div className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-teal-600" /> PHC (Govt Free)
                </div>
                <div className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-600" /> Sub-Centre (HWC)
                </div>
                <div className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-600" /> CHC / Hospital
                </div>
                <div className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-purple-600" /> Jan Aushadhi (Low-Cost)
                </div>
                <div className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-orange-600" /> Private Pharmacy
                </div>
                <div className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-slate-600" /> Warehouse (Staff Only)
                </div>
              </div>
            </div>

            {/* Leaflet Map Canvas */}
            <div className="h-[680px] w-full">
              <MapContainer
                center={mapCenter}
                zoom={11}
                scrollWheelZoom={true}
                className="h-full w-full"
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />

                <MapRecenter center={mapCenter} />

                {/* Search Radius Buffer Circle */}
                {userCoords && (
                  <Circle
                    center={userCoords}
                    radius={radiusKm * 1000}
                    pathOptions={{
                      color: '#0d9488',
                      fillColor: '#0d9488',
                      fillOpacity: 0.06,
                      weight: 1.5,
                      dashArray: '4, 4',
                    }}
                  />
                )}

                {/* Anchor Pin */}
                {userCoords && (
                  <Marker
                    position={userCoords}
                    icon={L.divIcon({
                      className: 'anchor-pin',
                      html: `
                        <div style="background-color: #0f172a; width: 34px; height: 34px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; border: 3px solid white; box-shadow: 0 4px 8px rgba(0,0,0,0.4);">
                          📍
                        </div>
                      `,
                      iconSize: [34, 34],
                      iconAnchor: [17, 17],
                    })}
                  >
                    <Popup>
                      <div className="p-1 text-xs">
                        <strong>Search Origin</strong>
                        <div className="text-[11px] text-slate-500">
                          {anchorType === 'gps' ? 'Current Device GPS Location' : `PHC Anchor (${selectedPhcId})`}
                        </div>
                      </div>
                    </Popup>
                  </Marker>
                )}

                {/* Facility Markers */}
                {searchResults.map((item) => {
                  const isSelected = selectedSourceId === item.source_id;
                  const icon = createSourceMarkerIcon(item.source_type, isSelected, item.quantity_status);

                  return (
                    <Marker
                      key={item.source_id}
                      position={[item.latitude, item.longitude]}
                      icon={icon}
                      eventHandlers={{
                        click: () => {
                          setSelectedSourceId(item.source_id);
                        },
                      }}
                    >
                      <Popup>
                        <div className="p-2 min-w-[200px] text-xs font-sans">
                          <div className="text-[10px] font-bold uppercase text-teal-700 mb-0.5">
                            {item.source_type.replace('_', ' ')}
                          </div>
                          <div className="font-bold text-slate-900 text-sm mb-1">{item.name}</div>
                          <div className="text-slate-500 text-[11px] mb-2">
                            Distance: <strong>{item.distance_km} km</strong> • {item.is_free ? 'Free Govt' : `₹${item.price_per_unit || 0}`}
                          </div>

                          <div className="bg-slate-50 p-2 rounded-lg border border-slate-200 mb-2">
                            <div className="font-semibold text-slate-800">{item.medicine_name}</div>
                            <div className="text-emerald-700 font-bold">
                              {item.quantity !== null ? `${item.quantity} available` : item.quantity_status.replace('_', ' ').toUpperCase()}
                            </div>
                          </div>

                          <button
                            onClick={() => setSelectedSourceId(item.source_id)}
                            className="w-full py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-semibold text-center transition-colors"
                          >
                            View Full Facility Stock
                          </button>
                        </div>
                      </Popup>
                    </Marker>
                  );
                })}
              </MapContainer>
            </div>
          </div>
        </div>
      </div>

      {/* 6. Slide-out Stock Side Panel (Drawer on Desktop, Bottom Sheet on Mobile) */}
      {selectedSourceId && (
        <div className="fixed inset-y-0 right-0 w-full sm:w-[480px] bg-white shadow-2xl z-[2000] border-l border-slate-200 flex flex-col transition-all duration-300">
          {/* Panel Header */}
          <div className="p-5 border-b border-slate-200 bg-slate-900 text-white relative">
            <button
              onClick={() => setSelectedSourceId(null)}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            {sourceStockData ? (
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-teal-500/20 text-teal-300 border border-teal-500/30 font-semibold uppercase">
                    {sourceStockData.source.source_type.replace('_', ' ')}
                  </span>
                  {sourceStockData.source.is_24x7 ? (
                    <span className="text-[10px] bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded-full font-semibold">
                      24x7 Open
                    </span>
                  ) : null}
                  {sourceStockData.source.is_verified && (
                    <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full flex items-center gap-1 font-semibold">
                      <ShieldCheck className="w-3 h-3" /> Verified
                    </span>
                  )}
                </div>

                <h3 className="text-lg font-bold text-white pr-6">{sourceStockData.source.name}</h3>
                <p className="text-xs text-slate-300 mt-1 flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span className="line-clamp-1">{sourceStockData.source.address}</span>
                </p>

                <div className="flex items-center gap-4 mt-3 text-xs text-slate-300">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-teal-400" /> {sourceStockData.source.opening_hours}
                  </span>
                  <a
                    href={`tel:${sourceStockData.source.phone}`}
                    className="flex items-center gap-1 text-teal-300 hover:underline font-semibold"
                  >
                    <Phone className="w-3.5 h-3.5" /> {sourceStockData.source.phone}
                  </a>
                </div>
              </div>
            ) : (
              <div className="animate-pulse h-16 bg-slate-800 rounded-lg" />
            )}
          </div>

          {/* Panel Body: Pinned Searched Medicine + Inventory Filters + Table */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {loadingStockPanel ? (
              <div className="text-center py-12">
                <div className="w-8 h-8 border-3 border-teal-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                <div className="text-xs text-slate-500">Loading facility formulary items...</div>
              </div>
            ) : sourceStockData ? (
              <>
                {/* Official Disclaimer Banner */}
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs flex items-start gap-2">
                  <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <strong>Patient Note:</strong> Stock is self-reported by facility records and fluctuates rapidly. Please call <a href={`tel:${sourceStockData.source.phone}`} className="underline font-bold">{sourceStockData.source.phone}</a> to verify before travelling.
                  </div>
                </div>

                {/* Pinned Primary Searched Medicine Card */}
                {(() => {
                  const pinnedItem = sourceStockData.items.find((it) => it.medicine_id === selectedMedIds[0]);
                  if (!pinnedItem) return null;
                  return (
                    <div className="bg-gradient-to-br from-teal-50 to-emerald-50 border-2 border-teal-500/40 rounded-xl p-4 shadow-xs">
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="text-[10px] font-extrabold uppercase tracking-wider text-teal-800 bg-teal-200/60 px-2 py-0.5 rounded">
                          Searched Medicine
                        </span>
                        <span className="font-bold text-slate-900">
                          {pinnedItem.is_free ? '₹0 (Free Govt Formulary)' : `₹${pinnedItem.price_per_unit?.toFixed(2)} / unit`}
                        </span>
                      </div>

                      <h4 className="text-sm font-bold text-slate-900">{pinnedItem.medicine_name}</h4>
                      <div className="text-xs text-slate-600 mt-0.5">
                        {pinnedItem.generic_name} • {pinnedItem.strength} ({pinnedItem.form})
                      </div>

                      <div className="mt-3 pt-2 border-t border-teal-200/60 flex items-center justify-between text-xs">
                        <div>
                          <span className="text-slate-500 text-[11px]">Availability: </span>
                          <strong className={pinnedItem.quantity_status === 'out_of_stock' ? 'text-rose-600' : 'text-emerald-700'}>
                            {pinnedItem.quantity !== null ? `${pinnedItem.quantity} units` : pinnedItem.quantity_status.replace('_', ' ').toUpperCase()}
                          </strong>
                        </div>
                        <div className="text-[11px] text-slate-500">
                          Batch: {pinnedItem.batch_no || 'Standard'}
                        </div>
                      </div>

                      {/* Staff Inter-PHC Transfer Trigger */}
                      {currentUser.role !== 'public' && sourceStockData.source.source_type === 'phc' && pinnedItem.quantity_status !== 'out_of_stock' && (
                        <button
                          onClick={() => {
                            setShowTransferSuccess(`Inter-PHC transfer requisition drafted from ${sourceStockData.source.name} for ${pinnedItem.medicine_name}.`);
                          }}
                          className="mt-3 w-full py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors shadow-xs"
                        >
                          <ArrowRight className="w-3.5 h-3.5" />
                          <span>Initiate Inter-PHC Stock Transfer</span>
                        </button>
                      )}
                    </div>
                  );
                })()}

                {/* Transfer Success Banner */}
                {showTransferSuccess && (
                  <div className="p-3 bg-emerald-50 border border-emerald-300 text-emerald-800 rounded-xl text-xs flex items-center justify-between">
                    <span>{showTransferSuccess}</span>
                    <button onClick={() => setShowTransferSuccess(null)} className="text-emerald-700 font-bold ml-2">
                      ✕
                    </button>
                  </div>
                )}

                {/* Inventory Search & Filters */}
                <div className="space-y-2 pt-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                      Complete Facility Inventory ({sourceStockData.total_items})
                    </h4>
                    <label className="text-[11px] text-slate-600 flex items-center gap-1 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={stockInStockOnly}
                        onChange={(e) => setStockInStockOnly(e.target.checked)}
                        className="accent-teal-600 rounded"
                      />
                      <span>In Stock Only</span>
                    </label>
                  </div>

                  <input
                    type="text"
                    value={stockPanelFilter}
                    onChange={(e) => setStockPanelFilter(e.target.value)}
                    placeholder="Filter facility stock by medicine name..."
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:ring-1 focus:ring-teal-500"
                  />
                </div>

                {/* Inventory Table List */}
                <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden bg-white">
                  {sourceStockData.items
                    .filter((it) => {
                      if (stockInStockOnly && it.quantity_status === 'out_of_stock') return false;
                      if (!stockPanelFilter.trim()) return true;
                      const q = stockPanelFilter.toLowerCase();
                      return (
                        it.medicine_name.toLowerCase().includes(q) ||
                        it.generic_name.toLowerCase().includes(q)
                      );
                    })
                    .map((item) => (
                      <div key={item.id} className="p-3 hover:bg-slate-50 text-xs transition-colors">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="font-bold text-slate-900">{item.medicine_name}</div>
                            <div className="text-[11px] text-slate-500">
                              {item.generic_name} • {item.strength} ({item.form})
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <span className="font-extrabold text-slate-900 block">
                              {item.is_free ? <span className="text-emerald-700">FREE</span> : `₹${item.price_per_unit?.toFixed(2)}`}
                            </span>
                            <span
                              className={`text-[10px] font-bold ${
                                item.quantity_status === 'out_of_stock'
                                  ? 'text-rose-600'
                                  : item.quantity_status === 'low_stock'
                                  ? 'text-amber-600'
                                  : 'text-emerald-600'
                              }`}
                            >
                              {item.quantity !== null ? `${item.quantity} in stock` : item.quantity_status.replace('_', ' ').toUpperCase()}
                            </span>
                          </div>
                        </div>

                        {/* Badges: Cold Chain, Critical, Expiry, Staleness */}
                        <div className="mt-1.5 flex items-center gap-1.5 flex-wrap text-[10px]">
                          {item.is_cold_chain && (
                            <span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 font-semibold border border-blue-200">
                              ❄️ Cold-chain (2-8°C)
                            </span>
                          )}
                          {item.is_near_expiry && (
                            <span className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 font-semibold border border-amber-200">
                              ⚠️ Near Expiry
                            </span>
                          )}
                          {item.is_stale && (
                            <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                              🕒 Stale Data
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                </div>
              </>
            ) : null}
          </div>

          {/* Panel Footer */}
          {sourceStockData && (
            <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between gap-3 text-xs">
              <a
                href={`https://www.google.com/maps/dir/?api=1&destination=${sourceStockData.source.latitude},${sourceStockData.source.longitude}`}
                target="_blank"
                rel="noreferrer"
                className="flex-1 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-center font-semibold flex items-center justify-center gap-1.5 transition-colors"
              >
                <Navigation className="w-3.5 h-3.5" />
                <span>Get Driving Directions</span>
              </a>

              <a
                href={`tel:${sourceStockData.source.phone}`}
                className="py-2.5 px-4 bg-teal-600 hover:bg-teal-700 text-white rounded-xl font-semibold flex items-center justify-center gap-1.5 transition-colors"
              >
                <Phone className="w-3.5 h-3.5" />
                <span>Call Facility</span>
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
