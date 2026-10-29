import { createHash, randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { Router, type Request, type Response } from 'express';
import { $Enums } from '@prisma/client';
import type { Role } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../src/db/client';
import { SESSION_COOKIE_NAME } from '../lib/auth/session';
import { passwordSchema } from '../lib/validations/auth';
import { clearCsrfCookie, issueCsrfToken } from '../src/middleware/csrf';
import { requireAuth } from '../src/middleware/auth';
import { createLoginRateLimit, createRegisterRateLimit } from '../src/middleware/rateLimits';

const passwordHashCost = 12;
const { Role } = $Enums;
const sessionDurationMs = 7 * 24 * 60 * 60 * 1000;
const dummyPasswordHash = bcrypt.hashSync('arogyanexus-invalid-login-check', passwordHashCost);
const bcryptPasswordSchema = passwordSchema.refine((value) => Buffer.byteLength(value, 'utf8') <= 72, {
  message: 'Password must be 72 bytes or fewer.',
});
const commonFields = {
  fullName: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(255),
  phoneNumber: z.string().trim().max(25).optional().or(z.literal('')),
  password: bcryptPasswordSchema,
  confirmPassword: z.string().min(1),
};
const patientRegisterSchema = z.object({ ...commonFields, role: z.literal('PATIENT').optional() })
  .refine((input) => input.password === input.confirmPassword, { message: 'Passwords do not match.', path: ['confirmPassword'] });
const doctorRegisterSchema = z.object({
  ...commonFields,
  role: z.literal('DOCTOR'),
  medicalSpeciality: z.string().trim().min(1).max(100),
  registrationNumber: z.string().trim().min(3).max(50),
  clinicName: z.string().trim().min(2).max(150),
  clinicAddress: z.string().trim().min(5).max(250),
  consultationFee: z.coerce.number().finite().min(0).max(1000000),
}).refine((input) => input.password === input.confirmPassword, { message: 'Passwords do not match.', path: ['confirmPassword'] });
const registerSchema = z.union([patientRegisterSchema, doctorRegisterSchema]);
const loginSchema = z.object({ email: z.string().trim().email().max(255), password: z.string().min(1).max(200) });
const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(200),
  newPassword: bcryptPasswordSchema,
  confirmPassword: z.string().min(1),
}).refine((input) => input.newPassword === input.confirmPassword, { message: 'Passwords do not match.', path: ['confirmPassword'] });

function sendError(res: Response, status: number, code: string, message: string) {
  return res.status(status).json({ code, message });
}

function safeUser(user: { id: string; fullName: string; email: string; phone: string | null; role: Role }) {
  return { id: user.id, fullName: user.fullName, email: user.email, phone: user.phone, role: user.role };
}

function setSessionCookie(res: Response, token: string) {
  res.cookie(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: sessionDurationMs,
  });
}

function clearSessionCookie(res: Response) {
  res.clearCookie(SESSION_COOKIE_NAME, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
  });
}

async function createStoredSession(userId: string, req: Request, res: Response) {
  const token = randomBytes(32).toString('base64url');
  const tokenHash = createHash('sha256').update(token).digest('hex');
  const expiresAt = new Date(Date.now() + sessionDurationMs);
  await prisma.session.create({
    data: {
      userId,
      tokenHash,
      expiresAt,
      userAgent: req.get('user-agent')?.slice(0, 512),
      ipAddress: req.ip,
    },
  });
  setSessionCookie(res, token);
}

function publicError(error: unknown) {
  if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') {
    return { status: 409, code: 'ACCOUNT_EXISTS', message: 'An account with this email or registration number already exists.' };
  }
  return { status: 500, code: 'AUTH_ERROR', message: 'The request could not be completed.' };
}

export function createAuthRouter(limits: { loginMax?: number; registerMax?: number } = {}) {
  const router = Router();

  router.get('/csrf', (_req, res) => {
    const csrfToken = issueCsrfToken(res);
    res.json({ data: { csrfToken } });
  });

  router.post('/register', createRegisterRateLimit(limits.registerMax), async (req, res) => {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) return sendError(res, 400, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Registration details are invalid.');
    const input = parsed.data;
    const email = input.email.toLowerCase();
    const passwordHash = await bcrypt.hash(input.password, passwordHashCost);
    try {
      const user = await prisma.$transaction(async (tx) => {
        if (input.role === 'DOCTOR') {
          const account = await tx.user.create({ data: {
            fullName: input.fullName,
            email,
            phone: input.phoneNumber || null,
            passwordHash,
            role: Role.DOCTOR,
          } });
          const doctor = await tx.doctor.create({ data: {
            userId: account.id,
            registrationNumber: input.registrationNumber,
            status: 'pending',
            consultationFee: input.consultationFee,
          } });
          const slug = input.medicalSpeciality.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
          const specialty = await tx.specialty.upsert({ where: { slug }, update: { name: input.medicalSpeciality }, create: { slug, name: input.medicalSpeciality } });
          await tx.doctorSpecialty.create({ data: { doctorId: doctor.id, specialtyId: specialty.id } });
          await tx.clinic.create({ data: { doctorId: doctor.id, name: input.clinicName, address: input.clinicAddress, city: 'Bengaluru' } });
          return account;
        }
        const account = await tx.user.create({ data: {
          fullName: input.fullName,
          email,
          phone: input.phoneNumber || null,
          passwordHash,
          role: Role.PATIENT,
        } });
        const patient = await tx.patient.create({ data: { userId: account.id } });
        const profile = await tx.profile.create({ data: { patientId: patient.id, name: account.fullName, relation: 'SELF' } });
        await tx.profileAccess.create({ data: {
          profileId: profile.id,
          userId: account.id,
          level: 'OWNER',
          scope: 'OWNER',
        } });
        return account;
      });
      return res.status(201).json({ data: { user: safeUser(user) } });
    } catch (error) {
      const response = publicError(error);
      return sendError(res, response.status, response.code, response.message);
    }
  });

  router.post('/login', createLoginRateLimit(limits.loginMax), async (req, res) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) return sendError(res, 400, 'VALIDATION_ERROR', 'Enter a valid email and password.');
    const email = parsed.data.email.toLowerCase();
    try {
      const user = await prisma.user.findUnique({ where: { email } });
      const matches = await bcrypt.compare(parsed.data.password, user?.passwordHash ?? dummyPasswordHash);
      const locked = Boolean(user?.lockedUntil && user.lockedUntil > new Date());
      if (!user || !matches || locked) {
        if (user && !locked) {
          const updated = await prisma.user.update({ where: { id: user.id }, data: { failedLoginAttempts: { increment: 1 } } });
          if (updated.failedLoginAttempts >= 5) {
            await prisma.user.update({ where: { id: user.id }, data: { lockedUntil: new Date(Date.now() + 15 * 60 * 1000) } });
          }
        }
        return sendError(res, 401, 'INVALID_CREDENTIALS', 'Invalid email or password.');
      }
      await prisma.$transaction([
        prisma.user.update({ where: { id: user.id }, data: { failedLoginAttempts: 0, lockedUntil: null } }),
      ]);
      await createStoredSession(user.id, req, res);
      const doctor = user.role === Role.DOCTOR ? await prisma.doctor.findUnique({ where: { userId: user.id }, select: { status: true } }) : null;
      return res.json({ data: { user: safeUser(user), doctorStatus: doctor?.status } });
    } catch {
      return sendError(res, 503, 'AUTH_UNAVAILABLE', 'Authentication is temporarily unavailable.');
    }
  });

  router.post('/logout', requireAuth, async (req, res) => {
    try {
      await prisma.session.update({ where: { id: req.auth!.sessionId }, data: { revokedAt: new Date() } });
      clearSessionCookie(res);
      clearCsrfCookie(res);
      return res.json({ data: { loggedOut: true } });
    } catch {
      return sendError(res, 503, 'AUTH_UNAVAILABLE', 'Logout could not be completed.');
    }
  });

  router.get('/me', requireAuth, (req, res) => res.json({ data: { user: req.auth!.user } }));

  router.post('/change-password', requireAuth, async (req, res) => {
    const parsed = changePasswordSchema.safeParse(req.body);
    if (!parsed.success) return sendError(res, 400, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Password details are invalid.');
    try {
      const current = await prisma.user.findUnique({ where: { id: req.auth!.user.id }, select: { passwordHash: true } });
      if (!current || !(await bcrypt.compare(parsed.data.currentPassword, current.passwordHash))) {
        return sendError(res, 400, 'CURRENT_PASSWORD_INVALID', 'Current password is incorrect.');
      }
      const passwordHash = await bcrypt.hash(parsed.data.newPassword, passwordHashCost);
      await prisma.$transaction([
        prisma.user.update({ where: { id: req.auth!.user.id }, data: { passwordHash, failedLoginAttempts: 0, lockedUntil: null } }),
        prisma.session.updateMany({ where: { userId: req.auth!.user.id, revokedAt: null, id: { not: req.auth!.sessionId } }, data: { revokedAt: new Date() } }),
      ]);
      return res.json({ data: { passwordChanged: true } });
    } catch {
      return sendError(res, 503, 'AUTH_UNAVAILABLE', 'Password could not be changed.');
    }
  });

  return router;
}
