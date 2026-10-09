import axios from 'axios';

// Configurable API base URL: defaults to /api in local dev (handled by Vite proxy),
// and uses VITE_API_BASE_URL (e.g. https://meil-esg-backend.onrender.com/api) in production.
const rawBase = import.meta.env.VITE_API_BASE_URL || '/api';
const API_BASE = rawBase.replace(/\/+$/, '');

const api = axios.create({
  baseURL: API_BASE,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('meil_auth_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  // Prevent duplicate /api if baseURL already includes /api and request URL starts with /api/
  if (config.baseURL?.endsWith('/api') && config.url?.startsWith('/api/')) {
    config.url = config.url.replace(/^\/api/, '');
  }
  return config;
});

export const authAPI = {
  login: (email, password) => api.post('/auth/login', { email, password }),
  getMe: () => api.get('/auth/me'),
  getUsers: () => api.get('/auth/users'),
};

export const entityAPI = {
  getAll: () => api.get('/entities'),
  getById: (id) => api.get(`/entities/${id}`),
};

export const factorAPI = {
  getAll: (params) => api.get('/factors', { params }),
  getById: (id) => api.get(`/factors/${id}`),
};

export const metricAPI = {
  preview: (data) => api.post('/metrics/preview', data),
  getAll: (params) => api.get('/metrics', { params }),
  getById: (id) => api.get(`/metrics/${id}`),
  create: (formData) => api.post('/metrics', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  uploadEvidence: (id, formData) => api.post(`/metrics/${id}/evidence`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
};

export const verificationAPI = {
  getPending: () => api.get('/verifications/pending'),
  review: (id, reviewData) => api.post(`/verifications/${id}/review`, reviewData),
};

export const evidenceAPI = {
  download: (filename) => api.get(`/evidence/${filename}`, { responseType: 'blob' }),
};

export const reportAPI = {
  getBRSRSectionC: (params) => api.get('/reports/brsr-section-c', { params }),
  getScope3Roadmap: () => api.get('/reports/scope3-roadmap'),
  downloadBRSRPdf: (params) => api.get('/reports/brsr-pdf', { params, responseType: 'blob' }),
};

export const disclosureAPI = {
  getAll: (params) => api.get('/disclosures', { params }),
  getById: (id) => api.get(`/disclosures/${id}`),
  importOlectra: () => api.post('/disclosures/import-olectra'),
};

export const demoAPI = {
  getEntries: (params) => api.get('/demo/entries', { params }),
  getEntryById: (id) => api.get(`/demo/entries/${id}`),
  getSummary: () => api.get('/demo/summary'),
  submit: (formData) => api.post('/demo/submit', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  resubmit: (id, formData) => api.put(`/demo/entries/${id}/resubmit`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  buReview: (id, reviewData) => api.post(`/demo/entries/${id}/bu-review`, reviewData),
  auditorReview: (id, reviewData) => api.post(`/demo/entries/${id}/auditor-review`, reviewData),
  corporateSignoff: (id, reviewData) => api.post(`/demo/entries/${id}/corporate-signoff`, reviewData),
  resetWorkspace: () => api.post('/demo/reset'),
};

export default api;
