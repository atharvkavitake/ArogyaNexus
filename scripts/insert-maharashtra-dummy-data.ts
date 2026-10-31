import { prisma } from '../lib/db/prisma';
import bcrypt from 'bcryptjs';

// 20 Distinct Medical Specialties
const SPECIALTIES = [
  'Cardiology',
  'Dermatology',
  'Orthopedics',
  'Pediatrics',
  'Neurology',
  'Gynecology',
  'Ophthalmology',
  'General Medicine',
  'ENT',
  'Gastroenterology',
  'Pulmonology',
  'Endocrinology',
  'Psychiatry',
  'Nephrology',
  'Urology',
  'Oncology',
  'Rheumatology',
  'General Surgery',
  'Dental Surgery',
  'Physiotherapy',
] as const;

// Major Maharashtra Cities with focus on Kolhapur and nearby regions
interface CityConfig {
  name: string;
  count: number;
  lat: number;
  lng: number;
  localities: string[];
  pincodeBase: number;
}

const CITIES: CityConfig[] = [
  {
    name: 'Kolhapur',
    count: 50,
    lat: 16.7050,
    lng: 74.2433,
    localities: ['Tarabai Park', 'Shahupuri', 'Rajarampuri', 'Nagala Park', 'Kasba Bawada', 'Ruikar Colony', 'Rankala Lake Road', 'Station Road', 'New Shahupuri', 'Laxmipuri'],
    pincodeBase: 416001,
  },
  {
    name: 'Sangli',
    count: 30,
    lat: 16.8524,
    lng: 74.5815,
    localities: ['Vishrambag', 'Miraj Road', 'Gaon Bhag', 'Khanbhag', 'South Shivaji Nagar', 'Kupwad Road'],
    pincodeBase: 416415,
  },
  {
    name: 'Satara',
    count: 25,
    lat: 17.6805,
    lng: 73.9997,
    localities: ['Powai Naka', 'Sadar Bazar', 'Radhika Road', 'Godoli', 'Camp Satara', 'Karanje'],
    pincodeBase: 415001,
  },
  {
    name: 'Pune',
    count: 35,
    lat: 18.5204,
    lng: 73.8567,
    localities: ['Shivajinagar', 'Kothrud', 'Baner', 'Aundh', 'Kalyani Nagar', 'Viman Nagar', 'Deccan Gymkhana'],
    pincodeBase: 411004,
  },
  {
    name: 'Mumbai',
    count: 30,
    lat: 19.0760,
    lng: 72.8777,
    localities: ['Bandra West', 'Dadar', 'Andheri West', 'Chembur', 'Colaba', 'Parel', 'Borivali West'],
    pincodeBase: 400050,
  },
  {
    name: 'Nashik',
    count: 20,
    lat: 19.9975,
    lng: 73.7898,
    localities: ['College Road', 'Gangapur Road', 'Indira Nagar', 'Panchavati', 'Mahatma Nagar'],
    pincodeBase: 422005,
  },
  {
    name: 'Solapur',
    count: 10,
    lat: 17.6599,
    lng: 75.9064,
    localities: ['Jule Solapur', 'Navi Peth', 'Hotgi Road', 'Saat Rasta', 'Old Employment Chowk'],
    pincodeBase: 413001,
  },
];

const FIRST_NAMES_MALE = [
  'Amit', 'Rajesh', 'Vikram', 'Suresh', 'Sachin', 'Nilesh', 'Ganesh', 'Sandeep', 'Prakash', 'Mahesh',
  'Abhay', 'Pradeep', 'Sunil', 'Santosh', 'Anand', 'Deepak', 'Manoj', 'Vijay', 'Rahul', 'Kiran',
  'Ashok', 'Tushar', 'Rohan', 'Milind', 'Vinod', 'Hemant', 'Ajay', 'Shrikant', 'Prashant', 'Devendra',
];

const FIRST_NAMES_FEMALE = [
  'Priya', 'Sneha', 'Anjali', 'Pooja', 'Sunita', 'Neha', 'Kavita', 'Smita', 'Aparna', 'Manasi',
  'Shalini', 'Suvarna', 'Vaishali', 'Swati', 'Megha', 'Madhuri', 'Archana', 'Geeta', 'Rohini', 'Urmila',
];

const SURNAMES = [
  'Patil', 'Deshmukh', 'Kulkarni', 'Jadhav', 'Shinde', 'Chavan', 'Kadam', 'Pawar', 'More', 'Gaikwad',
  'Bhosale', 'Sawant', 'Mane', 'Mohite', 'Joshi', 'Kamble', 'Sutar', 'Kale', 'Ghadge', 'Salunkhe',
  'Khandekar', 'Ghatge', 'Nalawade', 'Raut', 'Barge', 'Phadtare', 'Dabholkar', 'Ghorpade', 'Mahadik', 'Ghorpade',
];

const CLINIC_TYPES = [
  'Speciality Clinic', 'Healthcare Centre', 'Super Speciality Hospital', 'Medicare Clinic',
  'Care Hospital', 'Wellness Clinic', 'Medical Diagnostic Centre', 'Polyclinic & Nursing Home',
  'Health Institute', 'Family Care Clinic',
];

const LANGUAGES_POOL = [
  ['Marathi', 'Hindi', 'English'],
  ['Marathi', 'English'],
  ['Marathi', 'Hindi', 'English', 'Kannada'],
  ['Marathi', 'Hindi'],
];

async function main() {
  console.log('================================================================');
  console.log('   AROGYANEXUS — Maharashtra Dummy Data Insertion Script');
  console.log('   Target: 10 Patients & 200 Doctors (20 Specialties x 10 Doctors)');
  console.log('================================================================\n');

  // Securely hash common demo password once
  const passwordHash = bcrypt.hashSync('Pass@123', 10);

  // --------------------------------------------------------------------------
  // 1. INSERT 10 REALISTIC PATIENTS
  // --------------------------------------------------------------------------
  console.log('[Step 1/3] Inserting 10 realistic dummy patients...');
  const patientConfigs = [
    { name: 'Sachin Shinde', email: 'patient.sachin.shinde@arogyanexus.in', phone: '+91 98221 00101', gender: 'Male', dob: '1992-04-12', bg: 'B+', ht: 172, wt: 68, emName: 'Swati Shinde', emPhone: '+91 98221 00201', emRel: 'SPOUSE', allergies: ['Penicillin'] },
    { name: 'Pooja Gaikwad', email: 'patient.pooja.gaikwad@arogyanexus.in', phone: '+91 98221 00102', gender: 'Female', dob: '1995-09-24', bg: 'O+', ht: 160, wt: 55, emName: 'Ramesh Gaikwad', emPhone: '+91 98221 00202', emRel: 'FATHER', allergies: [] },
    { name: 'Rohan Sawant', email: 'patient.rohan.sawant@arogyanexus.in', phone: '+91 98221 00103', gender: 'Male', dob: '1988-11-05', bg: 'A+', ht: 178, wt: 75, emName: 'Snehal Sawant', emPhone: '+91 98221 00203', emRel: 'SPOUSE', allergies: ['Sulfa drugs'] },
    { name: 'Meera Deshmukh', email: 'patient.meera.deshmukh@arogyanexus.in', phone: '+91 98221 00104', gender: 'Female', dob: '1990-02-18', bg: 'AB+', ht: 163, wt: 59, emName: 'Prakash Deshmukh', emPhone: '+91 98221 00204', emRel: 'BROTHER', allergies: ['Dust mites'] },
    { name: 'Nilesh Bhosale', email: 'patient.nilesh.bhosale@arogyanexus.in', phone: '+91 98221 00105', gender: 'Male', dob: '1985-07-30', bg: 'O-', ht: 169, wt: 72, emName: 'Sunita Bhosale', emPhone: '+91 98221 00205', emRel: 'SPOUSE', allergies: [] },
    { name: 'Snehal Kulkarni', email: 'patient.snehal.kulkarni@arogyanexus.in', phone: '+91 98221 00106', gender: 'Female', dob: '1998-12-14', bg: 'B+', ht: 157, wt: 52, emName: 'Anand Kulkarni', emPhone: '+91 98221 00206', emRel: 'FATHER', allergies: ['Pollen'] },
    { name: 'Ganesh Patil', email: 'patient.ganesh.patil@arogyanexus.in', phone: '+91 98221 00107', gender: 'Male', dob: '1979-06-22', bg: 'A-', ht: 175, wt: 80, emName: 'Vidya Patil', emPhone: '+91 98221 00207', emRel: 'SPOUSE', allergies: [] },
    { name: 'Tanvi Jadhav', email: 'patient.tanvi.jadhav@arogyanexus.in', phone: '+91 98221 00108', gender: 'Female', dob: '1996-03-08', bg: 'O+', ht: 165, wt: 57, emName: 'Mahesh Jadhav', emPhone: '+91 98221 00208', emRel: 'BROTHER', allergies: ['Aspirin'] },
    { name: 'Pradeep Mane', email: 'patient.pradeep.mane@arogyanexus.in', phone: '+91 98221 00109', gender: 'Male', dob: '1983-10-19', bg: 'B-', ht: 181, wt: 84, emName: 'Aparna Mane', emPhone: '+91 98221 00209', emRel: 'SPOUSE', allergies: [] },
    { name: 'Ashwini Mohite', email: 'patient.ashwini.mohite@arogyanexus.in', phone: '+91 98221 00110', gender: 'Female', dob: '2001-08-03', bg: 'AB-', ht: 162, wt: 54, emName: 'Suresh Mohite', emPhone: '+91 98221 00210', emRel: 'FATHER', allergies: ['Latex'] },
  ];

  let patientCreatedCount = 0;
  let patientExistingCount = 0;

  for (let i = 0; i < patientConfigs.length; i++) {
    const p = patientConfigs[i];
    let user = await prisma.user.findUnique({ where: { email: p.email } });

    if (!user) {
      user = await prisma.user.create({
        data: {
          id: `patient-dummy-${i + 1}`,
          full_name: p.name,
          email: p.email,
          phone: p.phone,
          role: 'patient',
          password_hash: passwordHash,
        },
      });

      const profile = await prisma.profile.create({
        data: {
          id: `profile-dummy-patient-${i + 1}`,
          user_id: user.id,
          name: p.name,
          relation: 'SELF',
          seed_key: `seed:dummy-patient-${i + 1}`,
          dob: new Date(p.dob),
          gender: p.gender,
          blood_group: p.bg,
          phone: p.phone,
          height_cm: p.ht,
          weight_kg: p.wt,
          emergency_name: p.emName,
          emergency_phone: p.emPhone,
          emergency_relation: p.emRel,
          allergies: p.allergies,
          allergies_confirmed: true,
          onboarding_step: 4,
          onboarded_at: new Date(),
        },
      });

      await prisma.profileAccess.create({
        data: {
          profile_id: profile.id,
          user_id: user.id,
          level: 'OWNER',
        },
      });
      patientCreatedCount++;
    } else {
      patientExistingCount++;
    }
  }

  console.log(`✓ Patients processed: ${patientCreatedCount} created, ${patientExistingCount} already existed (Total: ${patientConfigs.length}).\n`);

  // --------------------------------------------------------------------------
  // 2. PREPARE 200 DOCTORS (20 Specialties x 10 Doctors each)
  // --------------------------------------------------------------------------
  console.log('[Step 2/3] Preparing 200 doctors across 20 specialties and Maharashtra cities...');

  // Build the array of 200 doctor slots: exactly 10 per specialty
  const doctorSlots: Array<{ specialty: string; specialtyIndex: number; doctorNumInSpec: number }> = [];
  for (let s = 0; s < SPECIALTIES.length; s++) {
    for (let d = 1; d <= 10; d++) {
      doctorSlots.push({
        specialty: SPECIALTIES[s],
        specialtyIndex: s,
        doctorNumInSpec: d,
      });
    }
  }

  // Build city distribution matching total 200
  // Kolhapur: 50, Sangli: 30, Satara: 25, Pune: 35, Mumbai: 30, Nashik: 20, Solapur: 10
  const cityByName: Record<string, CityConfig> = {};
  for (const city of CITIES) {
    cityByName[city.name] = city;
  }

  // Balanced distribution function: distributes 10 doctors of each specialty across Maharashtra cities
  function getCityForDoctor(specialtyIndex: number, docNumInSpec: number): CityConfig {
    const d = docNumInSpec - 1; // 0 to 9
    const s = specialtyIndex;   // 0 to 19

    if (d === 0 || d === 1) return cityByName['Kolhapur']; // 40 Kolhapur
    if (d === 2) return s < 10 ? cityByName['Kolhapur'] : cityByName['Pune']; // 10 Kolhapur (Total: 50), 10 Pune
    if (d === 3) return cityByName['Pune']; // 20 Pune
    if (d === 4) return s < 5 ? cityByName['Pune'] : cityByName['Sangli']; // 5 Pune (Total: 35), 15 Sangli
    if (d === 5) return s < 15 ? cityByName['Sangli'] : cityByName['Mumbai']; // 15 Sangli (Total: 30), 5 Mumbai
    if (d === 6) return cityByName['Mumbai']; // 20 Mumbai
    if (d === 7) return s < 5 ? cityByName['Mumbai'] : cityByName['Satara']; // 5 Mumbai (Total: 30), 15 Satara
    if (d === 8) return s < 10 ? cityByName['Satara'] : cityByName['Solapur']; // 10 Satara (Total: 25), 10 Solapur (Total: 10)
    if (d === 9) return cityByName['Nashik']; // 20 Nashik (Total: 20)

    return cityByName['Kolhapur'];
  }

  // Interleave and distribute specialties evenly across cities
  const doctorsData = doctorSlots.map((slot, index) => {
    const city = getCityForDoctor(slot.specialtyIndex, slot.doctorNumInSpec);
    const isFemale = index % 3 === 0;
    const firstName = isFemale
      ? FIRST_NAMES_FEMALE[(index + slot.specialtyIndex) % FIRST_NAMES_FEMALE.length]
      : FIRST_NAMES_MALE[(index + slot.specialtyIndex) % FIRST_NAMES_MALE.length];
    const surname = SURNAMES[(index * 3 + slot.doctorNumInSpec) % SURNAMES.length];
    const fullName = `Dr. ${firstName} ${surname}`;
    const email = `dr.${firstName.toLowerCase()}.${surname.toLowerCase()}.${index + 1}@arogyanexus.in`;
    const phone = `+91 94${String(20000000 + index).slice(0, 8)}`;
    const regYear = 2000 + (index % 22);
    const regNum = `MMC-${regYear}-${String(10000 + index).slice(-5)}`;

    const locality = city.localities[index % city.localities.length];
    const pincode = city.pincodeBase + (index % 15);
    const clinicType = CLINIC_TYPES[index % CLINIC_TYPES.length];
    const clinicName = `${surname} ${slot.specialty} & ${clinicType}`;
    const clinicAddress = `${10 + (index % 80)}, ${locality}, ${city.name}, Maharashtra ${pincode}`;

    const latJitter = ((index % 10) - 5) * 0.003;
    const lngJitter = ((index % 8) - 4) * 0.003;
    const clinicLat = Number((city.lat + latJitter).toFixed(4));
    const clinicLng = Number((city.lng + lngJitter).toFixed(4));

    const expYears = 5 + ((index * 7) % 24);
    const fee = 400 + ((index * 50) % 850);
    const languages = LANGUAGES_POOL[index % LANGUAGES_POOL.length];
    const ratingAvg = Number((4.4 + ((index % 6) * 0.1)).toFixed(1));
    const ratingCount = 20 + ((index * 13) % 190);

    const bio = `${fullName} is a senior consultant in ${slot.specialty} practicing in ${city.name} with over ${expYears} years of clinical expertise. Graduated from premier Maharashtra medical institutions, specializing in comprehensive patient diagnostics and patient-centric care at ${clinicName}.`;

    return {
      id: `doc-mh-${String(index + 1).padStart(3, '0')}`,
      userId: `user-doc-mh-${String(index + 1).padStart(3, '0')}`,
      fullName,
      email,
      phone,
      specialty: slot.specialty,
      regNum,
      clinicName,
      clinicAddress,
      city: city.name,
      clinicLat,
      clinicLng,
      fee,
      expYears,
      languages,
      ratingAvg,
      ratingCount,
      bio,
    };
  });

  // --------------------------------------------------------------------------
  // 3. INSERT DOCTORS INTO DATABASE
  // --------------------------------------------------------------------------
  console.log('[Step 3/3] Inserting 200 doctors into database...');
  let doctorsCreatedCount = 0;
  let doctorsUpdatedCount = 0;

  for (const doc of doctorsData) {
    let existingUser = await prisma.user.findUnique({ where: { email: doc.email } });

    if (!existingUser) {
      existingUser = await prisma.user.create({
        data: {
          id: doc.userId,
          full_name: doc.fullName,
          email: doc.email,
          phone: doc.phone,
          role: 'doctor',
          password_hash: passwordHash,
        },
      });
      doctorsCreatedCount++;
    } else {
      await prisma.user.upsert({
        where: { email: doc.email },
        update: {
          full_name: doc.fullName,
          phone: doc.phone,
        },
        create: {
          id: doc.userId,
          full_name: doc.fullName,
          email: doc.email,
          phone: doc.phone,
          role: 'doctor',
          password_hash: passwordHash,
        },
      });
      doctorsUpdatedCount++;
    }

    await prisma.doctorProfile.upsert({
      where: { user_id: existingUser.id },
      update: {
        speciality: doc.specialty,
        registration_number: doc.regNum,
        clinic_name: doc.clinicName,
        clinic_address: doc.clinicAddress,
        consultation_fee: doc.fee,
        status: 'approved',
        verified: true,
        clinic_lat: doc.clinicLat,
        clinic_lng: doc.clinicLng,
        experience_years: doc.expYears,
        languages: doc.languages,
        bio: doc.bio,
        offers_video: true,
        rating_avg: doc.ratingAvg,
        rating_count: doc.ratingCount,
      },
      create: {
        id: doc.id,
        user_id: existingUser.id,
        speciality: doc.specialty,
        registration_number: doc.regNum,
        clinic_name: doc.clinicName,
        clinic_address: doc.clinicAddress,
        consultation_fee: doc.fee,
        status: 'approved',
        verified: true,
        clinic_lat: doc.clinicLat,
        clinic_lng: doc.clinicLng,
        experience_years: doc.expYears,
        languages: doc.languages,
        bio: doc.bio,
        offers_video: true,
        rating_avg: doc.ratingAvg,
        rating_count: doc.ratingCount,
      },
    });
  }

  console.log(`✓ Doctors processed: ${doctorsCreatedCount} created, ${doctorsUpdatedCount} updated (Total: ${doctorsData.length}).\n`);

  // --------------------------------------------------------------------------
  // 4. VERIFICATION & AGGREGATE COUNTS
  // --------------------------------------------------------------------------
  console.log('================================================================');
  console.log('                    VERIFICATION REPORT');
  console.log('================================================================\n');

  // Verify all doctors from database
  const allDoctorProfiles = await prisma.doctorProfile.findMany({
    include: {
      user: {
        select: {
          full_name: true,
          email: true,
        },
      },
    },
  });

  const cityCounts: Record<string, number> = {};
  const specialtyCounts: Record<string, number> = {};

  for (const profile of allDoctorProfiles) {
    // Determine city
    const address = String(profile.clinic_address || '');
    let matchedCity = 'Other';
    for (const c of CITIES) {
      if (new RegExp(`\\b${c.name}\\b`, 'i').test(address)) {
        matchedCity = c.name;
        break;
      }
    }
    cityCounts[matchedCity] = (cityCounts[matchedCity] || 0) + 1;

    // Count specialty
    const spec = profile.speciality || 'General';
    specialtyCounts[spec] = (specialtyCounts[spec] || 0) + 1;
  }

  console.log('1. DOCTOR COUNTS BY CITY (Focus on Kolhapur & nearby):');
  console.log('------------------------------------------------------');
  for (const c of CITIES) {
    console.log(`   • ${c.name.padEnd(14)}: ${String(cityCounts[c.name] || 0).padStart(3)} doctors`);
  }
  if (cityCounts['Other']) {
    console.log(`   • ${'Other'.padEnd(14)}: ${String(cityCounts['Other']).padStart(3)} doctors`);
  }

  console.log('\n2. DOCTOR COUNTS BY SPECIALTY (All 20 Specialties):');
  console.log('---------------------------------------------------');
  for (const spec of SPECIALTIES) {
    console.log(`   • ${spec.padEnd(24)}: ${String(specialtyCounts[spec] || 0).padStart(3)} doctors`);
  }

  // Count total patients
  const allPatients = await prisma.user.findMany({
    where: { role: 'patient' },
  });

  console.log('\n3. TOTAL DATABASE SUMMARY:');
  console.log('---------------------------');
  console.log(`   • Total Patient Users : ${allPatients.length}`);
  console.log(`   • Total Doctor Profiles: ${allDoctorProfiles.length}`);
  console.log(`   • Seed/Dummy Logins   : password is 'Pass@123' for all accounts\n`);
  console.log('================================================================');
}

main()
  .catch((e) => {
    console.error('Fatal error during insertion:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
