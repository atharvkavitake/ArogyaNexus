import { prisma } from '../db/prisma';

export async function ensureSelfProfile(user: { id: string; full_name: string; email?: string; phone?: string | null }) {
  let patient = await prisma.patient.findUnique({ where: { userId: user.id } });
  if (!patient) patient = await prisma.patient.create({ data: { userId: user.id } });

  let profile = await prisma.profile.findFirst({ where: { patientId: patient.id, relation: 'SELF', deletedAt: null } });
  if (!profile) {
    profile = await prisma.profile.create({ data: {
      patientId: patient.id,
      name: user.full_name,
      relation: 'SELF',
      email: user.email || null,
      phone: user.phone || null,
      allergies: [],
      conditions: [],
    } });
    for (const field of ['name', 'relation', 'email', 'phone']) {
      await prisma.profileChangeLog.create({ data: { profileId: profile.id, changedBy: user.id, field } });
    }
  }

  const access = await prisma.profileAccess.findFirst({ where: { profileId: profile.id, userId: user.id } });
  if (!access) await prisma.profileAccess.create({ data: { profileId: profile.id, userId: user.id, scope: 'OWNER' } });
  else if (access.scope !== 'OWNER') await prisma.profileAccess.update({ where: { profileId_userId: { profileId: profile.id, userId: user.id } }, data: { scope: 'OWNER' } });
  return profile;
}
