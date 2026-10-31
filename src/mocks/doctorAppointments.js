const now = new Date();
const today = new Date(now);
today.setHours(0, 0, 0, 0);
const day = (offset, hour, minute = 0) => {
  const date = new Date(today);
  date.setDate(date.getDate() + offset);
  date.setHours(hour, minute, 0, 0);
  return date.toISOString();
};
const soon = new Date(Date.now() + 5 * 60000);
const soonEnd = new Date(soon.getTime() + 30 * 60000);
const patient = (id, name, age, gender, photoUrl) => ({ id, name, age, gender, photoUrl });
const consent = (offset = 1) => ({ id: `consent-${offset}`, status: 'ACTIVE', expiresAt: new Date(Date.now() + offset * 3600000).toISOString() });
export const doctorAppointments = [
  { id: 'a1', tokenNumber: 1, status: 'WAITING', mode: 'IN_PERSON', startsAt: day(0, 9), endsAt: day(0, 9, 30), checkedInAt: new Date(Date.now() - 12 * 60000).toISOString(), reason: 'Chronic chest discomfort & hypertension follow-up. Reviewing ECG report from yesterday.', doctorNotes: 'Continue blood pressure monitoring and review ECG.', patient: patient('p1', 'Rahul Verma', 42, 'Male', 'https://i.pravatar.cc/100?img=12'), checkInVitals: { bpSys: 128, bpDia: 82, spo2: 98, pulse: 74, recordedAt: now.toISOString() }, consent: consent(), createdAt: day(0, 8) },
  { id: 'a2', tokenNumber: 2, status: 'CONFIRMED', mode: 'VIDEO', startsAt: day(0, 10), endsAt: day(0, 10, 30), reason: 'Routine post-medication review for Diabetes. Experiencing mild fatigue.', doctorNotes: '', patient: patient('p2', 'Neha Kapoor', 35, 'Female', 'https://i.pravatar.cc/100?img=47'), checkInVitals: { bpSys: 115, bpDia: 70, spo2: 99, pulse: 72, recordedAt: now.toISOString() }, consent: null, createdAt: day(0, 8, 15) },
  { id: 'a3', tokenNumber: 3, status: 'SCHEDULED', mode: 'IN_PERSON', startsAt: day(0, 11), endsAt: day(0, 11, 30), reason: 'Consultation to adjust dose of anti-hypertensives. To be checked for minor ankle swelling.', doctorNotes: '', patient: patient('p3', 'Vikram Singh', 50, 'Male', 'https://i.pravatar.cc/100?img=13'), checkInVitals: { bpSys: 132, bpDia: 85, spo2: 97, pulse: 80, recordedAt: now.toISOString() }, consent: consent(), createdAt: day(0, 8, 30) },
  { id: 'a4', tokenNumber: 4, status: 'MISSED', mode: 'IN_PERSON', startsAt: day(0, 8), endsAt: day(0, 8, 30), reason: 'Routine prenatal check-up and reviewing recent ultrasound reports.', doctorNotes: '', patient: patient('p4', 'Priya Patel', 28, 'Female', 'https://i.pravatar.cc/100?img=44'), checkInVitals: { bpSys: 110, bpDia: 68, spo2: 98, pulse: 68, recordedAt: now.toISOString() }, consent: null, createdAt: day(0, 7), missedAlertSentAt: null },
  { id: 'a5', tokenNumber: 5, status: 'CONFIRMED', mode: 'VIDEO', startsAt: soon.toISOString(), endsAt: soonEnd.toISOString(), reason: 'Follow-up visit.', doctorNotes: 'Detailed history available with patient consent.', patient: patient('p5', 'Kabir Mehta', 46, 'Male', ''), checkInVitals: null, consent: consent(), createdAt: day(0, 9) },
  { id: 'a6', tokenNumber: 6, status: 'COMPLETED', mode: 'IN_PERSON', startsAt: day(0, 7), endsAt: day(0, 7, 30), reason: 'Medication review.', doctorNotes: 'Stable on current regimen.', patient: patient('p6', 'Sara Thomas', 39, 'Female', ''), checkInVitals: null, consent: consent(), createdAt: day(0, 6) },
  { id: 'a7', tokenNumber: 7, status: 'NO_SHOW', mode: 'IN_PERSON', startsAt: day(0, 6), endsAt: day(0, 6, 30), reason: 'Annual check-up.', doctorNotes: '', patient: patient('p7', 'Rohan Das', 55, 'Male', ''), checkInVitals: null, consent: null, createdAt: day(0, 5) },
  { id: 'a8', tokenNumber: 8, status: 'CANCELLED', mode: 'VIDEO', startsAt: day(0, 12), endsAt: day(0, 12, 30), reason: 'Consultation about recurring headaches.', doctorNotes: '', patient: patient('p8', 'Maya Joshi', 31, 'Female', ''), checkInVitals: null, consent: null, createdAt: day(0, 4) },
  { id: 'a9', tokenNumber: 9, status: 'REQUESTED', mode: 'VIDEO', startsAt: day(0, 15), endsAt: day(0, 15, 30), reason: 'Persistent migraines with light sensitivity.', doctorNotes: '', patient: patient('p9', 'Anika Rao', 27, 'Female', ''), checkInVitals: null, consent: null, createdAt: new Date(Date.now() - 2 * 3600000).toISOString() },
  { id: 'a10', tokenNumber: 10, status: 'SCHEDULED', mode: 'IN_PERSON', startsAt: day(1, 9), endsAt: day(1, 9, 30), reason: 'Blood pressure follow-up.', doctorNotes: '', patient: patient('p10', 'Dev Malhotra', 61, 'Male', ''), checkInVitals: null, consent: { ...consent(-1), expiresAt: new Date(Date.now() - 3600000).toISOString() }, createdAt: day(0, 10) },
  { id: 'a11', tokenNumber: 11, status: 'CONFIRMED', mode: 'VIDEO', startsAt: day(1, 10), endsAt: day(1, 10, 30), reason: 'A very long consultation request describing intermittent dizziness, fatigue, medication changes, diet history, family medical background, and a request to review recent laboratory results in detail.', doctorNotes: '', patient: patient('p11', 'Isha Banerjee', 44, 'Female', ''), checkInVitals: null, consent: null, createdAt: day(0, 11) },
  { id: 'a12', tokenNumber: 12, status: 'REQUESTED', mode: 'IN_PERSON', startsAt: day(3, 13), endsAt: day(3, 13, 30), reason: 'New patient consultation.', doctorNotes: '', patient: patient('p12', 'Omar Khan', 33, 'Male', ''), checkInVitals: null, consent: null, createdAt: new Date(Date.now() - 5 * 3600000).toISOString() },
];
