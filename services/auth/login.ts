import { prisma } from '../../lib/db/prisma';
import { ensureSelfProfile } from '../../lib/patients/ensureSelfProfile';
import { verifyPassword } from '../../lib/auth/password';
import { loginSchema } from '../../lib/validations/auth';
import type { SessionUser } from '../../lib/auth/session';

export interface LoginInput {
  email: string;
  password: string;
}

export interface LoginResult {
  success: boolean;
  user: SessionUser;
  doctorStatus?: 'pending' | 'approved' | 'rejected';
  statusMessage?: string;
}

export async function loginService(input: LoginInput): Promise<LoginResult> {
  // 1. Validate credentials structure
  const validation = loginSchema.safeParse(input);
  if (!validation.success) {
    throw new Error('Please enter a valid email and password.');
  }

  const { email, password } = validation.data;
  const normalizedEmail = email.toLowerCase().trim();

  // 2. Query user from PostgreSQL with doctor_profile
  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    include: {
      doctor_profile: true,
    },
  });

  // Generic message prevents user enumeration attacks
  if (!user) {
    throw new Error('Invalid email or password.');
  }

  // 3. Verify password hash securely
  const isMatch = await verifyPassword(password, user.password_hash);
  if (!isMatch) {
    throw new Error('Invalid email or password.');
  }

  const selfProfile = user.role === 'patient'
    ? await ensureSelfProfile({ id: user.id, full_name: user.full_name, email: user.email, phone: user.phone })
    : null;

  // 4. Construct safe user payload
  const safeUser: SessionUser = {
    id: user.id,
    full_name: user.full_name,
    email: user.email,
    phone: user.phone,
    ...(selfProfile ? { onboardedAt: selfProfile.onboardedAt ? new Date(selfProfile.onboardedAt).toISOString() : null } : {}),
    role: user.role as 'patient' | 'doctor' | 'admin',
    doctor_profile: user.doctor_profile
      ? {
          id: user.doctor_profile.id,
          speciality: user.doctor_profile.speciality,
          registration_number: user.doctor_profile.registration_number,
          clinic_name: user.doctor_profile.clinic_name,
          clinic_address: user.doctor_profile.clinic_address,
          consultation_fee: Number(user.doctor_profile.consultation_fee),
          status: user.doctor_profile.status as 'pending' | 'approved' | 'rejected',
        }
      : null,
  };

  // 5. Handle doctor status logic (Section 12)
  let doctorStatus: 'pending' | 'approved' | 'rejected' | undefined = undefined;
  let statusMessage: string | undefined = undefined;

  if (user.role === 'doctor' && user.doctor_profile) {
    doctorStatus = user.doctor_profile.status as 'pending' | 'approved' | 'rejected';

    if (doctorStatus === 'pending') {
      statusMessage = 'Your doctor account is pending admin approval.';
    } else if (doctorStatus === 'rejected') {
      statusMessage = 'Your doctor account has not been approved.';
    }
  }

  return {
    success: true,
    user: safeUser,
    doctorStatus,
    statusMessage,
  };
}
