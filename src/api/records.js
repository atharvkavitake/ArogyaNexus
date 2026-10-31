async function request(path, options = {}) {
  const response = await fetch(path, {
    credentials: 'include',
    ...options,
    headers: options.body instanceof FormData ? options.headers : { 'Content-Type': 'application/json', ...options.headers },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || 'Could not load health records.');
  return payload;
}

const query = (values) => new URLSearchParams(Object.entries(values).filter(([, value]) => value !== '' && value != null)).toString();

export async function getRecordVitals(profileId, range) {
  const result = await request(`/api/patient/records/vitals?${query({ profileId, range })}`);
  return { vitals: result.vitals || {}, history: result.history || [] };
}

export async function getRecordConditions(profileId) {
  return request(`/api/patient/records/conditions?${query({ profileId })}`);
}

export async function getRecords(profileId, filters) {
  return request(`/api/patient/records?${query({ profileId, ...filters })}`);
}

export async function getAccessHistory(profileId) {
  return (await request(`/api/patient/records/access-history?${query({ profileId, limit: 10 })}`)).entries;
}

export async function addVital(profileId, reading) {
  return request(`/api/patient/records/vitals?${query({ profileId })}`, { method: 'POST', body: JSON.stringify(reading) });
}

export async function deleteVital(id, profileId) {
  return request(`/api/patient/records/vitals/${id}?${query({ profileId })}`, { method: 'DELETE' });
}

export async function saveConditions(profileId, conditions, allergies, notes = '') {
  return request(`/api/patient/records/conditions?${query({ profileId })}`, { method: 'PATCH', body: JSON.stringify({ conditions, allergies, notes }) });
}

export async function uploadRecord(profileId, fields, file) {
  const body = new FormData();
  body.append('profileId', profileId);
  Object.entries(fields).forEach(([key, value]) => {
    if (value !== undefined && value !== null) body.append(key, value);
  });
  body.append('file', file);
  return request('/api/patient/records', { method: 'POST', body });
}

export async function deleteRecord(id, profileId) {
  return request(`/api/patient/records/${id}?${query({ profileId })}`, { method: 'DELETE' });
}

export function recordFileUrl(id, profileId, disposition = 'inline') {
  return `/api/patient/records/${id}/file?${query({ profileId, disposition })}`;
}

export async function getEligibleDoctors(profileId) {
  const result = await request(`/api/patient/records/eligible-doctors?${query({ profileId })}`);
  return result.doctors || [];
}

export async function requestDoctorReview(recordId, profileId, doctorId, notes = '') {
  return request(`/api/patient/records/${recordId}/request-review?${query({ profileId })}`, {
    method: 'POST',
    body: JSON.stringify({ doctorId, notes }),
  });
}

export async function reviewDoctorRecord(recordId, { decision, notes, rejectionReason }) {
  return request(`/api/doctor/records/${recordId}/review`, {
    method: 'POST',
    body: JSON.stringify({ decision, notes, rejectionReason }),
  });
}
