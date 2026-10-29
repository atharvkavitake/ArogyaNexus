import { z } from 'zod';
import { prisma } from '../db/prisma';

export const patientProfilePatchSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  relation: z.string().trim().min(1).max(40).optional(),
  dateOfBirth: z.string().date().nullable().optional(),
  sex: z.string().trim().max(40).nullable().optional(),
  bloodGroup: z.enum(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']).nullable().optional(),
  phone: z.string().trim().max(40).nullable().optional(),
  email: z.string().trim().email().max(254).nullable().optional(),
  allergies: z.array(z.string().trim().min(1).max(80)).max(30).optional(),
  conditions: z.array(z.string().trim().min(1).max(100)).max(50).optional(),
  allergiesConfirmed: z.boolean().optional(),
  conditionsConfirmed: z.boolean().optional(),
  onboardingStep: z.number().int().min(1).max(3).optional(),
}).strict();

export const patientProfileCreateSchema = z.object({
  name: z.string().trim().min(1).max(120),
  relation: z.enum(['Family member', 'Spouse', 'Mother', 'Father', 'Child', 'Sibling', 'Guardian']),
  dateOfBirth: z.string().date().nullable().optional(),
  sex: z.string().trim().max(40).nullable().optional(),
  bloodGroup: z.enum(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']).nullable().optional(),
  phone: z.string().trim().max(40).nullable().optional(),
  email: z.string().trim().email().max(254).nullable().optional(),
  allergies: z.array(z.string().trim().min(1).max(80)).max(30).optional(),
  conditions: z.array(z.string().trim().min(1).max(100)).max(50).optional(),
}).strict();

const completenessFields = ['name', 'dateOfBirth', 'sex', 'bloodGroup', 'phone', 'email'] as const;
export function computeProfileCompleteness(profile: Record<string, any>): number {
  const complete = completenessFields.filter((field) => Boolean(String(profile[field] ?? '').trim())).length
    + Number(profile.allergiesConfirmed === true)
    + Number(profile.conditionsConfirmed === true);
  return Math.round((complete / 8) * 100);
}

export class ProfileAccessError extends Error {
  status: number;
  constructor(status: number, message: string) { super(message); this.status = status; }
}

export async function requireProfile(profileId: string, userId: string) {
  const profile = await prisma.profile.findFirst({ where: { id: profileId, deletedAt: null } });
  if (!profile) throw new ProfileAccessError(404, 'Patient profile not found.');
  const access = await prisma.profileAccess.findFirst({ where: { profileId, userId, scope: 'OWNER' } });
  if (!access) throw new ProfileAccessError(403, 'You do not have access to this patient profile.');
  return profile;
}

export async function softDeletePatientProfile(profile: Record<string, any>, userId: string) {
  if (String(profile.relation).toUpperCase() === 'SELF') throw new ProfileAccessError(409, 'The primary profile cannot be deleted.');
  await prisma.profile.update({ where: { id: profile.id }, data: { deletedAt: new Date() } });
  await prisma.profileChangeLog.create({ data: { profileId: profile.id, changedBy: userId, field: 'deletedAt' } });
}
