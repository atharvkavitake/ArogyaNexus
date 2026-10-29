# ArogyaNexus project rules (read before every task)

Stack: React 19 + Vite + React Router + CSS + Lucide (client); Express 5 +
TypeScript + Prisma + PostgreSQL + Zod (server). Tests: Vitest. Lint: Oxlint.
No new UI libraries unless the task says so.

Rules
1. Inspect existing code first. List what exists, then add only what is missing.
   Reuse existing components, tokens and design/STYLE.md. Do not redesign
   approved pages.
2. Pages call src/api/*.js only. Replace mock internals with fetch to /api/v1
   (credentials: 'include') but keep the same response shapes the pages use.
   Keep ?mock=empty and ?mock=error working in development until the end.
3. Every endpoint: Zod validation, requireAuth, role check, ownership check.
   Patient data is scoped by patientId through requireProfile. Doctors reach
   patient data only through requireConsent on an appointment. Never trust ids
   from the client without checking them.
4. Clinical data is append-only with recordedBy and source fields. Never delete
   or silently edit medical history.
5. Write an AccessLog row for every doctor or staff read or write of patient
   data.
6. Return errors as { code, message }. Success as { data }.
7. Times use ISO 8601 with offset, displayed in Asia/Kolkata.
8. Fake data only. Seeds are idempotent and never delete real data.
9. After each task: run oxlint and vitest, add tests for the new rules, update
   docs/ (API list and DATABASE.md), and list files changed plus any
   follow-ups.