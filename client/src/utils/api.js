
const API_BASE = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/api`
  : '/api';

function getHeaders() {
  const headers = { 'Content-Type': 'application/json' };
  const token = localStorage.getItem('token');
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const cgToken = localStorage.getItem('caregiverToken');
  if (cgToken) headers['X-Caregiver-Token'] = cgToken;
  return headers;
}

async function request(method, path, body) {
  const opts = { method, headers: getHeaders() };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${API_BASE}${path}`, opts);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

export const api = {
  // Auth
  login: (body) => request('POST', '/auth/login', body),
  register: (body) => request('POST', '/auth/register', body),
  verifyPIN: (pin, patientId = null) => request('POST', '/auth/verify-pin', { pin, patientId }),
  getMe: () => request('GET', '/auth/me'),
  getPatients: () => request('GET', '/auth/patients'),
  linkCaregiver: (caregiverCode) => request('POST', '/auth/link-caregiver', { caregiverCode }),

  // Medicines — patientId is passed for caregiver mode
  getMedicines: (patientId = null) => request('GET', `/medicines${patientId ? `?patientId=${patientId}` : ''}`),
  addMedicine: (body, patientId = null) => request('POST', '/medicines', {
    ...body,
    timezoneOffset: new Date().getTimezoneOffset(),
    ...(patientId ? { patientId } : {})
  }),
  updateMedicine: (id, body, patientId = null) => request('PUT', `/medicines/${id}`, {
    ...body,
    ...(patientId ? { patientId } : {})
  }),
  deleteMedicine: (id, patientId = null) => request('DELETE', `/medicines/${id}${patientId ? `?patientId=${patientId}` : ''}`),
  getRefillAlerts: (patientId = null) => request('GET', `/medicines/refill-alerts${patientId ? `?patientId=${patientId}` : ''}`),

  // Dose Logs
  getTodayLogs: (patientId = null) => {
    const s = new Date(); s.setHours(0, 0, 0, 0);
    const e = new Date(); e.setHours(23, 59, 59, 999);
    const base = `/dose-logs/today?start=${s.toISOString()}&end=${e.toISOString()}`;
    return request('GET', patientId ? `${base}&patientId=${patientId}` : base);
  },
  markDoseTaken: (id) => request('PUT', `/dose-logs/${id}/take`),
  getWeeklySummary: (patientId = null) => {
    const base = `/dose-logs/weekly-summary?timezoneOffset=${new Date().getTimezoneOffset()}`;
    return request('GET', patientId ? `${base}&patientId=${patientId}` : base);
  },
  generateLogs: () => request('POST', '/dose-logs/generate', { timezoneOffset: new Date().getTimezoneOffset() }),

  // Notifications
  getNotifications: () => request('GET', '/notifications'),
  generateNotifications: () => request('POST', '/notifications/generate', { timezoneOffset: new Date().getTimezoneOffset() }),
  markNotificationAsRead: (id) => request('PUT', `/notifications/${id}/read`),
  markAllNotificationsAsRead: () => request('PUT', '/notifications/read-all'),

  // AI
  suggestSchedule: (input) => request('POST', '/ai/suggest-schedule', { input }),
};
