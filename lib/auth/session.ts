import crypto from 'crypto';
import type { Response } from 'express';

export interface SessionUser {
  id: string;
  full_name: string;
  email: string;
  role: 'patient' | 'doctor' | 'admin';
  phone: string | null;
  onboardedAt?: string | null;
  doctor_profile?: {
    id: string;
    speciality: string;
    registration_number: string;
    clinic_name: string;
    clinic_address: string;
    consultation_fee: number;
    status: 'pending' | 'approved' | 'rejected';
  } | null;
}

export interface SessionData {
  sessionId: string;
  user: SessionUser;
  createdAt: number;
  expiresAt: number;
}

// 7 days session duration
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const SESSION_COOKIE_NAME = 'arogyanexus_session';

// In-memory server-side session registry
const sessionStore = new Map<string, SessionData>();

const SESSION_SECRET =
  process.env.SESSION_SECRET || 'arogyanexus_default_secure_session_secret_change_in_production';

/**
 * Generate a cryptographically secure random session ID
 */
export function generateSessionId(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Sign session ID with secret
 */
export function signSessionId(sessionId: string): string {
  const signature = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(sessionId)
    .digest('hex');
  return `${sessionId}.${signature}`;
}

/**
 * Verify and unpack signed session ID
 */
export function verifySessionId(signedSessionId: string): string | null {
  if (!signedSessionId || typeof signedSessionId !== 'string') return null;

  const parts = signedSessionId.split('.');
  if (parts.length !== 2) return null;

  const [sessionId, signature] = parts;
  const expectedSignature = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(sessionId)
    .digest('hex');

  // Constant-time comparison to prevent timing attacks
  const isMatch = crypto.timingSafeEqual(
    Buffer.from(signature, 'utf8'),
    Buffer.from(expectedSignature, 'utf8')
  );

  return isMatch ? sessionId : null;
}

/**
 * Create a new server session and attach HTTP-only cookie
 */
export function createSession(res: Response, user: SessionUser): SessionData {
  const sessionId = generateSessionId();
  const now = Date.now();

  const sessionData: SessionData = {
    sessionId,
    user,
    createdAt: now,
    expiresAt: now + SESSION_TTL_MS,
  };

  sessionStore.set(sessionId, sessionData);

  const signedCookie = signSessionId(sessionId);

  res.cookie(SESSION_COOKIE_NAME, signedCookie, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_TTL_MS,
  });

  return sessionData;
}

/**
 * Retrieve session by signed cookie value
 */
export function getSession(signedCookie: string | undefined): SessionData | null {
  if (!signedCookie) return null;

  const sessionId = verifySessionId(signedCookie);
  if (!sessionId) return null;

  const session = sessionStore.get(sessionId);
  if (!session) return null;

  if (Date.now() > session.expiresAt) {
    sessionStore.delete(sessionId);
    return null;
  }

  return session;
}

/**
 * Destroy session and clear cookie
 */
export function destroySession(res: Response, signedCookie: string | undefined): void {
  if (signedCookie) {
    const sessionId = verifySessionId(signedCookie);
    if (sessionId) {
      sessionStore.delete(sessionId);
    }
  }

  res.clearCookie(SESSION_COOKIE_NAME, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
  });
}
