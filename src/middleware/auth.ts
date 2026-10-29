import { createHash } from 'node:crypto';
import { $Enums } from '@prisma/client';
import type { AccessLevel, Role } from '@prisma/client';
import type { RequestHandler } from 'express';
import { z } from 'zod';
import { prisma } from '../db/client';
import { SESSION_COOKIE_NAME } from '../../lib/auth/session';
import { roleHasPermission, type Permission } from './permissions';

const { Role } = $Enums;

const uuidSchema = z.string().uuid();
const error = (res: Parameters<RequestHandler>[1], status: number, code: string, message: string) =>
  res.status(status).json({ code, message });

export const requireAuth: RequestHandler = async (req, res, next) => {
  const token = req.cookies?.[SESSION_COOKIE_NAME];
  if (!token || typeof token !== 'string') {
    error(res, 401, 'AUTH_REQUIRED', 'Authentication is required.');
    return;
  }
  try {
    const session = await prisma.session.findFirst({
      where: { tokenHash: createHash('sha256').update(token).digest('hex'), revokedAt: null, expiresAt: { gt: new Date() } },
      include: { user: { select: { id: true, role: true, fullName: true, email: true, lockedUntil: true } } },
    });
    if (!session || session.user.lockedUntil && session.user.lockedUntil > new Date()) {
      error(res, 401, 'AUTH_REQUIRED', 'Authentication is required.');
      return;
    }
    req.auth = { sessionId: session.id, user: { id: session.user.id, role: session.user.role, fullName: session.user.fullName, email: session.user.email } };
    next();
  } catch {
    error(res, 503, 'AUTH_UNAVAILABLE', 'Authentication is temporarily unavailable.');
  }
};

export function requireRole(...roles: Role[]): RequestHandler {
  return (req, res, next) => {
    if (!req.auth) return error(res, 401, 'AUTH_REQUIRED', 'Authentication is required.');
    if (!roles.includes(req.auth.user.role)) return error(res, 403, 'ROLE_FORBIDDEN', 'You do not have permission to access this resource.');
    next();
  };
}

export function requireProfile(levels: AccessLevel[]): RequestHandler {
  return async (req, res, next) => {
    if (!req.auth) return error(res, 401, 'AUTH_REQUIRED', 'Authentication is required.');
    const profileId = req.params.profileId ?? req.query.profileId ?? req.body?.profileId;
    if (typeof profileId !== 'string' || !uuidSchema.safeParse(profileId).success) {
      return error(res, 400, 'INVALID_PROFILE', 'A valid profileId is required.');
    }
    try {
      const access = await prisma.profileAccess.findFirst({
        where: { profileId, userId: req.auth.user.id, level: { in: levels } },
        select: { profileId: true, profile: { select: { patientId: true } } },
      });
      if (!access) return error(res, 404, 'PROFILE_NOT_FOUND', 'Profile was not found.');
      req.profileId = access.profileId;
      req.patientId = access.profile.patientId;
      next();
    } catch {
      error(res, 503, 'PROFILE_ACCESS_UNAVAILABLE', 'Profile access is temporarily unavailable.');
    }
  };
}

export function requirePermission(permission: Permission): RequestHandler {
  return (req, res, next) => {
    if (!req.auth) return error(res, 401, 'AUTH_REQUIRED', 'Authentication is required.');
    if (!roleHasPermission(req.auth.user.role, permission)) return error(res, 403, 'PERMISSION_FORBIDDEN', 'You do not have permission to perform this action.');
    next();
  };
}

export const requireConsent: RequestHandler = async (req, res, next) => {
  if (!req.auth) return error(res, 401, 'AUTH_REQUIRED', 'Authentication is required.');
  if (req.auth.user.role !== Role.DOCTOR) return error(res, 403, 'ROLE_FORBIDDEN', 'Doctor access is required.');
  const appointmentId = req.params.appointmentId ?? req.body?.appointmentId;
  if (typeof appointmentId !== 'string' || !uuidSchema.safeParse(appointmentId).success) {
    return error(res, 400, 'INVALID_APPOINTMENT', 'A valid appointmentId is required.');
  }
  try {
    const appointment = await prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: { doctor: { select: { userId: true } }, consent: true },
    });
    if (!appointment) return error(res, 404, 'APPOINTMENT_NOT_FOUND', 'Appointment was not found.');
    if (appointment.doctor.userId !== req.auth.user.id) return error(res, 403, 'APPOINTMENT_FORBIDDEN', 'This appointment belongs to another doctor.');
    const consent = appointment.consent;
    if (!consent || consent.doctorId !== appointment.doctorId || consent.patientId !== appointment.patientId || consent.status !== 'ACTIVE' || consent.revokedAt || (consent.expiresAt && consent.expiresAt <= new Date())) {
      return error(res, 403, 'CONSENT_REQUIRED', 'Active patient consent is required.');
    }
    await prisma.accessLog.create({ data: { patientId: appointment.patientId, doctorId: appointment.doctorId, consentId: consent.id, action: 'CONSENTED_PATIENT_DATA_ACCESS' } });
    req.patientId = appointment.patientId;
    next();
  } catch {
    error(res, 503, 'CONSENT_CHECK_UNAVAILABLE', 'Patient consent could not be verified.');
  }
};
