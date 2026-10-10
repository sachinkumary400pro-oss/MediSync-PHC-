import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Navbar from './components/Navbar';
import DashboardPage from './pages/DashboardPage';
import InventoryPage from './pages/InventoryPage';
import StockEntryPage from './pages/StockEntryPage';
import NearbyFinderPage from './pages/NearbyFinderPage';
import MultiSourceFinderPage from './pages/MultiSourceFinderPage';
import SourceManagerPage from './pages/SourceManagerPage';
import SourceAdminPage from './pages/SourceAdminPage';
import TransfersPage from './pages/TransfersPage';
import AiForecastPage from './pages/AiForecastPage';
import StaffChatbotPage from './pages/StaffChatbotPage';
import ReportsPage from './pages/ReportsPage';
import PublicCheckerPage from './pages/PublicCheckerPage';

function AppShell() {
  const { authReady } = useAuth();

  if (!authReady) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-500 font-sans">
        <div className="text-center">
          <div className="text-lg font-semibold text-slate-700">MediSync PHC</div>
          <div className="text-sm mt-1">Authenticating session…</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col text-slate-900 font-sans">
      <Navbar />
          <main className="flex-1 pb-16">
            <Routes>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/inventory" element={<InventoryPage />} />
              <Route path="/entry" element={<StockEntryPage />} />
              <Route path="/nearby" element={<MultiSourceFinderPage />} />
              <Route path="/map" element={<MultiSourceFinderPage />} />
              <Route path="/source-manager" element={<SourceManagerPage />} />
              <Route path="/source-admin" element={<SourceAdminPage />} />
              <Route path="/transfers" element={<TransfersPage />} />
              <Route path="/ai" element={<AiForecastPage />} />
              <Route path="/chat" element={<StaffChatbotPage />} />
              <Route path="/reports" element={<ReportsPage />} />
              <Route path="/public" element={<PublicCheckerPage />} />
            </Routes>
          </main>

          {/* Footer */}
          <footer className="bg-white border-t border-slate-200 py-6 text-center text-xs text-slate-500 no-print">
            <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
              <div>
                <strong>MediSync PHC</strong> • Tamil Nadu Primary Health Centre Medicine Stock & Sharing System
              </div>
              <div className="text-[11px] text-slate-400">
                Department of Public Health & Preventive Medicine, Government of Tamil Nadu
              </div>
            </div>
          </footer>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <AppShell />
      </Router>
    </AuthProvider>
  );
}
