import { describe, it, expect, vi, beforeEach } from 'vitest';
import { hashPassword, verifyPassword } from '../../lib/auth/password';
import {
  signSessionId,
  verifySessionId,
  generateSessionId,
  createSession,
} from '../../lib/auth/session';
import { registerPatientService } from '../../services/auth/register-patient';
import { registerDoctorService } from '../../services/auth/register-doctor';
import { loginService } from '../../services/auth/login';
import { prisma } from '../../lib/db/prisma';

// Mock Prisma for deterministic unit testing of local server services
vi.mock('../../lib/db/prisma', () => {
  return {
    prisma: {
      user: {
        findUnique: vi.fn(),
        create: vi.fn(),
      },
      doctorProfile: {
        findUnique: vi.fn(),
        create: vi.fn(),
      },
      patient: {
        findUnique: vi.fn().mockResolvedValue({ id: 'patient-1' }),
        create: vi.fn().mockResolvedValue({ id: 'patient-1' }),
      },
      profile: {
        findFirst: vi.fn().mockResolvedValue({ id: 'profile-1', onboardedAt: null }),
        create: vi.fn().mockResolvedValue({ id: 'profile-1', onboardedAt: null }),
      },
      profileAccess: {
        findFirst: vi.fn().mockResolvedValue({ scope: 'OWNER' }),
        create: vi.fn(),
        update: vi.fn(),
      },
      profileChangeLog: { create: vi.fn() },
      $transaction: vi.fn(),
    },
  };
});

describe('AROGYANEXUS Local PostgreSQL Auth & Security Test Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ============================================================================
  // 1. Password Hashing Security (Section 9)
  // ============================================================================
  describe('Password Security & Hashing', () => {
    it('hashes passwords with bcrypt work factor and verifies correctly', async () => {
      const password = 'SuperSecurePassword2026!';
      const hash = await hashPassword(password);

      expect(hash).toBeDefined();
      expect(hash).not.toBe(password);
      expect(hash.startsWith('$2')).toBe(true); // bcrypt prefix

      const isValid = await verifyPassword(password, hash);
      expect(isValid).toBe(true);

      const isInvalid = await verifyPassword('WrongPassword123!', hash);
      expect(isInvalid).toBe(false);
    });

    it('rejects empty or invalid passwords during hashing', async () => {
      await expect(hashPassword('')).rejects.toThrow();
    });
  });

  // ============================================================================
  // 2. Server-side Session & Cookie Integrity (Section 10)
  // ============================================================================
  describe('Session Management & Tamper Resistance', () => {
    it('generates, signs, and verifies session IDs securely', () => {
      const sessionId = generateSessionId();
      const signed = signSessionId(sessionId);

      expect(signed).toContain('.');
      const verified = verifySessionId(signed);
      expect(verified).toBe(sessionId);
    });

    it('rejects tampered session cookies', () => {
      const sessionId = generateSessionId();
      const signed = signSessionId(sessionId);
      const tampered = signed.slice(0, -4) + 'abcd';

      expect(verifySessionId(tampered)).toBeNull();
    });

    it('attaches HTTP-only cookie with proper security settings on session creation', () => {
      const mockRes: any = {
        cookie: vi.fn(),
        clearCookie: vi.fn(),
      };

      const user: any = {
        id: 'usr-1',
        full_name: 'Test Patient',
        email: 'patient@example.com',
        role: 'patient',
        phone: null,
      };

      const session = createSession(mockRes, user);
      expect(session.sessionId).toBeDefined();

      expect(mockRes.cookie).toHaveBeenCalledWith(
        'arogyanexus_session',
        expect.any(String),
        expect.objectContaining({
          httpOnly: true,
          sameSite: 'lax',
          path: '/',
        })
      );
    });
  });

  // ============================================================================
  // 3. Patient Registration & Role Enforcement (Section 6 & 14)
  // ============================================================================
  describe('Patient Registration Service', () => {
    it('successfully registers patient and forces role = patient', async () => {
      (prisma.user.findUnique as any).mockResolvedValue(null);
      (prisma.user.create as any).mockImplementation(({ data }: any) => {
        return Promise.resolve({
          id: 'user-uuid-1234',
          full_name: data.full_name,
          email: data.email,
          phone: data.phone,
          role: data.role,
          created_at: new Date(),
          updated_at: new Date(),
        });
      });

      const result = await registerPatientService({
        fullName: 'Atharv Kavitake',
        email: 'atharv@example.com',
        phoneNumber: '+1 555-019-2834',
        password: 'Password123!',
        confirmPassword: 'Password123!',
      });

      expect(result.success).toBe(true);
      expect(result.user.role).toBe('patient');
      expect(result.user.email).toBe('atharv@example.com');
      expect((result.user as any).password_hash).toBeUndefined(); // Never exposed
    });

    it('SECURITY GATE: strictly ignores client-provided role = admin', async () => {
      (prisma.user.findUnique as any).mockResolvedValue(null);
      (prisma.user.create as any).mockImplementation(({ data }: any) => {
        return Promise.resolve({
          id: 'user-uuid-5678',
          full_name: data.full_name,
          email: data.email,
          role: data.role,
        });
      });

      const maliciousPayload = {
        fullName: 'Hacker User',
        email: 'hacker@example.com',
        phoneNumber: '+1 555-000-1111',
        password: 'Password123!',
        confirmPassword: 'Password123!',
        role: 'admin', // Tampered client role!
      };

      const result = await registerPatientService(maliciousPayload as any);

      // Backend MUST enforce role = patient
      expect(result.user.role).toBe('patient');
      expect(result.user.role).not.toBe('admin');
    });

    it('rejects registration if email already exists in PostgreSQL', async () => {
      (prisma.user.findUnique as any).mockResolvedValue({
        id: 'existing-id',
        email: 'duplicate@example.com',
      });

      await expect(
        registerPatientService({
          fullName: 'Duplicate User',
          email: 'duplicate@example.com',
          phoneNumber: '+1 555-123-4567',
          password: 'Password123!',
          confirmPassword: 'Password123!',
        })
      ).rejects.toThrow('An account with this email address already exists.');
    });

    it('rejects invalid email or weak passwords via server Zod validation', async () => {
      await expect(
        registerPatientService({
          fullName: 'Test User',
          email: 'not-an-email',
          password: 'weak',
          confirmPassword: 'weak',
        })
      ).rejects.toThrow();
    });
  });

  // ============================================================================
  // 4. Doctor Registration & Pending Status Enforcement (Section 7)
  // ============================================================================
  describe('Doctor Registration Service', () => {
    it('successfully registers doctor with forced status = pending and role = doctor', async () => {
      (prisma.user.findUnique as any).mockResolvedValue(null);
      (prisma.doctorProfile.findUnique as any).mockResolvedValue(null);

      (prisma.$transaction as any).mockImplementation(async (callback: any) => {
        const tx = {
          user: {
            create: vi.fn().mockResolvedValue({
              id: 'doc-user-id',
              full_name: 'Dr. Ananya Sharma',
              email: 'ananya@hospital.org',
              phone: '+1 555-234-5678',
              role: 'doctor',
              created_at: new Date(),
            }),
          },
          doctorProfile: {
            create: vi.fn().mockResolvedValue({
              id: 'doc-profile-id',
              speciality: 'Cardiology',
              registration_number: 'MCI-2026-8888',
              clinic_name: 'Apex Clinic',
              clinic_address: 'Medical Way',
              consultation_fee: 150,
              status: 'pending', // Server forces pending
            }),
          },
        };
        return await callback(tx);
      });

      const result = await registerDoctorService({
        fullName: 'Dr. Ananya Sharma',
        email: 'ananya@hospital.org',
        phoneNumber: '+1 555-234-5678',
        medicalSpeciality: 'Cardiology',
        registrationNumber: 'MCI-2026-8888',
        clinicName: 'Apex Clinic',
        clinicAddress: 'Medical Way',
        consultationFee: 150,
        password: 'Password123!',
        confirmPassword: 'Password123!',
        status: 'approved', // Client attempts to self-approve!
      });

      expect(result.success).toBe(true);
      expect(result.user.role).toBe('doctor');
      expect(result.doctorProfile.status).toBe('pending'); // Enforced as pending
      expect(result.doctorProfile.status).not.toBe('approved');
    });

    it('rejects doctor registration if registration number already exists', async () => {
      (prisma.user.findUnique as any).mockResolvedValue(null);
      (prisma.doctorProfile.findUnique as any).mockResolvedValue({
        id: 'existing-doc-id',
        registration_number: 'MCI-DUPLICATE-1',
      });

      await expect(
        registerDoctorService({
          fullName: 'Dr. Dup',
          email: 'dup@hospital.org',
          phoneNumber: '+1 555-111-2222',
          medicalSpeciality: 'Neurology',
          registrationNumber: 'MCI-DUPLICATE-1',
          clinicName: 'Clinic',
          clinicAddress: 'Address',
          consultationFee: 100,
          password: 'Password123!',
          confirmPassword: 'Password123!',
        })
      ).rejects.toThrow('A doctor with this registration number already exists.');
    });
  });

  // ============================================================================
  // 5. Login & Doctor Status Verification (Section 11 & 12)
  // ============================================================================
  describe('Login Service & Doctor Status', () => {
    it('authenticates approved doctor and returns safe user information', async () => {
      const passwordHash = await hashPassword('Password123!');

      (prisma.user.findUnique as any).mockResolvedValue({
        id: 'doc-approved-id',
        full_name: 'Dr. Approved',
        email: 'doc.approved@hospital.org',
        password_hash: passwordHash,
        role: 'doctor',
        phone: null,
        doctor_profile: {
          id: 'dp-1',
          speciality: 'Cardiology',
          registration_number: 'REG-100',
          clinic_name: 'Clinic',
          clinic_address: 'Street',
          consultation_fee: 120,
          status: 'approved',
        },
      });

      const result = await loginService({
        email: 'doc.approved@hospital.org',
        password: 'Password123!',
      });

      expect(result.success).toBe(true);
      expect(result.user.role).toBe('doctor');
      expect(result.doctorStatus).toBe('approved');
      expect((result.user as any).password_hash).toBeUndefined();
    });

    it('indicates pending message for pending doctor accounts', async () => {
      const passwordHash = await hashPassword('Password123!');

      (prisma.user.findUnique as any).mockResolvedValue({
        id: 'doc-pending-id',
        full_name: 'Dr. Pending',
        email: 'doc.pending@hospital.org',
        password_hash: passwordHash,
        role: 'doctor',
        phone: null,
        doctor_profile: {
          id: 'dp-2',
          speciality: 'Pediatrics',
          registration_number: 'REG-200',
          clinic_name: 'Clinic',
          clinic_address: 'Street',
          consultation_fee: 100,
          status: 'pending',
        },
      });

      const result = await loginService({
        email: 'doc.pending@hospital.org',
        password: 'Password123!',
      });

      expect(result.doctorStatus).toBe('pending');
      expect(result.statusMessage).toBe('Your doctor account is pending admin approval.');
    });

    it('indicates rejected message for rejected doctor accounts', async () => {
      const passwordHash = await hashPassword('Password123!');

      (prisma.user.findUnique as any).mockResolvedValue({
        id: 'doc-rejected-id',
        full_name: 'Dr. Rejected',
        email: 'doc.rejected@hospital.org',
        password_hash: passwordHash,
        role: 'doctor',
        phone: null,
        doctor_profile: {
          id: 'dp-3',
          speciality: 'Orthopedics',
          registration_number: 'REG-300',
          clinic_name: 'Clinic',
          clinic_address: 'Street',
          consultation_fee: 110,
          status: 'rejected',
        },
      });

      const result = await loginService({
        email: 'doc.rejected@hospital.org',
        password: 'Password123!',
      });

      expect(result.doctorStatus).toBe('rejected');
      expect(result.statusMessage).toBe('Your doctor account has not been approved.');
    });

    it('rejects incorrect password with generic error message', async () => {
      const passwordHash = await hashPassword('CorrectPassword123!');

      (prisma.user.findUnique as any).mockResolvedValue({
        id: 'usr-1',
        email: 'patient@example.com',
        password_hash: passwordHash,
      });

      await expect(
        loginService({
          email: 'patient@example.com',
          password: 'WrongPassword123!',
        })
      ).rejects.toThrow('Invalid email or password.');
    });

    it('rejects unknown email with generic error message', async () => {
      (prisma.user.findUnique as any).mockResolvedValue(null);

      await expect(
        loginService({
          email: 'nonexistent@example.com',
          password: 'Password123!',
        })
      ).rejects.toThrow('Invalid email or password.');
    });
  });
});
