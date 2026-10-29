# ArogyaNexus database

The development database is PostgreSQL 16 with PostGIS 3.4. Prisma models and
all application tables use PostgreSQL's `public` schema. The Compose service
stores data in the named `arogyanexus_pgdata` volume.

The prior four migrations described the prototype tables and were archived in
`prisma/migrations_legacy/`. The active migration history now starts with the
complete database baseline. Existing prototype databases must be reset before
using this baseline; do not apply it over a database containing data you need.

## Start PostgreSQL

1. Install and start Docker Desktop.
2. Copy `.env.example` to `.env` and keep its local credentials for the Compose
   database.
3. Start the database and apply migrations:

   ```sh
   npm run db:up
   npm run db:migrate
   ```

The database is available on `localhost:5432`. `DATABASE_URL` is the runtime
connection string. `DIRECT_URL` is the direct connection Prisma uses for schema
operations; it may point to a direct PostgreSQL endpoint even when runtime
traffic uses a pooler.

Authentication uses the PostgreSQL `Session` table. Browser sessions are
opaque random tokens; only SHA-256 token hashes are stored. The session cookie
is HTTP-only, SameSite=Lax, and Secure in production. Mutating auth requests
must send `X-CSRF-Token`, matching the readable `arogyanexus_csrf` cookie.
Configure `VITE_ORIGIN` to the exact trusted frontend origin; the default is
`http://localhost:5173` for local Vite development.

## Seed fictional demo data

```sh
npm run db:seed
```

The seed is safe to rerun and only upserts its fictional accounts and demo
fixtures. The default password is `Pass@123`; set `DEMO_PASSWORD` before seeding
to use another shared demo password. The command prints each demo login. The
seed includes one patient with SELF, Mother, and Son profiles; one primary
verified doctor with clinic and availability; a nurse with a facility
membership; an admin; and six additional Bengaluru doctors spanning five
specialties. Availability dates are generated relative to the seed run time.

`npm run db:reset` is limited to `localhost`, `127.0.0.1`, or `::1` and a
database named exactly `arogyanexus`. It refuses to run when
`NODE_ENV=production`, then reapplies migrations and reseeds the local database.

## View data

```sh
npm run db:studio
```

Prisma Studio opens a local browser interface for viewing and editing local
development data. Use only fictional data in the demo database.

## Database integration test

The database integration test is skipped unless `TEST_DATABASE_URL` points to a
separate database named `arogyanexus_test`. Create that database first, then run
the normal Vitest suite with the environment variable set. The test runs
`prisma migrate deploy`, runs the idempotent seed, and verifies the demo users.
It never points migrations at the regular `arogyanexus` database.

## Move to Supabase later

Create a Supabase PostgreSQL project with PostGIS enabled. Export the current
schema/data using `pg_dump`, then restore it into the Supabase database before
changing application configuration. Set `DATABASE_URL` to the Supabase pooled
connection string for application traffic and `DIRECT_URL` to the project's
direct connection string for Prisma migrations and administrative tools. Keep
the `?schema=public` parameter, verify the migration status, then deploy future
migrations with `prisma migrate deploy`. Do not point `db:reset` at Supabase.
