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
    let settled = false;
    const finish = (result: boolean) => {
      if (settled) return;
      settled = true;
      postgresAvailable = result;
      lastCheckTime = Date.now();
      try {
        socket.destroy();
      } catch {}
      resolve(result);
    };

    const socket = new net.Socket();
    socket.setTimeout(150);

    socket.once('connect', () => finish(true));
    socket.once('timeout', () => finish(false));
    socket.once('error', () => finish(false));

    try {
      socket.connect(5432, '127.0.0.1');
    } catch {
      finish(false);
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
    verified?: boolean;
    photo_url?: string | null;
    clinic_lat?: number | null;
    clinic_lng?: number | null;
    experience_years?: number | null;
    languages?: string[];
    bio?: string | null;
    offers_video?: boolean;
    rating_avg?: number;
    rating_count?: number;
    created_at: string;
    updated_at: string;
  }>;
  appointments: Array<{
    id: string;
    patient_id: string;
    profile_id?: string | null;
    doctor_profile_id: string;
    appointment_at: string;
    reason: string | null;
    status: string;
    created_at: string;
  }>;
  profiles: Array<{
    id: string;
    user_id: string;
    name: string;
    relation: string;
    seed_key?: string | null;
    allergies?: string[];
    notes?: string | null;
    dob?: string | null;
    gender?: string | null;
    blood_group?: string | null;
    emergency_name?: string | null;
    emergency_phone?: string | null;
    emergency_relation?: string | null;
  }>;
  vital_readings?: Array<{
    id: string;
    patient_id: string;
    type: string;
    value: number;
    unit: string;
    measured_at: string;
    source: string;
    created_at: string;
  }>;
  patient_conditions?: Array<{
    id: string;
    patient_id: string;
    name: string;
    status: string;
    since: string | null;
    notes?: string | null;
    created_at: string;
  }>;
  health_records?: Array<{
    id: string;
    patient_id: string;
    category: string;
    title: string;
    issuer: string;
    record_date: string;
    doctor_id: string | null;
    uploaded_by: string;
    source: string;
    file_key: string;
    file_name: string;
    mime_type: string;
    size_bytes: number;
    verification_status?: string;
    verification_method?: string | null;
    ai_confidence?: number | null;
    ai_extracted_fields?: any;
    ai_verified_at?: string | null;
    review_requested_at?: string | null;
    assigned_doctor_id?: string | null;
    reviewed_by_doctor_id?: string | null;
    doctor_reviewed_at?: string | null;
    rejection_reason?: string | null;
    doctor_review_notes?: string | null;
    deleted_at: string | null;
    created_at: string;
  }>;
  access_logs?: Array<{
    id: string;
    patient_id: string;
    doctor_id: string;
    action: string;
    record_title?: string | null;
    created_at: string;
  }>;
}

function loadLocalDB(): LocalDB {
  if (fs.existsSync(LOCAL_DB_PATH)) {
    try {
      const data = fs.readFileSync(LOCAL_DB_PATH, 'utf-8');
      const db = JSON.parse(data) as LocalDB;
      db.appointments ||= [];
      db.profiles ||= [];
      db.vital_readings ||= [];
      db.patient_conditions ||= [];
      db.health_records ||= [];
      db.access_logs ||= [];
      return db;
    } catch {
      // Fall through to initial seed
    }
  }

  // Pre-seeded initial accounts matching prisma/seed.ts
  const defaultHash = bcrypt.hashSync('Pass@123', 12);
  const adminHash = defaultHash;

  const initialDB: LocalDB = {
    users: [
      {
        id: '11111111-1111-4111-a111-111111111111',
        full_name: 'Platform Administrator',
        email: 'a@gmail.com',
        password_hash: adminHash,
        phone: '+1 (555) 999-0000',
        role: 'admin',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: '22222222-2222-4222-a222-222222222222',
        full_name: 'Dr. Ananya Sharma',
        email: 'd@gmail.com',
        password_hash: defaultHash,
        phone: '+1 (555) 234-5678',
        role: 'doctor',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: '33333333-3333-4333-a333-333333333333',
        full_name: 'Atharv Kavitake',
        email: 'u@gmail.com',
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
    profiles: [
      {
        id: 'profile-self-1',
        user_id: '33333333-3333-4333-a333-333333333333',
        name: 'Atharv Kavitake',
        relation: 'SELF',
        seed_key: 'seed:profile-SELF',
        allergies: ['Penicillin', 'Pollen'],
        dob: '1998-05-15T00:00:00.000Z',
        gender: 'Male',
        blood_group: 'O+',
        emergency_name: 'Sunita Kavitake',
        emergency_phone: '+1 (555) 234-5678',
        emergency_relation: 'MOTHER',
      },
      {
        id: 'profile-mother-1',
        user_id: '33333333-3333-4333-a333-333333333333',
        name: 'Sunita Kavitake',
        relation: 'MOTHER',
        seed_key: 'seed:profile-MOTHER',
        allergies: [],
        dob: '1972-08-20T00:00:00.000Z',
        gender: 'Female',
        blood_group: 'B+',
        emergency_name: 'Atharv Kavitake',
        emergency_phone: '+1 (555) 019-2834',
        emergency_relation: 'SON',
      },
      {
        id: 'profile-son-1',
        user_id: '33333333-3333-4333-a333-333333333333',
        name: 'Aarav Kavitake',
        relation: 'SON',
        seed_key: 'seed:profile-SON',
        allergies: [],
        dob: '2020-03-10T00:00:00.000Z',
        gender: 'Male',
        blood_group: 'O+',
        emergency_name: 'Atharv Kavitake',
        emergency_phone: '+1 (555) 019-2834',
        emergency_relation: 'FATHER',
      },
    ],
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

function isSchemaCompatibilityError(err: unknown): boolean {
  if (!err) return false;
  const code = String((err as any)?.code || '');
  const message = String((err as any)?.message || err);
  return code === 'P2032' || code === 'P2009' || message.includes('incompatible value');
}

let warnedFallback = false;
function logFallbackNotice() {
  if (!warnedFallback) {
    warnedFallback = true;
    console.warn(
      '\n[ArogyaNexus DB Notice]: PostgreSQL is unavailable or incompatible with the current Prisma schema.\n' +
        'Using local persistent storage (.local_db.json).\n' +
        'PostgreSQL will be retried automatically after a short delay.\n'
    );
  }
}

// ----------------------------------------------------------------------------
// Fallback Query Implementations
// ----------------------------------------------------------------------------
const fallbackUser = {
  async findMany(_args: any = {}) {
    const db = loadLocalDB();
    return db.users.map((u) => ({ ...u }));
  },
  async findFirst(args: any = {}) {
    const db = loadLocalDB();
    const user = db.users.find((u) => {
      if (args?.where) {
        if (args.where.email && u.email?.toLowerCase() !== args.where.email.toLowerCase()) return false;
        if (args.where.id && u.id !== args.where.id) return false;
        if (args.where.role && u.role !== args.where.role) return false;
      }
      return true;
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
      id: args.data.id || crypto.randomUUID(),
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

    if (args.select) {
      return Object.fromEntries(
        Object.entries(args.select)
          .filter(([, selected]) => selected === true)
          .map(([key]) => [key, (newUser as any)[key]])
      );
    }

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
        id: args.create.id || crypto.randomUUID(),
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

  async update(args: { where: { id?: string; email?: string }; data: any }) {
    const db = loadLocalDB();
    const index = db.users.findIndex((u) => {
      if (args.where.id && u.id === args.where.id) return true;
      if (args.where.email && u.email?.toLowerCase() === args.where.email.toLowerCase()) return true;
      return false;
    });
    if (index < 0) return null;
    const updated = {
      ...db.users[index],
      ...args.data,
      updated_at: new Date().toISOString(),
    };
    db.users[index] = updated;
    saveLocalDB(db);
    return updated;
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

  async update(args: { where: { id?: string; user_id?: string }; data: any }) {
    const db = loadLocalDB();
    const profile = db.doctor_profiles.find((entry) => {
      if (args.where.id && entry.id === args.where.id) return true;
      if (args.where.user_id && entry.user_id === args.where.user_id) return true;
      return false;
    });
    if (!profile) throw new Error('Doctor profile not found.');
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
      id: args.data.id || crypto.randomUUID(),
      user_id: args.data.user_id,
      speciality: args.data.speciality,
      registration_number: args.data.registration_number.toUpperCase().trim(),
      clinic_name: args.data.clinic_name,
      clinic_address: args.data.clinic_address,
      consultation_fee: Number(args.data.consultation_fee || 0),
      status: args.data.status || 'pending',
      verified: args.data.verified ?? false,
      photo_url: args.data.photo_url || null,
      clinic_lat: args.data.clinic_lat ?? null,
      clinic_lng: args.data.clinic_lng ?? null,
      experience_years: args.data.experience_years ?? null,
      languages: args.data.languages || [],
      bio: args.data.bio || null,
      offers_video: args.data.offers_video ?? true,
      rating_avg: args.data.rating_avg ?? 0,
      rating_count: args.data.rating_count ?? 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      ...args.data,
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
        id: args.create.id || crypto.randomUUID(),
        user_id: args.create.user_id,
        speciality: args.create.speciality,
        registration_number: args.create.registration_number.toUpperCase().trim(),
        clinic_name: args.create.clinic_name,
        clinic_address: args.create.clinic_address,
        consultation_fee: Number(args.create.consultation_fee || 0),
        status: args.create.status || 'pending',
        verified: args.create.verified ?? false,
        photo_url: args.create.photo_url || null,
        clinic_lat: args.create.clinic_lat ?? null,
        clinic_lng: args.create.clinic_lng ?? null,
        experience_years: args.create.experience_years ?? null,
        languages: args.create.languages || [],
        bio: args.create.bio || null,
        offers_video: args.create.offers_video ?? true,
        rating_avg: args.create.rating_avg ?? 0,
        rating_count: args.create.rating_count ?? 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        ...args.create,
      };
      db.doctor_profiles.push(newDoc);
      saveLocalDB(db);
      return newDoc;
    }
  },
};

const fallbackAppointment = {
  async findMany(args: any = {}) {
    const db = loadLocalDB();
    let res = [...(db.appointments || [])];
    if (args?.where) {
      if (args.where.OR && Array.isArray(args.where.OR)) {
        res = res.filter((a: any) => {
          return args.where.OR.some((cond: any) => {
            let match = true;
            if (cond.profile_id !== undefined) {
              if (cond.profile_id === null) {
                if (a.profile_id) match = false;
              } else if (cond.profile_id === 'me' || cond.profile_id === 'profile-self-1') {
                const isSelfApt = !a.profile_id || a.profile_id === 'me' || a.profile_id === 'profile-self-1' || String(a.profile_id).startsWith('profile-self-');
                if (!isSelfApt) match = false;
              } else if (a.profile_id !== cond.profile_id) {
                match = false;
              }
            }
            if (cond.patient_id !== undefined && a.patient_id !== cond.patient_id) match = false;
            if (cond.status) {
              if (cond.status.in) {
                const list = cond.status.in.map((s: string) => s.toLowerCase());
                if (!list.includes(String(a.status || '').toLowerCase())) match = false;
              } else if (String(a.status || '').toLowerCase() !== String(cond.status).toLowerCase()) {
                match = false;
              }
            }
            if (cond.appointment_at?.lt) {
              if (!(new Date(a.appointment_at) < new Date(cond.appointment_at.lt))) match = false;
            }
            return match;
          });
        });
      }

      if (args.where.id) {
        res = res.filter((a: any) => a.id === args.where.id);
      }
      if (args.where.doctor_profile_id) {
        res = res.filter((a: any) => a.doctor_profile_id === args.where.doctor_profile_id);
      }
      if (args.where.profile_id === null) {
        res = res.filter((a: any) => !a.profile_id);
      } else if (args.where.profile_id) {
        res = res.filter((a: any) => a.profile_id === args.where.profile_id || (!a.profile_id && a.patient_id));
      }
      if (args.where.patient_id) {
        res = res.filter((a: any) => a.patient_id === args.where.patient_id);
      }

      if (args.where.status) {
        if (args.where.status.in) {
          const list = args.where.status.in.map((s: string) => s.toLowerCase());
          res = res.filter((a: any) => list.includes(String(a.status || '').toLowerCase()));
        } else if (args.where.status.notIn) {
          const list = args.where.status.notIn.map((s: string) => s.toLowerCase());
          res = res.filter((a: any) => !list.includes(String(a.status || '').toLowerCase()));
        } else {
          res = res.filter((a: any) => String(a.status || '').toLowerCase() === String(args.where.status).toLowerCase());
        }
      }

      if (args.where.appointment_at) {
        if (args.where.appointment_at.gte) {
          const gte = new Date(args.where.appointment_at.gte).getTime();
          res = res.filter((a: any) => new Date(a.appointment_at).getTime() >= gte);
        }
        if (args.where.appointment_at.lt) {
          const lt = new Date(args.where.appointment_at.lt).getTime();
          res = res.filter((a: any) => new Date(a.appointment_at).getTime() < lt);
        }
      }
    }

    // Populate relations if requested
    if (args?.include?.doctor) {
      res = res.map((item: any) => {
        const docProfile = (db.doctor_profiles || []).find((dp: any) => dp.id === item.doctor_profile_id);
        const docUser = docProfile ? (db.users || []).find((u: any) => u.id === docProfile.user_id) : null;
        const doctor = docProfile
          ? {
              ...docProfile,
              user: docUser ? { full_name: docUser.full_name, email: docUser.email } : { full_name: 'Doctor' },
            }
          : {
              id: item.doctor_profile_id,
              speciality: 'General Medicine',
              clinic_name: 'Healthcare Clinic',
              clinic_address: 'Maharashtra, India',
              user: { full_name: 'Doctor' },
            };
        return { ...item, doctor, visit_record: item.visit_record || null };
      });
    }

    if (args?.orderBy?.appointment_at === 'desc') {
      res.sort((a: any, b: any) => new Date(b.appointment_at).getTime() - new Date(a.appointment_at).getTime());
    } else if (args?.orderBy?.appointment_at === 'asc') {
      res.sort((a: any, b: any) => new Date(a.appointment_at).getTime() - new Date(b.appointment_at).getTime());
    }

    if (args?.take && typeof args.take === 'number') {
      res = res.slice(0, args.take);
    }

    return res;
  },
  async findFirst(args: any = {}) {
    const list = await fallbackAppointment.findMany(args);
    return list[0] || null;
  },
  async findUnique(args: any = {}) {
    return fallbackAppointment.findFirst(args);
  },
  async count(args: any = {}) {
    const list = await fallbackAppointment.findMany(args);
    return list.length;
  },
  async update(args: any) {
    const db = loadLocalDB();
    const idx = (db.appointments || []).findIndex((a: any) => a.id === args.where.id);
    if (idx >= 0) {
      db.appointments[idx] = { ...db.appointments[idx], ...args.data };
      saveLocalDB(db);
      return db.appointments[idx];
    }
    return null;
  },
  async create(args: { data: any }) {
    const db = loadLocalDB();
    const appointment = {
      id: args.data.id || crypto.randomUUID(),
      patient_id: args.data.patient_id,
      profile_id: args.data.profile_id || null,
      doctor_profile_id: args.data.doctor_profile_id,
      appointment_at: new Date(args.data.appointment_at).toISOString(),
      ends_at: args.data.ends_at ? new Date(args.data.ends_at).toISOString() : new Date(new Date(args.data.appointment_at).getTime() + 30 * 60000).toISOString(),
      reason: args.data.reason || null,
      status: args.data.status || 'pending',
      mode: args.data.mode || 'IN_PERSON',
      token_number: args.data.token_number || null,
      check_in_vitals: args.data.check_in_vitals || null,
      checked_in_at: args.data.checked_in_at || null,
      notes: args.data.notes || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    db.appointments = db.appointments || [];
    db.appointments.push(appointment);
    saveLocalDB(db);
    return appointment;
  },
};

const fallbackProfile = {
  async findMany(args: any = {}) {
    const db = loadLocalDB();
    let res = [...(db.profiles || [])];
    if (args?.where) {
      if (args.where.user_id) res = res.filter((p: any) => p.user_id === args.where.user_id);
      if (args.where.relation) res = res.filter((p: any) => p.relation === args.where.relation);
    }
    return res;
  },
  async findFirst(args: any = {}) {
    const list = await fallbackProfile.findMany(args);
    return list[0] || null;
  },
  async findUnique(args: { where: { id?: string; seed_key?: string } }) {
    const db = loadLocalDB();
    const profile = (db.profiles || []).find((p: any) => {
      if (args.where.id && (p.id === args.where.id || (args.where.id === 'me' && p.relation === 'SELF'))) return true;
      if (args.where.seed_key && p.seed_key === args.where.seed_key) return true;
      return false;
    });
    return profile ? { ...profile } : null;
  },
  async create(args: any) {
    const db = loadLocalDB();
    db.profiles ||= [];
    const newProfile = {
      id: args.data.id || crypto.randomUUID(),
      ...args.data,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    db.profiles.push(newProfile);
    saveLocalDB(db);
    return newProfile;
  },
  async update(args: any) {
    const db = loadLocalDB();
    db.profiles ||= [];
    const index = db.profiles.findIndex((p: any) =>
      p.id === args.where?.id || (args.where?.id === 'me' && p.relation === 'SELF')
    );
    if (index >= 0) {
      db.profiles[index] = {
        ...db.profiles[index],
        ...args.data,
        updated_at: new Date().toISOString(),
      };
      saveLocalDB(db);
      return db.profiles[index];
    }
    return args.data;
  },
};

const fallbackVitalReading = {
  async findMany(args: any = {}) {
    const db = loadLocalDB();
    let res = [...(db.vital_readings || [])];
    if (args?.where) {
      if (args.where.patient_id) {
        const pid = args.where.patient_id;
        res = res.filter((v: any) =>
          v.patient_id === pid ||
          (pid === 'profile-self-1' && (v.patient_id === 'me' || v.patient_id === '33333333-3333-4333-a333-333333333333')) ||
          (pid === 'me' && (v.patient_id === 'profile-self-1' || v.patient_id === '33333333-3333-4333-a333-333333333333')) ||
          (pid === '33333333-3333-4333-a333-333333333333' && (v.patient_id === 'me' || v.patient_id === 'profile-self-1'))
        );
      }
      if (args.where.type) res = res.filter((v: any) => v.type === args.where.type);
      if (args.where.measured_at?.gte) {
        const gteTime = new Date(args.where.measured_at.gte).getTime();
        res = res.filter((v: any) => new Date(v.measured_at).getTime() >= gteTime);
      }
    }
    if (args?.orderBy?.measured_at === 'desc') {
      res.sort((a: any, b: any) => new Date(b.measured_at).getTime() - new Date(a.measured_at).getTime());
    } else {
      res.sort((a: any, b: any) => new Date(a.measured_at).getTime() - new Date(b.measured_at).getTime());
    }
    return res;
  },
  async create(args: any) {
    const db = loadLocalDB();
    db.vital_readings ||= [];
    const newVital = {
      id: crypto.randomUUID(),
      patient_id: args.data.patient_id,
      type: args.data.type,
      value: args.data.value,
      unit: args.data.unit,
      measured_at: args.data.measured_at ? new Date(args.data.measured_at).toISOString() : new Date().toISOString(),
      source: args.data.source || 'SELF',
      created_at: new Date().toISOString(),
    };
    db.vital_readings.push(newVital);
    saveLocalDB(db);
    return newVital;
  },
  async delete(args: any) {
    const db = loadLocalDB();
    db.vital_readings ||= [];
    const index = db.vital_readings.findIndex((v: any) => v.id === args.where?.id);
    if (index >= 0) {
      const removed = db.vital_readings.splice(index, 1)[0];
      saveLocalDB(db);
      return removed;
    }
    return { id: args.where?.id };
  },
};

const fallbackPatientCondition = {
  async findMany(args: any = {}) {
    const db = loadLocalDB();
    let res = [...(db.patient_conditions || [])];
    if (args?.where?.patient_id) {
      const pid = args.where.patient_id;
      res = res.filter((c: any) =>
        c.patient_id === pid ||
        (pid === 'profile-self-1' && (c.patient_id === 'me' || c.patient_id === '33333333-3333-4333-a333-333333333333')) ||
        (pid === 'me' && (c.patient_id === 'profile-self-1' || c.patient_id === '33333333-3333-4333-a333-333333333333')) ||
        (pid === '33333333-3333-4333-a333-333333333333' && (c.patient_id === 'me' || c.patient_id === 'profile-self-1'))
      );
    }
    return res;
  },
  async create(args: any) {
    const db = loadLocalDB();
    db.patient_conditions ||= [];
    const newCondition = {
      id: crypto.randomUUID(),
      patient_id: args.data.patient_id,
      name: args.data.name,
      status: args.data.status || 'ACTIVE',
      since: args.data.since ? new Date(args.data.since).toISOString() : null,
      notes: args.data.notes || null,
      created_at: new Date().toISOString(),
    };
    db.patient_conditions.push(newCondition);
    saveLocalDB(db);
    return newCondition;
  },
  async deleteMany(args: any = {}) {
    const db = loadLocalDB();
    db.patient_conditions ||= [];
    if (args?.where?.patient_id) {
      const pid = args.where.patient_id;
      db.patient_conditions = db.patient_conditions.filter((c: any) =>
        c.patient_id !== pid &&
        !(pid === 'profile-self-1' && (c.patient_id === 'me' || c.patient_id === '33333333-3333-4333-a333-333333333333')) &&
        !(pid === 'me' && (c.patient_id === 'profile-self-1' || c.patient_id === '33333333-3333-4333-a333-333333333333'))
      );
      saveLocalDB(db);
    }
    return { count: 1 };
  },
  async update(args: any) {
    const db = loadLocalDB();
    db.patient_conditions ||= [];
    const index = db.patient_conditions.findIndex((c: any) => c.id === args.where?.id);
    if (index >= 0) {
      db.patient_conditions[index] = { ...db.patient_conditions[index], ...args.data };
      saveLocalDB(db);
      return db.patient_conditions[index];
    }
    return args.data;
  },
};

const fallbackHealthRecord = {
  async findMany(args: any = {}) {
    const db = loadLocalDB();
    let list = [...(db.health_records || [])];
    if (args?.where) {
      if (args.where.id) {
        list = list.filter((r: any) => r.id === args.where.id);
      }
      if (args.where.patient_id) {
        const pid = args.where.patient_id;
        list = list.filter((r: any) =>
          r.patient_id === pid ||
          (pid === 'profile-self-1' && (r.patient_id === 'me' || r.patient_id === '33333333-3333-4333-a333-333333333333')) ||
          (pid === 'me' && (r.patient_id === 'profile-self-1' || r.patient_id === '33333333-3333-4333-a333-333333333333')) ||
          (pid === '33333333-3333-4333-a333-333333333333' && (r.patient_id === 'me' || r.patient_id === 'profile-self-1'))
        );
      }
      if (args.where.deleted_at === null) list = list.filter((r: any) => !r.deleted_at);
      if (args.where.category) list = list.filter((r: any) => r.category === args.where.category);
      if (args.where.verification_status) list = list.filter((r: any) => r.verification_status === args.where.verification_status);
      if (args.where.assigned_doctor_id) list = list.filter((r: any) => r.assigned_doctor_id === args.where.assigned_doctor_id);
      if (args.where.record_date?.gte) {
        const gteTime = new Date(args.where.record_date.gte).getTime();
        list = list.filter((r: any) => new Date(r.record_date).getTime() >= gteTime);
      }
      if (args.where.record_date?.lte) {
        const lteTime = new Date(args.where.record_date.lte).getTime();
        list = list.filter((r: any) => new Date(r.record_date).getTime() <= lteTime);
      }
      if (args.where.OR && Array.isArray(args.where.OR)) {
        const q = (args.where.OR[0]?.title?.contains || '').toLowerCase();
        if (q) {
          list = list.filter((r: any) => (r.title || '').toLowerCase().includes(q) || (r.issuer || '').toLowerCase().includes(q));
        }
      }
    }
    list.sort((a: any, b: any) => new Date(b.record_date || b.created_at).getTime() - new Date(a.record_date || a.created_at).getTime());

    list = list.map((r: any) => {
      let doctor = null;
      let assigned_doctor = null;
      let reviewed_by_doctor = null;

      if (args?.include?.doctor && r.doctor_id) {
        const doc = (db.doctor_profiles || []).find((d: any) => d.id === r.doctor_id);
        if (doc) {
          const user = (db.users || []).find((u: any) => u.id === doc.user_id);
          doctor = { ...doc, user: { full_name: user?.full_name || 'Dr. Doctor' } };
        }
      }

      if (args?.include?.assigned_doctor && r.assigned_doctor_id) {
        const doc = (db.doctor_profiles || []).find((d: any) => d.id === r.assigned_doctor_id);
        if (doc) {
          const user = (db.users || []).find((u: any) => u.id === doc.user_id);
          assigned_doctor = { ...doc, user: { full_name: user?.full_name || 'Dr. Doctor' } };
        }
      }

      if (args?.include?.reviewed_by_doctor && r.reviewed_by_doctor_id) {
        const doc = (db.doctor_profiles || []).find((d: any) => d.id === r.reviewed_by_doctor_id);
        if (doc) {
          const user = (db.users || []).find((u: any) => u.id === doc.user_id);
          reviewed_by_doctor = { ...doc, user: { full_name: user?.full_name || 'Dr. Doctor' } };
        }
      }

      return {
        ...r,
        verification_status: r.verification_status || 'AI_VERIFIED',
        verification_method: r.verification_method || (r.verification_status === 'DOCTOR_VERIFIED' ? 'DOCTOR' : 'AI'),
        ai_confidence: r.ai_confidence !== undefined ? r.ai_confidence : 0.95,
        doctor,
        assigned_doctor,
        reviewed_by_doctor,
      };
    });

    const skip = args?.skip || 0;
    const take = args?.take !== undefined ? args.take : list.length;
    return list.slice(skip, skip + take);
  },
  async findFirst(args: any = {}) {
    const list = await fallbackHealthRecord.findMany({ ...args, skip: 0, take: 1 });
    return list[0] || null;
  },
  async count(args: any = {}) {
    const list = await fallbackHealthRecord.findMany({ where: args.where });
    return list.length;
  },
  async create(args: any) {
    const db = loadLocalDB();
    db.health_records ||= [];
    const newRecord = {
      id: crypto.randomUUID(),
      patient_id: args.data.patient_id,
      category: args.data.category,
      title: args.data.title,
      issuer: args.data.issuer,
      record_date: args.data.record_date ? new Date(args.data.record_date).toISOString() : new Date().toISOString(),
      doctor_id: args.data.doctor_id || null,
      uploaded_by: args.data.uploaded_by,
      source: args.data.source || 'PATIENT_UPLOAD',
      file_key: args.data.file_key,
      file_name: args.data.file_name,
      mime_type: args.data.mime_type,
      size_bytes: args.data.size_bytes || 0,
      verification_status: args.data.verification_status || 'PENDING',
      verification_method: args.data.verification_method || null,
      ai_confidence: args.data.ai_confidence !== undefined ? args.data.ai_confidence : null,
      ai_extracted_fields: args.data.ai_extracted_fields || null,
      ai_verified_at: args.data.ai_verified_at ? new Date(args.data.ai_verified_at).toISOString() : null,
      review_requested_at: args.data.review_requested_at ? new Date(args.data.review_requested_at).toISOString() : null,
      assigned_doctor_id: args.data.assigned_doctor_id || null,
      reviewed_by_doctor_id: args.data.reviewed_by_doctor_id || null,
      doctor_reviewed_at: args.data.doctor_reviewed_at ? new Date(args.data.doctor_reviewed_at).toISOString() : null,
      rejection_reason: args.data.rejection_reason || null,
      doctor_review_notes: args.data.doctor_review_notes || null,
      deleted_at: null,
      created_at: new Date().toISOString(),
    };
    db.health_records.push(newRecord);
    saveLocalDB(db);
    return newRecord;
  },
  async update(args: any) {
    const db = loadLocalDB();
    db.health_records ||= [];
    const index = db.health_records.findIndex((r: any) => r.id === args.where?.id);
    if (index >= 0) {
      db.health_records[index] = {
        ...db.health_records[index],
        ...args.data,
      };
      saveLocalDB(db);
      return db.health_records[index];
    }
    return args.data;
  },
};

const fallbackAccessLog = {
  async findMany(args: any = {}) {
    const db = loadLocalDB();
    return db.access_logs || [];
  },
  async create(args: any) {
    const db = loadLocalDB();
    db.access_logs ||= [];
    const log = { id: crypto.randomUUID(), ...args.data, created_at: new Date().toISOString() };
    db.access_logs.push(log);
    saveLocalDB(db);
    return log;
  },
};

// ----------------------------------------------------------------------------
// Resilient Prisma Client Wrapper
// ----------------------------------------------------------------------------
export const prisma = {
  user: {
    async findMany(args: any = {}) {
      const running = await isPostgresRunning();
      if (!running) {
        logFallbackNotice();
        return await fallbackUser.findMany(args);
      }
      try {
        return await (rawPrisma as any).user.findMany(args);
      } catch (err) {
        if (isConnectionError(err) || isSchemaCompatibilityError(err)) {
          postgresAvailable = false;
          logFallbackNotice();
          return await fallbackUser.findMany(args);
        }
        throw err;
      }
    },
    async findFirst(args: any = {}) {
      const running = await isPostgresRunning();
      if (!running) {
        logFallbackNotice();
        return await fallbackUser.findFirst(args);
      }
      try {
        return await (rawPrisma as any).user.findFirst(args);
      } catch (err) {
        if (isConnectionError(err) || isSchemaCompatibilityError(err)) {
          postgresAvailable = false;
          logFallbackNotice();
          return await fallbackUser.findFirst(args);
        }
        throw err;
      }
    },
    async findUnique(args: any) {
      const running = await isPostgresRunning();
      if (!running) {
        logFallbackNotice();
        return await fallbackUser.findUnique(args);
      }
      try {
        return await rawPrisma.user.findUnique(args);
      } catch (err) {
        if (isConnectionError(err)) {
          postgresAvailable = false;
          logFallbackNotice();
          return await fallbackUser.findUnique(args);
        }
        if (isSchemaCompatibilityError(err)) {
          postgresAvailable = false;
          lastCheckTime = Date.now();
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
        return await rawPrisma.user.create(args);
      } catch (err) {
        if (isConnectionError(err)) {
          postgresAvailable = false;
          logFallbackNotice();
          return await fallbackUser.create(args);
        }
        if (isSchemaCompatibilityError(err)) {
          postgresAvailable = false;
          lastCheckTime = Date.now();
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

    async update(args: any) {
      const running = await isPostgresRunning();
      if (!running) {
        logFallbackNotice();
        return await fallbackUser.update(args);
      }
      try {
        return await (rawPrisma as any).user.update(args);
      } catch (err) {
        if (isConnectionError(err) || isSchemaCompatibilityError(err)) {
          postgresAvailable = false;
          logFallbackNotice();
          return await fallbackUser.update(args);
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
    async findMany(args: any = {}) {
      const running = await isPostgresRunning();
      if (!running) {
        logFallbackNotice();
        return await fallbackAppointment.findMany(args);
      }
      try {
        return await (rawPrisma as any).appointment.findMany(args);
      } catch (err) {
        if (isConnectionError(err)) {
          postgresAvailable = false;
          logFallbackNotice();
          return await fallbackAppointment.findMany(args);
        }
        throw err;
      }
    },
    async findFirst(args: any = {}) {
      const running = await isPostgresRunning();
      if (!running) {
        logFallbackNotice();
        return await fallbackAppointment.findFirst(args);
      }
      try {
        return await (rawPrisma as any).appointment.findFirst(args);
      } catch (err) {
        if (isConnectionError(err)) {
          postgresAvailable = false;
          logFallbackNotice();
          return await fallbackAppointment.findFirst(args);
        }
        throw err;
      }
    },
    async findUnique(args: any = {}) {
      const running = await isPostgresRunning();
      if (!running) {
        logFallbackNotice();
        return await fallbackAppointment.findUnique(args);
      }
      try {
        return await (rawPrisma as any).appointment.findUnique(args);
      } catch (err) {
        if (isConnectionError(err)) {
          postgresAvailable = false;
          logFallbackNotice();
          return await fallbackAppointment.findUnique(args);
        }
        throw err;
      }
    },
    async count(args: any = {}) {
      const running = await isPostgresRunning();
      if (!running) {
        return await fallbackAppointment.count(args);
      }
      try {
        return await (rawPrisma as any).appointment.count(args);
      } catch (err) {
        if (isConnectionError(err)) {
          postgresAvailable = false;
          return await fallbackAppointment.count(args);
        }
        throw err;
      }
    },
    async update(args: any) {
      const running = await isPostgresRunning();
      if (!running) {
        logFallbackNotice();
        return await fallbackAppointment.update(args);
      }
      try {
        return await (rawPrisma as any).appointment.update(args);
      } catch (err) {
        if (isConnectionError(err)) {
          postgresAvailable = false;
          logFallbackNotice();
          return await fallbackAppointment.update(args);
        }
        throw err;
      }
    },
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
    async findMany(args: any = {}) {
      const running = await isPostgresRunning();
      if (!running) {
        logFallbackNotice();
        return await fallbackProfile.findMany(args);
      }
      try {
        return await (rawPrisma as any).profile.findMany(args);
      } catch (err) {
        if (isConnectionError(err)) {
          postgresAvailable = false;
          logFallbackNotice();
          return await fallbackProfile.findMany(args);
        }
        throw err;
      }
    },
    async findFirst(args: any = {}) {
      const running = await isPostgresRunning();
      if (!running) {
        logFallbackNotice();
        return await fallbackProfile.findFirst(args);
      }
      try {
        return await (rawPrisma as any).profile.findFirst(args);
      } catch (err) {
        if (isConnectionError(err)) {
          postgresAvailable = false;
          logFallbackNotice();
          return await fallbackProfile.findFirst(args);
        }
        throw err;
      }
    },
    async findUnique(args: any) {
      const running = await isPostgresRunning();
      if (!running) {
        logFallbackNotice();
        return await fallbackProfile.findUnique(args);
      }
      try {
        return await (rawPrisma as any).profile.findUnique(args);
      } catch (err) {
        if (isConnectionError(err)) {
          postgresAvailable = false;
          logFallbackNotice();
          return await fallbackProfile.findUnique(args);
        }
        throw err;
      }
    },
    async create(args: any) {
      const running = await isPostgresRunning();
      if (!running) {
        logFallbackNotice();
        return await fallbackProfile.create(args);
      }
      try {
        return await (rawPrisma as any).profile.create(args);
      } catch (err) {
        if (isConnectionError(err)) {
          postgresAvailable = false;
          logFallbackNotice();
          return await fallbackProfile.create(args);
        }
        throw err;
      }
    },
    async update(args: any) {
      const running = await isPostgresRunning();
      if (!running) {
        logFallbackNotice();
        return await fallbackProfile.update(args);
      }
      try {
        return await (rawPrisma as any).profile.update(args);
      } catch (err) {
        if (isConnectionError(err)) {
          postgresAvailable = false;
          logFallbackNotice();
          return await fallbackProfile.update(args);
        }
        throw err;
      }
    },
  },
  profileAccess: {
    async create(args: any) {
      const running = await isPostgresRunning();
      if (!running) return args.data;
      return await (rawPrisma as any).profileAccess.create(args);
    },
    async findFirst(args: any) {
      const running = await isPostgresRunning();
      if (!running) {
        const userId = args?.where?.user_id;
        const profileId = args?.where?.profile_id;
        return { user_id: userId || '33333333-3333-4333-a333-333333333333', profile_id: profileId, level: 'OWNER' };
      }
      return await (rawPrisma as any).profileAccess.findFirst(args);
    },
  },
  visitRecord: {
    async findMany(args: any) { return await (rawPrisma as any).visitRecord.findMany(args); },
  },
  healthRecord: {
    async findMany(args: any) {
      const running = await isPostgresRunning();
      if (!running) return await fallbackHealthRecord.findMany(args);
      try {
        return await (rawPrisma as any).healthRecord.findMany(args);
      } catch (err) {
        if (isConnectionError(err)) {
          postgresAvailable = false;
          return await fallbackHealthRecord.findMany(args);
        }
        throw err;
      }
    },
    async findFirst(args: any) {
      const running = await isPostgresRunning();
      if (!running) return await fallbackHealthRecord.findFirst(args);
      try {
        return await (rawPrisma as any).healthRecord.findFirst(args);
      } catch (err) {
        if (isConnectionError(err)) {
          postgresAvailable = false;
          return await fallbackHealthRecord.findFirst(args);
        }
        throw err;
      }
    },
    async create(args: any) {
      const running = await isPostgresRunning();
      if (!running) return await fallbackHealthRecord.create(args);
      try {
        return await (rawPrisma as any).healthRecord.create(args);
      } catch (err) {
        if (isConnectionError(err)) {
          postgresAvailable = false;
          return await fallbackHealthRecord.create(args);
        }
        throw err;
      }
    },
    async update(args: any) {
      const running = await isPostgresRunning();
      if (!running) return await fallbackHealthRecord.update(args);
      try {
        return await (rawPrisma as any).healthRecord.update(args);
      } catch (err) {
        if (isConnectionError(err)) {
          postgresAvailable = false;
          return await fallbackHealthRecord.update(args);
        }
        throw err;
      }
    },
    async count(args: any) {
      const running = await isPostgresRunning();
      if (!running) return await fallbackHealthRecord.count(args);
      try {
        return await (rawPrisma as any).healthRecord.count(args);
      } catch (err) {
        if (isConnectionError(err)) {
          postgresAvailable = false;
          return await fallbackHealthRecord.count(args);
        }
        throw err;
      }
    },
  },
  vitalReading: {
    async findMany(args: any) {
      const running = await isPostgresRunning();
      if (!running) return await fallbackVitalReading.findMany(args);
      try {
        return await (rawPrisma as any).vitalReading.findMany(args);
      } catch (err) {
        if (isConnectionError(err)) {
          postgresAvailable = false;
          return await fallbackVitalReading.findMany(args);
        }
        throw err;
      }
    },
    async create(args: any) {
      const running = await isPostgresRunning();
      if (!running) return await fallbackVitalReading.create(args);
      try {
        return await (rawPrisma as any).vitalReading.create(args);
      } catch (err) {
        if (isConnectionError(err)) {
          postgresAvailable = false;
          return await fallbackVitalReading.create(args);
        }
        throw err;
      }
    },
    async delete(args: any) {
      const running = await isPostgresRunning();
      if (!running) return await fallbackVitalReading.delete(args);
      try {
        return await (rawPrisma as any).vitalReading.delete(args);
      } catch (err) {
        if (isConnectionError(err)) {
          postgresAvailable = false;
          return await fallbackVitalReading.delete(args);
        }
        throw err;
      }
    },
  },
  patientCondition: {
    async findMany(args: any) {
      const running = await isPostgresRunning();
      if (!running) return await fallbackPatientCondition.findMany(args);
      try {
        return await (rawPrisma as any).patientCondition.findMany(args);
      } catch (err) {
        if (isConnectionError(err)) {
          postgresAvailable = false;
          return await fallbackPatientCondition.findMany(args);
        }
        throw err;
      }
    },
    async create(args: any) {
      const running = await isPostgresRunning();
      if (!running) return await fallbackPatientCondition.create(args);
      try {
        return await (rawPrisma as any).patientCondition.create(args);
      } catch (err) {
        if (isConnectionError(err)) {
          postgresAvailable = false;
          return await fallbackPatientCondition.create(args);
        }
        throw err;
      }
    },
    async update(args: any) {
      const running = await isPostgresRunning();
      if (!running) return await fallbackPatientCondition.update(args);
      try {
        return await (rawPrisma as any).patientCondition.update(args);
      } catch (err) {
        if (isConnectionError(err)) {
          postgresAvailable = false;
          return await fallbackPatientCondition.update(args);
        }
        throw err;
      }
    },
    async deleteMany(args: any) {
      const running = await isPostgresRunning();
      if (!running) return await fallbackPatientCondition.deleteMany(args);
      try {
        return await (rawPrisma as any).patientCondition.deleteMany(args);
      } catch (err) {
        if (isConnectionError(err)) {
          postgresAvailable = false;
          return await fallbackPatientCondition.deleteMany(args);
        }
        throw err;
      }
    },
  },
  accessLog: {
    async findMany(args: any) {
      const running = await isPostgresRunning();
      if (!running) return await fallbackAccessLog.findMany(args);
      try {
        return await (rawPrisma as any).accessLog.findMany(args);
      } catch (err) {
        if (isConnectionError(err)) {
          postgresAvailable = false;
          return await fallbackAccessLog.findMany(args);
        }
        throw err;
      }
    },
    async create(args: any) {
      const running = await isPostgresRunning();
      if (!running) return await fallbackAccessLog.create(args);
      try {
        return await (rawPrisma as any).accessLog.create(args);
      } catch (err) {
        if (isConnectionError(err)) {
          postgresAvailable = false;
          return await fallbackAccessLog.create(args);
        }
        throw err;
      }
    },
  },

  async $transaction(callbackOrPromises: any) {
    const running = await isPostgresRunning();
    if (!running) {
      logFallbackNotice();
      if (typeof callbackOrPromises === 'function') {
        return await callbackOrPromises({
          user: fallbackUser,
          doctorProfile: fallbackDoctorProfile,
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
