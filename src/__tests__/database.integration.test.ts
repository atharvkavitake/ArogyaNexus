import { execFileSync } from 'node:child_process';
import { URL } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const databaseName = testDatabaseUrl ? decodeURIComponent(new URL(testDatabaseUrl).pathname.slice(1)) : '';
const integration = Boolean(testDatabaseUrl && databaseName === 'arogyanexus_test');
let disconnect: (() => Promise<void>) | undefined;

describe.skipIf(!integration)('database migrations and demo seed', () => {
  it('applies migrations to the isolated test database and seeds demo accounts', async () => {
    const env = { ...process.env, DATABASE_URL: testDatabaseUrl, DIRECT_URL: testDatabaseUrl };
    const prismaCli = 'node_modules/prisma/build/index.js';
    execFileSync(process.execPath, [prismaCli, 'generate'], { env, stdio: 'inherit' });
    execFileSync(process.execPath, [prismaCli, 'migrate', 'deploy'], { env, stdio: 'inherit' });
    execFileSync(process.execPath, [prismaCli, 'db', 'seed'], { env, stdio: 'inherit' });

    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient();
    disconnect = () => prisma.$disconnect();
    const [patient, doctor, nurse, admin, doctors] = await Promise.all([
      prisma.user.findUnique({ where: { email: 'patient@arogyanexus.test' } }),
      prisma.user.findUnique({ where: { email: 'doctor@arogyanexus.test' } }),
      prisma.user.findUnique({ where: { email: 'nurse@arogyanexus.test' } }),
      prisma.user.findUnique({ where: { email: 'admin@arogyanexus.test' } }),
      prisma.user.count({ where: { role: 'doctor' } }),
    ]);
    expect(patient?.role).toBe('patient');
    expect(doctor?.role).toBe('doctor');
    expect(nurse?.role).toBe('nurse');
    expect(admin?.role).toBe('admin');
    expect(doctors).toBeGreaterThanOrEqual(7);
  }, 120_000);
});

afterAll(async () => disconnect?.());
