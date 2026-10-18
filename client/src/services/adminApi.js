import api from './api.js';

// Thin wrappers over /api/admin/*. Every call carries the admin JWT (api.js
// interceptor); the SERVER enforces admin-only access on all of them.
const unwrap = (p) => p.then((r) => r.data);
export const errorMessage = (err, fallback = 'Something went wrong.') => err?.response?.data?.message || fallback;

export const adminApi = {
  stats: () => unwrap(api.get('/admin/dashboard/stats')),

  medicines: (params) => unwrap(api.get('/admin/medicines', { params })),
  medicineOptions: (q) => unwrap(api.get('/admin/medicines/options', { params: { q } })),
  createMedicine: (body) => unwrap(api.post('/admin/medicines', body)),
  updateMedicine: (id, body) => unwrap(api.put(`/admin/medicines/${id}`, body)),
  deleteMedicine: (id) => unwrap(api.delete(`/admin/medicines/${id}`)),

  references: (params) => unwrap(api.get('/admin/reference-images', { params })),
  uploadReferences: (formData) => unwrap(api.post('/admin/reference-images', formData)),
  updateReference: (id, body) => unwrap(api.put(`/admin/reference-images/${id}`, body)),
  deleteReference: (id) => unwrap(api.delete(`/admin/reference-images/${id}`)),

  batches: (params) => unwrap(api.get('/admin/batches', { params })),
  createBatch: (body) => unwrap(api.post('/admin/batches', body)),
  updateBatch: (id, body) => unwrap(api.put(`/admin/batches/${id}`, body)),
  deleteBatch: (id) => unwrap(api.delete(`/admin/batches/${id}`)),
  checkCode: (value) => unwrap(api.get('/admin/codes/check', { params: { value } })),
  manufacturerQr: () => unwrap(api.get('/admin/manufacturer-qr')),
  createManufacturerQr: (body) => unwrap(api.post('/admin/manufacturer-qr', body)),
  deleteManufacturerQr: (id) => unwrap(api.delete(`/admin/manufacturer-qr/${id}`)),

  verifications: (params) => unwrap(api.get('/admin/verifications', { params })),
  verification: (id) => unwrap(api.get(`/admin/verifications/${id}`)),
  users: (params) => unwrap(api.get('/admin/users', { params })),
  userHistory: (id) => unwrap(api.get(`/admin/users/${id}/history`)),
  setUserActive: (id, isActive) => unwrap(api.patch(`/admin/users/${id}/active`, { isActive })),
  auditLogs: (params) => unwrap(api.get('/admin/audit-logs', { params })),

  riskEngine: () => unwrap(api.get('/admin/risk-engine')),
  saveRiskEngine: (body) => unwrap(api.put('/admin/risk-engine', body)),
  settings: () => unwrap(api.get('/admin/settings')),
  saveSettings: (body) => unwrap(api.put('/admin/settings', body)),
};
