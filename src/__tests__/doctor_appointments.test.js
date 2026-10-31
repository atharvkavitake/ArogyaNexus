import { describe, expect, it } from 'vitest';
import { actionSet, hasRecordAccess, isJoinWindowOpen, waitingMinutes } from '../pages/doctor/Appointments';
import { getDoctorAppointments, appointmentStore } from '../api/doctorAppointments';

const now = new Date('2026-10-28T10:00:00Z');
describe('doctor appointment display rules', () => {
  it('renders the status specific action labels', () => {
    expect(actionSet('WAITING')).toEqual(['Complete Consultation', 'Mark as Completed', 'Mark No-Show']);
    expect(actionSet('MISSED')).toEqual(['Send Missed Visit Alert', 'Mark No-Show']);
    expect(actionSet('REQUESTED')).toEqual(['Accept', 'Decline', 'Propose new time']);
    expect(actionSet('COMPLETED')).toEqual([]);
  });
  it('opens video joining ten minutes before start through the end for eligible states', () => {
    const appointment = { status: 'CONFIRMED', startsAt: new Date(now.getTime() + 10 * 60000), endsAt: new Date(now.getTime() + 40 * 60000) };
    expect(isJoinWindowOpen(appointment, now)).toBe(true);
    expect(isJoinWindowOpen({ ...appointment, status: 'SCHEDULED' }, now)).toBe(false);
    expect(isJoinWindowOpen(appointment, new Date(now.getTime() + 41 * 60000))).toBe(false);
  });
  it('requires active, unexpired consent to open records', () => {
    expect(hasRecordAccess({ consent: { status: 'ACTIVE', expiresAt: new Date(now.getTime() + 1) } }, now)).toBe(true);
    expect(hasRecordAccess({ consent: { status: 'ACTIVE', expiresAt: new Date(now.getTime() - 1) } }, now)).toBe(false);
    expect(hasRecordAccess({ consent: null }, now)).toBe(false);
  });
  it('calculates nonnegative waiting minutes', () => {
    expect(waitingMinutes({ checkedInAt: new Date(now.getTime() - 12 * 60000) }, now)).toBe(12);
    expect(waitingMinutes({ checkedInAt: new Date(now.getTime() + 60000) }, now)).toBe(0);
  });
  it('filters list results by tab, search, and quick filter', async () => {
    const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
    appointmentStore.push(
      { id: 'test-req', status: 'REQUESTED', mode: 'VIDEO', startsAt: `${todayStr}T10:00:00.000Z`, patient: { name: 'Req Patient' }, reason: 'Consult', createdAt: new Date().toISOString() },
      { id: 'test-arjun', status: 'WAITING', mode: 'VIDEO', startsAt: `${todayStr}T11:00:00.000Z`, patient: { name: 'Arjun Sharma' }, reason: 'ECG Review', createdAt: new Date().toISOString() },
    );
    const requests = await getDoctorAppointments({ tab: 'requests' });
    expect(requests.every((item) => item.status === 'REQUESTED')).toBe(true);
    const search = await getDoctorAppointments({ tab: 'today', q: 'Arjun' });
    expect(search).toHaveLength(1);
    expect(search[0].patient.name).toBe('Arjun Sharma');
    const videos = await getDoctorAppointments({ tab: 'today', filter: 'Video Call' });
    expect(videos.every((item) => item.mode === 'VIDEO')).toBe(true);
  });
});
