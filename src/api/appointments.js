async function request(path, options = {}) {
  const response = await fetch(path, { credentials: 'include', ...options, headers: { 'Content-Type': 'application/json', ...options.headers } });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || 'Could not load appointments.');
  return payload;
}
const query = (values) => new URLSearchParams(values).toString();
export async function getAppointments(profileId, tab) {
  const res = await request(`/api/patient/appointments?${query({ profileId, tab })}`);
  return res.appointments || [];
}
export async function getAppointmentCalendar(profileId, month) {
  try {
    const res = await request(`/api/patient/appointments/calendar?${query({ profileId, month })}`);
    return res.dates || [];
  } catch {
    return [];
  }
}
export async function getPastSummary(profileId) {
  try {
    const res = await request(`/api/patient/appointments/past-summary?${query({ profileId, limit: 5 })}`);
    return res.visits || [];
  } catch {
    return [];
  }
}
export async function cancelAppointment(id, profileId, reason) { return request(`/api/patient/appointments/${id}/cancel?${query({ profileId })}`, { method: 'PATCH', body: JSON.stringify({ reason }) }); }
export async function modifyAppointment(id, profileId, reason) { return request(`/api/patient/appointments/${id}?${query({ profileId })}`, { method: 'PATCH', body: JSON.stringify({ reason }) }); }

