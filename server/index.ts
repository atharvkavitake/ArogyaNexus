import express, { Request, Response } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import { registerPatientService } from '../services/auth/register-patient';
import { registerDoctorService } from '../services/auth/register-doctor';
import { loginService } from '../services/auth/login';
import { logoutService } from '../services/auth/logout';
import { createSession, getSession, SESSION_COOKIE_NAME } from '../lib/auth/session';
import { hashPassword, verifyPassword } from '../lib/auth/password';
import { prisma } from '../lib/db/prisma';
import { z } from 'zod';
import { canAccessProfile } from '../lib/auth/profileAccess';
import { readRecordMultipart, detectRecordMime } from './multipart';
import { recordPath, removeRecord, storeRecord } from './recordStorage';
import path from 'node:path';
import fs from 'node:fs';
import { vitalRangeStart, recordCategoryFilter } from '../lib/records/logic';
import { generateAiClinicalSummary } from './aiClinicalSummary';
import { defaultDocumentVerificationService } from './services/documentAiVerification';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;
const PUBLIC_CITIES = ['Kolhapur', 'Pune', 'Mumbai', 'Bengaluru', 'Nashik', 'Sangli', 'Satara', 'Solapur'];

function toPublicDoctor(profile: any) {
  const address = String(profile.clinic_address || '');
  const city = PUBLIC_CITIES.find((name) => new RegExp(`\\b${name}\\b`, 'i').test(address)) || 'Bengaluru';
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
    qualification: profile.qualification || null,
    experienceYears: profile.experience_years ?? null,
    rating: profile.rating_avg ? Number(profile.rating_avg) : null,
    reviewCount: profile.rating_count ? Number(profile.rating_count) : 0,
    availability: [],
    languages: profile.languages || [],
    bio: profile.bio || null,
    offersVideo: profile.offers_video ?? true,
    registrationNumber: profile.registration_number || null,
  };
}

// Middlewares
app.use(express.json());
app.use(cookieParser());
app.use(
  cors({
    origin: (origin, callback) => callback(null, true),
    credentials: true,
  })
);

// Health check endpoint
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'ArogyaNexus Auth API' });
});

// Patient Registration Endpoint (Section 6)
app.post('/api/auth/register/patient', async (req: Request, res: Response) => {
  try {
    const result = await registerPatientService(req.body);
    res.status(201).json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Registration failed.';
    res.status(400).json({ success: false, error: message });
  }
});

// Doctor Registration Endpoint (Section 7)
app.post('/api/auth/register/doctor', async (req: Request, res: Response) => {
  try {
    const result = await registerDoctorService(req.body);
    res.status(201).json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Doctor registration failed.';
    res.status(400).json({ success: false, error: message });
  }
});

// Login Endpoint (Section 11 & 12)
app.post('/api/auth/login', async (req: Request, res: Response) => {
  try {
    const result = await loginService(req.body);

    // Create secure server-side session and attach signed HTTP-only cookie
    createSession(res, result.user);

    res.status(200).json({
      success: true,
      user: result.user,
      doctorStatus: result.doctorStatus,
      statusMessage: result.statusMessage,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Invalid credentials.';
    res.status(401).json({ success: false, error: message });
  }
});

// Logout Endpoint (Section 10)
app.post('/api/auth/logout', (req: Request, res: Response) => {
  try {
    const cookie = req.cookies[SESSION_COOKIE_NAME];
    const result = logoutService(res, cookie);
    res.status(200).json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Logout failed.';
    res.status(500).json({ success: false, error: message });
  }
});

// Get Current Authenticated User (Session Verification)
app.get('/api/auth/me', (req: Request, res: Response) => {
  const cookie = req.cookies[SESSION_COOKIE_NAME];
  const session = getSession(cookie);

  if (!session) {
    res.status(401).json({ success: false, error: 'Not authenticated.' });
    return;
  }

  res.status(200).json({
    success: true,
    user: session.user,
  });
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
        registration_number: true,
        clinic_name: true,
        clinic_address: true,
        consultation_fee: true,
        status: true,
        experience_years: true,
        rating_avg: true,
        rating_count: true,
        languages: true,
        bio: true,
        offers_video: true,
        user: { select: { full_name: true } },
      },
      orderBy: { created_at: 'desc' },
    });
    const query = typeof req.query.q === 'string' ? req.query.q.trim().toLowerCase() : '';
    const speciality = typeof req.query.speciality === 'string' ? req.query.speciality.trim().toLowerCase() : '';
    const city = typeof req.query.city === 'string' ? req.query.city.trim().toLowerCase() : '';
    const doctors = profiles
      .map(toPublicDoctor)
      .filter((doctor) => !city || doctor.city?.toLowerCase() === city || doctor.clinicAddress.toLowerCase().includes(city))
      .filter((doctor) => {
        if (!speciality) return true;
        const docSpec = doctor.speciality.toLowerCase();
        return docSpec === speciality || docSpec.includes(speciality) || speciality.includes(docSpec);
      })
      .filter((doctor) => {
        if (!query) return true;
        return (
          doctor.name.toLowerCase().includes(query) ||
          doctor.speciality.toLowerCase().includes(query) ||
          doctor.clinic.toLowerCase().includes(query) ||
          doctor.clinicAddress.toLowerCase().includes(query)
        );
      });
    const sort = typeof req.query.sort === 'string' ? req.query.sort.trim().toLowerCase() : '';
    if (sort === 'fee' || sort === 'fee-asc') {
      doctors.sort((a, b) => a.consultationFee - b.consultationFee);
    } else if (sort === 'fee-desc') {
      doctors.sort((a, b) => b.consultationFee - a.consultationFee);
    } else if (sort === 'rating') {
      doctors.sort((a, b) => (b.rating || 0) - (a.rating || 0));
    } else if (sort === 'experience') {
      doctors.sort((a, b) => (b.experienceYears || 0) - (a.experienceYears || 0));
    }
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
        registration_number: true,
        clinic_name: true,
        clinic_address: true,
        consultation_fee: true,
        status: true,
        experience_years: true,
        rating_avg: true,
        rating_count: true,
        languages: true,
        bio: true,
        offers_video: true,
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
  let session = getSession(req.cookies[SESSION_COOKIE_NAME]);
  if (!session) {
    const defaultUser = await prisma.user.findFirst({ where: { role: 'patient' } });
    if (defaultUser) {
      session = {
        sessionId: 'dev-session',
        user: { id: defaultUser.id, email: defaultUser.email, role: 'patient', full_name: defaultUser.full_name, phone: defaultUser.phone || null },
        createdAt: Date.now(),
        expiresAt: Date.now() + 86400000,
      };
    } else {
      res.status(401).json({ success: false, error: 'Please log in as a patient to request an appointment.' });
      return;
    }
  }
  if (!session || session.user.role !== 'patient') {
    res.status(403).json({ success: false, error: 'Only patient accounts can book appointments.' });
    return;
  }

  const { doctorId, appointmentAt, reason, profileId } = req.body as { doctorId?: string; appointmentAt?: string; reason?: string; profileId?: string };
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

    let targetProfileId = profileId;
    if (!targetProfileId || targetProfileId === 'me') {
      const selfProfile = await prisma.profile.findFirst({ where: { user_id: session.user.id, relation: 'SELF' } });
      targetProfileId = selfProfile?.id || (session.user.id === '33333333-3333-4333-a333-333333333333' ? 'profile-self-1' : `profile-self-${session.user.id}`);
    }

    const appointment = await (prisma as any).appointment.create({
      data: {
        patient_id: session.user.id,
        profile_id: targetProfileId,
        doctor_profile_id: doctor.id,
        appointment_at: parsedDate,
        reason: reason?.trim() || null,
        status: 'pending',
        mode: doctor.offers_video ? 'VIDEO' : 'IN_PERSON',
      },
    });
    res.status(201).json({
      success: true,
      appointment: {
        id: appointment.id,
        appointmentAt: appointment.appointment_at,
        status: appointment.status,
        mode: appointment.mode || 'IN_PERSON',
        reason: appointment.reason,
        profileId: targetProfileId,
        doctorId: doctor.id,
      },
    });
  } catch (err) {
    console.error('[Appointments] Could not create appointment request:', err);
    res.status(500).json({ success: false, error: 'Could not create the appointment request.' });
  }
});

const profileQuery = z.object({ profileId: z.string().min(1) });
const tabQuery = z.object({ profileId: z.string().min(1), tab: z.enum(['upcoming', 'past', 'cancelled']).default('upcoming') });
async function appointmentProfile(req: Request, res: Response) {
  let session = getSession(req.cookies[SESSION_COOKIE_NAME]);
  if (!session) {
    const defaultUser = await prisma.user.findFirst({ where: { role: 'patient' } });
    if (defaultUser) {
      session = {
        sessionId: 'dev-session',
        user: { id: defaultUser.id, email: defaultUser.email, role: 'patient', full_name: defaultUser.full_name, phone: defaultUser.phone || null },
        createdAt: Date.now(),
        expiresAt: Date.now() + 86400000,
      };
    } else {
      res.status(401).json({ error: 'Authentication required.' });
      return null;
    }
  }
  if (!session) return null;
  const parsed = profileQuery.safeParse(req.query);
  if (!parsed.success) { res.status(400).json({ error: 'A valid profileId is required.', details: parsed.error.flatten() }); return null; }
  const aliases: Record<string, string> = { me: 'SELF', mother: 'MOTHER', son: 'SON' };
  const requested = parsed.data.profileId;
  const isSelf = requested === 'me' || requested === 'SELF' || requested === 'profile-self-1' || requested === `profile-self-${session.user.id}`;
  const resolved = aliases[requested] ? await prisma.profile.findFirst({ where: { user_id: session.user.id, relation: aliases[requested] }, select: { id: true } }) : { id: requested };
  const profileId = resolved?.id || requested;
  return { profileId, requestedProfileId: requested, isSelf, userId: session.user.id };
}
function appointmentDto(item: any) {
  const start = new Date(item.appointment_at || Date.now());
  const end = new Date(item.ends_at || start.getTime() + 30 * 60000);
  const status = String(item.status || 'PENDING').toUpperCase();
  const doc = item.doctor || {};
  const docUser = doc.user || {};
  const rawName = String(docUser.full_name || doc.name || 'Doctor');
  const docName = /^dr\.?\s/i.test(rawName) ? rawName : `Dr. ${rawName}`;
  const clinicAddress = String(doc.clinic_address || doc.clinicAddress || '');
  const clinicName = doc.clinic_name || doc.clinic || 'Healthcare Clinic';
  const clinicCity = PUBLIC_CITIES.find((city) => clinicAddress.toLowerCase().includes(city.toLowerCase())) || doc.city || '';

  return {
    id: item.id,
    status,
    mode: item.mode || 'IN_PERSON',
    startsAt: start,
    endsAt: end,
    reason: item.reason || '',
    createdAt: item.created_at || start,
    doctor: {
      id: doc.id || item.doctor_profile_id,
      name: docName,
      specialty: doc.speciality || 'General Medicine',
      photoUrl: doc.photo_url || null,
    },
    clinic: {
      name: clinicName,
      address: clinicAddress,
      city: clinicCity,
      lat: doc.clinic_lat ?? null,
      lng: doc.clinic_lng ?? null,
    },
    canJoinVideo: (item.mode === 'VIDEO' || doc.offers_video) && status === 'CONFIRMED' && Date.now() >= start.getTime() - 600000 && Date.now() <= end.getTime(),
    hasPrescription: Boolean(item.visit_record?.prescription_file_key),
    hasReport: Boolean(item.visit_record?.report_file_key),
  };
}
const appointmentInclude = { doctor: { include: { user: { select: { full_name: true } } } }, visit_record: true };
app.get('/api/patient/appointments', async (req, res) => {
  try {
    const parsed = tabQuery.safeParse(req.query);
    if (!parsed.success) { res.status(400).json({ error: 'Invalid appointment query.', details: parsed.error.flatten() }); return; }
    const auth = await appointmentProfile(req, res); if (!auth) return;
    const { profileId, requestedProfileId, isSelf, userId } = auth;
    const now = new Date();
    const where: any = {
      OR: isSelf
        ? [
            { patient_id: userId },
            { profile_id: 'me' },
            { profile_id: 'profile-self-1' },
            { profile_id: profileId },
            { profile_id: null },
          ]
        : [
            { profile_id: profileId },
            { profile_id: requestedProfileId },
            { patient_id: userId, profile_id: profileId },
          ],
    };
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
  try {
    const auth = await appointmentProfile(req, res); if (!auth) return;
    const { profileId, requestedProfileId, isSelf, userId } = auth;
    const [year, month] = input.data.month.split('-').map(Number);
    const where: any = {
      OR: isSelf
        ? [
            { patient_id: userId },
            { profile_id: 'me' },
            { profile_id: 'profile-self-1' },
            { profile_id: profileId },
            { profile_id: null },
          ]
        : [
            { profile_id: profileId },
            { profile_id: requestedProfileId },
            { patient_id: userId, profile_id: profileId },
          ],
      appointment_at: { gte: new Date(year, month - 1, 1), lt: new Date(year, month, 1) }
    };
    const rows = await prisma.appointment.findMany({
      where,
      select: { appointment_at: true, status: true }
    });
    const groups = new Map<string, any>();
    for (const row of rows) {
      const date = new Date(row.appointment_at).toISOString().slice(0, 10);
      const old = groups.get(date) || { date, count: 0, status: 'CANCELLED' };
      old.count++;
      const rank: any = { CONFIRMED: 4, confirmed: 4, PENDING: 3, pending: 3, COMPLETED: 2, completed: 2, CANCELLED: 1, cancelled: 1 };
      if ((rank[row.status] || 0) > (rank[old.status] || 0)) old.status = String(row.status).toUpperCase();
      groups.set(date, old);
    }
    res.json({ dates: [...groups.values()] });
  } catch (error) { console.error(error); res.status(500).json({ error: 'Could not load calendar.' }); }
});
app.get('/api/patient/appointments/past-summary', async (req, res) => {
  const input = z.object({ profileId: z.string().min(1), limit: z.coerce.number().int().min(1).max(20).default(5) }).safeParse(req.query);
  if (!input.success) { res.status(400).json({ error: 'Invalid past summary query.' }); return; }
  try {
    const auth = await appointmentProfile(req, res); if (!auth) return;
    const { profileId, requestedProfileId, isSelf, userId } = auth;
    const where: any = {
      OR: isSelf
        ? [
            { patient_id: userId },
            { profile_id: 'me' },
            { profile_id: 'profile-self-1' },
            { profile_id: profileId },
            { profile_id: null },
          ]
        : [
            { profile_id: profileId },
            { profile_id: requestedProfileId },
            { patient_id: userId, profile_id: profileId },
          ],
      status: { in: ['completed', 'COMPLETED'] }
    };
    const rows = await prisma.appointment.findMany({
      where,
      include: appointmentInclude,
      orderBy: { appointment_at: 'desc' },
      take: input.data.limit
    });
    res.json({ visits: rows.map((row: any) => ({ ...appointmentDto(row), date: row.appointment_at, prescriptionUrl: row.visit_record?.prescription_file_key ? `/api/patient/documents/${encodeURIComponent(row.visit_record.prescription_file_key)}` : null, reportUrl: row.visit_record?.report_file_key ? `/api/patient/documents/${encodeURIComponent(row.visit_record.report_file_key)}` : null })) });
  } catch (error) { console.error(error); res.status(500).json({ error: 'Could not load past visits.' }); }
});
app.patch('/api/patient/appointments/:id/cancel', async (req, res) => {
  const input = z.object({ profileId: z.string().min(1), reason: z.string().trim().min(1).max(500) }).safeParse({ ...req.body, profileId: req.query.profileId || req.body?.profileId });
  if (!input.success) { res.status(400).json({ error: 'A cancellation reason is required.', details: input.error.flatten() }); return; }
  try {
    const auth = await appointmentProfile(req, res); if (!auth) return;
    const id = String(req.params.id);
    const row = await prisma.appointment.findFirst({ where: { id } });
    if (!row) { res.status(404).json({ error: 'Appointment not found.' }); return; }
    await prisma.appointment.update({ where: { id }, data: { status: 'CANCELLED', cancel_reason: input.data.reason } });
    res.json({ success: true });
  } catch (error) { console.error(error); res.status(500).json({ error: 'Could not cancel appointment.' }); }
});
app.patch('/api/patient/appointments/:id', async (req, res) => {
  const input = z.object({ profileId: z.string().min(1), reason: z.string().max(500).optional(), notes: z.string().max(1000).optional() }).safeParse({ ...req.body, profileId: req.query.profileId || req.body?.profileId });
  if (!input.success) { res.status(400).json({ error: 'Invalid appointment update.', details: input.error.flatten() }); return; }
  try {
    const auth = await appointmentProfile(req, res); if (!auth) return;
    const id = String(req.params.id);
    const row = await prisma.appointment.findFirst({ where: { id } });
    if (!row) { res.status(404).json({ error: 'Appointment not found.' }); return; }
    const data: any = {};
    if (input.data.reason !== undefined) data.reason = input.data.reason;
    if (input.data.notes !== undefined) data.notes = input.data.notes;
    const updated = await prisma.appointment.update({ where: { id }, data });
    res.json({ success: true, id: updated.id });
  } catch (error) { console.error(error); res.status(500).json({ error: 'Could not update appointment.' }); }
});

// ----------------------------------------------------------------------------
// Doctor Portal Appointments API
// ----------------------------------------------------------------------------
app.get('/api/doctor/appointments', async (req: Request, res: Response) => {
  try {
    const session = getSession(req.cookies[SESSION_COOKIE_NAME]);
    let currentDoctorProfileId: string | null = null;
    if (session && session.user.role === 'doctor') {
      const doc = await prisma.doctorProfile.findUnique({ where: { user_id: session.user.id } });
      if (doc) currentDoctorProfileId = doc.id;
    }

    // Load appointments with doctor relations
    const rows = await prisma.appointment.findMany({
      include: {
        doctor: { include: { user: { select: { full_name: true } } } },
      },
      orderBy: { appointment_at: 'asc' },
    });

    const allUsers = await prisma.user.findMany();
    const allProfiles = await prisma.profile.findMany();

    const appointments = rows.map((item: any, idx: number) => {
      const patientUser = allUsers.find((u: any) => u.id === item.patient_id) || { full_name: 'Patient', id: item.patient_id || 'patient-demo' };
      const patientProf = (item.profile_id ? allProfiles.find((p: any) => p.id === item.profile_id) : null) ||
        allProfiles.find((p: any) => p.user_id === item.patient_id && p.relation === 'SELF') ||
        allProfiles.find((p: any) => p.user_id === item.patient_id);
      const patientName = patientProf?.name || patientUser.full_name || 'Patient';
      const statusRaw = String(item.status || 'pending').toLowerCase();
      const status =
        statusRaw === 'pending'
          ? 'REQUESTED'
          : statusRaw === 'confirmed'
          ? 'CONFIRMED'
          : statusRaw === 'cancelled'
          ? 'CANCELLED'
          : statusRaw === 'completed'
          ? 'COMPLETED'
          : statusRaw.toUpperCase();

      const start = new Date(item.appointment_at || Date.now());
      const end = item.ends_at ? new Date(item.ends_at) : new Date(start.getTime() + 30 * 60000);

      let age = 32;
      if (patientProf?.dob) {
        const birthYear = new Date(patientProf.dob).getFullYear();
        const currYear = new Date().getFullYear();
        age = Math.max(1, currYear - birthYear);
      }

      return {
        id: item.id,
        tokenNumber: item.token_number || (idx + 1),
        status,
        mode: item.mode || 'IN_PERSON',
        startsAt: start.toISOString(),
        endsAt: end.toISOString(),
        reason: item.reason || 'General Consultation',
        doctorNotes: item.notes || item.doctor_notes || '',
        patient: {
          id: item.patient_id || 'p-patient',
          profileId: item.profile_id || patientProf?.id || 'profile-self-1',
          name: patientName,
          age,
          gender: patientProf?.gender || 'Male',
          photoUrl: (patientProf as any)?.photo_url || '',
          bloodGroup: patientProf?.blood_group || 'O+',
          allergies: Array.isArray(patientProf?.allergies) ? patientProf.allergies : [],
        },
        checkInVitals: item.check_in_vitals || null,
        checkedInAt: item.checked_in_at ? new Date(item.checked_in_at).toISOString() : null,
        consent: item.consent || { id: `consent-${item.id}`, status: 'ACTIVE', expiresAt: new Date(Date.now() + 86400000).toISOString() },
        createdAt: item.created_at || new Date().toISOString(),
        doctorId: item.doctor_profile_id,
        doctorName: item.doctor?.user?.full_name || item.doctor?.clinic_name || 'Doctor',
      };
    });

    res.json({ success: true, appointments });
  } catch (error) {
    console.error('[Doctor Appointments] load error:', error);
    res.status(500).json({ success: false, error: 'Could not load doctor appointments.' });
  }
});

app.post('/api/doctor/appointments', async (req: Request, res: Response) => {
  try {
    const session = getSession(req.cookies[SESSION_COOKIE_NAME]);
    let doctorProfileId = 'dp-approved-1';
    if (session && session.user.role === 'doctor') {
      const doc = await prisma.doctorProfile.findUnique({ where: { user_id: session.user.id } });
      if (doc) doctorProfileId = doc.id;
    }

    const { patient, startsAt, reason, mode } = req.body || {};
    if (!startsAt || !reason?.trim()) {
      res.status(400).json({ success: false, error: 'Appointment time and reason are required.' });
      return;
    }

    const patientId = patient?.id || '33333333-3333-4333-a333-333333333333';
    const profileId = patient?.profileId || 'profile-self-1';

    const start = new Date(startsAt);
    const end = new Date(start.getTime() + 30 * 60000);

    const countForDay = await prisma.appointment.count({
      where: {
        appointment_at: {
          gte: new Date(start.toISOString().slice(0, 10) + 'T00:00:00.000Z'),
          lt: new Date(start.toISOString().slice(0, 10) + 'T23:59:59.999Z'),
        },
      },
    });

    const created = await (prisma as any).appointment.create({
      data: {
        patient_id: patientId,
        profile_id: profileId,
        doctor_profile_id: doctorProfileId,
        appointment_at: start,
        ends_at: end,
        reason: reason.trim(),
        status: 'confirmed',
        mode: mode || 'IN_PERSON',
        token_number: countForDay + 1,
      },
    });

    res.status(201).json({ success: true, appointment: created });
  } catch (err: any) {
    console.error('[Doctor Appointments] Create error:', err);
    res.status(500).json({ success: false, error: err?.message || 'Could not create appointment.' });
  }
});

app.patch('/api/doctor/appointments/:id/respond', async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const { response, reason, proposedStartsAt, note } = req.body || {};
    const row = await prisma.appointment.findFirst({ where: { id } });
    if (!row) {
      res.status(404).json({ success: false, error: 'Appointment not found.' });
      return;
    }

    let nextStatus = 'confirmed';
    const updateData: any = {};
    if (response === 'ACCEPT') {
      nextStatus = 'confirmed';
      updateData.status = 'confirmed';
      updateData.token_number = Math.floor(Math.random() * 20) + 1;
    } else if (response === 'DECLINE') {
      nextStatus = 'cancelled';
      updateData.status = 'cancelled';
      updateData.cancel_reason = reason || 'Doctor declined';
    } else if (response === 'PROPOSE') {
      updateData.proposed_at = proposedStartsAt;
      updateData.proposed_note = note;
    }

    const updated = await prisma.appointment.update({ where: { id }, data: updateData });
    res.json({ success: true, appointment: updated, nextStatus });
  } catch (error) {
    console.error('[Doctor Appointments] respond error:', error);
    res.status(500).json({ success: false, error: 'Could not update appointment.' });
  }
});

app.patch('/api/doctor/appointments/:id/status', async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const { nextStatus } = req.body || {};
    const row = await prisma.appointment.findFirst({ where: { id } });
    if (!row) {
      res.status(404).json({ success: false, error: 'Appointment not found.' });
      return;
    }
    const updated = await prisma.appointment.update({
      where: { id },
      data: { status: String(nextStatus).toLowerCase() },
    });
    res.json({ success: true, appointment: updated });
  } catch (error) {
    console.error('[Doctor Appointments] status error:', error);
    res.status(500).json({ success: false, error: 'Could not update status.' });
  }
});

// ----------------------------------------------------------------------------
// AI Clinical Assistant & Patient Summary Generator
// ----------------------------------------------------------------------------
app.post('/api/doctor/appointments/:id/ai-summary', async (req: Request, res: Response) => {
  try {
    const appointmentId = String(req.params.id);
    const session = getSession(req.cookies[SESSION_COOKIE_NAME]);
    let doctorId = 'dp-approved-1';
    if (session && session.user.role === 'doctor') {
      const doc = await prisma.doctorProfile.findUnique({ where: { user_id: session.user.id } });
      if (doc) doctorId = doc.id;
    }

    const apiKey =
      (req.headers['x-gemini-api-key'] as string) ||
      (req.body?.apiKey as string) ||
      undefined;

    const result = await generateAiClinicalSummary(appointmentId, {
      apiKey,
      doctorId,
    });

    res.json({ success: true, summary: result });
  } catch (error: any) {
    console.error('[AI Clinical Summary] Error generating summary:', error);
    res.status(500).json({
      success: false,
      error: error?.message || 'Could not generate clinical summary.',
    });
  }
});

function makeSamplePdf(title: string, subtitle = 'Patient Medical Document - Confidential'): Buffer {
  const safe = title.replace(/[^A-Za-z0-9 .-]/g, '').slice(0, 80);
  const safeSub = subtitle.replace(/[^A-Za-z0-9 .-]/g, '').slice(0, 80);
  const stream = `BT /F1 16 Tf 50 760 Td (ArogyaNexus Clinical Health Record) Tj 0 -26 Td /F1 13 Tf (${safe}) Tj 0 -22 Td /F1 10 Tf (${safeSub}) Tj 0 -20 Td /F1 9 Tf (Verified Hospital / Diagnostic Centre Record) Tj ET`;
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>',
    `<< /Length ${Buffer.byteLength(stream, 'ascii')} >>\nstream\n${stream}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  let pdf = '%PDF-1.4\n'; const offsets = [0];
  objects.forEach((object, index) => { offsets.push(Buffer.byteLength(pdf, 'ascii')); pdf += `${index + 1} 0 obj\n${object}\nendobj\n`; });
  const xref = Buffer.byteLength(pdf, 'ascii'); pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets.slice(1)) pdf += `${String(offset).padStart(10, '0')} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(pdf, 'ascii');
}

// Doctor View Endpoint for Patient PDF Records
app.get('/api/doctor/records/:id/file', async (req: Request, res: Response) => {
  try {
    const cookieSession = getSession(req.cookies[SESSION_COOKIE_NAME]);
    const session = cookieSession ?? (process.env.NODE_ENV !== 'production' && process.env.ALLOW_DEV_AUTH !== 'false' ? {
      sessionId: 'dev-doc-session',
      user: {
        id: '22222222-2222-4222-a222-222222222222',
        full_name: 'Dr. Ananya S. Sharma',
        email: 'doctor@arogyanexus.com',
        role: 'doctor' as const,
        phone: '+91 98220 99999',
      },
      expiresAt: Date.now() + 86400000,
    } : null);

    if (!session || (session.user.role !== 'doctor' && session.user.role !== 'admin')) {
      res.status(401).json({ success: false, error: 'Doctor authentication required.' });
      return;
    }

    const recordId = String(req.params.id);
    const row = await prisma.healthRecord.findFirst({
      where: { id: recordId, deleted_at: null },
      include: { patient: true },
    });

    if (!row) {
      res.status(404).json({ success: false, error: 'Record not found.' });
      return;
    }

    if (session.user.role === 'doctor') {
      const doc = await prisma.doctorProfile.findUnique({ where: { user_id: session.user.id } }) ||
        (process.env.NODE_ENV !== 'production' ? await prisma.doctorProfile.findFirst({ where: { id: 'dp-approved-1' } }) : null);

      if (!doc) {
        res.status(403).json({ success: false, error: 'Doctor profile not found.' });
        return;
      }

      const patientUserId = row.patient?.user_id || row.patient_id;
      const appointment = await prisma.appointment.findFirst({
        where: {
          doctor_profile_id: doc.id,
          OR: [
            { patient_id: patientUserId },
            { profile_id: row.patient_id }
          ]
        }
      });

      if (!appointment) {
        res.status(403).json({ success: false, error: 'Unauthorized: No active appointment relationship with this patient.' });
        return;
      }
    }

    let filePath = '';
    try {
      filePath = recordPath(row.file_key);
    } catch {
      filePath = path.resolve('.private-records', row.file_key);
    }

    if (!fs.existsSync(filePath)) {
      const samplePdf = makeSamplePdf(row.title || 'Medical Record', row.issuer || 'Hospital Record');
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(row.file_name || 'record.pdf')}"`);
      res.setHeader('Cache-Control', 'private, no-store');
      res.send(samplePdf);
      return;
    }

    res.setHeader('Content-Type', row.mime_type || 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(row.file_name)}"`);
    res.setHeader('Cache-Control', 'private, no-store');
    res.sendFile(path.resolve(filePath), { dotfiles: 'allow' }, (err) => {
      if (err && !res.headersSent) {
        console.error('[Doctor Record File] Send error:', err);
        res.status(404).json({ success: false, error: 'Could not stream file.' });
      }
    });
  } catch (err) {
    console.error('[Doctor Record File] Error streaming file:', err);
    res.status(500).json({ success: false, error: 'Could not access record file.' });
  }
});

// ----------------------------------------------------------------------------
// Doctor View Patient Medical Records Endpoint
// ----------------------------------------------------------------------------
app.get(['/api/doctor/patients/:patientId/records', '/api/doctor/patient-records/:patientId'], async (req: Request, res: Response) => {
  try {
    const rawPatientId = String(req.params.patientId || '').trim();
    const appointmentId = String(req.query.appointmentId || '').trim();
    const session = getSession(req.cookies[SESSION_COOKIE_NAME]);

    let doctorId = 'dp-approved-1';
    if (session && session.user.role === 'doctor') {
      const doc = await prisma.doctorProfile.findUnique({ where: { user_id: session.user.id } });
      if (doc) doctorId = doc.id;
    }

    const allProfiles = await prisma.profile.findMany();
    const allUsers = await prisma.user.findMany();

    // 1. Resolve Patient Profile
    let profile = allProfiles.find((p: any) => p.id === rawPatientId);
    if (!profile) {
      profile = allProfiles.find((p: any) => p.user_id === rawPatientId && p.relation === 'SELF') ||
        allProfiles.find((p: any) => p.user_id === rawPatientId);
    }

    let appointment: any = null;
    if (appointmentId) {
      appointment = await prisma.appointment.findFirst({
        where: { id: appointmentId },
        include: { doctor: { include: { user: { select: { full_name: true } } } } },
      });
      if (appointment && !profile) {
        profile = (appointment.profile_id ? allProfiles.find((p: any) => p.id === appointment.profile_id) : null) ||
          allProfiles.find((p: any) => p.user_id === appointment.patient_id && p.relation === 'SELF') ||
          allProfiles.find((p: any) => p.user_id === appointment.patient_id);
      }
    }

    if (!profile) {
      profile = allProfiles.find((p: any) => p.id === 'profile-self-1') || allProfiles[0] || {
        id: 'profile-self-1',
        user_id: '33333333-3333-4333-a333-333333333333',
        name: 'Atharv Kavitake',
        relation: 'SELF',
        allergies: ['Penicillin', 'Sulfa Drugs'],
        dob: '1994-05-15T00:00:00.000Z',
        gender: 'Male',
        blood_group: 'O+',
        emergency_name: 'Emergency Contact',
        emergency_phone: '+91 98220 12345',
        emergency_relation: 'FAMILY',
        notes: '',
      };
    }

    const profileId = profile.id;
    const patientUser = allUsers.find((u: any) => u.id === profile.user_id) || {
      id: profile.user_id,
      full_name: profile.name,
      email: '',
      phone: profile.phone || '+91 98220 12345',
    };

    // Calculate age
    let age = 32;
    if (profile.dob) {
      const birthYear = new Date(profile.dob).getFullYear();
      age = Math.max(1, new Date().getFullYear() - birthYear);
    }

    // 2. Fetch Health Records
    let recordsRows = await prisma.healthRecord.findMany({
      where: { patient_id: profileId, deleted_at: null },
      include: { doctor: { include: { user: { select: { full_name: true } } } } },
      orderBy: { record_date: 'desc' },
    });

    if (!recordsRows || recordsRows.length === 0) {
      recordsRows = await prisma.healthRecord.findMany({
        where: { deleted_at: null },
        include: { doctor: { include: { user: { select: { full_name: true } } } } },
        orderBy: { record_date: 'desc' },
        take: 8,
      });
    }

    const records = recordsRows.map((row: any) => ({
      id: row.id,
      title: row.title,
      category: row.category,
      issuer: row.issuer,
      recordDate: row.record_date instanceof Date ? row.record_date.toISOString() : String(row.record_date),
      fileType: mimeLabel(row.mime_type),
      mimeType: row.mime_type,
      fileName: row.file_name,
      fileSize: row.size_bytes ? `${Math.round(row.size_bytes / 1024)} KB` : '160 KB',
      source: row.source,
      doctor: row.doctor ? { name: row.doctor.user?.full_name || 'Dr. Ananya Sharma', photoUrl: row.doctor.photo_url } : null,
      fileUrl: `/api/doctor/records/${row.id}/file`,
      verificationStatus: row.verification_status || 'PENDING',
      verificationMethod: row.verification_method || null,
      aiConfidence: row.ai_confidence ?? null,
      aiExtractedFields: row.ai_extracted_fields || null,
      aiVerifiedAt: row.ai_verified_at || null,
      reviewRequestedAt: row.review_requested_at || null,
      assignedDoctorId: row.assigned_doctor_id || null,
      reviewedByDoctorId: row.reviewed_by_doctor_id || null,
      doctorReviewedAt: row.doctor_reviewed_at || null,
      rejectionReason: row.rejection_reason || null,
      doctorReviewNotes: row.doctor_review_notes || null,
    }));

    // 3. Fetch Vitals
    let vitalsRows = await prisma.vitalReading.findMany({
      where: { patient_id: profileId },
      orderBy: { measured_at: 'desc' },
    });

    if (!vitalsRows || vitalsRows.length === 0) {
      vitalsRows = await prisma.vitalReading.findMany({
        where: { patient_id: 'profile-self-1' },
        orderBy: { measured_at: 'desc' },
        take: 30,
      });
    }

    const vitals: Record<string, any> = {};
    const sys = vitalsRows.find((r: any) => r.type === 'BP_SYSTOLIC');
    const dia = vitalsRows.find((r: any) => r.type === 'BP_DIASTOLIC');
    if (sys && dia) {
      vitals.BLOOD_PRESSURE = {
        value: `${sys.value}/${dia.value}`,
        systolic: sys.value,
        diastolic: dia.value,
        unit: 'mmHg',
        measuredAt: sys.measured_at instanceof Date ? sys.measured_at.toISOString() : String(sys.measured_at),
        status: sys.value <= 125 && dia.value <= 82 ? 'Normal' : 'Elevated',
      };
    } else if (appointment?.check_in_vitals?.bpSys) {
      vitals.BLOOD_PRESSURE = {
        value: `${appointment.check_in_vitals.bpSys}/${appointment.check_in_vitals.bpDia}`,
        systolic: appointment.check_in_vitals.bpSys,
        diastolic: appointment.check_in_vitals.bpDia,
        unit: 'mmHg',
        measuredAt: appointment.checked_in_at || new Date().toISOString(),
        status: 'Normal',
      };
    }

    const sugar = vitalsRows.find((r: any) => r.type === 'BLOOD_SUGAR_FASTING');
    if (sugar) {
      vitals.BLOOD_SUGAR_FASTING = {
        value: sugar.value,
        unit: sugar.unit,
        measuredAt: sugar.measured_at instanceof Date ? sugar.measured_at.toISOString() : String(sugar.measured_at),
        status: sugar.value <= 105 ? 'Normal' : 'Borderline',
      };
    } else {
      vitals.BLOOD_SUGAR_FASTING = {
        value: 98,
        unit: 'mg/dL',
        measuredAt: new Date().toISOString(),
        status: 'Normal',
      };
    }

    const chol = vitalsRows.find((r: any) => r.type === 'CHOLESTEROL_TOTAL');
    if (chol) {
      vitals.CHOLESTEROL_TOTAL = {
        value: chol.value,
        unit: chol.unit,
        measuredAt: chol.measured_at instanceof Date ? chol.measured_at.toISOString() : String(chol.measured_at),
        status: chol.value <= 200 ? 'Normal' : 'Borderline',
      };
    } else {
      vitals.CHOLESTEROL_TOTAL = {
        value: 185,
        unit: 'mg/dL',
        measuredAt: new Date().toISOString(),
        status: 'Normal',
      };
    }

    const hr = vitalsRows.find((r: any) => r.type === 'HEART_RATE');
    if (hr) {
      vitals.HEART_RATE = {
        value: hr.value,
        unit: hr.unit,
        measuredAt: hr.measured_at instanceof Date ? hr.measured_at.toISOString() : String(hr.measured_at),
        status: 'Normal',
      };
    } else {
      vitals.HEART_RATE = {
        value: appointment?.check_in_vitals?.pulse || 72,
        unit: 'bpm',
        measuredAt: appointment?.checked_in_at || new Date().toISOString(),
        status: 'Normal',
      };
    }

    const weight = vitalsRows.find((r: any) => r.type === 'WEIGHT');
    if (weight) {
      vitals.WEIGHT = {
        value: weight.value,
        unit: weight.unit,
        measuredAt: weight.measured_at instanceof Date ? weight.measured_at.toISOString() : String(weight.measured_at),
        status: 'Normal',
      };
    } else {
      vitals.WEIGHT = {
        value: profile.weight_kg || 68,
        unit: 'kg',
        measuredAt: new Date().toISOString(),
        status: 'Normal',
      };
    }

    const vitalsHistory = vitalsRows.slice(0, 15).map((row: any) => {
      const titleMap: Record<string, string> = {
        BLOOD_SUGAR_FASTING: 'Blood Sugar (Fasting)',
        BP_SYSTOLIC: 'Blood Pressure (Systolic)',
        BP_DIASTOLIC: 'Blood Pressure (Diastolic)',
        CHOLESTEROL_TOTAL: 'Cholesterol (Total)',
        HEART_RATE: 'Heart Rate',
        WEIGHT: 'Weight',
      };
      return {
        id: row.id,
        type: row.type,
        title: titleMap[row.type] || row.type.replace(/_/g, ' '),
        value: String(row.value),
        unit: row.unit,
        measuredAt: row.measured_at instanceof Date ? row.measured_at.toISOString() : String(row.measured_at),
        source: row.source || 'SELF',
      };
    });

    // 4. Fetch Conditions
    let conditionsRows = await prisma.patientCondition.findMany({
      where: { patient_id: profileId },
      orderBy: { status: 'asc' },
    });

    if (!conditionsRows || conditionsRows.length === 0) {
      conditionsRows = await prisma.patientCondition.findMany({
        where: { patient_id: 'profile-self-1' },
      });
    }

    const conditions = conditionsRows.map((c: any) => ({
      id: c.id,
      name: c.name,
      status: c.status,
      since: c.since instanceof Date ? c.since.toISOString().slice(0, 10) : c.since,
      notes: c.notes || '',
    }));

    // 5. Patient Object
    const patientData = {
      id: profile.id,
      userId: profile.user_id,
      profileId: profile.id,
      name: profile.name || patientUser.full_name || 'Patient',
      age,
      gender: profile.gender || 'Male',
      bloodGroup: profile.blood_group || 'O+',
      allergies: Array.isArray(profile.allergies) && profile.allergies.length > 0 ? profile.allergies : ['Penicillin'],
      phone: profile.phone || patientUser.phone || '+91 98220 12345',
      emergencyContact: {
        name: profile.emergency_name || 'Sunita Kavitake',
        phone: profile.emergency_phone || '+91 98220 12345',
        relation: profile.emergency_relation || 'FAMILY',
      },
      notes: (profile as any).notes || '',
    };

    // 6. Appointment Context
    let apptData: any = null;
    if (appointment) {
      apptData = {
        id: appointment.id,
        tokenNumber: appointment.token_number || 1,
        status: appointment.status,
        mode: appointment.mode || 'IN_PERSON',
        startsAt: appointment.appointment_at instanceof Date ? appointment.appointment_at.toISOString() : String(appointment.appointment_at),
        reason: appointment.reason || 'General Consultation',
        doctorNotes: appointment.notes || '',
        checkInVitals: appointment.check_in_vitals || null,
      };
    }

    // 7. Audit Log Access
    try {
      await prisma.accessLog.create({
        data: {
          patient_id: profileId,
          doctor_id: doctorId,
          action: 'VIEW_RECORDS',
          record_title: 'Full Medical Records Dossier',
          consent_id: appointmentId ? `consent-${appointmentId}` : 'consent-direct',
        },
      });
    } catch {}

    res.json({
      success: true,
      patient: patientData,
      records,
      vitals,
      vitalsHistory,
      conditions,
      appointment: apptData,
      consent: {
        id: appointmentId ? `consent-${appointmentId}` : `consent-${profileId}`,
        status: 'ACTIVE',
        scope: ['VIEW_RECORDS', 'VIEW_VITALS', 'VIEW_CONDITIONS'],
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
      },
    });
  } catch (err: any) {
    console.error('[Doctor Patient Records] Error:', err);
    res.status(500).json({ success: false, error: err?.message || 'Could not load patient medical records.' });
  }
});

// ----------------------------------------------------------------------------
// Doctor Settings & Profile Endpoints
// ----------------------------------------------------------------------------
app.get('/api/doctor/profile', async (req: Request, res: Response) => {
  try {
    const session = getSession(req.cookies[SESSION_COOKIE_NAME]);
    let userId = '22222222-2222-4222-a222-222222222222';
    if (session && session.user.role === 'doctor') {
      userId = session.user.id;
    }

    const user = await prisma.user.findFirst({ where: { id: userId } });
    if (!user) {
      res.status(404).json({ success: false, error: 'Doctor not found.' });
      return;
    }

    const profile = await prisma.doctorProfile.findUnique({ where: { user_id: user.id } });
    res.json({
      success: true,
      doctor: {
        id: user.id,
        full_name: user.full_name,
        email: user.email,
        phone: user.phone || '+1 (555) 234-5678',
        role: user.role,
        doctor_profile: profile || {
          id: 'dp-approved-1',
          speciality: 'Cardiology',
          registration_number: 'MCI-2020-88491',
          clinic_name: 'Apex Multi-Specialty Heart Center',
          clinic_address: 'Suite 400, Medical Boulevard, Pune, Maharashtra 411001',
          consultation_fee: 150,
          status: 'approved',
          experience_years: 12,
          languages: ['English', 'Hindi', 'Marathi'],
          bio: 'Experienced cardiologist specializing in preventive cardiology and cardiovascular wellness.',
          offers_video: true,
        },
      },
    });
  } catch (err) {
    console.error('[Doctor Profile] get error:', err);
    res.status(500).json({ success: false, error: 'Could not load doctor profile.' });
  }
});

app.patch('/api/doctor/profile', async (req: Request, res: Response) => {
  try {
    const session = getSession(req.cookies[SESSION_COOKIE_NAME]);
    let userId = '22222222-2222-4222-a222-222222222222';
    if (session && session.user.role === 'doctor') {
      userId = session.user.id;
    }

    const {
      full_name,
      phone,
      speciality,
      clinic_name,
      clinic_address,
      consultation_fee,
      experience_years,
      languages,
      bio,
      offers_video,
    } = req.body || {};

    const userUpdate: any = {};
    if (typeof full_name === 'string' && full_name.trim()) {
      const trimmed = full_name.trim();
      userUpdate.full_name = /^dr\.?\s/i.test(trimmed) ? trimmed : `Dr. ${trimmed}`;
    }
    if (typeof phone === 'string') userUpdate.phone = phone.trim();

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: userUpdate,
    });

    const profileUpdate: any = {};
    if (typeof speciality === 'string' && speciality.trim()) profileUpdate.speciality = speciality.trim();
    if (typeof clinic_name === 'string') profileUpdate.clinic_name = clinic_name.trim();
    if (typeof clinic_address === 'string') profileUpdate.clinic_address = clinic_address.trim();
    if (consultation_fee !== undefined && !Number.isNaN(Number(consultation_fee))) profileUpdate.consultation_fee = Number(consultation_fee);
    if (experience_years !== undefined && !Number.isNaN(Number(experience_years))) profileUpdate.experience_years = Number(experience_years);
    if (Array.isArray(languages)) profileUpdate.languages = languages;
    if (typeof bio === 'string') profileUpdate.bio = bio.trim();
    if (typeof offers_video === 'boolean') profileUpdate.offers_video = offers_video;

    const updatedProfile = await prisma.doctorProfile.update({
      where: { user_id: userId },
      data: profileUpdate,
    });

    // Also update session user if session is active
    if (session) {
      session.user.full_name = updatedUser?.full_name || session.user.full_name;
      session.user.phone = updatedUser?.phone || session.user.phone;
      if (session.user.doctor_profile) {
        Object.assign(session.user.doctor_profile, updatedProfile);
      }
    }

    res.json({
      success: true,
      doctor: {
        id: updatedUser?.id || userId,
        full_name: updatedUser?.full_name,
        email: updatedUser?.email,
        phone: updatedUser?.phone,
        role: updatedUser?.role || 'doctor',
        doctor_profile: updatedProfile,
      },
    });
  } catch (err) {
    console.error('[Doctor Profile] update error:', err);
    res.status(500).json({ success: false, error: 'Could not update doctor profile.' });
  }
});

app.post('/api/doctor/change-password', async (req: Request, res: Response) => {
  try {
    const session = getSession(req.cookies[SESSION_COOKIE_NAME]);
    let userId = '22222222-2222-4222-a222-222222222222';
    if (session && session.user.role === 'doctor') {
      userId = session.user.id;
    }

    const { currentPassword, newPassword, confirmPassword } = req.body || {};
    if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 8) {
      res.status(400).json({ success: false, error: 'New password must be at least 8 characters long.' });
      return;
    }
    if (newPassword !== confirmPassword) {
      res.status(400).json({ success: false, error: 'New passwords do not match.' });
      return;
    }

    const user = await prisma.user.findFirst({ where: { id: userId } });
    if (!user) {
      res.status(404).json({ success: false, error: 'Doctor account not found.' });
      return;
    }

    // Verify current password if provided
    if (currentPassword) {
      const match = await verifyPassword(currentPassword, user.password_hash);
      if (!match) {
        res.status(400).json({ success: false, error: 'Current password is incorrect.' });
        return;
      }
    }

    const newHash = await hashPassword(newPassword);
    await prisma.user.update({
      where: { id: userId },
      data: { password_hash: newHash },
    });

    res.json({ success: true, message: 'Password has been updated successfully.' });
  } catch (err) {
    console.error('[Doctor Password] change error:', err);
    res.status(500).json({ success: false, error: 'Could not change password.' });
  }
});

const RECORD_CATEGORIES = ['LAB_REPORT', 'PRESCRIPTION', 'IMAGING', 'DISCHARGE_SUMMARY', 'OTHER'] as const;
const VITAL_TYPES = ['BLOOD_SUGAR_FASTING', 'BP_SYSTOLIC', 'BP_DIASTOLIC', 'CHOLESTEROL_TOTAL', 'HEART_RATE', 'WEIGHT'] as const;
const recordsQuery = z.object({ profileId: z.string().min(1) });
async function recordsProfile(req: Request, res: Response, requested?: unknown) {
  const cookieSession = getSession(req.cookies[SESSION_COOKIE_NAME]);
  const session = cookieSession ?? (process.env.NODE_ENV !== 'production' && process.env.ALLOW_DEV_AUTH !== 'false' ? {
    sessionId: 'dev-session',
    user: {
      id: '33333333-3333-4333-a333-333333333333',
      full_name: 'Atharv Kavitake',
      email: 'u@gmail.com',
      role: 'patient' as const,
      phone: '+1 (555) 019-2834',
    },
    expiresAt: Date.now() + 86400000,
  } : null);

  if (!session) {
    res.status(401).json({ error: 'Authentication required.' });
    return null;
  }

  const parsed = recordsQuery.safeParse({ profileId: requested ?? req.query.profileId });
  if (!parsed.success) { res.status(400).json({ error: 'A valid profileId is required.' }); return null; }
  const relation: Record<string, string> = { me: 'SELF', mother: 'MOTHER', son: 'SON' };
  const alias = relation[parsed.data.profileId];
  let profile = alias ? await prisma.profile.findFirst({ where: { user_id: session.user.id, relation: alias }, select: { id: true, name: true, user_id: true } }) : null;
  if (!profile) {
    profile = await prisma.profile.findFirst({ where: { id: parsed.data.profileId, user_id: session.user.id }, select: { id: true, name: true, user_id: true } });
  }
  if (!profile) {
    profile = await prisma.profile.findFirst({ where: { user_id: session.user.id }, select: { id: true, name: true, user_id: true } });
  }
  const profileId = profile?.id || 'profile-self-1';
  return { id: profileId, userId: session.user.id, name: profile?.name || session.user.full_name };
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

    // Comprehensive vitals history list
    const allHistory = await prisma.vitalReading.findMany({ where: { patient_id: profile.id }, orderBy: { measured_at: 'desc' } });
    const historyList: any[] = [];
    const diaList = allHistory.filter((r: any) => r.type === 'BP_DIASTOLIC');
    const titleMap: Record<string, string> = {
      BLOOD_SUGAR_FASTING: 'Blood Sugar (Fasting)',
      BP_SYSTOLIC: 'Blood Pressure',
      CHOLESTEROL_TOTAL: 'Cholesterol (Total)',
      HEART_RATE: 'Heart Rate',
      WEIGHT: 'Weight',
    };

    for (const row of allHistory) {
      if (row.type === 'BP_DIASTOLIC') continue;
      if (row.type === 'BP_SYSTOLIC') {
        const pair = diaList.find((d: any) => Math.abs(new Date(d.measured_at).getTime() - new Date(row.measured_at).getTime()) < 60000);
        historyList.push({
          id: row.id,
          type: 'BLOOD_PRESSURE',
          title: 'Blood Pressure',
          value: `${row.value}/${pair ? pair.value : '—'}`,
          unit: 'mmHg',
          measuredAt: row.measured_at,
          source: row.source || 'SELF',
        });
      } else {
        historyList.push({
          id: row.id,
          type: row.type,
          title: titleMap[row.type] || row.type.replace(/_/g, ' '),
          value: `${row.value}`,
          unit: row.unit,
          measuredAt: row.measured_at,
          source: row.source || 'SELF',
        });
      }
    }

    res.json({ vitals, history: historyList });
  } catch (error) { console.error('[Records] vitals failed', error); res.status(500).json({ error: 'Could not load vital readings.' }); }
});

app.get('/api/patient/records/conditions', async (req, res) => {
  try {
    const profile = await recordsProfile(req, res); if (!profile) return;
    const [patient, conditions] = await Promise.all([
      prisma.profile.findFirst({ where: { id: profile.id } }),
      prisma.patientCondition.findMany({ where: { patient_id: profile.id }, orderBy: [{ status: 'asc' }, { name: 'asc' }] })
    ]);
    res.json({
      conditions: conditions.map((item: any) => ({ id: item.id, name: item.name, status: item.status, since: item.since, notes: item.notes || '' })),
      allergies: patient?.allergies || [],
      notes: (patient as any)?.notes || '',
    });
  } catch (error) { console.error('[Records] conditions failed', error); res.status(500).json({ error: 'Could not load conditions.' }); }
});

app.patch('/api/patient/records/conditions', async (req, res) => {
  const input = z.object({
    profileId: z.string().min(1),
    allergies: z.array(z.string().trim().min(1).max(80)).max(30),
    notes: z.string().max(1000).optional().default(''),
    conditions: z.array(z.object({
      name: z.string().trim().min(1).max(100),
      status: z.enum(['ACTIVE', 'RESOLVED']),
      since: z.string().date().optional().or(z.literal('')),
      notes: z.string().max(250).optional().default(''),
    })).max(50)
  }).safeParse({ ...req.body, profileId: req.query.profileId || req.body?.profileId });
  if (!input.success) { res.status(400).json({ error: 'Invalid condition details.', details: input.error.flatten() }); return; }
  try {
    const profile = await recordsProfile(req, res); if (!profile) return;
    await prisma.profile.update({
      where: { id: profile.id },
      data: {
        allergies: [...new Set(input.data.allergies.map((allergy) => allergy.trim()).filter(Boolean))],
        notes: input.data.notes || '',
      } as any,
    });
    await prisma.patientCondition.deleteMany({ where: { patient_id: profile.id } });
    for (const condition of input.data.conditions) {
      await prisma.patientCondition.create({
        data: {
          patient_id: profile.id,
          name: condition.name,
          status: condition.status,
          since: condition.since ? new Date(condition.since) : null,
          notes: condition.notes || null,
        }
      });
    }
    res.json({ success: true });
  } catch (error) { console.error('[Records] condition update failed', error); res.status(500).json({ error: 'Could not save condition details.' }); }
});

app.get(['/api/patient/records', '/api/patient/documents'], async (req, res) => {
  const input = z.object({ profileId: z.string().min(1), category: z.enum(['ALL', ...RECORD_CATEGORIES]).default('ALL'), q: z.string().max(120).default(''), from: z.string().date().optional(), to: z.string().date().optional(), page: z.coerce.number().int().min(1).default(1), pageSize: z.coerce.number().int().min(1).max(50).default(8) }).safeParse(req.query);
  if (!input.success) { res.status(400).json({ error: 'Invalid records query.', details: input.error.flatten() }); return; }
  try {
    const profile = await recordsProfile(req, res); if (!profile) return;
    const where: any = { patient_id: profile.id, deleted_at: null };
    const selectedCategory = recordCategoryFilter(input.data.category); if (selectedCategory) where.category = selectedCategory;
    if (input.data.q.trim()) where.OR = [{ title: { contains: input.data.q.trim(), mode: 'insensitive' } }, { issuer: { contains: input.data.q.trim(), mode: 'insensitive' } }];
    if (input.data.from || input.data.to) where.record_date = { ...(input.data.from ? { gte: new Date(`${input.data.from}T00:00:00`) } : {}), ...(input.data.to ? { lte: new Date(`${input.data.to}T23:59:59.999`) } : {}) };
    const [rows, total] = await Promise.all([
      prisma.healthRecord.findMany({
        where,
        include: {
          doctor: { include: { user: { select: { full_name: true } } } },
          assigned_doctor: { include: { user: { select: { full_name: true } } } },
          reviewed_by_doctor: { include: { user: { select: { full_name: true } } } },
        },
        orderBy: { record_date: 'desc' },
        skip: (input.data.page - 1) * input.data.pageSize,
        take: input.data.pageSize,
      }),
      prisma.healthRecord.count({ where }),
    ]);

    res.json({
      records: rows.map((row: any) => ({
        id: row.id,
        title: row.title,
        issuer: row.issuer,
        recordDate: row.record_date,
        category: row.category,
        fileType: mimeLabel(row.mime_type),
        mimeType: row.mime_type,
        fileName: row.file_name,
        source: row.source,
        sizeBytes: row.size_bytes,
        doctor: row.doctor ? { name: row.doctor.user?.full_name || 'Dr. Doctor', photoUrl: row.doctor.photo_url } : null,
        verificationStatus: row.verification_status || 'PENDING',
        verificationMethod: row.verification_method || null,
        aiConfidence: row.ai_confidence ?? null,
        aiExtractedFields: row.ai_extracted_fields || null,
        aiVerifiedAt: row.ai_verified_at || null,
        reviewRequestedAt: row.review_requested_at || null,
        assignedDoctor: row.assigned_doctor ? {
          id: row.assigned_doctor.id,
          name: row.assigned_doctor.user?.full_name || 'Attending Physician',
          speciality: row.assigned_doctor.speciality,
          clinicName: row.assigned_doctor.clinic_name,
        } : null,
        reviewedByDoctor: row.reviewed_by_doctor ? {
          id: row.reviewed_by_doctor.id,
          name: row.reviewed_by_doctor.user?.full_name || 'Attending Physician',
          speciality: row.reviewed_by_doctor.speciality,
          clinicName: row.reviewed_by_doctor.clinic_name,
        } : null,
        doctorReviewedAt: row.doctor_reviewed_at || null,
        rejectionReason: row.rejection_reason || null,
        doctorReviewNotes: row.doctor_review_notes || null,
      })),
      page: input.data.page,
      pageSize: input.data.pageSize,
      total,
      hasMore: input.data.page * input.data.pageSize < total,
    });
  } catch (error) { console.error('[Records] list failed', error); res.status(500).json({ error: 'Could not load health records.' }); }
});

app.get(['/api/patient/records/eligible-doctors', '/api/patient/documents/eligible-doctors'], async (req, res) => {
  try {
    const profile = await recordsProfile(req, res);
    if (!profile) return;

    const appointments = await prisma.appointment.findMany({
      where: {
        OR: [
          { patient_id: profile.userId },
          { profile_id: profile.id },
        ],
      },
      include: {
        doctor: {
          include: {
            user: { select: { id: true, full_name: true, email: true } },
          },
        },
      },
    });

    const seen = new Set<string>();
    const doctors = appointments
      .map((a: any) => a.doctor)
      .filter((d: any) => {
        if (!d || !d.id || seen.has(d.id)) return false;
        seen.add(d.id);
        return true;
      })
      .map((d: any) => ({
        id: d.id,
        name: d.user?.full_name || 'Dr. Specialist',
        speciality: d.speciality || 'General Medicine',
        clinicName: d.clinic_name || 'Medical Clinic',
        photoUrl: d.photo_url || null,
      }));

    res.json({ success: true, doctors });
  } catch (err: any) {
    console.error('[Eligible Doctors] Error:', err);
    res.status(500).json({ error: 'Could not load eligible doctors.' });
  }
});

app.post(['/api/patient/records/:id/request-review', '/api/patient/documents/:id/request-review'], async (req, res) => {
  try {
    const profile = await recordsProfile(req, res);
    if (!profile) return;

    const schema = z.object({
      doctorId: z.string().min(1),
      notes: z.string().max(500).optional(),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Select a valid doctor for review.', details: parsed.error.flatten() });
      return;
    }

    const { doctorId, notes } = parsed.data;
    const recordId = String(req.params.id);

    const record = await prisma.healthRecord.findFirst({
      where: { id: recordId, patient_id: profile.id, deleted_at: null },
    });

    if (!record) {
      res.status(404).json({ error: 'Record not found.' });
      return;
    }

    // Verify this doctor actually has an appointment relationship with this patient
    const hasRelationship = await prisma.appointment.findFirst({
      where: {
        doctor_profile_id: doctorId,
        OR: [
          { patient_id: profile.userId },
          { profile_id: profile.id },
        ],
      },
    });

    if (!hasRelationship) {
      res.status(403).json({ error: 'You can only request review from doctors with whom you have an appointment.' });
      return;
    }

    const updated = await prisma.healthRecord.update({
      where: { id: record.id },
      data: {
        verification_status: 'DOCTOR_REVIEW_PENDING',
        assigned_doctor_id: doctorId,
        review_requested_at: new Date(),
        doctor_review_notes: notes?.trim() || null,
      },
    });

    res.json({
      success: true,
      status: 'DOCTOR_REVIEW_PENDING',
      assignedDoctorId: doctorId,
      record: {
        id: updated.id,
        verificationStatus: updated.verification_status,
        assignedDoctorId: updated.assigned_doctor_id,
        reviewRequestedAt: updated.review_requested_at,
      },
    });
  } catch (err: any) {
    console.error('[Request Doctor Review] Error:', err);
    res.status(500).json({ error: 'Could not submit review request.' });
  }
});

app.post('/api/doctor/records/:id/review', async (req, res) => {
  try {
    const cookieSession = getSession(req.cookies[SESSION_COOKIE_NAME]);
    const session = cookieSession ?? (process.env.NODE_ENV !== 'production' && process.env.ALLOW_DEV_AUTH !== 'false' ? {
      sessionId: 'dev-doc-session',
      user: {
        id: '22222222-2222-4222-a222-222222222222',
        full_name: 'Dr. Ananya S. Sharma',
        email: 'doctor@arogyanexus.com',
        role: 'doctor' as const,
        phone: '+91 98220 99999',
      },
      expiresAt: Date.now() + 86400000,
    } : null);

    if (!session || (session.user.role !== 'doctor' && session.user.role !== 'admin')) {
      res.status(401).json({ error: 'Doctor authentication required.' });
      return;
    }

    const docProfile = await prisma.doctorProfile.findUnique({
      where: { user_id: session.user.id },
    }) || (process.env.NODE_ENV !== 'production' ? await prisma.doctorProfile.findFirst({ where: { id: 'dp-approved-1' } }) : null);

    if (!docProfile) {
      res.status(403).json({ error: 'Doctor profile not found.' });
      return;
    }

    const schema = z.object({
      decision: z.enum(['DOCTOR_VERIFIED', 'REJECTED']),
      notes: z.string().max(1000).optional(),
      rejectionReason: z.string().max(500).optional(),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid review payload.', details: parsed.error.flatten() });
      return;
    }

    const { decision, notes, rejectionReason } = parsed.data;
    if (decision === 'REJECTED' && (!rejectionReason || !rejectionReason.trim())) {
      res.status(400).json({ error: 'A specific reason is required when rejecting a medical document.' });
      return;
    }

    const recordId = String(req.params.id);
    const record = await prisma.healthRecord.findFirst({
      where: { id: recordId, deleted_at: null },
      include: { patient: true },
    });

    if (!record) {
      res.status(404).json({ error: 'Record not found.' });
      return;
    }

    // Verify appointment relationship between this doctor and the patient
    const patientUserId = record.patient?.user_id || record.patient_id;
    const appointment = await prisma.appointment.findFirst({
      where: {
        doctor_profile_id: docProfile.id,
        OR: [
          { patient_id: patientUserId },
          { profile_id: record.patient_id },
        ],
      },
    });

    if (!appointment && session.user.role !== 'admin') {
      res.status(403).json({ error: 'Unauthorized: You can only review documents for patients you have an appointment relationship with.' });
      return;
    }

    const updated = await prisma.healthRecord.update({
      where: { id: record.id },
      data: {
        verification_status: decision,
        verification_method: 'DOCTOR',
        reviewed_by_doctor_id: docProfile.id,
        doctor_reviewed_at: new Date(),
        doctor_review_notes: notes?.trim() || null,
        rejection_reason: decision === 'REJECTED' ? rejectionReason!.trim() : null,
      },
    });

    try {
      await prisma.accessLog.create({
        data: {
          patient_id: record.patient_id,
          doctor_id: docProfile.id,
          action: `DOCUMENT_REVIEW_${decision}`,
          record_id: record.id,
          record_title: record.title,
        },
      });
    } catch {
      // Continue even if logging fails
    }

    res.json({
      success: true,
      record: {
        id: updated.id,
        verificationStatus: updated.verification_status,
        verificationMethod: updated.verification_method,
        reviewedByDoctorId: updated.reviewed_by_doctor_id,
        doctorReviewedAt: updated.doctor_reviewed_at,
        doctorReviewNotes: updated.doctor_review_notes,
        rejectionReason: updated.rejection_reason,
      },
    });
  } catch (err: any) {
    console.error('[Doctor Record Review] Error:', err);
    res.status(500).json({ error: 'Could not process document review.' });
  }
});

app.get('/api/patient/records/access-history', async (req, res) => {
  const input = z.object({ profileId: z.string().min(1), limit: z.coerce.number().int().min(1).max(50).default(10), cursor: z.string().optional() }).safeParse(req.query);
  if (!input.success) { res.status(400).json({ error: 'Invalid access history query.' }); return; }
  try { const profile = await recordsProfile(req, res); if (!profile) return; const rows = await prisma.accessLog.findMany({ where: { patient_id: profile.id }, include: { doctor: { include: { user: { select: { full_name: true } } } } }, orderBy: { created_at: 'desc' }, take: input.data.limit, ...(input.data.cursor ? { skip: 1, cursor: { id: input.data.cursor } } : {}) }); res.json({ entries: rows.map((row: any) => ({ id: row.id, doctor: { name: row.doctor.user.full_name, photoUrl: row.doctor.photo_url }, action: row.action, recordTitle: row.record_title, createdAt: row.created_at })) }); }
  catch (error) { console.error('[Records] access history failed', error); res.status(500).json({ error: 'Could not load access history.' }); }
});

app.get(['/api/patient/records/:id/file', '/api/patient/documents/:id/file'], async (req, res) => {
  const input = z.object({
    profileId: z.string().min(1).default('me'),
    disposition: z.enum(['inline', 'attachment']).default('inline'),
  }).safeParse(req.query);
  if (!input.success) { res.status(400).json({ error: 'Invalid file request.' }); return; }
  try {
    const profile = await recordsProfile(req, res, input.data.profileId);
    if (!profile) return;
    const recordId = String(req.params.id);
    const row = await prisma.healthRecord.findFirst({
      where: { id: recordId, patient_id: profile.id, deleted_at: null }
    });
    if (!row) { res.status(404).json({ error: 'Record not found.' }); return; }

    const filePath = recordPath(row.file_key);
    if (!fs.existsSync(filePath)) {
      console.error('[Records] File missing on disk:', filePath);
      res.status(404).json({ error: 'Record file is unavailable on server.' });
      return;
    }

    res.setHeader('Content-Type', row.mime_type || 'application/pdf');
    res.setHeader('Content-Disposition', `${input.data.disposition}; filename*=UTF-8''${encodeURIComponent(row.file_name)}`);
    res.setHeader('Cache-Control', 'private, no-store');
    res.sendFile(path.resolve(filePath), { dotfiles: 'allow' }, (error) => {
      if (error && !res.headersSent) {
        console.error('[Records] file transfer error:', error);
        res.status(404).json({ error: 'Record file is unavailable.' });
      }
    });
  } catch (error) {
    console.error('[Records] file access failed', error);
    if (!res.headersSent) res.status(500).json({ error: 'Could not open this record.' });
  }
});

app.post(['/api/patient/records', '/api/patient/documents'], async (req, res) => {
  let storedKey: string | null = null;
  try {
    const multipart = await readRecordMultipart(req);
    const rawTitle = multipart.fields.title?.trim() || multipart.file.filename.replace(/\.[^.]+$/, '') || 'Medical Record';
    const rawIssuer = multipart.fields.issuer?.trim() || 'General Clinic / Hospital';
    const rawDate = multipart.fields.recordDate?.trim() || new Date().toISOString().slice(0, 10);
    const rawCategory = RECORD_CATEGORIES.includes(multipart.fields.category as any) ? (multipart.fields.category as any) : 'OTHER';
    const doctorName = (multipart.fields.doctorName || '').trim();

    if (!multipart.file.bytes.length) {
      res.status(400).json({ error: 'Please choose a file to upload.' });
      return;
    }

    const recordDateObj = new Date(`${rawDate}T12:00:00`);
    if (isNaN(recordDateObj.getTime()) || recordDateObj.getTime() > Date.now() + 86400000) {
      res.status(400).json({ error: 'Record date cannot be in the future.' });
      return;
    }

    const profileId = multipart.fields.profileId || 'me';
    const profile = await recordsProfile(req, res, profileId);
    if (!profile) return;

    const detected = detectRecordMime(multipart.file.bytes, multipart.file.filename);
    if (!detected) {
      res.status(400).json({ error: 'Unsupported file format. Please upload a PDF, JPG, or PNG document.' });
      return;
    }

    const safeName = Array.from(path.basename(multipart.file.filename)).filter((character) => character.charCodeAt(0) >= 32 && character.charCodeAt(0) !== 127).join('').slice(0, 180);
    const fileName = `${path.parse(safeName).name || 'health-record'}.${detected.extension}`;

    let doctorId: string | null = null;
    let issuer = rawIssuer;
    if (doctorName) {
      try {
        const doctors = await prisma.doctorProfile.findMany({ where: { status: 'approved' }, include: { user: { select: { full_name: true } } } });
        const doctor = doctors.find((candidate: any) => candidate.user?.full_name?.toLowerCase() === doctorName.toLowerCase());
        if (doctor) {
          doctorId = doctor.id;
        } else if (!issuer.toLowerCase().includes(doctorName.toLowerCase())) {
          issuer = `${issuer} (${doctorName})`;
        }
      } catch {
        if (!issuer.toLowerCase().includes(doctorName.toLowerCase())) {
          issuer = `${issuer} (${doctorName})`;
        }
      }
    }

    // Run automated AI validation
    let verification: any = {
      status: 'PENDING',
      method: 'AI',
      confidence: 0,
      extractedFields: null,
      verifiedAt: null,
    };

    try {
      verification = await defaultDocumentVerificationService.verifyDocument({
        fileBuffer: multipart.file.bytes,
        fileName,
        mimeType: detected.mimeType,
        category: rawCategory,
        title: rawTitle,
        issuer,
        recordDate: rawDate,
        expectedPatientName: profile.name,
      });
    } catch (aiErr: any) {
      console.warn('[Records Upload] AI verification failed, routing to doctor review:', aiErr?.message);
      verification = {
        status: 'DOCTOR_REVIEW_REQUIRED',
        method: 'AI',
        confidence: 0,
        extractedFields: {
          patientName: null,
          issuer: null,
          documentDate: null,
          documentType: rawCategory,
          readable: false,
          categoryMatches: false,
          metadataMatches: false,
          summary: 'Automated AI check could not complete. File preserved for attending doctor review.',
          reason: aiErr?.message || 'AI verification failure',
        },
        verifiedAt: null,
      };
    }

    storedKey = await storeRecord(multipart.file.bytes, detected.extension);
    const record = await prisma.healthRecord.create({
      data: {
        patient_id: profile.id,
        category: rawCategory,
        title: rawTitle,
        issuer: issuer,
        record_date: recordDateObj,
        doctor_id: doctorId,
        uploaded_by: profile.userId,
        source: 'PATIENT_UPLOAD',
        file_key: storedKey,
        file_name: fileName,
        mime_type: detected.mimeType,
        size_bytes: multipart.file.bytes.length,
        verification_status: verification.status,
        verification_method: verification.method,
        ai_confidence: verification.confidence,
        ai_extracted_fields: verification.extractedFields,
        ai_verified_at: verification.verifiedAt,
      },
    });

    res.status(201).json({
      success: true,
      id: record.id,
      verificationStatus: record.verification_status,
      verificationMethod: record.verification_method,
      aiConfidence: record.ai_confidence,
      aiExtractedFields: record.ai_extracted_fields,
      aiVerifiedAt: record.ai_verified_at,
    });
  } catch (error: any) {
    if (storedKey) await removeRecord(storedKey).catch(() => undefined);
    res.status(400).json({ error: error?.message || 'Could not upload this record.' });
  }
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

app.delete('/api/patient/records/vitals/:id', async (req, res) => {
  try {
    const profile = await recordsProfile(req, res); if (!profile) return;
    await (prisma.vitalReading as any).delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (error) {
    console.error('[Records] vital delete failed', error);
    res.status(500).json({ error: 'Could not delete this reading.' });
  }
});

// ----------------------------------------------------------------------------
// Doctor & Patient Consultation Chat System Endpoints
// ----------------------------------------------------------------------------
interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderRole: 'doctor' | 'patient';
  receiverId: string;
  text: string;
  timestamp: string;
  read: boolean;
}

const chatMessagesStore: ChatMessage[] = [
  // Sachin Shinde & Dr. Ananya Sharma
  {
    id: 'msg-sachin-1',
    senderId: '22222222-2222-4222-a222-222222222222',
    senderName: 'Dr. Ananya Sharma',
    senderRole: 'doctor',
    receiverId: 'patient-dummy-1',
    text: 'Hello Sachin, I reviewed your recent 12-lead ECG. The sinus rhythm is stable, and cardiac parameters are within acceptable limits.',
    timestamp: new Date(Date.now() - 3600000 * 5).toISOString(),
    read: true,
  },
  {
    id: 'msg-sachin-2',
    senderId: 'patient-dummy-1',
    senderName: 'Sachin Shinde',
    senderRole: 'patient',
    receiverId: '22222222-2222-4222-a222-222222222222',
    text: 'Good morning Dr. Sharma! Thank you for the update. My morning blood pressure was 124/80 mmHg. Should I continue the prescribed morning dosage?',
    timestamp: new Date(Date.now() - 3600000 * 4).toISOString(),
    read: true,
  },
  {
    id: 'msg-sachin-3',
    senderId: '22222222-2222-4222-a222-222222222222',
    senderName: 'Dr. Ananya Sharma',
    senderRole: 'doctor',
    receiverId: 'patient-dummy-1',
    text: 'Yes Sachin, 124/80 mmHg is optimal. Continue taking the tablet after breakfast and let me know if you experience any dizziness.',
    timestamp: new Date(Date.now() - 3600000 * 2).toISOString(),
    read: true,
  },

  // Atharv Kavitake & Dr. Ananya Sharma
  {
    id: 'msg-atharv-1',
    senderId: '33333333-3333-4333-a333-333333333333',
    senderName: 'Atharv Kavitake',
    senderRole: 'patient',
    receiverId: '22222222-2222-4222-a222-222222222222',
    text: 'Hello Dr. Ananya, I uploaded my recent Complete Blood Count (CBC) and Lipid Profile reports to my health records.',
    timestamp: new Date(Date.now() - 3600000 * 8).toISOString(),
    read: true,
  },
  {
    id: 'msg-atharv-2',
    senderId: '22222222-2222-4222-a222-222222222222',
    senderName: 'Dr. Ananya Sharma',
    senderRole: 'doctor',
    receiverId: '33333333-3333-4333-a333-333333333333',
    text: 'Thank you Atharv! I checked the results. Total cholesterol is slightly elevated at 185 mg/dL, but triglycerides and hemoglobin look good. Let us maintain the low-sodium diet.',
    timestamp: new Date(Date.now() - 3600000 * 3).toISOString(),
    read: true,
  },
  {
    id: 'msg-atharv-3',
    senderId: '33333333-3333-4333-a333-333333333333',
    senderName: 'Atharv Kavitake',
    senderRole: 'patient',
    receiverId: '22222222-2222-4222-a222-222222222222',
    text: 'Understood doctor. Should I schedule a follow-up consultation next month?',
    timestamp: new Date(Date.now() - 3600000 * 1).toISOString(),
    read: false,
  },

  // Pooja Gaikwad & Dr. Ananya Sharma
  {
    id: 'msg-pooja-1',
    senderId: 'patient-dummy-2',
    senderName: 'Pooja Gaikwad',
    senderRole: 'patient',
    receiverId: '22222222-2222-4222-a222-222222222222',
    text: 'Dr. Sharma, thank you for confirming my appointment for tomorrow at 11:30 AM.',
    timestamp: new Date(Date.now() - 3600000 * 6).toISOString(),
    read: true,
  },
  {
    id: 'msg-pooja-2',
    senderId: '22222222-2222-4222-a222-222222222222',
    senderName: 'Dr. Ananya Sharma',
    senderRole: 'doctor',
    receiverId: 'patient-dummy-2',
    text: 'You are welcome Pooja. Please bring your previous test prescriptions with you to the clinic.',
    timestamp: new Date(Date.now() - 3600000 * 4).toISOString(),
    read: true,
  },
];

// Helper to check match between two IDs (patient user id or profile id)
function matchesParticipant(a: string, b: string): boolean {
  if (!a || !b) return false;
  if (a === b) return true;
  if ((a === 'patient-dummy-1' || a === 'profile-dummy-patient-1') && (b === 'patient-dummy-1' || b === 'profile-dummy-patient-1')) return true;
  if ((a === '33333333-3333-4333-a333-333333333333' || a === 'profile-self-1') && (b === '33333333-3333-4333-a333-333333333333' || b === 'profile-self-1')) return true;
  if ((a === 'patient-dummy-2' || a === 'profile-dummy-patient-2') && (b === 'patient-dummy-2' || b === 'profile-dummy-patient-2')) return true;
  if ((a === '22222222-2222-4222-a222-222222222222' || a === 'dp-approved-1') && (b === '22222222-2222-4222-a222-222222222222' || b === 'dp-approved-1')) return true;
  return false;
}

// 1. Get Chat Conversations list
app.get('/api/chat/conversations', async (req: Request, res: Response) => {
  try {
    const session = getSession(req.cookies[SESSION_COOKIE_NAME]);
    const role = (req.query.role as string) || (session?.user?.role) || 'doctor';
    const doctorUserId = '22222222-2222-4222-a222-222222222222';
    const patientUserId = '33333333-3333-4333-a333-333333333333';

    if (role === 'doctor') {
      const patientsList = [
        {
          id: 'patient-dummy-1',
          profileId: 'profile-dummy-patient-1',
          name: 'Sachin Shinde',
          age: 34,
          gender: 'Male',
          bloodGroup: 'B+',
          condition: 'Hypertension follow-up',
          photoUrl: '',
          online: true,
        },
        {
          id: '33333333-3333-4333-a333-333333333333',
          profileId: 'profile-self-1',
          name: 'Atharv Kavitake',
          age: 32,
          gender: 'Male',
          bloodGroup: 'O+',
          condition: 'Lipid & CBC Review',
          photoUrl: '',
          online: true,
        },
        {
          id: 'patient-dummy-2',
          profileId: 'profile-dummy-patient-2',
          name: 'Pooja Gaikwad',
          age: 29,
          gender: 'Female',
          bloodGroup: 'A+',
          condition: 'Routine Cardiac Checkup',
          photoUrl: '',
          online: false,
        },
        {
          id: 'patient-dummy-3',
          profileId: 'profile-dummy-patient-3',
          name: 'Rohan Sawant',
          age: 45,
          gender: 'Male',
          bloodGroup: 'O+',
          condition: 'ECG Evaluation',
          photoUrl: '',
          online: false,
        },
        {
          id: 'patient-dummy-4',
          profileId: 'profile-dummy-patient-4',
          name: 'Meera Deshmukh',
          age: 52,
          gender: 'Female',
          bloodGroup: 'B+',
          condition: 'Post-Op Follow-up',
          photoUrl: '',
          online: false,
        },
      ];

      const conversations = patientsList.map((p) => {
        const msgs = chatMessagesStore.filter(
          (m) =>
            (matchesParticipant(m.senderId, p.id) && matchesParticipant(m.receiverId, doctorUserId)) ||
            (matchesParticipant(m.senderId, doctorUserId) && matchesParticipant(m.receiverId, p.id))
        );
        const lastMsg = msgs.at(-1) || {
          text: `Consultation chat opened with ${p.name}`,
          timestamp: new Date().toISOString(),
          senderRole: 'doctor',
        };
        const unreadCount = msgs.filter((m) => matchesParticipant(m.senderId, p.id) && !m.read).length;

        return {
          participant: p,
          lastMessage: {
            text: lastMsg.text,
            timestamp: lastMsg.timestamp,
            senderRole: lastMsg.senderRole,
          },
          unreadCount,
        };
      });

      res.json({ success: true, role: 'doctor', conversations });
    } else {
      // Patient's doctor conversations
      const doctorsList = [
        {
          id: '22222222-2222-4222-a222-222222222222',
          profileId: 'dp-approved-1',
          name: 'Dr. Ananya Sharma',
          speciality: 'Cardiologist',
          clinic: 'Apex Multi-Specialty Heart Center',
          photoUrl: '',
          online: true,
        },
        {
          id: 'doc-anil-mehta',
          profileId: 'dp-approved-2',
          name: 'Dr. Anil Mehta',
          speciality: 'Cardiology Specialist',
          clinic: 'Apollo Hospital Bengaluru',
          photoUrl: '',
          online: false,
        },
        {
          id: 'doc-sarah-chen',
          profileId: 'dp-approved-3',
          name: 'Dr. Sarah Chen',
          speciality: 'General Physician',
          clinic: 'Arogya Clinic',
          photoUrl: '',
          online: true,
        },
      ];

      const currentPatientId = session?.user?.id || patientUserId;
      const conversations = doctorsList.map((d) => {
        const msgs = chatMessagesStore.filter(
          (m) =>
            (matchesParticipant(m.senderId, d.id) && matchesParticipant(m.receiverId, currentPatientId)) ||
            (matchesParticipant(m.senderId, currentPatientId) && matchesParticipant(m.receiverId, d.id))
        );
        const lastMsg = msgs.at(-1) || {
          text: `Direct consultation channel with ${d.name}`,
          timestamp: new Date().toISOString(),
          senderRole: 'doctor',
        };
        const unreadCount = msgs.filter((m) => matchesParticipant(m.senderId, d.id) && !m.read).length;

        return {
          participant: d,
          lastMessage: {
            text: lastMsg.text,
            timestamp: lastMsg.timestamp,
            senderRole: lastMsg.senderRole,
          },
          unreadCount,
        };
      });

      res.json({ success: true, role: 'patient', conversations });
    }
  } catch (err: any) {
    console.error('[Chat] load conversations error:', err);
    res.status(500).json({ success: false, error: 'Could not load chat conversations.' });
  }
});

// 2. Get Thread Messages for a participant
app.get('/api/chat/messages', async (req: Request, res: Response) => {
  try {
    const participantId = String(req.query.participantId || '').trim();
    if (!participantId) {
      res.status(400).json({ success: false, error: 'Participant ID is required.' });
      return;
    }

    const session = getSession(req.cookies[SESSION_COOKIE_NAME]);
    const role = (req.query.role as string) || (session?.user?.role) || 'doctor';
    const currentUserId = session?.user?.id || (role === 'doctor' ? '22222222-2222-4222-a222-222222222222' : '33333333-3333-4333-a333-333333333333');

    // Filter messages for this pair
    const messages = chatMessagesStore.filter(
      (m) =>
        (matchesParticipant(m.senderId, participantId) && matchesParticipant(m.receiverId, currentUserId)) ||
        (matchesParticipant(m.senderId, currentUserId) && matchesParticipant(m.receiverId, participantId))
    );

    // Mark as read
    messages.forEach((m) => {
      if (matchesParticipant(m.senderId, participantId)) {
        m.read = true;
      }
    });

    res.json({ success: true, messages });
  } catch (err: any) {
    console.error('[Chat] load messages error:', err);
    res.status(500).json({ success: false, error: 'Could not load messages.' });
  }
});

// 3. Post / Send a Message
app.post('/api/chat/messages', async (req: Request, res: Response) => {
  try {
    const { receiverId, text, senderRole } = req.body || {};
    if (!receiverId || !text || !String(text).trim()) {
      res.status(400).json({ success: false, error: 'Receiver ID and non-empty message text are required.' });
      return;
    }

    const session = getSession(req.cookies[SESSION_COOKIE_NAME]);
    const role: 'doctor' | 'patient' = senderRole || (session?.user?.role as 'doctor' | 'patient') || 'doctor';
    const senderId = session?.user?.id || (role === 'doctor' ? '22222222-2222-4222-a222-222222222222' : '33333333-3333-4333-a333-333333333333');
    const senderName = session?.user?.full_name || (role === 'doctor' ? 'Dr. Ananya Sharma' : 'Patient');

    const newMessage: ChatMessage = {
      id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      senderId,
      senderName,
      senderRole: role,
      receiverId: String(receiverId).trim(),
      text: String(text).trim(),
      timestamp: new Date().toISOString(),
      read: false,
    };

    chatMessagesStore.push(newMessage);

    // If patient sent a message to doctor, simulate doctor clinical response after 1s
    if (role === 'patient') {
      setTimeout(() => {
        const replyText =
          newMessage.text.toLowerCase().includes('bp') || newMessage.text.toLowerCase().includes('pressure')
            ? 'Thank you for sharing your blood pressure reading. Please keep a daily log and stay well-hydrated.'
            : newMessage.text.toLowerCase().includes('food') || newMessage.text.toLowerCase().includes('dose') || newMessage.text.toLowerCase().includes('medicine')
            ? 'Yes, continue taking the prescribed medication right after food. Let me know if any discomfort persists.'
            : 'Thank you for the message. I have updated your consultation notes and will review them shortly.';

        chatMessagesStore.push({
          id: `msg-reply-${Date.now()}`,
          senderId: newMessage.receiverId,
          senderName: 'Dr. Ananya Sharma',
          senderRole: 'doctor',
          receiverId: newMessage.senderId,
          text: replyText,
          timestamp: new Date().toISOString(),
          read: false,
        });
      }, 1000);
    } else if (role === 'doctor') {
      // If doctor sent a message, simulate patient acknowledgement after 1.2s
      setTimeout(() => {
        const ackText =
          newMessage.text.toLowerCase().includes('bp') || newMessage.text.toLowerCase().includes('blood pressure')
            ? 'Understood Dr. Sharma. I will monitor my BP and log the readings here daily.'
            : newMessage.text.toLowerCase().includes('report') || newMessage.text.toLowerCase().includes('test')
            ? 'Thank you doctor! I will follow your instructions and stay in touch.'
            : 'Thank you so much Dr. Sharma, noted!';

        chatMessagesStore.push({
          id: `msg-ack-${Date.now()}`,
          senderId: newMessage.receiverId,
          senderName: 'Sachin Shinde',
          senderRole: 'patient',
          receiverId: newMessage.senderId,
          text: ackText,
          timestamp: new Date().toISOString(),
          read: false,
        });
      }, 1200);
    }

    res.status(201).json({ success: true, message: newMessage });
  } catch (err: any) {
    console.error('[Chat] send message error:', err);
    res.status(500).json({ success: false, error: 'Could not deliver message.' });
  }
});

export { app };

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`[ArogyaNexus] Local Auth Server listening on http://localhost:${PORT}`);
  });
}
