# OscarPS Orders API + Worker

Fastify + Prisma + PostgreSQL with a lightweight polling worker for async order processing (shoe e-commerce context). Includes Swagger UI, Docker Compose, Zod env/input validation, and Pino logs.

## Quickstart (local)
1) Requirements: Node 20+, Postgres running. Copy env and install deps:
```
cp .env.example .env
npm install
```
2) Run migrations (DB must be up):
```
npm run db:migrate
```
3) Start services (two terminals):
```
npm run dev     # API (Swagger at http://localhost:3000/docs)
npm run worker  # background processor
```

## Quickstart (Docker)
```
docker compose up -d db
docker compose run --rm api npm run db:migrate
docker compose up -d api worker
```
- API: http://localhost:3000
- Worker shares the same DB and runs automatically.

## Usage
- Health: `curl http://localhost:3000/health`
- Create order (idempotent on `orderId`):
```
curl -X POST http://localhost:3000/orders \
  -H "Content-Type: application/json" \
  -d '{"orderId":"SHOE-001","customer":"Alice","total":199.99}'
```
- Fetch by orderId:
```
curl http://localhost:3000/orders/SHOE-001
```
Expected flow: POST returns `PENDING`; worker locks → waits ~2s → updates to `PROCESSED`. Duplicate POST returns the existing record (200).

## Worker behavior
- Polls every `WORKER_POLL_INTERVAL_MS` with small jitter to avoid thundering herd.
- Selects PENDING orders not locked and under `WORKER_MAX_ATTEMPTS`.
- Locks row, simulates processing (`WORKER_PROCESSING_DELAY_MS`), marks `PROCESSED`.
- On failure: increments `attempts`, records `lastError`, releases lock; stops after max attempts.

## Data model
- Order: `id (uuid)`, `orderId (unique)`, `customer`, `total (decimal)`, `status (PENDING|PROCESSED)`, `attempts`, `lockedAt`, `lastError`, `createdAt`.

## Scripts
- `npm run dev` / `npm run start` — API (dev / built).
- `npm run worker` — worker.
- `npm run db:migrate` — apply migrations.
- `npm run db:generate` — regenerate Prisma client.
- `npm run build` — type-check/emit.
- `npm test` — placeholder (Vitest installed).

## Decisions
- Idempotência via unique `orderId` + fallback select on P2002.
- Polling worker (DB-backed) instead of external queue to keep stack minimal for the challenge.
- Pino logging and Swagger for basic observability and contract clarity.

## Troubleshooting
- Prisma engine/SSL: Compose uses debian-based node image to avoid musl/openssl issues.
- Ports: Postgres 5432, API 3000.
