import { prisma } from '../../lib/db/prisma';
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

  // 2. Query the user first. Fetching the doctor profile separately keeps
  // login compatible with clients generated under either relation name.
  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
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

  const doctorProfile = (user as any).doctor_profile ?? (user.role === 'doctor'
    ? await prisma.doctorProfile.findUnique({ where: { user_id: user.id } })
    : null);

  // 4. Construct safe user payload
  const safeUser: SessionUser = {
    id: user.id,
    full_name: user.full_name,
    email: user.email,
    phone: user.phone,
    role: user.role as 'patient' | 'doctor' | 'admin',
    doctor_profile: doctorProfile
      ? {
          id: doctorProfile.id,
          speciality: doctorProfile.speciality,
          registration_number: doctorProfile.registration_number,
          clinic_name: doctorProfile.clinic_name,
          clinic_address: doctorProfile.clinic_address,
          consultation_fee: Number(doctorProfile.consultation_fee),
          status: doctorProfile.status as 'pending' | 'approved' | 'rejected',
        }
      : null,
  };

  // 5. Handle doctor status logic (Section 12)
  let doctorStatus: 'pending' | 'approved' | 'rejected' | undefined = undefined;
  let statusMessage: string | undefined = undefined;

  if (user.role === 'doctor' && doctorProfile) {
    doctorStatus = doctorProfile.status as 'pending' | 'approved' | 'rejected';

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
