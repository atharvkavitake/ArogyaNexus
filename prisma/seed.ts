import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { storeRecord } from '../server/recordStorage';

const prisma = new PrismaClient();
const BCRYPT_SALT_ROUNDS = 12;

function makeSamplePdf(title: string): Buffer {
  const safe = title.replace(/[^A-Za-z0-9 .-]/g, '').slice(0, 90);
  const stream = `BT /F1 14 Tf 50 750 Td (ArogyaNexus Medical Record) Tj 0 -24 Td /F1 12 Tf (${safe}) Tj ET`;
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>',
    `<< /Length ${Buffer.byteLength(stream, 'ascii')} >>\nstream\n${stream}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(pdf, 'ascii'));
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = Buffer.byteLength(pdf, 'ascii');
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets.slice(1)) {
    pdf += `${String(offset).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(pdf, 'ascii');
}

const atDaysAgo = (days: number, hour = 9) => {
  const date = new Date();
  date.setDate(date.getDate() - days);
  date.setHours(hour, 15, 0, 0);
  return date;
};

const atFutureDays = (days: number, hour: number, minute = 0) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  date.setHours(hour, minute, 0, 0);
  return date;
};

async function main() {
  console.log('[ArogyaNexus Unified Seed] Starting full PostgreSQL database seeding...');

  // 1. Clean all existing tables to guarantee a clean, consistent state
  console.log('[ArogyaNexus Unified Seed] Clearing old records...');
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
  console.log('[ArogyaNexus Unified Seed] All tables cleared.');

  const defaultPassword = 'Pass@123';
  const defaultHash = await bcrypt.hash(defaultPassword, BCRYPT_SALT_ROUNDS);

  // 2. Seed Admin User
  const admin = await prisma.user.create({
    data: {
      id: '11111111-1111-4111-a111-111111111111',
      full_name: 'Platform Administrator',
      email: 'a@gmail.com',
      phone: '+1 (555) 999-0000',
      role: 'admin',
      password_hash: defaultHash,
    },
  });
  console.log(`✓ [Admin] Seeded: ${admin.email}`);

  // 3. Seed 10 Approved Doctors with complete profiles, varied fees, locations, and specialities
  const doctorSpecs = [
    {
      id: 'dp-ananya-sharma',
      email: 'd@gmail.com', // Primary doctor requested by user
      name: 'Dr. Ananya Sharma',
      phone: '+1 (555) 234-5678',
      speciality: 'Cardiology',
      regNo: 'MCI-2018-04192',
      clinic: 'Apex Heart & Wellness Centre',
      address: '12th Main Road, Indiranagar, Bengaluru, Karnataka',
      fee: 900.0,
      lat: 12.9784,
      lng: 77.6408,
    },
    {
      id: 'dp-meera-iyer',
      email: 'meera.iyer@arogyanexus.test',
      name: 'Dr. Meera Iyer',
      phone: '+91 98450 12345',
      speciality: 'Endocrinology',
      regNo: 'KMC-2012-02573',
      clinic: 'Narayana Health City',
      address: 'Hosur Road, Electronic City, Bengaluru, Karnataka',
      fee: 1100.0,
      lat: 12.8399,
      lng: 77.6770,
    },
    {
      id: 'dp-arjun-nair',
      email: 'arjun.nair@arogyanexus.test',
      name: 'Dr. Arjun Nair',
      phone: '+91 98450 23456',
      speciality: 'Dermatology',
      regNo: 'KMC-2016-01884',
      clinic: 'Sparsh Skin & Laser Clinic',
      address: '9th Block, Jayanagar, Bengaluru, Karnataka',
      fee: 750.0,
      lat: 12.9250,
      lng: 77.5938,
    },
    {
      id: 'dp-ritu-rao',
      email: 'ritu.rao@arogyanexus.test',
      name: 'Dr. Ritu Rao',
      phone: '+91 98450 34567',
      speciality: 'Paediatrics',
      regNo: 'KMC-2019-05108',
      clinic: 'Cloudnine Children’s Clinic',
      address: '80 Feet Road, Koramangala, Bengaluru, Karnataka',
      fee: 800.0,
      lat: 12.9352,
      lng: 77.6245,
    },
    {
      id: 'dp-vikram-patil',
      email: 'vikram.patil@arogyanexus.test',
      name: 'Dr. Vikram Patil',
      phone: '+91 98220 45678',
      speciality: 'General Medicine',
      regNo: 'MMC-2014-08219',
      clinic: 'Arogya Family Health Clinic',
      address: 'FC Road, Shivajinagar, Pune, Maharashtra',
      fee: 450.0,
      lat: 18.5204,
      lng: 73.8567,
    },
    {
      id: 'dp-sunita-kulkarni',
      email: 'sunita.kulkarni@arogyanexus.test',
      name: 'Dr. Sunita Kulkarni',
      phone: '+91 98450 56789',
      speciality: 'Neurology',
      regNo: 'KMC-2010-09341',
      clinic: 'Brain & Spine Specialty Center',
      address: 'MG Road, Bengaluru, Karnataka',
      fee: 1400.0,
      lat: 12.9756,
      lng: 77.6066,
    },
    {
      id: 'dp-rajesh-deshmukh',
      email: 'rajesh.deshmukh@arogyanexus.test',
      name: 'Dr. Rajesh Deshmukh',
      phone: '+91 98220 67890',
      speciality: 'Orthopaedics',
      regNo: 'MMC-2015-03712',
      clinic: 'Joint Care & Bone Hospital',
      address: 'Baner Road, Pune, Maharashtra',
      fee: 650.0,
      lat: 18.5590,
      lng: 73.7868,
    },
    {
      id: 'dp-priya-nambiar',
      email: 'priya.nambiar@arogyanexus.test',
      name: 'Dr. Priya Nambiar',
      phone: '+91 98450 78901',
      speciality: 'Ophthalmology',
      regNo: 'KMC-2021-06782',
      clinic: 'Nethra Super Specialty Eye Care',
      address: 'Whitefield Main Road, Bengaluru, Karnataka',
      fee: 500.0,
      lat: 12.9698,
      lng: 77.7499,
    },
    {
      id: 'dp-farhan-siddiqui',
      email: 'farhan.siddiqui@arogyanexus.test',
      name: 'Dr. Farhan Siddiqui',
      phone: '+91 98450 89012',
      speciality: 'ENT',
      regNo: 'KMC-2017-02451',
      clinic: 'Bangalore ENT & Hearing Care',
      address: 'Malleshwaram 8th Cross, Bengaluru, Karnataka',
      fee: 600.0,
      lat: 13.0031,
      lng: 77.5643,
    },
    {
      id: 'dp-kavita-joshi',
      email: 'kavita.joshi@arogyanexus.test',
      name: 'Dr. Kavita Joshi',
      phone: '+91 98220 90123',
      speciality: 'Psychiatry',
      regNo: 'MMC-2013-04981',
      clinic: 'MindWell Wellness Center',
      address: 'Kothrud, Pune, Maharashtra',
      fee: 1200.0,
      lat: 18.5074,
      lng: 73.8077,
    },
  ];

  const doctors: any[] = [];
  for (const spec of doctorSpecs) {
    const docUser = await prisma.user.create({
      data: {
        full_name: spec.name,
        email: spec.email,
        phone: spec.phone,
        role: 'doctor',
        password_hash: defaultHash,
      },
    });

    const docProfile = await prisma.doctorProfile.create({
      data: {
        id: spec.id,
        user_id: docUser.id,
        speciality: spec.speciality,
        registration_number: spec.regNo,
        clinic_name: spec.clinic,
        clinic_address: spec.address,
        consultation_fee: spec.fee,
        status: 'approved',
        verified: true,
        clinic_lat: spec.lat,
        clinic_lng: spec.lng,
      },
    });

    doctors.push({ ...docProfile, user: docUser });
  }
  console.log(`✓ [Doctors] Seeded ${doctors.length} approved doctors across 10 specialities.`);

  // 4. Seed Full Patient: u@gmail.com
  const patient = await prisma.user.create({
    data: {
      id: '33333333-3333-4333-a333-333333333333',
      full_name: 'Atharv Kavitake',
      email: 'u@gmail.com',
      phone: '+1 (555) 019-2834',
      role: 'patient',
      password_hash: defaultHash,
    },
  });

  // Profiles: SELF, MOTHER, SON
  const selfProfile = await prisma.profile.create({
    data: {
      id: 'profile-self-1',
      user_id: patient.id,
      name: patient.full_name,
      relation: 'SELF',
      seed_key: 'seed:profile-SELF',
      allergies: ['Penicillin', 'Pollen'],
    },
  });
  await prisma.profileAccess.create({
    data: { profile_id: selfProfile.id, user_id: patient.id },
  });

  const motherProfile = await prisma.profile.create({
    data: {
      id: 'profile-mother-1',
      user_id: patient.id,
      name: 'Sunita Kavitake',
      relation: 'MOTHER',
      seed_key: 'seed:profile-MOTHER',
      allergies: ['Dust', 'Sulfa drugs'],
    },
  });
  await prisma.profileAccess.create({
    data: { profile_id: motherProfile.id, user_id: patient.id },
  });

  const sonProfile = await prisma.profile.create({
    data: {
      id: 'profile-son-1',
      user_id: patient.id,
      name: 'Aarav Kavitake',
      relation: 'SON',
      seed_key: 'seed:profile-SON',
      allergies: [],
    },
  });
  await prisma.profileAccess.create({
    data: { profile_id: sonProfile.id, user_id: patient.id },
  });

  console.log(`✓ [Patient] Seeded ${patient.email} with 3 linked profiles (SELF, MOTHER, SON).`);

  // 5. Seed Real Health Records with genuine PDF attachments
  const healthRecordList = [
    {
      category: 'LAB_REPORT',
      title: 'Complete Blood Count (CBC)',
      issuer: 'Apollo Diagnostics',
      daysAgo: 2,
      docIdx: 0,
    },
    {
      category: 'IMAGING',
      title: 'Echocardiogram (ECG) Report',
      issuer: 'Apex Multi-Specialty Heart Center',
      daysAgo: 5,
      docIdx: 0,
    },
    {
      category: 'PRESCRIPTION',
      title: 'Cardiology Prescription - Atorvastatin 20mg',
      issuer: 'Apex Multi-Specialty Heart Center',
      daysAgo: 6,
      docIdx: 0,
    },
    {
      category: 'DISCHARGE_SUMMARY',
      title: 'Annual Inpatient Health Assessment Summary',
      issuer: 'Manipal Hospital Bengaluru',
      daysAgo: 25,
      docIdx: 1,
    },
    {
      category: 'LAB_REPORT',
      title: 'Comprehensive Lipid Profile',
      issuer: 'Metropolis Healthcare Labs',
      daysAgo: 30,
      docIdx: 1,
    },
    {
      category: 'IMAGING',
      title: 'Chest X-Ray (PA View)',
      issuer: 'Sparsh Hospital Imaging Department',
      daysAgo: 45,
      docIdx: 2,
    },
    {
      category: 'LAB_REPORT',
      title: 'Thyroid Function Test (TSH, T3, T4)',
      issuer: 'Dr Lal PathLabs',
      daysAgo: 60,
      docIdx: 1,
    },
    {
      category: 'OTHER',
      title: 'General Consultation Clinical Notes',
      issuer: 'Arogya Family Health Clinic',
      daysAgo: 75,
      docIdx: 4,
    },
  ];

  const seededRecords: any[] = [];
  for (const item of healthRecordList) {
    const pdfBytes = makeSamplePdf(item.title);
    const fileKey = await storeRecord(pdfBytes, 'pdf');
    const assignedDoc = doctors[item.docIdx % doctors.length];

    const record = await prisma.healthRecord.create({
      data: {
        patient_id: selfProfile.id,
        category: item.category,
        title: item.title,
        issuer: item.issuer,
        record_date: atDaysAgo(item.daysAgo),
        doctor_id: assignedDoc.id,
        uploaded_by: assignedDoc.user.id,
        source: 'DOCTOR',
        file_key: fileKey,
        file_name: `${item.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.pdf`,
        mime_type: 'application/pdf',
        size_bytes: pdfBytes.length,
      },
    });
    seededRecords.push(record);
  }
  console.log(`✓ [Health Records] Created ${seededRecords.length} PDF health records with actual file storage.`);

  // 6. Seed 31 Days of Vital Readings
  const vitalsToCreate: any[] = [];
  for (let day = 0; day < 31; day++) {
    const measuredAt = atDaysAgo(day * 2);
    const bloodSugar = 94 + Math.round(Math.sin(day * 0.7) * 12);
    const systolic = 118 + Math.round(Math.sin(day * 0.5) * 6);
    const diastolic = 78 + Math.round(Math.cos(day * 0.5) * 4);
    const cholesterol = 180 + Math.round(Math.sin(day * 0.3) * 10);
    const heartRate = 72 + Math.round(Math.cos(day * 0.8) * 6);
    const weight = 68.5 - Number((day * 0.05).toFixed(1));

    vitalsToCreate.push(
      { patient_id: selfProfile.id, type: 'BLOOD_SUGAR_FASTING', value: bloodSugar, unit: 'mg/dL', measured_at: measuredAt, source: 'SELF' },
      { patient_id: selfProfile.id, type: 'BP_SYSTOLIC', value: systolic, unit: 'mmHg', measured_at: measuredAt, source: 'SELF' },
      { patient_id: selfProfile.id, type: 'BP_DIASTOLIC', value: diastolic, unit: 'mmHg', measured_at: measuredAt, source: 'SELF' },
      { patient_id: selfProfile.id, type: 'CHOLESTEROL_TOTAL', value: cholesterol, unit: 'mg/dL', measured_at: measuredAt, source: 'SELF' },
      { patient_id: selfProfile.id, type: 'HEART_RATE', value: heartRate, unit: 'bpm', measured_at: measuredAt, source: 'SELF' },
      { patient_id: selfProfile.id, type: 'WEIGHT', value: weight, unit: 'kg', measured_at: measuredAt, source: 'SELF' },
    );
  }
  for (const v of vitalsToCreate) {
    await prisma.vitalReading.create({ data: v });
  }
  console.log(`✓ [Vitals] Seeded ${vitalsToCreate.length} vital readings across 30 days.`);

  // 7. Seed Patient Conditions
  const conditions = [
    { name: 'Hypertension', status: 'ACTIVE', sinceDays: 150 },
    { name: 'Type 2 Diabetes Mellitus', status: 'ACTIVE', sinceDays: 90 },
    { name: 'Iron Deficiency Anemia', status: 'RESOLVED', sinceDays: 280 },
  ];
  for (const c of conditions) {
    await prisma.patientCondition.create({
      data: {
        patient_id: selfProfile.id,
        name: c.name,
        status: c.status,
        since: atDaysAgo(c.sinceDays),
      },
    });
  }
  console.log(`✓ [Conditions] Seeded ${conditions.length} conditions.`);

  // 8. Seed Appointments (Upcoming, Past Completed, and Cancelled)
  // Appointment 1: Tomorrow Video with Dr. Ananya Sharma
  const appt1Starts = atFutureDays(1, 10, 30);
  await prisma.appointment.create({
    data: {
      patient_id: patient.id,
      profile_id: selfProfile.id,
      doctor_profile_id: doctors[0].id,
      appointment_at: appt1Starts,
      ends_at: new Date(appt1Starts.getTime() + 30 * 60000),
      mode: 'VIDEO',
      status: 'confirmed',
      reason: 'Routine Cardiology Follow-up and Medication Review',
    },
  });

  // Appointment 2: In 3 Days In-Person with Dr. Arjun Nair (Dermatology)
  const appt2Starts = atFutureDays(3, 16, 0);
  await prisma.appointment.create({
    data: {
      patient_id: patient.id,
      profile_id: selfProfile.id,
      doctor_profile_id: doctors[2].id,
      appointment_at: appt2Starts,
      ends_at: new Date(appt2Starts.getTime() + 30 * 60000),
      mode: 'IN_PERSON',
      status: 'confirmed',
      reason: 'Skin rash examination and allergy patch test',
    },
  });

  // Appointment 3: Pending request with Dr. Meera Iyer (Endocrinology)
  const appt3Starts = atFutureDays(7, 11, 0);
  await prisma.appointment.create({
    data: {
      patient_id: patient.id,
      profile_id: selfProfile.id,
      doctor_profile_id: doctors[1].id,
      appointment_at: appt3Starts,
      ends_at: new Date(appt3Starts.getTime() + 30 * 60000),
      mode: 'IN_PERSON',
      status: 'pending',
      reason: 'HbA1c Blood Sugar Consultation',
    },
  });

  // Appointment 4: Completed appointment in past with Visit Record & Prescription PDF
  const pastStarts = atDaysAgo(14, 15);
  const completedAppt = await prisma.appointment.create({
    data: {
      patient_id: patient.id,
      profile_id: selfProfile.id,
      doctor_profile_id: doctors[0].id,
      appointment_at: pastStarts,
      ends_at: new Date(pastStarts.getTime() + 30 * 60000),
      mode: 'IN_PERSON',
      status: 'completed',
      reason: 'Bi-annual Cardiovascular Checkup',
    },
  });

  const rxBytes = makeSamplePdf('Prescription - Dr Ananya Sharma');
  const rxKey = await storeRecord(rxBytes, 'pdf');
  await prisma.visitRecord.create({
    data: {
      appointment_id: completedAppt.id,
      prescription_file_key: rxKey,
    },
  });

  // Appointment 5: Cancelled appointment
  await prisma.appointment.create({
    data: {
      patient_id: patient.id,
      profile_id: selfProfile.id,
      doctor_profile_id: doctors[3].id,
      appointment_at: atDaysAgo(30, 11),
      ends_at: atDaysAgo(30, 11, 30),
      mode: 'IN_PERSON',
      status: 'cancelled',
      reason: 'Paediatric nutrition consultation',
      cancel_reason: 'Rescheduled due to patient travel',
    },
  });
  console.log(`✓ [Appointments] Seeded upcoming, completed, and past appointments.`);

  // 9. Seed Access Audit Logs
  const auditLogs = [
    { action: 'VIEW', record: seededRecords[0], days: 0 },
    { action: 'DOWNLOAD', record: seededRecords[1], days: 1 },
    { action: 'WRITE', record: seededRecords[2], days: 5 },
    { action: 'VIEW', record: seededRecords[3], days: 15 },
  ];
  for (const log of auditLogs) {
    await prisma.accessLog.create({
      data: {
        patient_id: selfProfile.id,
        doctor_id: doctors[0].id,
        action: log.action,
        record_id: log.record.id,
        record_title: log.record.title,
        created_at: atDaysAgo(log.days),
      },
    });
  }
  console.log(`✓ [Audit Logs] Seeded doctor access privacy logs.`);

  console.log('\n======================================================');
  console.log('✅ ALL SEED DATA SUCCESSFULLY PERSISTED TO POSTGRESQL');
  console.log('Accounts ready:');
  console.log(' - Patient: u@gmail.com (Pass@123)');
  console.log(' - Doctor:  d@gmail.com (Pass@123) + 9 additional doctors');
  console.log(' - Admin:   a@gmail.com (Pass@123)');
  console.log('======================================================\n');
}

main()
  .catch((e) => {
    console.error('[ArogyaNexus Seed] Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
