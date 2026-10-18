import api from './api.js';

// Real backend calls — server/controllers/scanController.js and
// dashboardController.js. No mock data or client-side fabrication here;
// an empty/zero response from the API is passed straight through.

export async function fetchScans({ page = 1, limit = 10, status } = {}) {
  const { data } = await api.get('/scans', { params: { page, limit, status } });
  return data;
}

export async function fetchScanById(id) {
  const { data } = await api.get(`/scans/${id}`);
  return data.scan;
}

export async function fetchDashboardStats() {
  const { data } = await api.get('/dashboard/stats');
  return data;
}
