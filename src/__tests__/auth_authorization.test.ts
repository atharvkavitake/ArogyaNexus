import { describe, expect, it, vi } from 'vitest';
import express from 'express';
import { createServer } from 'node:http';
import { $Enums } from '@prisma/client';
import { requireConsent, requireProfile, requireRole } from '../middleware/auth';
import { csrfProtection } from '../middleware/csrf';
import { createLoginRateLimit } from '../middleware/rateLimits';
import { prisma } from '../db/client';
import { getCsrfToken } from '../api/auth.js';

const { Role } = $Enums;

vi.mock('../db/client', () => ({
  prisma: {
    session: { findFirst: vi.fn() },
    profileAccess: { findFirst: vi.fn() },
    appointment: { findUnique: vi.fn() },
    accessLog: { create: vi.fn() },
  },
}));

function responseStub() {
  const res: any = { statusCode: 200, body: undefined };
  res.status = vi.fn((status: number) => { res.statusCode = status; return res; });
  res.json = vi.fn((body: unknown) => { res.body = body; return res; });
  return res;
}

describe('authorization and request security middleware', () => {
  it('rejects a role outside the route allowlist with 403', () => {
    const req: any = { auth: { user: { role: Role.PATIENT } } };
    const res = responseStub();
    const next = vi.fn();
    requireRole(Role.DOCTOR)(req, res, next);
    expect(res.statusCode).toBe(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('does not reveal another user profile', async () => {
    vi.mocked(prisma.profileAccess.findFirst).mockResolvedValue(null);
    const req: any = { auth: { user: { id: 'user-a' } }, params: { profileId: '00000000-0000-4000-8000-000000000001' }, query: {}, body: {} };
    const res = responseStub();
    await requireProfile(['VIEW'] as any)(req, res, vi.fn());
    expect(res.statusCode).toBe(404);
    expect(prisma.profileAccess.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ userId: 'user-a' }) }));
  });

  it('rejects an expired consent', async () => {
    vi.mocked(prisma.appointment.findUnique).mockResolvedValue({
      id: '00000000-0000-4000-8000-000000000002', patientId: 'patient-1', doctorId: 'doctor-1',
      doctor: { userId: 'doctor-user' },
      consent: { id: 'consent-1', doctorId: 'doctor-1', patientId: 'patient-1', status: 'ACTIVE', revokedAt: null, expiresAt: new Date(Date.now() - 1000) },
    } as any);
    const req: any = { auth: { user: { id: 'doctor-user', role: Role.DOCTOR } }, params: { appointmentId: '00000000-0000-4000-8000-000000000002' }, body: {} };
    const res = responseStub();
    await requireConsent(req, res, vi.fn());
    expect(res.statusCode).toBe(403);
    expect(res.body.code).toBe('CONSENT_REQUIRED');
    expect(prisma.accessLog.create).not.toHaveBeenCalled();
  });

  it('rejects an appointment owned by another doctor', async () => {
    vi.mocked(prisma.appointment.findUnique).mockResolvedValue({
      id: '00000000-0000-4000-8000-000000000003', doctor: { userId: 'doctor-owner' }, consent: null,
    } as any);
    const req: any = { auth: { user: { id: 'other-doctor', role: Role.DOCTOR } }, params: { appointmentId: '00000000-0000-4000-8000-000000000003' }, body: {} };
    const res = responseStub();
    await requireConsent(req, res, vi.fn());
    expect(res.statusCode).toBe(403);
    expect(res.body.code).toBe('APPOINTMENT_FORBIDDEN');
  });

  it('rejects unsafe requests without a matching CSRF cookie and header', () => {
    const req: any = { method: 'POST', cookies: {}, get: () => undefined };
    const res = responseStub();
    const next = vi.fn();
    csrfProtection(req, res, next);
    expect(res.statusCode).toBe(403);
    expect(res.body.code).toBe('CSRF_INVALID');
    expect(next).not.toHaveBeenCalled();
  });

  it('reports an unavailable auth route clearly when the backend returns HTML', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      status: 404,
      headers: { get: () => 'text/html; charset=utf-8' },
    }));
    await expect(getCsrfToken()).rejects.toThrow(/Restart the backend with npm run dev:all/);
    vi.unstubAllGlobals();
  });

  it('rate limits repeated login attempts', async () => {
    const app = express();
    app.post('/login', createLoginRateLimit(1), (_req, res) => res.status(401).json({ code: 'INVALID_CREDENTIALS', message: 'Invalid email or password.' }));
    const server = createServer(app);
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    try {
      const address = server.address();
      if (!address || typeof address === 'string') throw new Error('Test HTTP server did not bind.');
      const url = `http://127.0.0.1:${address.port}/login`;
      expect((await fetch(url, { method: 'POST' })).status).toBe(401);
      const blocked = await fetch(url, { method: 'POST' });
      expect(blocked.status).toBe(429);
      expect((await blocked.json()).code).toBe('RATE_LIMITED');
    } finally {
      await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    }
  });
});
