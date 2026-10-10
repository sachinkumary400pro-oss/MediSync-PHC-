/**
 * MediSync PHC - Centralized API Service
 */

const API_BASE = '/api';

async function request(endpoint, options = {}) {
  const token = localStorage.getItem('medisync_token');
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {})
  };

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `HTTP error ${response.status}`);
  }

  return response.json();
}

export const api = {
  // Medicines & PHCs
  getMedicines: (params = '') => request(`/medicines${params ? '?' + params : ''}`),
  getPhcs: (params = '') => request(`/phcs${params ? '?' + params : ''}`),
  getPhcById: (id) => request(`/phcs/${id}`),

  // Stock & Inventory
  getStock: (phcId) => request(`/stock?phc_id=${phcId}`),
  getStockDaysLeft: (phcId) => request(`/stock/days-left?phc_id=${phcId}`),
  getStockHistory: (phcId, medicineId, days = 30) => request(`/stock/history?phc_id=${phcId}&medicine_id=${medicineId}&days=${days}`),
  getBatches: (phcId, medicineId = '') => request(`/stock/batches?phc_id=${phcId}${medicineId ? '&medicine_id=' + medicineId : ''}`),
  postStockEntry: (data) => request('/stock/entry', { method: 'POST', body: JSON.stringify(data) }),

  // Nearby Surplus Finder
  getNearbyStock: (phcId, medicineId, radius = 45) => request(`/nearby-stock?phc_id=${phcId}&medicine_id=${medicineId}&radius=${radius}`),
  postNearbyStockMulti: (phcId, medicineIds, radius = 45) => request('/nearby-stock/multi', {
    method: 'POST',
    body: JSON.stringify({ phc_id: phcId, medicine_ids: medicineIds, radius })
  }),

  // Transfers & Indents
  getTransfers: (params = '') => request(`/transfers${params ? '?' + params : ''}`),
  getTransferSlip: (id) => request(`/transfers/${id}`),
  postTransfer: (data) => request('/transfers', { method: 'POST', body: JSON.stringify(data) }),
  patchTransferStatus: (id, status) => request(`/transfers/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status })
  }),
  getIndents: (params = '') => request(`/indents${params ? '?' + params : ''}`),
  postIndent: (data) => request('/indents', { method: 'POST', body: JSON.stringify(data) }),
  postAutoDraftIndent: (phcId) => request('/indents/auto-draft', {
    method: 'POST',
    body: JSON.stringify({ phc_id: phcId })
  }),
  patchIndentStatus: (id, status) => request(`/indents/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status })
  }),

  // Alerts
  getAlerts: (params = '') => request(`/alerts${params ? '?' + params : ''}`),
  patchAlertStatus: (id, status) => request(`/alerts/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ status })
  }),

  // AI & Analytics
  getForecast: (phcId, medicineId) => request(`/ai/forecast/${phcId}/${medicineId}`),
  getAnomalies: (phcId = '') => request(`/ai/anomalies${phcId ? '?phc_id=' + phcId : ''}`),
  getSeasonalProfile: () => request('/ai/seasonal-profile'),
  getRedistributionPlan: (districtId = 'dist_01') => request(`/ai/recommendations/redistribution?district_id=${districtId}`),
  postChatbotQuery: (query, user) => request('/ai/chatbot', {
    method: 'POST',
    body: JSON.stringify({ query, user })
  }),

  // Reports & Logs
  getDistrictOverview: () => request('/reports/district-overview'),
  getNotifications: () => request('/notifications'),

  // Public Portal
  getPublicAvailability: (phcId, medicineId) => request(`/public/availability?phc_id=${phcId}&medicine_id=${medicineId}`),

  // Multi-Source Finder & Map
  searchFinderSources: (params = '') => request(`/finder/search${params ? '?' + params : ''}`),
  searchFinderMulti: (params = '') => request(`/finder/multi${params ? '?' + params : ''}`),
  getMapSources: (params = '') => request(`/map/sources${params ? '?' + params : ''}`),
  getSourceStockList: (sourceId, params = '') => request(`/map/sources/${sourceId}/stock${params ? '?' + params : ''}`),
  suggestAlternatives: (fromSourceId, medicineId, radiusKm = 30) => request(`/finder/suggest?from_source_id=${fromSourceId}&medicine_id=${medicineId}&radius_km=${radiusKm}`),
  updateSourceStock: (sourceId, data) => request(`/finder/sources/${sourceId}/stock`, {
    method: 'POST',
    body: JSON.stringify(data)
  }),
  bulkUpdateSourceStock: (sourceId, data) => request(`/finder/sources/${sourceId}/stock/bulk`, {
    method: 'POST',
    body: JSON.stringify(data)
  }),
  uploadCsvSourceStock: async (sourceId, file) => {
    const token = localStorage.getItem('medisync_token');
    const formData = new FormData();
    formData.append('file', file);
    const response = await fetch(`/api/finder/sources/${sourceId}/stock/csv`, {
      method: 'POST',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: formData
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.detail || err.error || 'Failed to upload CSV');
    }
    return response.json();
  },
  getAdminSources: (params = '') => request(`/finder/admin/sources${params ? '?' + params : ''}`),
  createAdminSource: (data) => request('/finder/admin/sources', {
    method: 'POST',
    body: JSON.stringify(data)
  }),
  patchAdminSource: (sourceId, data) => request(`/finder/admin/sources/${sourceId}`, {
    method: 'PATCH',
    body: JSON.stringify(data)
  })
};

