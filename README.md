# OscarPS Orders API + Worker

Stack: Fastify (TypeScript) + Prisma + PostgreSQL, with a lightweight polling worker that processes orders asynchronously. Includes Zod validation, Pino logging, Swagger UI, and Docker Compose for local convenience.

## Getting started (local)

1. Requirements: Node 20+, PostgreSQL running locally (default url in `.env.example`).
2. Install deps: `npm install`.
3. Copy env: `cp .env.example .env` and adjust if needed.
4. Run migrations: `npm run db:migrate` (database must be up).
5. Start API: `npm run dev` (fast refresh via tsx). Swagger: http://localhost:3000/docs
6. Start worker (separate terminal): `npm run worker`.

### API endpoints

- POST `/orders` — create order (idempotent via unique `orderId`). Body: `{ orderId, customer, total }`. Returns existing order on duplicate.
- GET `/orders/:orderId` — fetch order by business id.
- GET `/health` — simple liveness check.

### Worker behavior

- Polls every `WORKER_POLL_INTERVAL_MS` (default 1s).
- Picks PENDING orders with `lockedAt` null and `attempts < WORKER_MAX_ATTEMPTS`.
- Locks row (optimistic `lockedAt` update), simulates ~2s processing (`WORKER_PROCESSING_DELAY_MS`), then marks `PROCESSED`.
- On failure: increments `attempts`, stores `lastError`, releases lock; stops retrying after `WORKER_MAX_ATTEMPTS`.

### Data model

`prisma/schema.prisma` and migration `prisma/migrations/0001_init/migration.sql` define:

- `Order(id, orderId unique, customer, total Decimal, status PENDING|PROCESSED, attempts, lockedAt, lastError, createdAt)`

### Docker Compose (optional)

Run API + worker + Postgres in one go:

```
docker compose up --build
```

- Postgres: exposed on 5432.
- API: port 3000, runs migrations on start, hot-reloads via volume mount.
- Worker: runs alongside API, shares the same DB.

### Scripts

- `npm run dev` — API in watch mode.
- `npm run worker` — worker in watch mode.
- `npm run db:migrate` — Prisma migrate dev.
- `npm run db:generate` — regenerate Prisma client.
- `npm run build` — type-check & emit to `dist/`.
- `npm run start` — run built server.
- `npm test` — runs Vitest (no tests added by default).

### Logging

Pino is used for both API (Fastify logger) and worker. Expect logs like: received order → locked → processed (or retry with error and attempts).

### Notes

- Idempotency: enforced by DB unique index on `orderId`; on conflict we return the existing record with 200.
- Swagger schemas live in `src/routes/orders.ts`.
- Environment validation via Zod in `src/config/env.ts`.
