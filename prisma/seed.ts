import { PrismaClient, $Enums } from '@prisma/client';
import bcrypt from 'bcryptjs';

const { Role, StaffRole, AppointmentMode, AccessLevel, AccessScope } = $Enums;

const prisma = new PrismaClient();
const password = process.env.DEMO_PASSWORD || 'Pass@123';
const passwordHash = await bcrypt.hash(password, 12);
const now = new Date();

async function user(email: string, fullName: string, role: Role, phone: string) {
  return prisma.user.upsert({
    where: { email },
    update: { fullName, role, phone, passwordHash },
    create: { email, fullName, role, phone, passwordHash },
  });
}

async function doctor(email: string, fullName: string, registrationNumber: string, specialtyName: string, clinic: { name: string; address: string; city: string; lat: number; lng: number }, verified = true) {
  const account = await user(email, fullName, Role.DOCTOR, '+91-90000-10001');
  const profile = await prisma.doctor.upsert({
    where: { userId: account.id },
    update: { registrationNumber, status: 'approved', verifiedAt: verified ? now : null },
    create: { userId: account.id, registrationNumber, status: 'approved', verifiedAt: verified ? now : null, consultationFee: 500 },
  });
  const specialty = await prisma.specialty.upsert({
    where: { slug: specialtyName.toLowerCase().replaceAll(/[^a-z0-9]+/g, '-') },
    update: { name: specialtyName },
    create: { name: specialtyName, slug: specialtyName.toLowerCase().replaceAll(/[^a-z0-9]+/g, '-') },
  });
  await prisma.doctorSpecialty.upsert({
    where: { doctorId_specialtyId: { doctorId: profile.id, specialtyId: specialty.id } },
    update: {}, create: { doctorId: profile.id, specialtyId: specialty.id },
  });
  let clinicRow = await prisma.clinic.findFirst({ where: { doctorId: profile.id, name: clinic.name } });
  clinicRow ??= await prisma.clinic.create({ data: { doctorId: profile.id, ...clinic } });
  const rule = await prisma.availabilityRule.findFirst({ where: { doctorId: profile.id, weekday: 1, startsAt: '09:00', endsAt: '17:00' } });
  if (!rule) await prisma.availabilityRule.create({ data: { doctorId: profile.id, clinicId: clinicRow.id, weekday: 1, startsAt: '09:00', endsAt: '17:00', mode: AppointmentMode.IN_PERSON } });
  const startsAt = new Date(now);
  startsAt.setDate(startsAt.getDate() + 1);
  startsAt.setHours(10, 0, 0, 0);
  if (!(await prisma.slot.findFirst({ where: { doctorId: profile.id, startsAt } }))) {
    const endsAt = new Date(startsAt.getTime() + 30 * 60 * 1000);
    await prisma.slot.create({ data: { doctorId: profile.id, clinicId: clinicRow.id, startsAt, endsAt, mode: AppointmentMode.IN_PERSON } });
  }
  return { account, profile, clinic: clinicRow };
}

async function main() {
  const patientUser = await user(process.env.DEMO_PATIENT_EMAIL || 'patient@arogyanexus.test', 'Aarav Demo', Role.PATIENT, '+91-90000-10000');
  const patient = await prisma.patient.upsert({ where: { userId: patientUser.id }, update: {}, create: { userId: patientUser.id } });
  const family = [
    { name: 'Aarav Demo', relation: 'SELF' },
    { name: 'Meera Demo', relation: 'Mother' },
    { name: 'Ishaan Demo', relation: 'Son' },
  ];
  for (const item of family) {
    let profile = await prisma.profile.findFirst({ where: { patientId: patient.id, relation: item.relation } });
    profile ??= await prisma.profile.create({ data: { patientId: patient.id, ...item } });
    await prisma.profileAccess.upsert({
      where: { profileId_userId: { profileId: profile.id, userId: patientUser.id } },
      update: { level: AccessLevel.OWNER, scope: AccessScope.OWNER },
      create: { profileId: profile.id, userId: patientUser.id, level: AccessLevel.OWNER, scope: AccessScope.OWNER },
    });
  }

  const mainDoctor = await doctor('doctor@arogyanexus.test', 'Dr. Ananya Sharma', 'KA-DEMO-1001', 'Cardiology', {
    name: 'Apex Heart Clinic', address: '12 Sample Road, Indiranagar', city: 'Bengaluru', lat: 12.9784, lng: 77.6408,
  });

  const facility = await prisma.facility.upsert({
    where: { clinicId: mainDoctor.clinic.id },
    update: { name: 'Arogya Community Health Centre' },
    create: { clinicId: mainDoctor.clinic.id, name: 'Arogya Community Health Centre', address: '45 Fictional Health Avenue', city: 'Bengaluru' },
  });
  const nurse = await user('nurse@arogyanexus.test', 'Nisha Demo Nurse', Role.NURSE, '+91-90000-10002');
  await prisma.staffMembership.upsert({
    where: { userId_facilityId: { userId: nurse.id, facilityId: facility.id } },
    update: { role: StaffRole.NURSE, active: true },
    create: { userId: nurse.id, facilityId: facility.id, role: StaffRole.NURSE },
  });
  const admin = await user('admin@arogyanexus.test', 'Arogya Demo Admin', Role.ADMIN, '+91-90000-10003');

  const additional = [
    ['doctor.dermatology@arogyanexus.test', 'Dr. Kavya Rao', 'KA-DEMO-1002', 'Dermatology', 'Indiranagar Skin Clinic', 12.9719, 77.6412],
    ['doctor.pediatrics@arogyanexus.test', 'Dr. Rohan Iyer', 'KA-DEMO-1003', 'Pediatrics', 'Little Steps Clinic', 12.9352, 77.6245],
    ['doctor.orthopedics@arogyanexus.test', 'Dr. Neha Menon', 'KA-DEMO-1004', 'Orthopedics', 'Greenline Bone Care', 12.9591, 77.6974],
    ['doctor.neurology@arogyanexus.test', 'Dr. Arjun Nair', 'KA-DEMO-1005', 'Neurology', 'Northstar Neuro Clinic', 13.0358, 77.597],
    ['doctor.gynecology@arogyanexus.test', 'Dr. Diya Shetty', 'KA-DEMO-1006', 'Gynecology', 'Sakhi Women’s Clinic', 12.9141, 77.6101],
    ['doctor.cardiology@arogyanexus.test', 'Dr. Vikram Das', 'KA-DEMO-1007', 'Cardiology', 'Cedar Cardiac Centre', 12.9982, 77.553],
  ] as const;
  for (const [email, name, registration, specialty, clinicName, lat, lng] of additional) {
    await doctor(email, name, registration, specialty, { name: clinicName, address: `Fictional ${specialty} Road, Bengaluru`, city: 'Bengaluru', lat, lng });
  }

  console.log('ArogyaNexus fictional demo logins (shared password shown below):');
  console.log(`Patient: ${patientUser.email}`);
  console.log(`Doctor: ${mainDoctor.account.email}`);
  console.log(`Nurse: ${nurse.email}`);
  console.log(`Admin: ${admin.email}`);
  for (const [email] of additional) console.log(`Doctor: ${email}`);
  console.log(`Password: ${password}`);
}

main().catch((error) => {
  console.error('Database seed failed:', error);
  process.exitCode = 1;
}).finally(async () => prisma.$disconnect());

