import { execFileSync } from 'node:child_process';
import { URL } from 'node:url';

if (process.env.NODE_ENV === 'production') {
  throw new Error('db:reset is disabled when NODE_ENV=production.');
}

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL must point to a local development database.');
const parsed = new URL(databaseUrl);
const databaseName = decodeURIComponent(parsed.pathname.slice(1));
if (!['localhost', '127.0.0.1', '::1'].includes(parsed.hostname) || databaseName !== 'arogyanexus') {
  throw new Error('db:reset only runs against the local arogyanexus database.');
}

execFileSync(process.execPath, ['node_modules/prisma/build/index.js', 'migrate', 'reset', '--force', '--skip-seed'], {
  stdio: 'inherit',
  env: process.env,
});
execFileSync(process.execPath, ['node_modules/prisma/build/index.js', 'db', 'seed'], {
  stdio: 'inherit',
  env: process.env,
});
