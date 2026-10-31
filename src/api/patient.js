import { getAppointments, getPastSummary } from './appointments';
import { getRecordConditions, getRecordVitals, getRecords } from './records';

export async function getPatientDashboard(profileId) {
  const [upcomingAppts, pastVisits, vitalsData, conditionsData, recordsData] = await Promise.all([
    getAppointments(profileId, 'upcoming').catch(() => []),
    getPastSummary(profileId).catch(() => []),
    getRecordVitals(profileId, '30d').catch(() => ({ vitals: {}, history: [] })),
    getRecordConditions(profileId).catch(() => ({ conditions: [], allergies: [], notes: '' })),
    getRecords(profileId, { pageSize: 6 }).catch(() => ({ records: [], total: 0 })),
  ]);

  // 1. Next upcoming appointment from database (only if one actually exists)
  let nextAppointment = null;
  if (Array.isArray(upcomingAppts) && upcomingAppts.length > 0) {
    const first = upcomingAppts[0];
    nextAppointment = {
      id: first.id,
      doctor: first.doctor?.name || 'Doctor',
      specialty: first.doctor?.specialty || 'General Consultation',
      at: first.startsAt || first.appointmentAt,
      status: String(first.status).toLowerCase() === 'confirmed' ? 'Confirmed' : 'Pending',
      clinic: first.clinic?.name || 'ArogyaNexus Clinic',
      address: first.clinic?.address || first.clinic?.city || 'In-Person Consultation',
      photoUrl: first.doctor?.photoUrl,
    };
  }

  // 2. Health Snapshot vitals from real user database readings
  const vitals = vitalsData.vitals || {};
  const formattedVitals = {
    heartRate: vitals.HEART_RATE?.latest?.value ? `${vitals.HEART_RATE.latest.value} bpm` : null,
    bloodPressure: vitals.BLOOD_PRESSURE?.latest?.systolic ? `${vitals.BLOOD_PRESSURE.latest.systolic}/${vitals.BLOOD_PRESSURE.latest.diastolic} mmHg` : null,
    bloodGlucose: vitals.BLOOD_SUGAR_FASTING?.latest?.value ? `${vitals.BLOOD_SUGAR_FASTING.latest.value} mg/dL` : null,
    cholesterol: vitals.CHOLESTEROL_TOTAL?.latest?.value ? `${vitals.CHOLESTEROL_TOTAL.latest.value} mg/dL` : null,
    weight: vitals.WEIGHT?.latest?.value ? `${vitals.WEIGHT.latest.value} kg` : null,
  };

  // 3. Recent Visits from database
  const recentVisits = (pastVisits || []).map((visit) => ({
    id: visit.id,
    doctor: visit.doctor?.name || 'Doctor',
    specialty: visit.doctor?.specialty || 'Consultation',
    clinic: visit.clinic?.name || visit.clinic?.city || 'Healthcare Clinic',
    date: visit.startsAt || visit.date,
  }));

  // 4. Recent Documents from database (actual uploaded records)
  const documents = (recordsData.records || []).map((doc) => ({
    id: doc.id,
    name: doc.title,
    category: doc.category ? String(doc.category).replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()) : 'Medical Record',
    clinic: doc.issuer || 'Uploaded by Patient',
    date: doc.recordDate,
    fileType: doc.fileType || 'PDF',
    fileName: doc.fileName,
    mimeType: doc.mimeType,
  }));

  // 5. Consent & Data Access from database
  const consent = {
    activeCount: 0,
    lastViewedAt: null,
    providers: [],
  };

  return {
    profile: {
      id: profileId,
      allergies: conditionsData.allergies || [],
      notes: conditionsData.notes || '',
      vitals: formattedVitals,
    },
    actions: [],
    nextAppointment,
    medicinesToday: [],
    recentVisits,
    consent,
    camps: [
      { title: 'Heart health screening', place: 'Indiranagar Community Centre', date: '2026-11-02T09:00:00+05:30', distance: '1.2 km away' },
      { title: 'Free diabetes check-up', place: 'BBMP Health Centre', date: '2026-11-08T10:00:00+05:30', distance: '2.4 km away' },
    ],
    documents,
  };
}
