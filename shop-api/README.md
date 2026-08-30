# shop-api

Shop Purchases microservice (NestJS) with idempotency and replay protection.
See the [root README](../README.md) for how this service fits into the monorepo,
and [ADR-001](../backend/docs/ADR-001-shop-purchase-ownership.md) for the
purchase write-path ownership decision between `backend` and `shop-api`.

## Logging

- All requests get a request ID: the incoming `x-request-id` header is reused
  when present, otherwise a UUID is generated (`RequestIdMiddleware`). The ID
  is echoed back on the response `x-request-id` header and attached to every
  structured log line for that request, so a purchase incident can be traced
  across services (matching the backend's `x-correlation-id` pattern).
- In `NODE_ENV=production`, logs are emitted as single-line JSON
  (`StructuredLoggerService`); outside production they use Nest's readable
  console format for local development.
- Idempotency keys are **never logged in raw form** — `IdempotencyService`
  masks all but the last 4 characters (e.g. `****ab12`) before any log call.

### Example log line (production JSON)

```json
{"timestamp":"2026-08-30T12:00:00.123Z","level":"info","message":"HTTP request completed","context":"HTTP","requestId":"5b1f6e2a-2b7b-4e9a-9b7b-2b7b4e9a9b7b","method":"POST","path":"/purchases","statusCode":201,"durationMs":42}
```

## Running locally

```bash
cd shop-api
npm install
npm run start:dev
```

Or via Docker Compose (see [`docker-compose.yml`](./docker-compose.yml)):

```bash
cd shop-api
docker compose up --build
```

This starts `shop-api` on port `3000` alongside its own PostgreSQL instance,
matching the `DB_*` variables in `.env.example`.

## Idempotency record cleanup

`idempotency_records` rows with `status=COMPLETED` are purged periodically by
a scheduled job — see `IdempotencyCleanupService` in
`src/idempotency/idempotency-cleanup.service.ts`. `PROCESSING` and recent
`FAILED` rows are never purged. Configure the retention window with
`IDEMPOTENCY_TTL_DAYS` (default `7`).

## Tests

```bash
npm test          # all tests (in-memory SQLite, no Postgres needed)
npm run test:cov  # with coverage
```
