import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { 
  Activity, 
  Package, 
  MapPin, 
  ArrowLeftRight, 
  BrainCircuit, 
  MessageSquare, 
  FileText, 
  Globe, 
  Bell, 
  Wifi, 
  WifiOff, 
  ShieldCheck, 
  UserCheck, 
  CheckCircle2, 
  AlertTriangle,
  X,
  Languages,
  PlusCircle,
  Layers,
  Building2
} from 'lucide-react';

export default function Navbar() {
  const { currentUser, switchRole, PRESET_USERS, lang, toggleLanguage, t, isOnline, offlineQueue } = useAuth();
  const location = useLocation();
  const [notifications, setNotifications] = useState([]);
  const [showNotifDrawer, setShowNotifDrawer] = useState(false);
  const [showRoleModal, setShowRoleModal] = useState(false);

  useEffect(() => {
    loadNotifications();
    const interval = setInterval(loadNotifications, 20000);
    return () => clearInterval(interval);
  }, []);

  const loadNotifications = async () => {
    try {
      const data = await api.getNotifications();
      if (data && data.notifications) {
        setNotifications(data.notifications.slice(0, 10));
      }
    } catch (e) {
      // offline or server busy
    }
  };

  const navItems = [
    { path: '/', label: t('nav_dashboard'), icon: Activity },
    { path: '/inventory', label: t('nav_inventory'), icon: Package },
    { path: '/entry', label: t('nav_entry'), icon: PlusCircle },
    { path: '/nearby', label: t('nav_multi_map') || 'Stock Map & Finder', icon: MapPin },
    { path: '/transfers', label: t('nav_transfers'), icon: ArrowLeftRight },
    { path: '/source-manager', label: t('nav_source_manager') || 'Stock Manager', icon: Layers },
    { path: '/source-admin', label: t('nav_source_admin') || 'Facility Admin', icon: Building2 },
    { path: '/ai', label: t('nav_ai'), icon: BrainCircuit },
    { path: '/chat', label: t('nav_chat'), icon: MessageSquare },
    { path: '/reports', label: t('nav_reports'), icon: FileText },
    { path: '/public', label: t('nav_public'), icon: Globe }
  ];

  return (
    <header className="sticky top-0 z-50 bg-white border-b border-slate-200 shadow-xs">
      {/* Top Banner: Tamil Nadu Health Department & Role Switcher */}
      <div className="bg-emerald-800 text-white text-xs px-4 py-1.5 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="font-semibold tracking-wide">தமிழ்நாடு அரசு • GOVT OF TAMIL NADU</span>
          <span className="text-emerald-300">|</span>
          <span className="text-emerald-100 hidden sm:inline">Department of Public Health & Preventive Medicine</span>
          <span className="text-emerald-300">|</span>
          <span className="bg-emerald-900/80 px-2 py-0.5 rounded text-[11px] font-medium text-emerald-200">
            {currentUser.district_name || 'Chengalpattu District'}
          </span>
        </div>

        {/* Quick Role Switcher Bar */}
        <div className="flex items-center gap-2 ml-auto">
          {/* Offline/Online Indicator */}
          <div className="flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-900/60 text-[11px]">
            {isOnline ? (
              <>
                <Wifi className="w-3 h-3 text-emerald-300" />
                <span className="text-emerald-200 hidden md:inline">Online</span>
              </>
            ) : (
              <>
                <WifiOff className="w-3 h-3 text-amber-300" />
                <span className="text-amber-200 font-medium">Offline ({offlineQueue.length})</span>
              </>
            )}
          </div>

          {/* Language Switcher */}
          <button
            onClick={toggleLanguage}
            className="flex items-center gap-1 px-2.5 py-0.5 rounded bg-white/10 hover:bg-white/20 transition-colors font-medium text-white cursor-pointer"
            title="Toggle Language / மொழி மாற்றம்"
          >
            <Languages className="w-3 h-3 text-emerald-200" />
            <span>{t('switch_language')}</span>
          </button>

          {/* Role selector button */}
          <button
            onClick={() => setShowRoleModal(true)}
            className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-600 text-slate-900 font-semibold px-2.5 py-0.5 rounded transition-all cursor-pointer shadow-xs"
          >
            <UserCheck className="w-3 h-3" />
            <span>Role: {currentUser.role.replace(/_/g, ' ').toUpperCase()}</span>
          </button>
        </div>
      </div>

      {/* Main Navbar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand Logo */}
          <Link to="/" className="flex items-center gap-3 group">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-600 to-teal-700 flex items-center justify-center text-white shadow-md shadow-emerald-600/20 group-hover:scale-105 transition-transform">
              <Package className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-xl text-slate-900 tracking-tight">MediSync <span className="text-emerald-600">PHC</span></span>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-300">TN-PHC</span>
              </div>
              <p className="text-[11px] text-slate-500 font-medium -mt-1 hidden sm:block">
                {currentUser.phc_name ? currentUser.phc_name : `${currentUser.district_name || 'District'} Central`}
              </p>
            </div>
          </Link>

          {/* Navigation Links */}
          <nav className="hidden lg:flex items-center space-x-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                    isActive
                      ? 'bg-emerald-50 text-emerald-700 font-semibold border border-emerald-200/80'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-emerald-600' : 'text-slate-400'}`} />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {/* Right Action Icons: Notification Bell & User Pill */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowNotifDrawer(!showNotifDrawer)}
              className="relative p-2 rounded-lg text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
              title="SMS/WhatsApp Dispatch Feed"
            >
              <Bell className="w-5 h-5" />
              {notifications.length > 0 && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-rose-500 ring-2 ring-white animate-pulse" />
              )}
            </button>

            <div className="hidden sm:flex flex-col text-right">
              <span className="text-xs font-semibold text-slate-800">{currentUser.full_name}</span>
              <span className="text-[11px] text-emerald-600 font-medium">
                {currentUser.phc_name || currentUser.block_name || 'District Portal'}
              </span>
            </div>
          </div>
        </div>

        {/* Mobile Nav Overflow */}
        <div className="lg:hidden flex overflow-x-auto py-2 border-t border-slate-100 gap-1 scrollbar-none">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs whitespace-nowrap ${
                  isActive
                    ? 'bg-emerald-600 text-white font-medium'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {item.label}
              </Link>
            );
          })}
        </div>
      </div>

      {/* Role Switcher Modal */}
      {showRoleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-600" />
                <h3 className="text-base font-bold text-slate-900">Switch User Persona (Demo Mode)</h3>
              </div>
              <button onClick={() => setShowRoleModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-500 my-3">
              Test MediSync PHC across different administrative tiers and workflows:
            </p>

            <div className="space-y-2 max-h-96 overflow-y-auto">
              <button
                onClick={() => { switchRole('pharmacist'); setShowRoleModal(false); }}
                className={`w-full text-left p-3 rounded-xl border transition-all cursor-pointer ${
                  currentUser.role === 'pharmacist' && currentUser.phc_id === 'phc_cpt_01'
                    ? 'border-emerald-600 bg-emerald-50/50 ring-1 ring-emerald-600'
                    : 'border-slate-200 hover:border-emerald-400 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-xs text-slate-900">Pharmacist (PHC Alapakkam)</span>
                  <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.5 rounded">Shortage PHC</span>
                </div>
                <p className="text-[11px] text-slate-500 mt-1">Updates daily stock, manages critical stockouts (Paracetamol 0 stock), initiates transfers.</p>
              </button>

              <button
                onClick={() => { switchRole('medical_officer'); setShowRoleModal(false); }}
                className={`w-full text-left p-3 rounded-xl border transition-all cursor-pointer ${
                  currentUser.role === 'medical_officer'
                    ? 'border-emerald-600 bg-emerald-50/50 ring-1 ring-emerald-600'
                    : 'border-slate-200 hover:border-emerald-400 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-xs text-slate-900">Medical Officer (PHC Alapakkam)</span>
                  <span className="text-[10px] bg-blue-100 text-blue-800 font-bold px-1.5 py-0.5 rounded">Approver</span>
                </div>
                <p className="text-[11px] text-slate-500 mt-1">Authorizes transfers, signs emergency indents to warehouse, verifies cold-chain protocols.</p>
              </button>

              <button
                onClick={() => { switchRole('pharmacist_donor'); setShowRoleModal(false); }}
                className={`w-full text-left p-3 rounded-xl border transition-all cursor-pointer ${
                  currentUser.role === 'pharmacist' && currentUser.phc_id === 'phc_cpt_02'
                    ? 'border-emerald-600 bg-emerald-50/50 ring-1 ring-emerald-600'
                    : 'border-slate-200 hover:border-emerald-400 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-xs text-slate-900">Pharmacist (PHC Melamaiyur)</span>
                  <span className="text-[10px] bg-purple-100 text-purple-800 font-bold px-1.5 py-0.5 rounded">Surplus Donor (2.9 km)</span>
                </div>
                <p className="text-[11px] text-slate-500 mt-1">Holds surplus stock of Paracetamol & Amoxicillin; dispatches stock to nearby centres.</p>
              </button>

              <button
                onClick={() => { switchRole('block_medical_officer'); setShowRoleModal(false); }}
                className={`w-full text-left p-3 rounded-xl border transition-all cursor-pointer ${
                  currentUser.role === 'block_medical_officer'
                    ? 'border-emerald-600 bg-emerald-50/50 ring-1 ring-emerald-600'
                    : 'border-slate-200 hover:border-emerald-400 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-xs text-slate-900">Block Medical Officer (Chengalpattu Block)</span>
                  <span className="text-[10px] bg-amber-100 text-amber-800 font-bold px-1.5 py-0.5 rounded">Block Level (5 PHCs)</span>
                </div>
                <p className="text-[11px] text-slate-500 mt-1">Monitors entire block health grid, approves cross-PHC balancing, views risk maps.</p>
              </button>

              <button
                onClick={() => { switchRole('district_admin'); setShowRoleModal(false); }}
                className={`w-full text-left p-3 rounded-xl border transition-all cursor-pointer ${
                  currentUser.role === 'district_admin'
                    ? 'border-emerald-600 bg-emerald-50/50 ring-1 ring-emerald-600'
                    : 'border-slate-200 hover:border-emerald-400 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-xs text-slate-900">District Admin (DDHS Chengalpattu)</span>
                  <span className="text-[10px] bg-rose-100 text-rose-800 font-bold px-1.5 py-0.5 rounded">District Level (15 PHCs)</span>
                </div>
                <p className="text-[11px] text-slate-500 mt-1">Oversees all 3 blocks, manages medicine master list, runs automated redistribution engine.</p>
              </button>

              <button
                onClick={() => { switchRole('public'); setShowRoleModal(false); }}
                className={`w-full text-left p-3 rounded-xl border transition-all cursor-pointer ${
                  currentUser.role === 'public'
                    ? 'border-emerald-600 bg-emerald-50/50 ring-1 ring-emerald-600'
                    : 'border-slate-200 hover:border-emerald-400 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-xs text-slate-900">Public Citizen Portal (No Login)</span>
                  <span className="text-[10px] bg-slate-100 text-slate-800 font-bold px-1.5 py-0.5 rounded">Public View</span>
                </div>
                <p className="text-[11px] text-slate-500 mt-1">Public access: check medicine availability without internal staff data.</p>
              </button>

              <button
                onClick={() => { switchRole('source_manager_apollo'); setShowRoleModal(false); }}
                className={`w-full text-left p-3 rounded-xl border transition-all cursor-pointer ${
                  currentUser.role === 'source_manager' && currentUser.source_id === 'src_pharm_01'
                    ? 'border-emerald-600 bg-emerald-50/50 ring-1 ring-emerald-600'
                    : 'border-slate-200 hover:border-emerald-400 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-xs text-slate-900">Source Manager (Apollo Pharmacy)</span>
                  <span className="text-[10px] bg-orange-100 text-orange-800 font-bold px-1.5 py-0.5 rounded">Private Retail</span>
                </div>
                <p className="text-[11px] text-slate-500 mt-1">Manage private retail pharmacy inventory, upload POS CSVs, update retail prices.</p>
              </button>

              <button
                onClick={() => { switchRole('source_manager_ja'); setShowRoleModal(false); }}
                className={`w-full text-left p-3 rounded-xl border transition-all cursor-pointer ${
                  currentUser.role === 'source_manager' && currentUser.source_id === 'src_ja_01'
                    ? 'border-emerald-600 bg-emerald-50/50 ring-1 ring-emerald-600'
                    : 'border-slate-200 hover:border-emerald-400 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-xs text-slate-900">Source Manager (Jan Aushadhi Kendra)</span>
                  <span className="text-[10px] bg-purple-100 text-purple-800 font-bold px-1.5 py-0.5 rounded">Cooperative Generic</span>
                </div>
                <p className="text-[11px] text-slate-500 mt-1">Manage cooperative low-cost generic medicine stock and expiry tracking.</p>
              </button>
            </div>
          </div>
        </div>
      )}


      {/* Notifications Drawer (Pluggable Mock SMS & WhatsApp Feed) */}
      {showNotifDrawer && (
        <div className="fixed inset-y-0 right-0 z-50 w-full max-w-sm bg-white shadow-2xl border-l border-slate-200 flex flex-col">
          <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
            <div>
              <h3 className="font-bold text-sm flex items-center gap-2">
                <Bell className="w-4 h-4 text-emerald-400" />
                SMS / WhatsApp Dispatches
              </h3>
              <p className="text-[11px] text-slate-400">Live mock telecom notification logs</p>
            </div>
            <button onClick={() => setShowNotifDrawer(false)} className="text-slate-400 hover:text-white">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {notifications.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-8">No notifications dispatched yet.</p>
            ) : (
              notifications.map((n) => (
                <div key={n.id} className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                      n.channel === 'WHATSAPP' ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800'
                    }`}>
                      {n.channel}
                    </span>
                    <span className="text-[10px] text-slate-400">
                      {new Date(n.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <div className="text-[11px] font-semibold text-slate-700 mb-1">
                    To: {n.recipient_phone} ({n.recipient_role})
                  </div>
                  <p className="text-slate-600 whitespace-pre-line text-[11px] leading-relaxed bg-white p-2 rounded border border-slate-100">
                    {n.message}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </header>
  );
}
