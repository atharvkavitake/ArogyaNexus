const roleNames = {
  PATIENT: 'patient', DOCTOR: 'doctor', NURSE: 'nurse', LAB_TECH: 'lab_tech',
  RECEPTIONIST: 'receptionist', ADMIN: 'admin',
};

let csrfToken;

async function readAuthJson(response) {
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.toLowerCase().includes('application/json')) {
    throw new Error(`Authentication API returned ${response.status} without JSON. Restart the backend with npm run dev:all and confirm it is listening on port 3001.`);
  }
  return response.json();
}

export async function getCsrfToken() {
  if (csrfToken) return csrfToken;
  const response = await fetch('/api/v1/auth/csrf', { credentials: 'include' });
  const result = await readAuthJson(response);
  if (!response.ok || !result.data?.csrfToken) throw new Error('Could not start a secure session.');
  csrfToken = result.data.csrfToken;
  return csrfToken;
}

async function authRequest(path, { method = 'GET', body } = {}) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (['POST', 'PATCH', 'DELETE'].includes(method)) headers['X-CSRF-Token'] = await getCsrfToken();
  const response = await fetch(`/api/v1/auth/${path}`, {
    method, headers, credentials: 'include',
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const result = await readAuthJson(response);
  if (!response.ok) {
    if (response.status === 403 && result.code === 'CSRF_INVALID') csrfToken = undefined;
    throw new Error(result.message || 'The request could not be completed.');
  }
  return result.data;
}

function normalizeUser(user) {
  return {
    ...user,
    full_name: user.fullName,
    role: roleNames[user.role] || String(user.role).toLowerCase(),
  };
}

export function getRedirectPathForUser(user) {
  switch (user?.role?.toUpperCase()) {
    case 'PATIENT': return '/patient/dashboard';
    case 'DOCTOR': return '/doctor/dashboard';
    case 'ADMIN': return '/admin/dashboard';
    case 'NURSE': case 'LAB_TECH': case 'RECEPTIONIST': return '/staff/dashboard';
    default: return '/login';
  }
}

export async function registerPatient(input) {
  const data = await authRequest('register', { method: 'POST', body: { ...input, role: 'PATIENT' } });
  return { success: true, message: 'Patient account created successfully.', user: normalizeUser(data.user) };
}

export async function registerDoctor(input) {
  const data = await authRequest('register', { method: 'POST', body: { ...input, role: 'DOCTOR' } });
  return { success: true, message: 'Doctor application submitted successfully.', user: normalizeUser(data.user) };
}

export async function loginUser(input) {
  const data = await authRequest('login', { method: 'POST', body: input });
  return { success: true, user: normalizeUser(data.user), doctorStatus: data.doctorStatus?.toLowerCase() };
}

export async function logoutUser() {
  const data = await authRequest('logout', { method: 'POST' });
  csrfToken = undefined;
  return { success: true, ...data };
}

export async function getCurrentUser() {
  try {
    const data = await authRequest('me');
    return normalizeUser(data.user);
  } catch {
    return null;
  }
}

export async function changePassword(input) {
  return authRequest('change-password', { method: 'POST', body: input });
}
