import { randomBytes, timingSafeEqual } from 'node:crypto';
import type { Request, RequestHandler, Response } from 'express';

export const CSRF_COOKIE_NAME = 'arogyanexus_csrf';
const cookieOptions = () => ({ secure: process.env.NODE_ENV === 'production', sameSite: 'lax' as const, path: '/' });

export function issueCsrfToken(res: Response): string {
  const token = randomBytes(32).toString('hex');
  res.cookie(CSRF_COOKIE_NAME, token, { ...cookieOptions(), httpOnly: false, maxAge: 60 * 60 * 1000 });
  return token;
}

export function validCsrfRequest(req: Request): boolean {
  const cookieToken = req.cookies?.[CSRF_COOKIE_NAME];
  const headerToken = req.get('x-csrf-token');
  if (typeof cookieToken !== 'string' || typeof headerToken !== 'string') return false;
  const cookieBuffer = Buffer.from(cookieToken);
  const headerBuffer = Buffer.from(headerToken);
  return cookieBuffer.length === headerBuffer.length && timingSafeEqual(cookieBuffer, headerBuffer);
}

export const csrfProtection: RequestHandler = (req, res, next) => {
  if (!['POST', 'PATCH', 'DELETE'].includes(req.method)) return next();
  if (!validCsrfRequest(req)) {
    res.status(403).json({ code: 'CSRF_INVALID', message: 'A valid CSRF token is required.' });
    return;
  }
  next();
};

export function clearCsrfCookie(res: Response) {
  res.clearCookie(CSRF_COOKIE_NAME, cookieOptions());
}
