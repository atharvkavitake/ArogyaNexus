import { getCsrfToken } from './auth.js';

async function request(path, options = {}) {
  const headers = options.body instanceof FormData ? { ...options.headers } : { 'Content-Type': 'application/json', ...options.headers };
  if (['POST', 'PATCH', 'DELETE'].includes(options.method)) headers['X-CSRF-Token'] = await getCsrfToken();
  const response = await fetch(path, { credentials: 'include', ...options, headers });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || 'Could not load health records.');
  return payload;
}
const query = (values) => new URLSearchParams(Object.entries(values).filter(([, value]) => value !== '' && value != null)).toString();
export async function getRecordVitals(profileId, range) { return (await request(`/api/patient/records/vitals?${query({ profileId, range })}`)).vitals; }
export async function getRecordConditions(profileId) { return request(`/api/patient/records/conditions?${query({ profileId })}`); }
export async function getRecords(profileId, filters) { return request(`/api/patient/records?${query({ profileId, ...filters })}`); }
export async function getAccessHistory(profileId) { return (await request(`/api/patient/records/access-history?${query({ profileId, limit: 10 })}`)).entries; }
export async function addVital(profileId, reading) { return request(`/api/patient/records/vitals?${query({ profileId })}`, { method: 'POST', body: JSON.stringify(reading) }); }
export async function saveConditions(profileId, conditions, allergies) { return request(`/api/patient/records/conditions?${query({ profileId })}`, { method: 'PATCH', body: JSON.stringify({ conditions, allergies }) }); }
export async function uploadRecord(profileId, fields, file) { const body = new FormData(); body.append('profileId', profileId); Object.entries(fields).forEach(([key, value]) => body.append(key, value)); body.append('file', file); return request('/api/patient/records', { method: 'POST', body }); }
export async function deleteRecord(id, profileId) { return request(`/api/patient/records/${id}?${query({ profileId })}`, { method: 'DELETE' }); }
export function recordFileUrl(id, profileId, disposition = 'inline') { return `/api/patient/records/${id}/file?${query({ profileId, disposition })}`; }
