async function request(path, options = {}) {
  const response = await fetch(path, {
    credentials: 'include',
    ...options,
    headers: { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...options.headers },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || 'Could not save patient profile.');
  return payload;
}

const scopedPath = (id) => `/api/patients/${encodeURIComponent(id)}?${new URLSearchParams({ profileId: id })}`;
export async function getPatientProfiles(profileId) {
  const query = profileId ? `?${new URLSearchParams({ profileId })}` : '';
  return (await request(`/api/patients${query}`)).profiles;
}
export async function getPatientProfile(profileId) { return (await request(scopedPath(profileId))).profile; }
export async function updatePatientProfile(profileId, patch) { return (await request(scopedPath(profileId), { method: 'PATCH', body: JSON.stringify(patch) })).profile; }
export async function createPatientProfile(ownerProfileId, profile) {
  const query = ownerProfileId ? `?${new URLSearchParams({ profileId: ownerProfileId })}` : '';
  return (await request(`/api/patients${query}`, { method: 'POST', body: JSON.stringify(profile) })).profile;
}
export async function deletePatientProfile(profileId) { return request(scopedPath(profileId), { method: 'DELETE' }); }
