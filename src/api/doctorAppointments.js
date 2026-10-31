import { doctorAppointments as seedAppointments } from '../mocks/doctorAppointments.js';
import { canTransition } from '../features/doctor/appointmentRules.js';

const delay = () => new Promise((resolve) => setTimeout(resolve, 400));
const clone = (value) => structuredClone(value);
export const appointmentStore = clone(seedAppointments);
export const patientNotifications = [];
export const auditLog = [];
export const accessLog = [];
export const mockInvites = [];
let failUpdateConsumed = false;
const failOnce = () => {
  const params = new URLSearchParams(globalThis.window?.location?.search || '');
  if (params.get('mock') === 'fail-update' && !failUpdateConsumed) {
    failUpdateConsumed = true;
    throw new Error('Network error. Please try again.');
  }
};
const recordAudit = (action, appointmentId) => auditLog.push({ actor: 'doctor-demo', action, appointmentId, at: new Date().toISOString() });
const getById = (id) => appointmentStore.find((appointment) => appointment.id === id);
const dateKey = (date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date(date));
const nextToken = (startsAt) => Math.max(0, ...appointmentStore.filter((appointment) => dateKey(appointment.startsAt) === dateKey(startsAt)).map((appointment) => Number(appointment.tokenNumber) || 0)) + 1;
const failResult = (code, message) => ({ code, message });

export async function syncLiveAppointments() {
  try {
    const res = await fetch('/api/doctor/appointments', { credentials: 'include' });
    if (res.ok) {
      const data = await res.json();
      if (data.success && Array.isArray(data.appointments)) {
        appointmentStore.length = 0;
        for (const liveApt of data.appointments) {
          appointmentStore.push({
            tokenNumber: Number(liveApt.tokenNumber) || nextToken(liveApt.startsAt),
            ...liveApt,
          });
        }
      }
    }
  } catch (err) {
    console.warn('[DoctorAppointments] Live sync error:', err);
  }
}

export async function getDoctorAppointments({ tab = 'today', q = '', filter = 'All' } = {}) {
  await syncLiveAppointments();
  await delay();
  const params = new URLSearchParams(globalThis.window?.location?.search || '');
  if (params.get('mock') === 'error') throw new Error('Could not load appointments.');
  if (params.get('mock') === 'empty') return [];
  const todayKey = dateKey(new Date());
  const visible = appointmentStore.filter((appointment) => {
    const appointmentDay = dateKey(appointment.startsAt);
    if (tab === 'today') {
      if (appointmentDay !== todayKey) return false;
      if (['CANCELLED', 'REQUESTED', 'PROPOSED_NEW_TIME'].includes(appointment.status)) return false;
      if (appointment.status === 'COMPLETED' && filter !== 'Completed') return false;
    }
    if (tab === 'upcoming') {
      if (appointmentDay <= todayKey) return false;
      if (['REQUESTED', 'PROPOSED_NEW_TIME', 'CANCELLED'].includes(appointment.status)) return false;
    }
    if (tab === 'requests') {
      if (!['REQUESTED', 'PROPOSED_NEW_TIME'].includes(appointment.status)) return false;
    }
    if (filter !== 'All') {
      const filterValue = filter.toLowerCase().replace('in-person', 'in_person').replace('video call', 'video').replace('in waiting', 'waiting').replace('missed', 'missed');
      if (!`${appointment.mode} ${appointment.status}`.toLowerCase().includes(filterValue)) return false;
    }
    return `${appointment.patient?.name || ''} ${appointment.reason || ''} ${appointment.status || ''} ${appointment.mode || ''}`.toLowerCase().includes(q.toLowerCase());
  });
  visible.sort((a, b) => tab === 'requests' ? new Date(a.createdAt) - new Date(b.createdAt) : tab === 'today' ? (a.status === 'WAITING' ? -1 : b.status === 'WAITING' ? 1 : a.tokenNumber - b.tokenNumber) : new Date(a.startsAt) - new Date(b.startsAt));
  return clone(visible);
}

export async function getAppointment(id) {
  await delay();
  let found = getById(id);
  if (!found) {
    try {
      await syncLiveAppointments();
      found = getById(id);
    } catch {}
  }
  return clone(found || null);
}

export async function getDoctorPatientRecords(patientId, appointmentId = '') {
  try {
    const params = new URLSearchParams();
    if (appointmentId) params.append('appointmentId', appointmentId);
    const res = await fetch(`/api/doctor/patients/${encodeURIComponent(patientId)}/records?${params.toString()}`, {
      credentials: 'include',
    });
    const data = await res.json();
    if (res.ok && data.success) {
      return data;
    }
    throw new Error(data.error || 'Could not load patient medical records.');
  } catch (err) {
    console.error('[DoctorAppointments] getDoctorPatientRecords error:', err);
    throw err;
  }
}

export async function getDoctorAppointmentCounts() {
  await syncLiveAppointments();
  await delay();
  const todayKey = dateKey(new Date());
  return {
    today: appointmentStore.filter((appointment) => dateKey(appointment.startsAt) === todayKey && !['CANCELLED', 'REQUESTED', 'PROPOSED_NEW_TIME', 'COMPLETED'].includes(appointment.status)).length,
    upcoming: appointmentStore.filter((appointment) => dateKey(appointment.startsAt) > todayKey && !['REQUESTED', 'PROPOSED_NEW_TIME', 'CANCELLED'].includes(appointment.status)).length,
    requests: appointmentStore.filter((appointment) => ['REQUESTED', 'PROPOSED_NEW_TIME'].includes(appointment.status)).length,
  };
}

export async function updateAppointmentStatus(id, nextStatus, payload = {}) {
  await delay(); failOnce();
  const appointment = getById(id);
  if (!appointment) return failResult('NOT_FOUND', 'Appointment not found.');
  if (!canTransition(appointment.status, nextStatus)) return failResult('INVALID_TRANSITION', `Cannot change ${appointment.status} to ${nextStatus}.`);
  Object.assign(appointment, payload, { status: nextStatus, updatedAt: new Date().toISOString() });
  recordAudit(`STATUS_${nextStatus}`, id);
  if (nextStatus === 'CANCELLED') patientNotifications.push({ patientId: appointment.patient.id, appointmentId: id, type: 'APPOINTMENT_CANCELLED', at: new Date().toISOString(), message: payload.reason || 'Your appointment request was declined.' });
  try {
    await fetch(`/api/doctor/appointments/${id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ nextStatus }),
    });
  } catch {}
  return clone(appointment);
}

export async function revertStatus(id, previousStatus) {
  await delay(); failOnce();
  const appointment = getById(id);
  if (!appointment) return failResult('NOT_FOUND', 'Appointment not found.');
  appointment.status = previousStatus;
  appointment.updatedAt = new Date().toISOString();
  recordAudit(`UNDO_STATUS_${previousStatus}`, id);
  return clone(appointment);
}

export async function sendMissedVisitAlert(id) {
  await delay(); failOnce();
  const appointment = getById(id);
  if (!appointment) return failResult('NOT_FOUND', 'Appointment not found.');
  if (appointment.status !== 'MISSED') return failResult('INVALID_STATUS', 'Only missed visits can receive an alert.');
  if (appointment.missedAlertSentAt) return failResult('ALREADY_SENT', 'The reschedule alert was already sent.');
  appointment.missedAlertSentAt = new Date().toISOString();
  patientNotifications.push({ patientId: appointment.patient.id, appointmentId: id, type: 'MISSED_VISIT_RESCHEDULE', at: appointment.missedAlertSentAt, message: 'Please contact your doctor to reschedule your missed visit.' });
  recordAudit('MISSED_VISIT_ALERT_SENT', id);
  return clone(appointment);
}

export async function requestRecordAccess(appointmentId) {
  await delay(); failOnce();
  const appointment = getById(appointmentId);
  if (!appointment) return failResult('NOT_FOUND', 'Appointment not found.');
  if (appointment.consent?.status === 'ACTIVE' && new Date(appointment.consent.expiresAt) > new Date()) return failResult('ALREADY_ACTIVE', 'Record access is already active.');
  if (appointment.consent?.status === 'PENDING') return failResult('ALREADY_PENDING', 'An access request is already pending.');
  appointment.consent = { id: `consent-${crypto.randomUUID()}`, status: 'PENDING', requestedAt: new Date().toISOString(), scope: ['VIEW_SUMMARY', 'VIEW_HISTORY'], expiresAt: null };
  recordAudit('RECORD_ACCESS_REQUESTED', appointmentId);
  patientNotifications.push({ patientId: appointment.patient.id, appointmentId, type: 'RECORD_ACCESS_REQUEST', at: new Date().toISOString() });
  return clone(appointment);
}

export async function respondToRequest(id, response, payload = {}) {
  await delay(); failOnce();
  const appointment = getById(id);
  if (!appointment) return failResult('NOT_FOUND', 'Appointment not found.');
  if (appointment.status !== 'REQUESTED') return failResult('INVALID_STATUS', 'This appointment is no longer a pending request.');
  if (response === 'ACCEPT') {
    if (!canTransition('REQUESTED', 'CONFIRMED')) return failResult('INVALID_TRANSITION', 'This request cannot be accepted.');
    appointment.status = 'CONFIRMED';
    appointment.tokenNumber = nextToken(appointment.startsAt);
    recordAudit('REQUEST_ACCEPTED', id);
    try {
      await fetch(`/api/doctor/appointments/${id}/respond`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ response: 'ACCEPT' }),
      });
    } catch {}
  } else if (response === 'DECLINE') {
    if (!payload.reason?.trim() || payload.reason.trim().length < 5) return failResult('INVALID_REASON', 'Please enter a reason with at least 5 characters.');
    appointment.status = 'CANCELLED';
    appointment.cancelledBy = 'DOCTOR';
    appointment.cancellationReason = payload.reason.trim();
    patientNotifications.push({ patientId: appointment.patient.id, appointmentId: id, type: 'APPOINTMENT_DECLINED', reason: appointment.cancellationReason, at: new Date().toISOString() });
    recordAudit('REQUEST_DECLINED', id);
    try {
      await fetch(`/api/doctor/appointments/${id}/respond`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ response: 'DECLINE', reason: payload.reason.trim() }),
      });
    } catch {}
  } else if (response === 'PROPOSE') {
    if (!payload.proposedStartsAt || new Date(payload.proposedStartsAt) <= new Date()) return failResult('INVALID_SLOT', 'Choose a future appointment time.');
    appointment.status = 'PROPOSED_NEW_TIME';
    appointment.proposedSlot = { startsAt: new Date(payload.proposedStartsAt).toISOString(), note: payload.note?.trim() || '' };
    recordAudit('REQUEST_TIME_PROPOSED', id);
    try {
      await fetch(`/api/doctor/appointments/${id}/respond`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ response: 'PROPOSE', proposedStartsAt: payload.proposedStartsAt, note: payload.note }),
      });
    } catch {}
  } else return failResult('INVALID_RESPONSE', 'Unknown response.');
  appointment.updatedAt = new Date().toISOString();
  return clone(appointment);
}

export async function getDoctorSlots(date) {
  await delay();
  const day = typeof date === 'string' ? date : dateKey(date);
  const slots = [];
  const [year, month, dateNum] = day.split('-').map(Number);
  for (let minutes = 9 * 60; minutes < 17 * 60; minutes += 15) {
    const local = new Date(`${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(dateNum).padStart(2, '0')}T${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}:00+05:30`);
    const startsAt = local.toISOString();
    const endsAt = new Date(local.getTime() + 15 * 60000).toISOString();
    const booked = appointmentStore.some((appointment) => appointment.status !== 'CANCELLED' && new Date(appointment.startsAt) < new Date(endsAt) && new Date(appointment.endsAt) > new Date(startsAt));
    if (!booked && new Date(startsAt) > new Date()) slots.push({ startsAt, endsAt });
  }
  return slots;
}

export async function createAppointment(data) {
  await delay(); failOnce();
  if (!data.patient?.id || !data.startsAt || !data.reason?.trim()) return failResult('INVALID_DATA', 'Choose a patient, time, and reason for visit.');
  if (new Date(data.startsAt) <= new Date()) return failResult('PAST_SLOT', 'Choose a future time.');
  const end = data.endsAt || new Date(new Date(data.startsAt).getTime() + 30 * 60000).toISOString();
  if (appointmentStore.some((item) => item.status !== 'CANCELLED' && new Date(item.startsAt) < new Date(end) && new Date(item.endsAt) > new Date(data.startsAt))) return failResult('SLOT_TAKEN', 'That time is no longer available.');

  try {
    const res = await fetch('/api/doctor/appointments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        patient: data.patient,
        startsAt: data.startsAt,
        reason: data.reason,
        mode: data.mode || 'IN_PERSON',
      }),
    });
    if (res.ok) {
      await syncLiveAppointments();
      const created = appointmentStore.find((a) => a.reason === data.reason.trim());
      if (created) return clone(created);
    }
  } catch (err) {
    console.warn('[DoctorAppointments] Server create error, saving in local store:', err);
  }

  const appointment = { id: `appt-${crypto.randomUUID()}`, tokenNumber: nextToken(data.startsAt), status: 'SCHEDULED', mode: data.mode || 'IN_PERSON', startsAt: new Date(data.startsAt).toISOString(), endsAt: new Date(end).toISOString(), checkedInAt: null, reason: data.reason.trim(), doctorNotes: '', patient: clone(data.patient), checkInVitals: null, consent: null, missedAlertSentAt: null, createdAt: new Date().toISOString() };
  appointmentStore.push(appointment);
  recordAudit('APPOINTMENT_CREATED', appointment.id);
  return clone(appointment);
}

export async function getAiClinicalSummary(appointmentId) {
  try {
    const res = await fetch(`/api/doctor/appointments/${encodeURIComponent(appointmentId)}/ai-summary`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Could not generate AI clinical summary.');
    }
    return data.summary;
  } catch (err) {
    console.error('[DoctorAppointments] getAiClinicalSummary error:', err);
    throw err;
  }
}

export async function searchMyPatients(q = '') {
  await delay();
  const treated = appointmentStore.map((item) => item.patient).filter(Boolean);
  const unique = Array.from(new Map(treated.map((p) => [p.name, p])).values());
  return clone(unique.filter((patient) => patient.name.toLowerCase().includes(q.trim().toLowerCase())).slice(0, 8));
}

export async function invitePatientByPhone(phone, name) {
  await delay(); failOnce();
  if (!/^\+?[0-9\s()-]{8,18}$/.test(phone || '') || !name?.trim()) return failResult('INVALID_INVITE', 'Enter a patient name and valid phone number.');
  const invite = { id: `invite-${crypto.randomUUID()}`, phone: phone.trim(), name: name.trim(), status: 'PENDING', createdAt: new Date().toISOString() };
  mockInvites.push(invite);
  recordAudit('PATIENT_INVITED', invite.id);
  return clone(invite);
}

export async function logRecordAccess(appointmentId, doctorId = 'doctor-demo') {
  await delay();
  const appointment = getById(appointmentId);
  if (!appointment || appointment.consent?.status !== 'ACTIVE' || new Date(appointment.consent.expiresAt) <= new Date()) return failResult('ACCESS_DENIED', 'Access denied. Patient consent is not active.');
  const row = { doctorId, patientId: appointment.patient.id, action: 'VIEW', consentId: appointment.consent.id, at: new Date().toISOString() };
  accessLog.push(row);
  recordAudit('MEDICAL_RECORDS_VIEWED', appointmentId);
  return clone(row);
}

export async function simulatePatientConsent(appointmentId, decision = 'APPROVE') {
  await delay(); failOnce();
  const appointment = getById(appointmentId);
  if (!appointment?.consent || appointment.consent.status !== 'PENDING') return failResult('NO_PENDING_REQUEST', 'There is no pending consent request.');
  if (decision === 'APPROVE') Object.assign(appointment.consent, { status: 'ACTIVE', expiresAt: new Date(Date.now() + 60 * 60000).toISOString() });
  else appointment.consent.status = 'DENIED';
  recordAudit(`PATIENT_CONSENT_${decision}`, appointmentId);
  return clone(appointment);
}
