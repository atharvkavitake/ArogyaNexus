import { prisma } from '../../lib/db/prisma';
import { ensureSelfProfile } from '../../lib/patients/ensureSelfProfile';
import { hashPassword } from '../../lib/auth/password';
import { patientRegisterSchema } from '../../lib/validations/auth';
import type { ZodIssue } from 'zod';

export interface RegisterPatientInput {
  fullName: string;
  email: string;
  phoneNumber?: string;
  password: string;
  confirmPassword: string;
  role?: string; // Any client-provided role will be strictly ignored
}

export async function registerPatientService(input: RegisterPatientInput) {
  // 1. Server-side validation with Zod
  const validation = patientRegisterSchema.safeParse(input);
  if (!validation.success) {
    const errorMessages = validation.error.issues.map((i: ZodIssue) => i.message);
    throw new Error(errorMessages[0] || 'Invalid patient registration data.');
  }

  const { fullName, email, phoneNumber, password } = validation.data;
  const normalizedEmail = email.toLowerCase().trim();

  // 2. Check for duplicate email in PostgreSQL
  const existingUser = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  });

  if (existingUser) {
    throw new Error('An account with this email address already exists.');
  }

  // 3. Hash password with bcrypt work factor 12
  const passwordHash = await hashPassword(password);

  // 4. Create user with server-enforced role = 'patient'
  const user = await prisma.user.create({
    data: {
      full_name: fullName.trim(),
      email: normalizedEmail,
      phone: phoneNumber?.trim() || null,
      password_hash: passwordHash,
      role: 'patient', // Server forces role = 'patient'
    },
    select: {
      id: true,
      full_name: true,
      email: true,
      phone: true,
      role: true,
      created_at: true,
      updated_at: true,
    },
  });

  await ensureSelfProfile({ id: user.id, full_name: user.full_name, email: user.email, phone: user.phone });

  return {
    success: true,
    message: 'Patient registered successfully.',
    user,
  };
}
