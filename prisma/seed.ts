import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();
const BCRYPT_SALT_ROUNDS = 12;

async function main() {
  console.log('[ArogyaNexus Seed] Starting database cleanup and seeding...');

  // 1. Clean all existing tables to guarantee only the 3 users exist
  console.log('[ArogyaNexus Seed] Deleting existing records across all tables...');
  await prisma.visitRecord.deleteMany();
  await prisma.accessLog.deleteMany();
  await prisma.healthRecord.deleteMany();
  await prisma.vitalReading.deleteMany();
  await prisma.patientCondition.deleteMany();
  await prisma.appointment.deleteMany();
  await prisma.profileAccess.deleteMany();
  await prisma.profile.deleteMany();
  await prisma.doctorProfile.deleteMany();
  await prisma.user.deleteMany();
  console.log('[ArogyaNexus Seed] All existing user profiles removed.');

  // Password for all 3 accounts: Pass@123
  const commonPassword = 'Pass@123';
  const passwordHash = await bcrypt.hash(commonPassword, BCRYPT_SALT_ROUNDS);

  // 2. Admin User
  const admin = await prisma.user.create({
    data: {
      id: '11111111-1111-4111-a111-111111111111',
      full_name: 'Platform Administrator',
      email: 'a@gmail.com',
      phone: '+1 (555) 999-0000',
      role: 'admin',
      password_hash: passwordHash,
    },
  });
  console.log(`[ArogyaNexus Seed] Seeded Admin: ${admin.email} (Role: ${admin.role})`);

  // 3. Doctor User & Approved Profile
  const doctorUser = await prisma.user.create({
    data: {
      id: '22222222-2222-4222-a222-222222222222',
      full_name: 'Dr. Ananya Sharma',
      email: 'd@gmail.com',
      phone: '+1 (555) 234-5678',
      role: 'doctor',
      password_hash: passwordHash,
    },
  });

  const doctorProfile = await prisma.doctorProfile.create({
    data: {
      id: 'dp-approved-1',
      user_id: doctorUser.id,
      speciality: 'Cardiology',
      registration_number: 'MCI-2020-88491',
      clinic_name: 'Apex Multi-Specialty Heart Center',
      clinic_address: 'Suite 400, Medical Boulevard, Bengaluru',
      consultation_fee: 150.0,
      status: 'approved',
      verified: true,
      clinic_lat: 12.9716,
      clinic_lng: 77.5946,
    },
  });
  console.log(`[ArogyaNexus Seed] Seeded Approved Doctor: ${doctorUser.email} (Profile ID: ${doctorProfile.id})`);

  // 4. Patient User & Family Profiles
  const patient = await prisma.user.create({
    data: {
      id: '33333333-3333-4333-a333-333333333333',
      full_name: 'Atharv Kavitake',
      email: 'u@gmail.com',
      phone: '+1 (555) 019-2834',
      role: 'patient',
      password_hash: passwordHash,
    },
  });

  // Patient Self Profile
  const selfProfile = await prisma.profile.create({
    data: {
      id: 'profile-self-1',
      user_id: patient.id,
      name: patient.full_name,
      relation: 'SELF',
      seed_key: 'seed:profile-SELF',
      allergies: ['Penicillin', 'Pollen'],
      dob: new Date('1998-05-15'),
      gender: 'Male',
      blood_group: 'O+',
      phone: patient.phone,
      emergency_name: 'Sunita Kavitake',
      emergency_phone: '+1 (555) 234-5678',
      emergency_relation: 'MOTHER',
      allergies_confirmed: true,
      onboarding_step: 4,
      onboarded_at: new Date(),
    },
  });

  await prisma.profileAccess.create({
    data: {
      profile_id: selfProfile.id,
      user_id: patient.id,
    },
  });

  // Patient Mother Profile
  const motherProfile = await prisma.profile.create({
    data: {
      id: 'profile-mother-1',
      user_id: patient.id,
      name: 'Sunita Kavitake',
      relation: 'MOTHER',
      seed_key: 'seed:profile-MOTHER',
      allergies: [],
      dob: new Date('1972-08-20'),
      gender: 'Female',
      blood_group: 'B+',
      emergency_name: 'Atharv Kavitake',
      emergency_phone: '+1 (555) 019-2834',
      emergency_relation: 'SON',
      allergies_confirmed: true,
      onboarding_step: 4,
      onboarded_at: new Date(),
    },
  });

  await prisma.profileAccess.create({
    data: {
      profile_id: motherProfile.id,
      user_id: patient.id,
    },
  });

  // Patient Son Profile
  const sonProfile = await prisma.profile.create({
    data: {
      id: 'profile-son-1',
      user_id: patient.id,
      name: 'Aarav Kavitake',
      relation: 'SON',
      seed_key: 'seed:profile-SON',
      allergies: [],
      dob: new Date('2020-03-10'),
      gender: 'Male',
      blood_group: 'O+',
      emergency_name: 'Atharv Kavitake',
      emergency_phone: '+1 (555) 019-2834',
      emergency_relation: 'FATHER',
      allergies_confirmed: true,
      onboarding_step: 4,
      onboarded_at: new Date(),
    },
  });

  await prisma.profileAccess.create({
    data: {
      profile_id: sonProfile.id,
      user_id: patient.id,
    },
  });

  console.log(`[ArogyaNexus Seed] Seeded Patient: ${patient.email} (Profiles: SELF, MOTHER, SON)`);

  // 5. Update .local_db.json fallback file to maintain exact consistency
  const localDbPath = path.resolve(process.cwd(), '.local_db.json');
  const localDbData = {
    users: [
      {
        id: admin.id,
        full_name: admin.full_name,
        email: admin.email,
        password_hash: passwordHash,
        phone: admin.phone,
        role: admin.role,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: doctorUser.id,
        full_name: doctorUser.full_name,
        email: doctorUser.email,
        password_hash: passwordHash,
        phone: doctorUser.phone,
        role: doctorUser.role,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: patient.id,
        full_name: patient.full_name,
        email: patient.email,
        password_hash: passwordHash,
        phone: patient.phone,
        role: patient.role,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ],
    doctor_profiles: [
      {
        id: doctorProfile.id,
        user_id: doctorUser.id,
        speciality: doctorProfile.speciality,
        registration_number: doctorProfile.registration_number,
        clinic_name: doctorProfile.clinic_name,
        clinic_address: doctorProfile.clinic_address,
        consultation_fee: Number(doctorProfile.consultation_fee),
        status: doctorProfile.status,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ],
    appointments: [],
  };

  fs.writeFileSync(localDbPath, JSON.stringify(localDbData, null, 2), 'utf-8');
  console.log('[ArogyaNexus Seed] Synchronized fallback .local_db.json.');
  console.log('[ArogyaNexus Seed] Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('[ArogyaNexus Seed] Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
