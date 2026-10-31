import { prisma } from '../lib/db/prisma';

async function main() {
  console.log('[Backfill] Starting backfill of appointments.profile_id...');

  // Find all appointments where profile_id is null
  const appointmentsToBackfill = await prisma.appointment.findMany({
    where: {
      profile_id: null,
    },
  });

  console.log(`[Backfill] Found ${appointmentsToBackfill.length} appointment(s) with null profile_id.`);

  let updatedCount = 0;

  for (const appointment of appointmentsToBackfill) {
    // Find the user's SELF profile
    const selfProfile = await prisma.profile.findFirst({
      where: {
        user_id: appointment.patient_id,
        relation: 'SELF',
      },
    });

    if (selfProfile) {
      await prisma.appointment.update({
        where: { id: appointment.id },
        data: { profile_id: selfProfile.id },
      });
      updatedCount++;
    } else {
      console.warn(
        `[Backfill] No SELF profile found for patient_id ${appointment.patient_id} (appointment ${appointment.id})`
      );
    }
  }

  console.log(`[Backfill] Completed backfill: successfully updated ${updatedCount} row(s).`);
}

main()
  .catch((e) => {
    console.error('[Backfill] Error during backfill:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
