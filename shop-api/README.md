# shop-api

Shop Purchases API with idempotency and replay protection.

## Running locally

```bash
npm install
npm run migration:run   # create the schema — synchronize is disabled outside tests
npm run start:dev
```

> TypeORM `synchronize` is **only** enabled in the Jest test environment
> (`NODE_ENV=test`, in-memory SQLite). Staging, production, and local
> development use migrations (`npm run migration:run`). The app refuses to boot
> if `DB_SYNCHRONIZE=true` is forced in a staging environment.

## Configuration

See `.env.example`:

| Variable         | Description |
|------------------|-------------|
| `PORT`           | HTTP port (default `3000`) |
| `NODE_ENV`       | `development` / `test` / `staging` / `production` |
| `DB_HOST` …      | PostgreSQL connection settings |
| `SHOP_API_KEY`   | API key for `POST /purchases` — clients send it as `x-api-key` |
| `JWT_SECRET`     | Secret that enables Bearer JWT auth for `POST /purchases` |
| `ENABLE_SWAGGER` | `true` forces Swagger on in production (default: on outside production) |

**Key rotation** — rotate `SHOP_API_KEY` by setting a new value in the
environment and redeploying. Keys/tokens are never logged.

## Endpoints

| Method | Path                | Auth              | Description |
|--------|---------------------|-------------------|-------------|
| GET    | `/health`           | —                 | Liveness: 200 while the process is up |
| GET    | `/ready`            | —                 | Readiness: 200 when Postgres answers `SELECT 1`, 503 otherwise |
| POST   | `/purchases`        | `x-api-key` **or** Bearer JWT | Create a purchase (requires `Idempotency-Key` header) |
| GET    | `/purchases/:id`    | —                 | Public read of a single purchase |
| GET    | `/docs`             | —                 | Swagger UI (non-production by default) |

Readiness responses contain no connection strings, credentials, or PII.

## Migrations

```bash
npm run migration:run     # apply pending migrations
npm run migration:revert  # revert the last migration
```

## Tests

```bash
npm test   # in-memory SQLite — no Postgres needed
```
