import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import net from 'net';

// Real Prisma client instance with hot-reload guard
const globalForPrisma = globalThis as unknown as {
  rawPrisma: PrismaClient | undefined;
};

const rawPrisma =
  globalForPrisma.rawPrisma ??
  new PrismaClient({
    log: ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.rawPrisma = rawPrisma;
}

// ----------------------------------------------------------------------------
// PostgreSQL Connection Prober
// Checks if port 5432 is reachable before calling Prisma to avoid noisy engine errors
// ----------------------------------------------------------------------------
let postgresAvailable: boolean | null = null;
let lastCheckTime = 0;
const CHECK_INTERVAL_MS = 5000;

export async function isPostgresRunning(): Promise<boolean> {
  const now = Date.now();
  if (postgresAvailable !== null && now - lastCheckTime < CHECK_INTERVAL_MS) {
    return postgresAvailable;
  }

  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(150);

    socket.on('connect', () => {
      postgresAvailable = true;
      lastCheckTime = Date.now();
      socket.destroy();
      resolve(true);
    });

    const onFail = () => {
      postgresAvailable = false;
      lastCheckTime = Date.now();
      socket.destroy();
      resolve(false);
    };

    socket.on('timeout', onFail);
    socket.on('error', onFail);

    try {
      socket.connect(5432, '127.0.0.1');
    } catch {
      onFail();
    }
  });
}

// ----------------------------------------------------------------------------
// Local Database Fallback Storage
// Ensures zero-downtime development when local PostgreSQL is not currently running
// ----------------------------------------------------------------------------
const LOCAL_DB_PATH = path.resolve(process.cwd(), '.local_db.json');

interface LocalDB {
  users: Array<{
    id: string;
    full_name: string;
    email: string;
    password_hash: string;
    phone: string | null;
    role: string;
    created_at: string;
    updated_at: string;
  }>;
  doctor_profiles: Array<{
    id: string;
    user_id: string;
    speciality: string;
    registration_number: string;
    clinic_name: string;
    clinic_address: string;
    consultation_fee: number;
    status: string;
    created_at: string;
    updated_at: string;
  }>;
  appointments: Array<{
    id: string;
    patient_id: string;
    doctor_profile_id: string;
    appointment_at: string;
    reason: string | null;
    status: string;
    created_at: string;
  }>;
  patients: Array<Record<string, any>>;
  profiles: Array<Record<string, any>>;
  profile_access: Array<Record<string, any>>;
  profile_change_logs: Array<Record<string, any>>;
}

function loadLocalDB(): LocalDB {
  if (fs.existsSync(LOCAL_DB_PATH)) {
    try {
      const data = fs.readFileSync(LOCAL_DB_PATH, 'utf-8');
      const db = JSON.parse(data) as LocalDB;
      db.appointments ||= [];
      db.patients ||= [];
      db.profiles ||= [];
      db.profile_access ||= [];
      db.profile_change_logs ||= [];
      return db;
    } catch {
      // Fall through to initial seed
    }
  }

  // Pre-seeded initial accounts matching prisma/seed.ts
  const defaultHash = bcrypt.hashSync('Password123!', 10);
  const adminHash = bcrypt.hashSync('AdminSecure2026!', 10);

  const initialDB: LocalDB = {
    users: [
      {
        id: '11111111-1111-4111-a111-111111111111',
        full_name: 'Platform Administrator',
        email: 'admin@mednexus.org',
        password_hash: adminHash,
        phone: '+1 (555) 999-0000',
        role: 'admin',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: '22222222-2222-4222-a222-222222222222',
        full_name: 'Dr. Ananya Sharma',
        email: 'doctor.approved@mednexus.org',
        password_hash: defaultHash,
        phone: '+1 (555) 234-5678',
        role: 'doctor',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: '33333333-3333-4333-a333-333333333333',
        full_name: 'Atharv Kavitake',
        email: 'patient@mednexus.org',
        password_hash: defaultHash,
        phone: '+1 (555) 019-2834',
        role: 'patient',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ],
    doctor_profiles: [
      {
        id: 'dp-approved-1',
        user_id: '22222222-2222-4222-a222-222222222222',
        speciality: 'Cardiology',
        registration_number: 'MCI-2020-88491',
        clinic_name: 'Apex Multi-Specialty Heart Center',
        clinic_address: 'Suite 400, Medical Boulevard',
        consultation_fee: 150,
        status: 'approved',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ],
    appointments: [],
    patients: [],
    profiles: [],
    profile_access: [],
    profile_change_logs: [],
  };

  try {
    fs.writeFileSync(LOCAL_DB_PATH, JSON.stringify(initialDB, null, 2), 'utf-8');
  } catch (err) {
    console.warn('[LocalDB] Could not persist initial local database file:', err);
  }

  return initialDB;
}

function saveLocalDB(db: LocalDB): void {
  try {
    fs.writeFileSync(LOCAL_DB_PATH, JSON.stringify(db, null, 2), 'utf-8');
  } catch (err) {
    console.error('[LocalDB] Error saving database file:', err);
  }
}

function isConnectionError(err: unknown): boolean {
  if (!err) return false;
  const msg = String((err as any)?.message || err);
  const code = String((err as any)?.code || '');
  return (
    code === 'P1001' ||
    msg.includes("Can't reach database server") ||
    msg.includes('connection refused') ||
    msg.includes('ECONNREFUSED') ||
    msg.includes('ETIMEDOUT')
  );
}

let warnedFallback = false;
function logFallbackNotice() {
  if (!warnedFallback) {
    warnedFallback = true;
    console.warn(
      '\n⚠️  [ArogyaNexus DB Notice]: PostgreSQL server at localhost:5432 was not detected.\n' +
        '👉 Automatically activated local persistent storage (.local_db.json).\n' +
        '✨ You can test Patient Registration, Doctor Registration, and Login without any interruptions!\n' +
        '💡 Once you start PostgreSQL (Start-Service postgresql*), it will automatically use real PostgreSQL.\n'
    );
  }
}

// ----------------------------------------------------------------------------
// Fallback Query Implementations
// ----------------------------------------------------------------------------
const fallbackUser = {
  async findUnique(args: { where: { email?: string; id?: string }; include?: { doctor_profile?: boolean }; select?: any }) {
    const db = loadLocalDB();
    const user = db.users.find((u) => {
      if (args.where.email) {
        return u.email.toLowerCase() === args.where.email.toLowerCase();
      }
      if (args.where.id) {
        return u.id === args.where.id;
      }
      return false;
    });

    if (!user) return null;

    if (args.include?.doctor_profile) {
      const doc = db.doctor_profiles.find((dp) => dp.user_id === user.id) || null;
      return { ...user, doctor_profile: doc };
    }

    if (args.select) {
      return Object.fromEntries(Object.entries(args.select).filter(([, selected]) => selected === true).map(([key]) => [key, (user as any)[key]]));
    }

    return { ...user };
  },

  async create(args: { data: any; select?: any }) {
    const db = loadLocalDB();
    const newUser = {
      id: crypto.randomUUID(),
      full_name: args.data.full_name,
      email: args.data.email.toLowerCase().trim(),
      password_hash: args.data.password_hash,
      phone: args.data.phone || null,
      role: args.data.role || 'patient',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    db.users.push(newUser);
    saveLocalDB(db);

    return { ...newUser };
  },

  async upsert(args: { where: any; update: any; create: any }) {
    const db = loadLocalDB();
    const index = db.users.findIndex((u) => u.email.toLowerCase() === args.where.email.toLowerCase());

    if (index >= 0) {
      const updated = {
        ...db.users[index],
        ...args.update,
        updated_at: new Date().toISOString(),
      };
      db.users[index] = updated;
      saveLocalDB(db);
      return updated;
    } else {
      const newUser = {
        id: crypto.randomUUID(),
        ...args.create,
        email: args.create.email.toLowerCase().trim(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      db.users.push(newUser);
      saveLocalDB(db);
      return newUser;
    }
  },
};

const fallbackPatient = {
  async findUnique(args: any) {
    const db = loadLocalDB();
    const patient = db.patients.find((item) => (args.where?.userId && item.userId === args.where.userId) || (args.where?.id && item.id === args.where.id));
    if (!patient) return null;
    if (args.include?.profiles) return { ...patient, profiles: db.profiles.filter((profile) => profile.patientId === patient.id && !profile.deletedAt) };
    return { ...patient };
  },
  async create(args: any) {
    const db = loadLocalDB();
    const patient = { id: crypto.randomUUID(), userId: args.data.userId, dateOfBirth: args.data.dateOfBirth || null, sex: args.data.sex || null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    db.patients.push(patient);
    saveLocalDB(db);
    return { ...patient };
  },
};

const fallbackProfile = {
  async findMany(args: any = {}) {
    const db = loadLocalDB();
    let profiles = db.profiles.filter((item) => (!args.where?.patientId || item.patientId === args.where.patientId) && (!args.where || args.where.deletedAt === undefined || (args.where.deletedAt === null ? !item.deletedAt : item.deletedAt === args.where.deletedAt)));
    if (args.orderBy?.createdAt === 'asc') profiles = profiles.sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
    return profiles.map((item) => ({ ...item, allergies: [...(item.allergies || [])], conditions: [...(item.conditions || [])] }));
  },
  async findFirst(args: any) {
    const db = loadLocalDB();
    const item = db.profiles.find((profile) => (!args.where?.id || profile.id === args.where.id)
      && (!args.where?.patientId || profile.patientId === args.where.patientId)
      && (!args.where?.relation || profile.relation === args.where.relation)
      && (!args.where || args.where.deletedAt === undefined || (args.where.deletedAt === null ? !profile.deletedAt : profile.deletedAt === args.where.deletedAt)));
    return item ? { ...item, allergies: [...(item.allergies || [])], conditions: [...(item.conditions || [])] } : null;
  },
  async create(args: any) {
    const db = loadLocalDB();
    const now = new Date().toISOString();
    const profile = { id: crypto.randomUUID(), dateOfBirth: null, sex: null, bloodGroup: null, phone: null, email: null, allergies: [], conditions: [], allergiesConfirmed: false, conditionsConfirmed: false, onboardingStep: 1, onboardedAt: null, deletedAt: null, createdAt: now, updatedAt: now, ...args.data };
    db.profiles.push(profile);
    saveLocalDB(db);
    return { ...profile };
  },
  async update(args: any) {
    const db = loadLocalDB();
    const profile = db.profiles.find((item) => item.id === args.where.id && !item.deletedAt);
    if (!profile) throw new Error('Patient profile not found.');
    Object.assign(profile, args.data, { updatedAt: new Date().toISOString() });
    saveLocalDB(db);
    return { ...profile };
  },
};

const fallbackProfileAccess = {
  async findFirst(args: any) {
    const item = loadLocalDB().profile_access.find((entry) => (!args.where?.profileId || entry.profileId === args.where.profileId) && (!args.where?.userId || entry.userId === args.where.userId) && (!args.where?.scope || entry.scope === args.where.scope));
    return item ? { ...item } : null;
  },
  async create(args: any) {
    const db = loadLocalDB();
    const access = { id: crypto.randomUUID(), scope: 'PROFILE', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), ...args.data };
    db.profile_access.push(access);
    saveLocalDB(db);
    return { ...access };
  },
  async update(args: any) {
    const db = loadLocalDB();
    const access = db.profile_access.find((entry) => entry.profileId === args.where.profileId_userId?.profileId && entry.userId === args.where.profileId_userId?.userId);
    if (!access) throw new Error('Profile access not found.');
    Object.assign(access, args.data, { updatedAt: new Date().toISOString() });
    saveLocalDB(db);
    return { ...access };
  },
};

const fallbackProfileChangeLog = {
  async create(args: any) {
    const db = loadLocalDB();
    const entry = { id: crypto.randomUUID(), oldValue: null, newValue: null, createdAt: new Date().toISOString(), ...args.data };
    db.profile_change_logs.push(entry);
    saveLocalDB(db);
    return { ...entry };
  },
};

const fallbackDoctorProfile = {
  async findMany(args: { where?: { status?: string }; orderBy?: any; include?: any; select?: any } = {}) {
    const db = loadLocalDB();
    const profiles = db.doctor_profiles
      .filter((profile) => !args.where?.status || profile.status === args.where.status)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    return profiles.map((profile) => {
      const doctor = args.select
        ? Object.fromEntries(Object.entries(args.select).filter(([, selected]) => selected === true).map(([key]) => [key, (profile as any)[key]]))
        : { ...profile };
      if (args.include?.user || args.select?.user) {
        const user = db.users.find((entry) => entry.id === profile.user_id);
        const userSelect = args.select?.user?.select;
        const safeUser = user ? (userSelect
          ? Object.fromEntries(Object.entries(userSelect).filter(([, selected]) => selected === true).map(([key]) => [key, (user as any)[key]]))
          : { id: user.id, full_name: user.full_name, email: user.email, phone: user.phone, created_at: user.created_at }) : null;
        return { ...doctor, user: safeUser };
      }
      return doctor;
    });
  },

  async update(args: { where: { id: string }; data: { status?: string } }) {
    const db = loadLocalDB();
    const profile = db.doctor_profiles.find((entry) => entry.id === args.where.id);
    if (!profile) throw new Error('Doctor application not found.');
    Object.assign(profile, args.data, { updated_at: new Date().toISOString() });
    saveLocalDB(db);
    return { ...profile };
  },

  async findUnique(args: { where: { id?: string; registration_number?: string; user_id?: string }; select?: any }) {
    const db = loadLocalDB();
    const doc = db.doctor_profiles.find((dp) => {
      if (args.where.registration_number) {
        return dp.registration_number.toUpperCase() === args.where.registration_number.toUpperCase();
      }
      if (args.where.user_id) {
        return dp.user_id === args.where.user_id;
      }
      if (args.where.id) {
        return dp.id === args.where.id;
      }
      return false;
    });

    if (!doc) return null;
    if (args.select) return Object.fromEntries(Object.entries(args.select).filter(([, selected]) => selected === true).map(([key]) => [key, (doc as any)[key]]));
    return { ...doc };
  },

  async create(args: { data: any }) {
    const db = loadLocalDB();
    const newDoc = {
      id: crypto.randomUUID(),
      user_id: args.data.user_id,
      speciality: args.data.speciality,
      registration_number: args.data.registration_number.toUpperCase().trim(),
      clinic_name: args.data.clinic_name,
      clinic_address: args.data.clinic_address,
      consultation_fee: Number(args.data.consultation_fee || 0),
      status: args.data.status || 'pending',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    db.doctor_profiles.push(newDoc);
    saveLocalDB(db);

    return { ...newDoc };
  },

  async upsert(args: { where: any; update: any; create: any }) {
    const db = loadLocalDB();
    const index = db.doctor_profiles.findIndex((dp) => dp.user_id === args.where.user_id);

    if (index >= 0) {
      const updated = {
        ...db.doctor_profiles[index],
        ...args.update,
        updated_at: new Date().toISOString(),
      };
      db.doctor_profiles[index] = updated;
      saveLocalDB(db);
      return updated;
    } else {
      const newDoc = {
        id: crypto.randomUUID(),
        ...args.create,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      db.doctor_profiles.push(newDoc);
      saveLocalDB(db);
      return newDoc;
    }
  },
};

const fallbackAppointment = {
  async create(args: { data: { patient_id: string; doctor_profile_id: string; appointment_at: Date | string; reason?: string | null } }) {
    const db = loadLocalDB();
    const appointment = {
      id: crypto.randomUUID(),
      patient_id: args.data.patient_id,
      doctor_profile_id: args.data.doctor_profile_id,
      appointment_at: new Date(args.data.appointment_at).toISOString(),
      reason: args.data.reason || null,
      status: 'pending',
      created_at: new Date().toISOString(),
    };
    db.appointments.push(appointment);
    saveLocalDB(db);
    return appointment;
  },
};

// ----------------------------------------------------------------------------
// Resilient Prisma Client Wrapper
// ----------------------------------------------------------------------------
function toLegacyUser(user: any) {
  if (!user) return user;
  const doctor = user.doctor ? {
    id: user.doctor.id,
    registration_number: user.doctor.registrationNumber,
    speciality: user.doctor.specialties?.map((item: any) => item.specialty?.name).filter(Boolean).join(', ') || '',
    clinic_name: user.doctor.clinics?.[0]?.name || '',
    clinic_address: user.doctor.clinics?.[0]?.address || '',
    consultation_fee: Number(user.doctor.consultationFee || 0),
    status: user.doctor.status,
  } : null;
  return {
    ...user,
    full_name: user.fullName ?? user.full_name,
    password_hash: user.passwordHash ?? user.password_hash,
    created_at: user.createdAt ?? user.created_at,
    updated_at: user.updatedAt ?? user.updated_at,
    doctor_profile: doctor ?? user.doctor_profile ?? null,
  };
}

export const prisma = {
  user: {
    async findUnique(args: any) {
      const running = await isPostgresRunning();
      if (!running) {
        logFallbackNotice();
        return await fallbackUser.findUnique(args);
      }
      try {
        const include = args.include?.doctor_profile
          ? { doctor: { include: { specialties: { include: { specialty: true } }, clinics: true } } }
          : undefined;
        return toLegacyUser(await rawPrisma.user.findUnique({ where: args.where, ...(include ? { include } : {}) }));
      } catch (err) {
        if (isConnectionError(err)) {
          postgresAvailable = false;
          logFallbackNotice();
          return await fallbackUser.findUnique(args);
        }
        throw err;
      }
    },

    async create(args: any) {
      const running = await isPostgresRunning();
      if (!running) {
        logFallbackNotice();
        return await fallbackUser.create(args);
      }
      try {
        return toLegacyUser(await rawPrisma.user.create({ data: {
          fullName: args.data.full_name,
          email: args.data.email,
          phone: args.data.phone,
          passwordHash: args.data.password_hash,
          role: args.data.role,
        } }));
      } catch (err) {
        if (isConnectionError(err)) {
          postgresAvailable = false;
          logFallbackNotice();
          return await fallbackUser.create(args);
        }
        throw err;
      }
    },

    async upsert(args: any) {
      const running = await isPostgresRunning();
      if (!running) {
        logFallbackNotice();
        return await fallbackUser.upsert(args);
      }
      try {
        return await rawPrisma.user.upsert(args);
      } catch (err) {
        if (isConnectionError(err)) {
          postgresAvailable = false;
          logFallbackNotice();
          return await fallbackUser.upsert(args);
        }
        throw err;
      }
    },
  },

  doctorProfile: {
    async findMany(args: any = {}) {
      const running = await isPostgresRunning();
      if (!running) {
        logFallbackNotice();
        return await fallbackDoctorProfile.findMany(args);
      }
      try {
        return await rawPrisma.doctorProfile.findMany(args);
      } catch (err) {
        if (isConnectionError(err)) {
          postgresAvailable = false;
          logFallbackNotice();
          return await fallbackDoctorProfile.findMany(args);
        }
        throw err;
      }
    },

    async update(args: any) {
      const running = await isPostgresRunning();
      if (!running) {
        logFallbackNotice();
        return await fallbackDoctorProfile.update(args);
      }
      try {
        return await rawPrisma.doctorProfile.update(args);
      } catch (err) {
        if (isConnectionError(err)) {
          postgresAvailable = false;
          logFallbackNotice();
          return await fallbackDoctorProfile.update(args);
        }
        throw err;
      }
    },

    async findUnique(args: any) {
      const running = await isPostgresRunning();
      if (!running) {
        logFallbackNotice();
        return await fallbackDoctorProfile.findUnique(args);
      }
      try {
        return await rawPrisma.doctorProfile.findUnique(args);
      } catch (err) {
        if (isConnectionError(err)) {
          postgresAvailable = false;
          logFallbackNotice();
          return await fallbackDoctorProfile.findUnique(args);
        }
        throw err;
      }
    },

    async create(args: any) {
      const running = await isPostgresRunning();
      if (!running) {
        logFallbackNotice();
        return await fallbackDoctorProfile.create(args);
      }
      try {
        return await rawPrisma.doctorProfile.create(args);
      } catch (err) {
        if (isConnectionError(err)) {
          postgresAvailable = false;
          logFallbackNotice();
          return await fallbackDoctorProfile.create(args);
        }
        throw err;
      }
    },

    async upsert(args: any) {
      const running = await isPostgresRunning();
      if (!running) {
        logFallbackNotice();
        return await fallbackDoctorProfile.upsert(args);
      }
      try {
        return await rawPrisma.doctorProfile.upsert(args);
      } catch (err) {
        if (isConnectionError(err)) {
          postgresAvailable = false;
          logFallbackNotice();
          return await fallbackDoctorProfile.upsert(args);
        }
        throw err;
      }
    },
  },

  appointment: {
    async findMany(args: any) { return await (rawPrisma as any).appointment.findMany(args); },
    async findFirst(args: any) { return await (rawPrisma as any).appointment.findFirst(args); },
    async update(args: any) { return await (rawPrisma as any).appointment.update(args); },
    async create(args: any) {
      const running = await isPostgresRunning();
      if (!running) {
        logFallbackNotice();
        return await fallbackAppointment.create(args);
      }
      try {
        return await (rawPrisma as any).appointment.create(args);
      } catch (err) {
        if (isConnectionError(err)) {
          postgresAvailable = false;
          logFallbackNotice();
          return await fallbackAppointment.create(args);
        }
        throw err;
      }
    },
  },

  profile: {
    async findMany(args: any = {}) { const running = await isPostgresRunning(); if (!running) { logFallbackNotice(); return fallbackProfile.findMany(args); } try { return await (rawPrisma as any).profile.findMany(args); } catch (err) { if (isConnectionError(err)) { postgresAvailable = false; logFallbackNotice(); return fallbackProfile.findMany(args); } throw err; } },
    async findFirst(args: any) { const running = await isPostgresRunning(); if (!running) { logFallbackNotice(); return fallbackProfile.findFirst(args); } try { return await (rawPrisma as any).profile.findFirst(args); } catch (err) { if (isConnectionError(err)) { postgresAvailable = false; logFallbackNotice(); return fallbackProfile.findFirst(args); } throw err; } },
    async create(args: any) { const running = await isPostgresRunning(); if (!running) { logFallbackNotice(); return fallbackProfile.create(args); } try { return await (rawPrisma as any).profile.create(args); } catch (err) { if (isConnectionError(err)) { postgresAvailable = false; logFallbackNotice(); return fallbackProfile.create(args); } throw err; } },
    async update(args: any) { const running = await isPostgresRunning(); if (!running) { logFallbackNotice(); return fallbackProfile.update(args); } try { return await (rawPrisma as any).profile.update(args); } catch (err) { if (isConnectionError(err)) { postgresAvailable = false; logFallbackNotice(); return fallbackProfile.update(args); } throw err; } },
  },
  profileAccess: {
    async findFirst(args: any) { const running = await isPostgresRunning(); if (!running) { logFallbackNotice(); return fallbackProfileAccess.findFirst(args); } try { return await (rawPrisma as any).profileAccess.findFirst(args); } catch (err) { if (isConnectionError(err)) { postgresAvailable = false; logFallbackNotice(); return fallbackProfileAccess.findFirst(args); } throw err; } },
    async create(args: any) { const running = await isPostgresRunning(); if (!running) { logFallbackNotice(); return fallbackProfileAccess.create(args); } try { return await (rawPrisma as any).profileAccess.create(args); } catch (err) { if (isConnectionError(err)) { postgresAvailable = false; logFallbackNotice(); return fallbackProfileAccess.create(args); } throw err; } },
    async update(args: any) { const running = await isPostgresRunning(); if (!running) { logFallbackNotice(); return fallbackProfileAccess.update(args); } try { return await (rawPrisma as any).profileAccess.update(args); } catch (err) { if (isConnectionError(err)) { postgresAvailable = false; logFallbackNotice(); return fallbackProfileAccess.update(args); } throw err; } },
  },
  patient: {
    async findUnique(args: any) { const running = await isPostgresRunning(); if (!running) { logFallbackNotice(); return fallbackPatient.findUnique(args); } try { return await (rawPrisma as any).patient.findUnique(args); } catch (err) { if (isConnectionError(err)) { postgresAvailable = false; logFallbackNotice(); return fallbackPatient.findUnique(args); } throw err; } },
    async create(args: any) { const running = await isPostgresRunning(); if (!running) { logFallbackNotice(); return fallbackPatient.create(args); } try { return await (rawPrisma as any).patient.create(args); } catch (err) { if (isConnectionError(err)) { postgresAvailable = false; logFallbackNotice(); return fallbackPatient.create(args); } throw err; } },
  },
  profileChangeLog: {
    async create(args: any) { const running = await isPostgresRunning(); if (!running) { logFallbackNotice(); return fallbackProfileChangeLog.create(args); } try { return await (rawPrisma as any).profileChangeLog.create(args); } catch (err) { if (isConnectionError(err)) { postgresAvailable = false; logFallbackNotice(); return fallbackProfileChangeLog.create(args); } throw err; } },
  },
  visitRecord: {
    async findMany(args: any) { return await (rawPrisma as any).visitRecord.findMany(args); },
  },
  healthRecord: {
    async findMany(args: any) { return await (rawPrisma as any).healthRecord.findMany(args); },
    async findFirst(args: any) { return await (rawPrisma as any).healthRecord.findFirst(args); },
    async create(args: any) { return await (rawPrisma as any).healthRecord.create(args); },
    async update(args: any) { return await (rawPrisma as any).healthRecord.update(args); },
    async count(args: any) { return await (rawPrisma as any).healthRecord.count(args); },
  },
  vitalReading: {
    async findMany(args: any) { return await (rawPrisma as any).vitalReading.findMany(args); },
    async create(args: any) { return await (rawPrisma as any).vitalReading.create(args); },
  },
  patientCondition: {
    async findMany(args: any) { return await (rawPrisma as any).patientCondition.findMany(args); },
    async create(args: any) { return await (rawPrisma as any).patientCondition.create(args); },
    async update(args: any) { return await (rawPrisma as any).patientCondition.update(args); },
    async deleteMany(args: any) { return await (rawPrisma as any).patientCondition.deleteMany(args); },
  },
  accessLog: {
    async findMany(args: any) { return await (rawPrisma as any).accessLog.findMany(args); },
  },

  async $transaction(callbackOrPromises: any) {
    const running = await isPostgresRunning();
    if (!running) {
      logFallbackNotice();
      if (typeof callbackOrPromises === 'function') {
        return await callbackOrPromises({
          user: fallbackUser,
          doctorProfile: fallbackDoctorProfile,
          patient: fallbackPatient,
          profile: fallbackProfile,
          profileAccess: fallbackProfileAccess,
            profileChangeLog: fallbackProfileChangeLog,
        });
      }
      if (Array.isArray(callbackOrPromises)) {
        return await Promise.all(callbackOrPromises);
      }
      return null;
    }

    try {
      return await rawPrisma.$transaction(callbackOrPromises);
    } catch (err) {
      if (isConnectionError(err)) {
        postgresAvailable = false;
        logFallbackNotice();
        if (typeof callbackOrPromises === 'function') {
          return await callbackOrPromises({
            user: fallbackUser,
            doctorProfile: fallbackDoctorProfile,
            patient: fallbackPatient,
            profile: fallbackProfile,
            profileAccess: fallbackProfileAccess,
            profileChangeLog: fallbackProfileChangeLog,
          });
        }
        throw err;
      }
      throw err;
    }
  },

  async $disconnect() {
    try {
      await rawPrisma.$disconnect();
    } catch {
      // Ignore disconnect error in fallback mode
    }
  },
} as unknown as PrismaClient;

export default prisma;
