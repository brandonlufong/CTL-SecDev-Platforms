import API from './axios';

/**
 * Typed-ish helpers for the enterprise endpoints added in Workstreams B–F.
 * All calls go through the shared axios instance (api/axios.js) which attaches
 * the bearer token.
 */

// ---- Analytics ----
export const getOverview = () => API.get('/analytics/overview').then(r => r.data);
export const getTrends = (days = 30) => API.get(`/analytics/trends?days=${days}`).then(r => r.data);
export const getExposure = () => API.get('/analytics/exposure').then(r => r.data);

/** Fetch the executive HTML report (with auth) and open it in a new tab. */
export const openReport = async () => {
  const res = await API.get('/analytics/report', { responseType: 'blob' });
  const url = URL.createObjectURL(res.data);
  window.open(url, '_blank');
  setTimeout(() => URL.revokeObjectURL(url), 60000);
};

// ---- Remediation / SLA ----
export const getSlaSummary = () => API.get('/vulnerabilities/sla/summary').then(r => r.data);
export const setVulnStatus = (id, status, note) => API.patch(`/vulnerabilities/${id}/status`, { status, note }).then(r => r.data);
export const assignVuln = (id, userId) => API.patch(`/vulnerabilities/${id}/assign`, { userId }).then(r => r.data);
export const addVulnNote = (id, text) => API.post(`/vulnerabilities/${id}/notes`, { text }).then(r => r.data);
export const bulkVulnAction = (payload) => API.post('/vulnerabilities/bulk', payload).then(r => r.data);

/** Download a CSV blob and trigger a browser download. */
async function downloadCsv(path, filename) {
  const res = await API.get(path, { responseType: 'blob' });
  const url = URL.createObjectURL(res.data);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
export const exportVulnerabilitiesCsv = () => downloadCsv('/vulnerabilities/export', 'vulnerabilities.csv');
export const exportAssetsCsv = () => downloadCsv('/assets/export', 'assets.csv');
export const importAssetsCsv = (csv) => API.post('/assets/import', { csv }).then(r => r.data);
export const bulkUpdateAssets = (ids, update) => API.patch('/assets/bulk', { ids, update }).then(r => r.data);
export const findDuplicateAssets = () => API.get('/assets/duplicates').then(r => r.data);

// ---- Discovery ----
export const discoverSubnet = (target) => API.post('/assets/discover', { target }).then(r => r.data);
export const promoteHosts = (hosts, defaults) => API.post('/assets/promote', { hosts, defaults }).then(r => r.data);

// ---- Scheduler ----
export const listSchedules = () => API.get('/schedules').then(r => r.data);
export const createSchedule = (payload) => API.post('/schedules', payload).then(r => r.data);
export const updateSchedule = (id, payload) => API.put(`/schedules/${id}`, payload).then(r => r.data);
export const deleteSchedule = (id) => API.delete(`/schedules/${id}`).then(r => r.data);
export const runScheduleNow = (id) => API.post(`/schedules/${id}/run`).then(r => r.data);

// ---- Security / TLS ----
export const tlsCheck = (host, ports) => API.post('/security/tls-check', { host, ports }).then(r => r.data);
export const tlsCheckTarget = (id) => API.get(`/security/tls-check/${id}`).then(r => r.data);

// ---- System health / backup ----
export const getSystemHealth = () => API.get('/system/health').then(r => r.data);
export const downloadBackup = () => downloadCsv('/system/backup', `camtelvm-backup-${new Date().toISOString().slice(0, 10)}.json`);
export const getComplianceCoverage = () => API.get('/analytics/compliance').then(r => r.data);

// ---- Asset monitoring ----
export const getMonitoringStatus = () => API.get('/monitoring/status').then(r => r.data);
export const triggerMonitoringCheck = () => API.post('/monitoring/check').then(r => r.data);
export const startMonitoring = (intervalMinutes = 5) => API.post('/monitoring/start', { intervalMinutes }).then(r => r.data);

// ---- Core resources ----
export const getVulnerabilities = (params = {}) => {
  const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v)).toString();
  return API.get(`/vulnerabilities${qs ? `?${qs}` : ''}`).then(r => r.data);
};
export const createVulnerability = (data) => API.post('/vulnerabilities', data).then(r => r.data);
export const updateVulnerability = (id, data) => API.put(`/vulnerabilities/${id}`, data).then(r => r.data);
export const deleteVulnerability = (id) => API.delete(`/vulnerabilities/${id}`).then(r => r.data);
export const getAssets = () => API.get('/assets').then(r => r.data);
export const getAssetById = (id) => API.get(`/assets/${id}`).then(r => r.data);
export const getScanHistory = (targetType, targetId) => API.get(`/scan/history?targetType=${targetType}&targetId=${targetId}`).then(r => r.data);
export const getScanDelta = (targetType, targetId) => API.get(`/scan/delta?targetType=${targetType}&targetId=${targetId}`).then(r => r.data);
export const createAsset = (data) => API.post('/assets', data).then(r => r.data);
export const updateAsset = (id, data) => API.put(`/assets/${id}`, data).then(r => r.data);
export const deleteAsset = (id) => API.delete(`/assets/${id}`).then(r => r.data);
export const getDevices = () => API.get('/devices').then(r => r.data);
export const getUsers = () => API.get('/admin/users').then(r => r.data).catch(() => []);

// ---- Scan engines (nmap / nessus / openvas) ----
export const getScanEngines = () => API.get('/scan/engines').then(r => r.data);

// ---- Multi-tool import (Nessus / OpenVAS XML or OpenVAS PDF) ----
// payload: { content, format } for XML text, or { contentBase64, format } for PDF.
export const importScan = (payload) => API.post('/import/scan', payload).then(r => r.data);
