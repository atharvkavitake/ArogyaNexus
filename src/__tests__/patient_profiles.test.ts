import { beforeEach, describe, expect, it, vi } from 'vitest';
import { computeProfileCompleteness, patientProfilePatchSchema, ProfileAccessError, requireProfile, softDeletePatientProfile } from '../../lib/patients/profileService';
import { prisma } from '../../lib/db/prisma';

vi.mock('../../lib/db/prisma', () => ({
  prisma: {
    profile: { findFirst: vi.fn(), update: vi.fn() },
    profileAccess: { findFirst: vi.fn() },
    profileChangeLog: { create: vi.fn() },
  },
}));

describe('patient profile API rules', () => {
  beforeEach(() => vi.clearAllMocks());

  it('rejects unknown PATCH fields', () => {
    const parsed = patientProfilePatchSchema.safeParse({ name: 'Jane', isAdmin: true });
    expect(parsed.success).toBe(false);
  });

  it('returns 403 when another account does not own the profile', async () => {
    (prisma.profile.findFirst as any).mockResolvedValue({ id: 'profile-1', relation: 'SELF' });
    (prisma.profileAccess.findFirst as any).mockResolvedValue(null);
    await expect(requireProfile('profile-1', 'other-user')).rejects.toMatchObject<Partial<ProfileAccessError>>({ status: 403 });
  });

  it('blocks deleting the SELF profile', async () => {
    await expect(softDeletePatientProfile({ id: 'self-id', relation: 'SELF' }, 'owner-id'))
      .rejects.toMatchObject<Partial<ProfileAccessError>>({ status: 409 });
    expect(prisma.profile.update).not.toHaveBeenCalled();
  });

  it('computes completeness from the eight supported profile fields', () => {
    expect(computeProfileCompleteness({
      name: 'Jane', dateOfBirth: '1990-01-01', sex: 'Female', bloodGroup: 'O+', phone: '123', email: 'jane@example.test',
      allergiesConfirmed: true, conditionsConfirmed: true,
    })).toBe(100);
    expect(computeProfileCompleteness({ name: 'Jane', dateOfBirth: '1990-01-01', sex: 'Female', bloodGroup: 'O+' })).toBe(50);
  });
});
