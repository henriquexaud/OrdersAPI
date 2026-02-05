# OscarPS Orders API + Worker

API Fastify + Prisma + PostgreSQL com worker de polling leve para processar pedidos de forma assíncrona (contexto e-commerce de calçados). Inclui Swagger UI, Docker Compose, validação via Zod (env e payload), e logs com Pino.

## Como rodar (local)

1. Requisitos: Node 20+, Postgres ativo. Copie variáveis e instale deps:

```
cp .env.example .env
npm install
```

2. Rode migrações (DB precisa estar de pé):

```
npm run db:migrate
```

3. Suba API e worker (dois terminais):

```
npm run dev     # API (Swagger em http://localhost:3000/docs)
npm run worker  # processador de pedidos
```

## Como rodar (Docker)

```
docker compose up -d db
docker compose run --rm api npm run db:migrate
docker compose up -d api worker
```

- API: http://localhost:3000
- Worker usa o mesmo banco e roda automaticamente.

## Uso rápido

- Health: `curl http://localhost:3000/health`
- Criar pedido (idempotente em `orderId`):

```
curl -X POST http://localhost:3000/orders \
  -H "Content-Type: application/json" \
  -d '{"orderId":"SHOE-001","customer":"Alice","total":199.99}'
```

- Buscar por orderId:

```
curl http://localhost:3000/orders/SHOE-001
```

Fluxo esperado: POST retorna `PENDING`; worker aplica lock → simula ~2s → marca `PROCESSED`. POST duplicado devolve o registro existente (200).

## Comportamento do worker

- Polling a cada `WORKER_POLL_INTERVAL_MS` com jitter para evitar rajadas sincronizadas.
- Seleciona pedidos `PENDING` sem lock e com `attempts < WORKER_MAX_ATTEMPTS`.
- Faz lock pessimista (campo `lockedAt`), simula processamento (`WORKER_PROCESSING_DELAY_MS`) e marca `PROCESSED`.
- Em falha: incrementa `attempts`, registra `lastError`, libera lock; para após limite de tentativas.

## Modelo de dados

- Order: `id (uuid)`, `orderId` (unique), `customer`, `total (decimal)`, `status (PENDING|PROCESSED)`, `attempts`, `lockedAt`, `lastError`, `createdAt`.

## Scripts principais

- `npm run dev` / `npm run start` — API (dev / build).
- `npm run worker` — worker dedicado.
- `npm run db:migrate` — aplica migrações.
- `npm run db:generate` — regenera Prisma Client.
- `npm run build` — checa tipos/emite build.
- `npm test` — placeholder (Vitest instalado).

## Decisões técnicas (e por quê)

- Fastify + Pino: performance e logs estruturados de fábrica, bom custo/benefício para API simples.
- Prisma + PostgreSQL: esquema tipado, migrações e client gerado; Postgres já atende consistência e locking necessário para o worker.
- Polling com lock em DB: elimina dependência de fila externa; suficiente para throughput do desafio. Campo `lockedAt` evita corrida entre workers.
- Idempotência em `orderId`: unique constraint + tratamento de P2002 garante evitar duplicidades mesmo sob concorrência.
- Zod no input/env: falha rápida e mensagens claras antes de tocar a camada de dados.
- Swagger: contrato visível e testável via `/docs` sem precisar de cliente dedicado.
- Jitter + backoff no worker: reduz thundering herd e dá tempo de resfriamento em falhas.

## Solução de problemas

- Prisma/SSL em Alpine: imagens Docker usam Node 20 baseado em Debian para evitar erros de OpenSSL/musl.
- Portas: Postgres 5432, API 3000.

## Testes rápidos manuais

1. Criar pedido: `curl -X POST http://localhost:3000/orders -H "Content-Type: application/json" -d '{"orderId":"SHOE-002","customer":"Bob","total":149.9}'`
2. Aguardar ~2s e verificar: `curl http://localhost:3000/orders/SHOE-002`
   - Esperado: status `PROCESSED`, `attempts` zerado.
