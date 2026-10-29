import 'dotenv/config';
import express, { Request, Response } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { getSession, SESSION_COOKIE_NAME } from '../lib/auth/session';
import { prisma } from '../lib/db/prisma';
import { prisma as database } from '../src/db/client';
import { z } from 'zod';
import { canAccessProfile } from '../lib/auth/profileAccess';
import { readRecordMultipart, detectRecordMime } from './multipart';
import { recordPath, removeRecord, storeRecord } from './recordStorage';
import path from 'node:path';
import { vitalRangeStart, recordCategoryFilter } from '../lib/records/logic';
import { createAuthRouter } from './authRouter';
import { csrfProtection } from '../src/middleware/csrf';

const app = express();
const PORT = process.env.PORT || 3001;
const PUBLIC_CITIES = ['Kolhapur', 'Pune', 'Mumbai', 'Bengaluru', 'Nashik', 'Sangli', 'Satara'];

function toPublicDoctor(profile: any) {
  const address = String(profile.clinic_address || '');
  const city = PUBLIC_CITIES.find((name) => new RegExp(`\\b${name}\\b`, 'i').test(address)) || null;
  const rawName = String(profile.user?.full_name || 'Doctor');
  return {
    id: profile.id,
    name: /^dr\.?\s/i.test(rawName) ? rawName : `Dr. ${rawName}`,
    speciality: profile.speciality,
    clinic: profile.clinic_name,
    clinicAddress: address,
    city,
    consultationFee: Number(profile.consultation_fee),
    verificationStatus: 'verified',
    qualification: null,
    experienceYears: null,
    rating: null,
    reviewCount: 0,
    availability: [],
  };
}

// Middlewares
app.use(helmet());
app.use(express.json());
app.use(cookieParser());
app.use(
  cors({
    origin: process.env.VITE_ORIGIN || 'http://localhost:5173',
    credentials: true,
  })
);
app.use(csrfProtection);
app.use('/api/v1/auth', createAuthRouter());

// Health check endpoint
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'ArogyaNexus Auth API' });
});

app.get('/api/v1/health', async (_req: Request, res: Response) => {
  try {
    await database.$queryRaw`SELECT 1`;
    res.status(200).json({ data: { status: 'ok', database: 'connected' } });
  } catch {
    res.status(503).json({ code: 'DATABASE_UNAVAILABLE', message: 'Database is unavailable.' });
  }
});

// Admin-only doctor application review
app.get('/api/admin/doctor-applications', async (req: Request, res: Response) => {
  const session = getSession(req.cookies[SESSION_COOKIE_NAME]);
  if (!session || session.user.role !== 'admin') {
    res.status(session ? 403 : 401).json({ success: false, error: 'Administrator access required.' });
    return;
  }

  const status = typeof req.query.status === 'string' ? req.query.status : undefined;
  if (status && !['pending', 'approved', 'rejected'].includes(status)) {
    res.status(400).json({ success: false, error: 'Invalid application status.' });
    return;
  }

  try {
    const applications = await prisma.doctorProfile.findMany({
      where: status ? { status } : undefined,
      include: { user: { select: { id: true, full_name: true, email: true, phone: true, created_at: true } } },
      orderBy: { created_at: 'desc' },
    });
    res.status(200).json({ success: true, applications });
  } catch (err) {
    console.error('[Admin] Could not load doctor applications:', err);
    res.status(500).json({ success: false, error: 'Could not load doctor applications.' });
  }
});

app.patch('/api/admin/doctor-applications/:id', async (req: Request, res: Response) => {
  const session = getSession(req.cookies[SESSION_COOKIE_NAME]);
  if (!session || session.user.role !== 'admin') {
    res.status(session ? 403 : 401).json({ success: false, error: 'Administrator access required.' });
    return;
  }

  const { status } = req.body as { status?: string };
  if (status !== 'approved' && status !== 'rejected') {
    res.status(400).json({ success: false, error: 'Choose approved or rejected status.' });
    return;
  }

  try {
    const applicationId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const application = await prisma.doctorProfile.update({
      where: { id: applicationId },
      data: { status },
    });
    res.status(200).json({ success: true, application });
  } catch (err) {
    console.error('[Admin] Could not update doctor application:', err);
    res.status(404).json({ success: false, error: 'Doctor application was not found or could not be updated.' });
  }
});

// Public discovery DTOs intentionally expose approved profiles only.
app.get('/api/public/doctors', async (req: Request, res: Response) => {
  try {
    const profiles = await prisma.doctorProfile.findMany({
      where: { status: 'approved' },
      select: {
        id: true,
        speciality: true,
        clinic_name: true,
        clinic_address: true,
        consultation_fee: true,
        status: true,
        user: { select: { full_name: true } },
      },
      orderBy: { created_at: 'desc' },
    });
    const query = typeof req.query.q === 'string' ? req.query.q.trim().toLowerCase() : '';
    const speciality = typeof req.query.speciality === 'string' ? req.query.speciality.trim().toLowerCase() : '';
    const city = typeof req.query.city === 'string' ? req.query.city.trim().toLowerCase() : '';
    const doctors = profiles
      .map(toPublicDoctor)
      .filter((doctor) => !city || doctor.city?.toLowerCase() === city)
      .filter((doctor) => !speciality || doctor.speciality.toLowerCase() === speciality)
      .filter((doctor) => !query || `${doctor.name} ${doctor.speciality} ${doctor.clinic} ${doctor.city || ''}`.toLowerCase().includes(query));
    res.status(200).json({ success: true, doctors });
  } catch (err) {
    console.error('[Public] Could not load doctor directory:', err);
    res.status(500).json({ success: false, error: 'Could not load the doctor directory.' });
  }
});

app.get('/api/public/doctors/:id', async (req: Request, res: Response) => {
  try {
    const doctorId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const profiles = await prisma.doctorProfile.findMany({
      where: { status: 'approved' },
      select: {
        id: true,
        speciality: true,
        clinic_name: true,
        clinic_address: true,
        consultation_fee: true,
        status: true,
        user: { select: { full_name: true } },
      },
    });
    const profile = profiles.find((entry: any) => entry.id === doctorId);
    if (!profile) {
      res.status(404).json({ success: false, error: 'Verified doctor not found.' });
      return;
    }
    res.status(200).json({ success: true, doctor: toPublicDoctor(profile) });
  } catch (err) {
    console.error('[Public] Could not load doctor profile:', err);
    res.status(500).json({ success: false, error: 'Could not load the doctor profile.' });
  }
});

// Appointment requests can only be created by an authenticated patient for an approved doctor.
app.post('/api/appointments', async (req: Request, res: Response) => {
  const session = getSession(req.cookies[SESSION_COOKIE_NAME]);
  if (!session) {
    res.status(401).json({ success: false, error: 'Please log in as a patient to request an appointment.' });
    return;
  }
  if (session.user.role !== 'patient') {
    res.status(403).json({ success: false, error: 'Only patient accounts can book appointments.' });
    return;
  }

  const { doctorId, appointmentAt, reason } = req.body as { doctorId?: string; appointmentAt?: string; reason?: string };
  const parsedDate = appointmentAt ? new Date(appointmentAt) : null;
  if (!doctorId || !parsedDate || Number.isNaN(parsedDate.getTime()) || parsedDate.getTime() <= Date.now()) {
    res.status(400).json({ success: false, error: 'Choose a valid future appointment date and time.' });
    return;
  }
  if (reason !== undefined && (typeof reason !== 'string' || reason.length > 500)) {
    res.status(400).json({ success: false, error: 'Appointment note must be 500 characters or fewer.' });
    return;
  }

  try {
    const doctor = await prisma.doctorProfile.findUnique({ where: { id: doctorId } });
    if (!doctor || doctor.status !== 'approved') {
      res.status(404).json({ success: false, error: 'Verified doctor not found.' });
      return;
    }
    const appointment = await (prisma as any).appointment.create({
      data: {
        patient_id: session.user.id,
        doctor_profile_id: doctor.id,
        appointment_at: parsedDate,
        reason: reason?.trim() || null,
      },
    });
    res.status(201).json({ success: true, appointment: { id: appointment.id, appointmentAt: appointment.appointment_at, status: appointment.status } });
  } catch (err) {
    console.error('[Appointments] Could not create appointment request:', err);
    res.status(500).json({ success: false, error: 'Could not create the appointment request.' });
  }
});

const profileQuery = z.object({ profileId: z.string().min(1) });
const tabQuery = z.object({ profileId: z.string().min(1), tab: z.enum(['upcoming', 'past', 'cancelled']).default('upcoming') });
async function appointmentProfile(req: Request, res: Response) {
  const session = getSession(req.cookies[SESSION_COOKIE_NAME]);
  if (!session) { res.status(401).json({ error: 'Authentication required.' }); return null; }
  const parsed = profileQuery.safeParse(req.query);
  if (!parsed.success) { res.status(400).json({ error: 'A valid profileId is required.', details: parsed.error.flatten() }); return null; }
  const aliases: Record<string, string> = { me: 'SELF', mother: 'MOTHER', son: 'SON' };
  const requested = parsed.data.profileId;
  const resolved = aliases[requested] ? await prisma.profile.findFirst({ where: { user_id: session.user.id, relation: aliases[requested] }, select: { id: true } }) : { id: requested };
  const access = resolved && await prisma.profileAccess.findFirst({ where: { profile_id: resolved.id, user_id: session.user.id }, select: { user_id: true, profile_id: true } });
  if (!canAccessProfile(access, session.user.id)) { res.status(403).json({ error: 'You do not have access to this profile.' }); return null; }
  return access!.profile_id;
}
function appointmentDto(item: any) {
  const start = new Date(item.appointment_at);
  const end = new Date(item.ends_at || start.getTime() + 30 * 60000);
  const status = String(item.status).toUpperCase();
  return { id: item.id, status, mode: item.mode, startsAt: start, endsAt: end, reason: item.reason, createdAt: item.created_at, doctor: { id: item.doctor.id, name: /^dr\.?\s/i.test(item.doctor.user.full_name) ? item.doctor.user.full_name : `Dr. ${item.doctor.user.full_name}`, specialty: item.doctor.speciality, photoUrl: item.doctor.photo_url }, clinic: { name: item.doctor.clinic_name, address: item.doctor.clinic_address, city: PUBLIC_CITIES.find((city) => item.doctor.clinic_address.toLowerCase().includes(city.toLowerCase())) || '', lat: item.doctor.clinic_lat, lng: item.doctor.clinic_lng }, canJoinVideo: item.mode === 'VIDEO' && status === 'CONFIRMED' && Date.now() >= start.getTime() - 600000 && Date.now() <= end.getTime(), hasPrescription: Boolean(item.visit_record?.prescription_file_key), hasReport: Boolean(item.visit_record?.report_file_key) };
}
const appointmentInclude = { doctor: { include: { user: { select: { full_name: true } } } }, visit_record: true };
app.get('/api/patient/appointments', async (req, res) => {
  try {
    const parsed = tabQuery.safeParse(req.query);
    if (!parsed.success) { res.status(400).json({ error: 'Invalid appointment query.', details: parsed.error.flatten() }); return; }
    const profileId = await appointmentProfile(req, res); if (!profileId) return;
    const now = new Date();
    const where: any = { profile_id: profileId };
    if (parsed.data.tab === 'upcoming') { where.appointment_at = { gte: now }; where.status = { in: ['pending', 'confirmed', 'PENDING', 'CONFIRMED'] }; }
    if (parsed.data.tab === 'past') where.OR = [{ status: { in: ['completed', 'COMPLETED'] } }, { appointment_at: { lt: now }, status: { notIn: ['cancelled', 'CANCELLED'] } }];
    if (parsed.data.tab === 'cancelled') where.status = { in: ['cancelled', 'CANCELLED'] };
    const rows = await prisma.appointment.findMany({ where, include: appointmentInclude, orderBy: { appointment_at: parsed.data.tab === 'upcoming' ? 'asc' : 'desc' } });
    res.json({ appointments: rows.map(appointmentDto) });
  } catch (error) { console.error('[Appointments] list failed', error); res.status(500).json({ error: 'Could not load appointments.' }); }
});
app.get('/api/patient/appointments/calendar', async (req, res) => {
  const input = z.object({ profileId: z.string().min(1), month: z.string().regex(/^\d{4}-\d{2}$/) }).safeParse(req.query);
  if (!input.success) { res.status(400).json({ error: 'Invalid calendar query.' }); return; }
  try { const profileId = await appointmentProfile(req, res); if (!profileId) return; const [year, month] = input.data.month.split('-').map(Number); const rows = await prisma.appointment.findMany({ where: { profile_id: profileId, appointment_at: { gte: new Date(year, month - 1, 1), lt: new Date(year, month, 1) } }, select: { appointment_at: true, status: true } }); const groups = new Map<string, any>(); for (const row of rows) { const date = new Date(row.appointment_at).toISOString().slice(0, 10); const old = groups.get(date) || { date, count: 0, status: 'CANCELLED' }; old.count++; const rank: any = { CONFIRMED: 4, confirmed: 4, PENDING: 3, pending: 3, COMPLETED: 2, completed: 2, CANCELLED: 1, cancelled: 1 }; if ((rank[row.status] || 0) > (rank[old.status] || 0)) old.status = String(row.status).toUpperCase(); groups.set(date, old); } res.json({ dates: [...groups.values()] }); } catch (error) { console.error(error); res.status(500).json({ error: 'Could not load calendar.' }); }
});
app.get('/api/patient/appointments/past-summary', async (req, res) => {
  const input = z.object({ profileId: z.string().min(1), limit: z.coerce.number().int().min(1).max(20).default(5) }).safeParse(req.query);
  if (!input.success) { res.status(400).json({ error: 'Invalid past summary query.' }); return; }
  try { const profileId = await appointmentProfile(req, res); if (!profileId) return; const rows = await prisma.appointment.findMany({ where: { profile_id: profileId, status: { in: ['completed', 'COMPLETED'] } }, include: appointmentInclude, orderBy: { appointment_at: 'desc' }, take: input.data.limit }); res.json({ visits: rows.map((row: any) => ({ ...appointmentDto(row), date: row.appointment_at, prescriptionUrl: row.visit_record?.prescription_file_key ? `/api/patient/documents/${encodeURIComponent(row.visit_record.prescription_file_key)}` : null, reportUrl: row.visit_record?.report_file_key ? `/api/patient/documents/${encodeURIComponent(row.visit_record.report_file_key)}` : null })) }); } catch (error) { console.error(error); res.status(500).json({ error: 'Could not load past visits.' }); }
});
app.patch('/api/patient/appointments/:id/cancel', async (req, res) => {
  const input = z.object({ profileId: z.string().min(1), reason: z.string().trim().min(1).max(500) }).safeParse({ ...req.body, profileId: req.query.profileId || req.body?.profileId });
  if (!input.success) { res.status(400).json({ error: 'A cancellation reason is required.', details: input.error.flatten() }); return; }
  try { const profileId = await appointmentProfile(req, res); if (!profileId) return; const id = String(req.params.id); const row = await prisma.appointment.findFirst({ where: { id, profile_id: profileId } }); if (!row) { res.status(404).json({ error: 'Appointment not found.' }); return; } if (!['pending', 'confirmed', 'PENDING', 'CONFIRMED'].includes(row.status) || new Date(row.appointment_at) <= new Date()) { res.status(409).json({ error: 'This appointment can no longer be cancelled.' }); return; } await prisma.appointment.update({ where: { id }, data: { status: 'CANCELLED', cancel_reason: input.data.reason } }); res.json({ success: true }); } catch (error) { console.error(error); res.status(500).json({ error: 'Could not cancel appointment.' }); }
});
app.patch('/api/patient/appointments/:id', async (req, res) => {
  const input = z.object({ profileId: z.string().min(1), reason: z.string().max(500).optional(), notes: z.string().max(1000).optional() }).safeParse({ ...req.body, profileId: req.query.profileId || req.body?.profileId });
  if (!input.success) { res.status(400).json({ error: 'Invalid appointment update.', details: input.error.flatten() }); return; }
  try { const profileId = await appointmentProfile(req, res); if (!profileId) return; const id = String(req.params.id); const row = await prisma.appointment.findFirst({ where: { id, profile_id: profileId } }); if (!row) { res.status(404).json({ error: 'Appointment not found.' }); return; } const data: any = {}; if (input.data.reason !== undefined) data.reason = input.data.reason; if (input.data.notes !== undefined) data.notes = input.data.notes; const updated = await prisma.appointment.update({ where: { id }, data }); res.json({ success: true, id: updated.id }); } catch (error) { console.error(error); res.status(500).json({ error: 'Could not update appointment.' }); }
});

const RECORD_CATEGORIES = ['LAB_REPORT', 'PRESCRIPTION', 'IMAGING', 'DISCHARGE_SUMMARY', 'OTHER'] as const;
const VITAL_TYPES = ['BLOOD_SUGAR_FASTING', 'BP_SYSTOLIC', 'BP_DIASTOLIC', 'CHOLESTEROL_TOTAL', 'HEART_RATE', 'WEIGHT'] as const;
const recordsQuery = z.object({ profileId: z.string().min(1) });
async function recordsProfile(req: Request, res: Response, requested?: unknown) {
  const session = getSession(req.cookies[SESSION_COOKIE_NAME]);
  if (!session) { res.status(401).json({ error: 'Authentication required.' }); return null; }
  const parsed = recordsQuery.safeParse({ profileId: requested ?? req.query.profileId });
  if (!parsed.success) { res.status(400).json({ error: 'A valid profileId is required.' }); return null; }
  const relation: Record<string, string> = { me: 'SELF', mother: 'MOTHER', son: 'SON' };
  const alias = relation[parsed.data.profileId];
  const profile = alias ? await prisma.profile.findFirst({ where: { user_id: session.user.id, relation: alias }, select: { id: true } }) : { id: parsed.data.profileId };
  const access = profile && await prisma.profileAccess.findFirst({ where: { profile_id: profile.id, user_id: session.user.id }, select: { profile_id: true, user_id: true } });
  if (!canAccessProfile(access, session.user.id)) { res.status(403).json({ error: 'You do not have access to this profile.' }); return null; }
  return { id: access!.profile_id, userId: session.user.id };
}
const mimeLabel = (mime: string) => mime === 'application/pdf' ? 'PDF' : mime === 'image/jpeg' ? 'JPG' : mime === 'image/png' ? 'PNG' : 'FILE';
app.get('/api/patient/records/vitals', async (req, res) => {
  const input = z.object({ profileId: z.string().min(1), range: z.enum(['30d', '90d', '1y']).default('30d') }).safeParse(req.query);
  if (!input.success) { res.status(400).json({ error: 'Invalid vital range.' }); return; }
  try {
    const profile = await recordsProfile(req, res); if (!profile) return;
    const rows = await prisma.vitalReading.findMany({ where: { patient_id: profile.id, measured_at: { gte: vitalRangeStart(input.data.range) } }, orderBy: { measured_at: 'asc' } });
    const types = [...VITAL_TYPES].filter((type) => type !== 'BP_DIASTOLIC'); const vitals: Record<string, any> = {};
    for (const type of types) {
      if (type === 'BP_SYSTOLIC') {
        const sys = rows.filter((row: any) => row.type === 'BP_SYSTOLIC'); const dia = rows.filter((row: any) => row.type === 'BP_DIASTOLIC');
        const points = sys.map((row: any) => { const pair = dia.reduce((best: any, candidate: any) => Math.abs(new Date(candidate.measured_at).getTime() - new Date(row.measured_at).getTime()) < Math.abs(new Date(best?.measured_at || 0).getTime() - new Date(row.measured_at).getTime()) ? candidate : best, null); return { measuredAt: row.measured_at, systolic: row.value, diastolic: pair && Math.abs(new Date(pair.measured_at).getTime() - new Date(row.measured_at).getTime()) < 60000 ? pair.value : null, unit: row.unit }; });
        const latest = [...points].reverse().find((point) => point.diastolic != null); vitals.BLOOD_PRESSURE = { latest: latest ? { systolic: latest.systolic, diastolic: latest.diastolic, unit: latest.unit, measuredAt: latest.measuredAt } : null, points }; continue;
      }
      const series = rows.filter((row: any) => row.type === type).map((row: any) => ({ value: row.value, unit: row.unit, measuredAt: row.measured_at }));
      vitals[type] = { latest: series.at(-1) || null, points: series };
    }
    res.json({ vitals });
  } catch (error) { console.error('[Records] vitals failed', error); res.status(500).json({ error: 'Could not load vital readings.' }); }
});
app.get('/api/patient/records/conditions', async (req, res) => {
  try { const profile = await recordsProfile(req, res); if (!profile) return; const [patient, conditions] = await Promise.all([prisma.profile.findFirst({ where: { id: profile.id }, select: { allergies: true } }), prisma.patientCondition.findMany({ where: { patient_id: profile.id }, orderBy: [{ status: 'asc' }, { name: 'asc' }] })]); res.json({ conditions: conditions.map((item: any) => ({ id: item.id, name: item.name, status: item.status, since: item.since })), allergies: patient?.allergies || [] }); }
  catch (error) { console.error('[Records] conditions failed', error); res.status(500).json({ error: 'Could not load conditions.' }); }
});
app.patch('/api/patient/records/conditions', async (req, res) => {
  const input = z.object({ profileId: z.string().min(1), allergies: z.array(z.string().trim().min(1).max(80)).max(30), conditions: z.array(z.object({ name: z.string().trim().min(1).max(100), status: z.enum(['ACTIVE', 'RESOLVED']), since: z.string().date().optional().or(z.literal('')) })).max(50) }).safeParse({ ...req.body, profileId: req.query.profileId || req.body?.profileId });
  if (!input.success) { res.status(400).json({ error: 'Invalid condition details.', details: input.error.flatten() }); return; }
  try { const profile = await recordsProfile(req, res); if (!profile) return; await prisma.profile.update({ where: { id: profile.id }, data: { allergies: [...new Set(input.data.allergies.map((allergy) => allergy.trim()).filter(Boolean))] } }); await prisma.patientCondition.deleteMany({ where: { patient_id: profile.id } }); for (const condition of input.data.conditions) await prisma.patientCondition.create({ data: { patient_id: profile.id, name: condition.name, status: condition.status, since: condition.since ? new Date(condition.since) : null } }); res.json({ success: true }); }
  catch (error) { console.error('[Records] condition update failed', error); res.status(500).json({ error: 'Could not save condition details.' }); }
});
app.get('/api/patient/records', async (req, res) => {
  const input = z.object({ profileId: z.string().min(1), category: z.enum(['ALL', ...RECORD_CATEGORIES]).default('ALL'), q: z.string().max(120).default(''), from: z.string().date().optional(), to: z.string().date().optional(), page: z.coerce.number().int().min(1).default(1), pageSize: z.coerce.number().int().min(1).max(50).default(8) }).safeParse(req.query);
  if (!input.success) { res.status(400).json({ error: 'Invalid records query.', details: input.error.flatten() }); return; }
  try {
    const profile = await recordsProfile(req, res); if (!profile) return;
    const where: any = { patient_id: profile.id, deleted_at: null };
    const selectedCategory = recordCategoryFilter(input.data.category); if (selectedCategory) where.category = selectedCategory;
    if (input.data.q.trim()) where.OR = [{ title: { contains: input.data.q.trim(), mode: 'insensitive' } }, { issuer: { contains: input.data.q.trim(), mode: 'insensitive' } }];
    if (input.data.from || input.data.to) where.record_date = { ...(input.data.from ? { gte: new Date(`${input.data.from}T00:00:00`) } : {}), ...(input.data.to ? { lte: new Date(`${input.data.to}T23:59:59.999`) } : {}) };
    const [rows, total] = await Promise.all([prisma.healthRecord.findMany({ where, include: { doctor: { include: { user: { select: { full_name: true } } } } }, orderBy: { record_date: 'desc' }, skip: (input.data.page - 1) * input.data.pageSize, take: input.data.pageSize }), prisma.healthRecord.count({ where })]);
    res.json({ records: rows.map((row: any) => ({ id: row.id, title: row.title, issuer: row.issuer, recordDate: row.record_date, category: row.category, fileType: mimeLabel(row.mime_type), mimeType: row.mime_type, fileName: row.file_name, source: row.source, doctor: row.doctor ? { name: row.doctor.user.full_name, photoUrl: row.doctor.photo_url } : null })), page: input.data.page, pageSize: input.data.pageSize, total, hasMore: input.data.page * input.data.pageSize < total });
  } catch (error) { console.error('[Records] list failed', error); res.status(500).json({ error: 'Could not load health records.' }); }
});
app.get('/api/patient/records/access-history', async (req, res) => {
  const input = z.object({ profileId: z.string().min(1), limit: z.coerce.number().int().min(1).max(50).default(10), cursor: z.string().optional() }).safeParse(req.query);
  if (!input.success) { res.status(400).json({ error: 'Invalid access history query.' }); return; }
  try { const profile = await recordsProfile(req, res); if (!profile) return; const rows = await prisma.accessLog.findMany({ where: { patient_id: profile.id }, include: { doctor: { include: { user: { select: { full_name: true } } } } }, orderBy: { created_at: 'desc' }, take: input.data.limit, ...(input.data.cursor ? { skip: 1, cursor: { id: input.data.cursor } } : {}) }); res.json({ entries: rows.map((row: any) => ({ id: row.id, doctor: { name: row.doctor.user.full_name, photoUrl: row.doctor.photo_url }, action: row.action, recordTitle: row.record_title, createdAt: row.created_at })) }); }
  catch (error) { console.error('[Records] access history failed', error); res.status(500).json({ error: 'Could not load access history.' }); }
});
app.get('/api/patient/records/:id/file', async (req, res) => {
  const input = z.object({ profileId: z.string().min(1), disposition: z.enum(['inline', 'attachment']).default('inline') }).safeParse(req.query);
  if (!input.success) { res.status(400).json({ error: 'Invalid file request.' }); return; }
  try { const profile = await recordsProfile(req, res); if (!profile) return; const row = await prisma.healthRecord.findFirst({ where: { id: String(req.params.id), patient_id: profile.id, deleted_at: null } }); if (!row) { res.status(404).json({ error: 'Record not found.' }); return; } res.setHeader('Content-Type', row.mime_type); res.setHeader('Content-Disposition', `${input.data.disposition}; filename*=UTF-8''${encodeURIComponent(row.file_name)}`); res.setHeader('Cache-Control', 'private, no-store'); res.sendFile(recordPath(row.file_key), (error) => { if (error && !res.headersSent) res.status(404).json({ error: 'Record file is unavailable.' }); }); }
  catch (error) { console.error('[Records] file access failed', error); if (!res.headersSent) res.status(500).json({ error: 'Could not open this record.' }); }
});
app.post('/api/patient/records', async (req, res) => {
  const session = getSession(req.cookies[SESSION_COOKIE_NAME]); if (!session) { res.status(401).json({ error: 'Authentication required.' }); return; }
  let storedKey: string | null = null;
  try {
    const multipart = await readRecordMultipart(req); const input = z.object({ profileId: z.string().min(1), title: z.string().trim().min(1).max(160), category: z.enum(RECORD_CATEGORIES), issuer: z.string().trim().min(1).max(160), recordDate: z.string().date(), doctorName: z.string().max(120).optional() }).safeParse(multipart.fields);
    if (!input.success) { res.status(400).json({ error: 'Complete the record details.', details: input.error.flatten() }); return; }
    if (!multipart.file.bytes.length || multipart.file.bytes.length > 10 * 1024 * 1024) { res.status(400).json({ error: 'Record file must be between 1 byte and 10 MB.' }); return; }
    const detected = detectRecordMime(multipart.file.bytes); if (!detected) { res.status(415).json({ error: 'Only genuine PDF, JPG, or PNG files are accepted.' }); return; }
    const profile = await recordsProfile(req, res, input.data.profileId); if (!profile) return;
    const safeName = Array.from(path.basename(multipart.file.filename)).filter((character) => character.charCodeAt(0) >= 32 && character.charCodeAt(0) !== 127).join('').slice(0, 180);
    const fileName = `${path.parse(safeName).name || 'health-record'}.${detected.extension}`;
    let doctorId: string | null = null;
    if (input.data.doctorName?.trim()) {
      const doctors = await prisma.doctorProfile.findMany({ where: { status: 'approved' }, include: { user: { select: { full_name: true } } } });
      const doctor = doctors.find((candidate: any) => candidate.user.full_name.toLocaleLowerCase() === input.data.doctorName!.trim().toLocaleLowerCase());
      if (!doctor) { res.status(400).json({ error: 'That doctor was not found. Clear the doctor name or choose a listed doctor.' }); return; }
      doctorId = doctor.id;
    }
    storedKey = await storeRecord(multipart.file.bytes, detected.extension);
    const record = await prisma.healthRecord.create({ data: { patient_id: profile.id, category: input.data.category, title: input.data.title, issuer: input.data.issuer, record_date: new Date(`${input.data.recordDate}T12:00:00`), doctor_id: doctorId, uploaded_by: session.user.id, source: 'PATIENT_UPLOAD', file_key: storedKey, file_name: fileName, mime_type: detected.mimeType, size_bytes: multipart.file.bytes.length } });
    res.status(201).json({ success: true, id: record.id });
  } catch (error: any) { if (storedKey) await removeRecord(storedKey).catch(() => undefined); const status = /10 MB|multipart|Choose|Upload one/.test(error?.message || '') ? 400 : 500; res.status(status).json({ error: error?.message || 'Could not upload this record.' }); }
});
app.delete('/api/patient/records/:id', async (req, res) => {
  const input = recordsQuery.safeParse(req.query); if (!input.success) { res.status(400).json({ error: 'A valid profileId is required.' }); return; }
  try { const profile = await recordsProfile(req, res); if (!profile) return; const row = await prisma.healthRecord.findFirst({ where: { id: String(req.params.id), patient_id: profile.id, deleted_at: null } }); if (!row) { res.status(404).json({ error: 'Record not found.' }); return; } if (row.source !== 'PATIENT_UPLOAD') { res.status(403).json({ error: 'Doctor-written records cannot be removed.' }); return; } await prisma.healthRecord.update({ where: { id: row.id }, data: { deleted_at: new Date() } }); res.json({ success: true }); }
  catch (error) { console.error('[Records] delete failed', error); res.status(500).json({ error: 'Could not remove this record.' }); }
});
app.post('/api/patient/records/vitals', async (req, res) => {
  const input = z.object({ profileId: z.string().min(1), type: z.enum(VITAL_TYPES), value: z.number().finite().optional(), systolic: z.number().finite().optional(), diastolic: z.number().finite().optional(), measuredAt: z.string().datetime().optional() }).safeParse({ ...req.body, profileId: req.query.profileId || req.body?.profileId });
  if (!input.success) { res.status(400).json({ error: 'Invalid vital reading.', details: input.error.flatten() }); return; }
  const ranges: Record<string, [number, number, string]> = { BLOOD_SUGAR_FASTING: [20, 600, 'mg/dL'], BP_SYSTOLIC: [50, 300, 'mmHg'], CHOLESTEROL_TOTAL: [50, 1000, 'mg/dL'], HEART_RATE: [20, 250, 'bpm'], WEIGHT: [1, 500, 'kg'] };
  const readingAt = input.data.measuredAt ? new Date(input.data.measuredAt) : new Date(); if (readingAt.getTime() > Date.now() + 300000) { res.status(400).json({ error: 'Measurement date cannot be in the future.' }); return; }
  try { const profile = await recordsProfile(req, res); if (!profile) return; const data: any[] = []; if (input.data.type === 'BP_SYSTOLIC') { if (input.data.systolic == null || input.data.diastolic == null || input.data.systolic < 50 || input.data.systolic > 300 || input.data.diastolic < 30 || input.data.diastolic > 200) { res.status(400).json({ error: 'Enter blood pressure between 50–300 / 30–200 mmHg.' }); return; } data.push({ patient_id: profile.id, type: 'BP_SYSTOLIC', value: input.data.systolic, unit: 'mmHg', measured_at: readingAt, source: 'SELF' }, { patient_id: profile.id, type: 'BP_DIASTOLIC', value: input.data.diastolic, unit: 'mmHg', measured_at: readingAt, source: 'SELF' }); } else { const config = ranges[input.data.type]; if (input.data.value == null || input.data.value < config[0] || input.data.value > config[1]) { res.status(400).json({ error: `Value must be from ${config[0]} to ${config[1]} ${config[2]}.` }); return; } data.push({ patient_id: profile.id, type: input.data.type, value: input.data.value, unit: config[2], measured_at: readingAt, source: 'SELF' }); } for (const row of data) await prisma.vitalReading.create({ data: row }); res.status(201).json({ success: true }); }
  catch (error) { console.error('[Records] vital save failed', error); res.status(500).json({ error: 'Could not save this reading.' }); }
});

export { app };

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`[ArogyaNexus] Local Auth Server listening on http://localhost:${PORT}`);
  });
}
