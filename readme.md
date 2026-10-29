# ArogyaNexus

Healthcare management platform with a React/Vite frontend and Express authentication API.

## Requirements

- Node.js 20 or newer
- Corepack (included with Node.js)
- PostgreSQL, if using the Prisma database

## Setup and run

```powershell
corepack pnpm install --frozen-lockfile
Copy-Item .env.example .env
corepack pnpm dev:all
```

Copy `.env.example` to `.env`, then start the API and Vite together with `corepack pnpm dev:all` (or `npm run dev:all`). The API runs at [http://localhost:3001](http://localhost:3001); verify the database connection at `/api/v1/health`. If you start Vite alone, the auth API must also be running on port 3001. Start PostgreSQL and apply migrations before logging in.

## Other commands

```powershell
corepack pnpm build
corepack pnpm typecheck
corepack pnpm lint
```
