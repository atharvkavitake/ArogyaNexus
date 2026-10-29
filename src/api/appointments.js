import { getCsrfToken } from './auth.js';

async function request(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  if (['POST', 'PATCH', 'DELETE'].includes(options.method)) headers['X-CSRF-Token'] = await getCsrfToken();
  const response = await fetch(path, { credentials: 'include', ...options, headers });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || 'Could not load appointments.');
  return payload;
}
const query = (values) => new URLSearchParams(values).toString();
export async function getAppointments(profileId, tab) { return (await request(`/api/patient/appointments?${query({ profileId, tab })}`)).appointments; }
export async function getAppointmentCalendar(profileId, month) { return (await request(`/api/patient/appointments/calendar?${query({ profileId, month })}`)).dates; }
export async function getPastSummary(profileId) { return (await request(`/api/patient/appointments/past-summary?${query({ profileId, limit: 5 })}`)).visits; }
export async function cancelAppointment(id, profileId, reason) { return request(`/api/patient/appointments/${id}/cancel?${query({ profileId })}`, { method: 'PATCH', body: JSON.stringify({ reason }) }); }
export async function modifyAppointment(id, profileId, reason) { return request(`/api/patient/appointments/${id}?${query({ profileId })}`, { method: 'PATCH', body: JSON.stringify({ reason }) }); }
