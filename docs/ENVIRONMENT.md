# Environment Variables

This document is the canonical reference for every environment variable across the four
packages in this monorepo. Copy the relevant `.env.example` file in each package,
rename it `.env`, and fill in the required values.

> **Security rule:** Never commit a real `.env` file. Variables marked **Secret** must
> never appear in client-side bundles. `NEXT_PUBLIC_*` variables are embedded in the
> Next.js bundle and visible to end users — never put secrets there.

---

## Quick links

| Package | Example file | Joi validation |
|---|---|---|
| Root | [`.env.example`](../.env.example) | — |
| Backend | [`backend/.env.example`](../backend/.env.example) | `backend/src/config/` |
| Frontend | [`frontend/.env.example`](../frontend/.env.example) | Next.js build-time type narrowing |
| Shop API | [`shop-api/.env.example`](../shop-api/.env.example) | TypeORM `data-source.ts` |

---

## Root (`.env.example`)

Used by the top-level `docker-compose` and any tooling that bootstraps the whole stack.

| Variable | Required in prod | Default | Secret | Notes |
|---|---|---|---|---|
| `DB_HOST` | ✅ | `localhost` | | PostgreSQL host |
| `DB_PORT` | | `5432` | | PostgreSQL port |
| `DB_USERNAME` | ✅ | `postgres` | | DB username |
| `DB_PASSWORD` | ✅ | `postgres` | ✅ | DB password |
| `DB_NAME` | ✅ | `admin_user_db` | | Database name |
| `JWT_SECRET` | ✅ | *(must change)* | ✅ | Signing key for JWTs — minimum 32 chars in prod |

---

## Backend (`backend/.env.example`)

NestJS API server. Run from `backend/`.

### App

| Variable | Required in prod | Default | Secret | Notes |
|---|---|---|---|---|
| `NODE_ENV` | ✅ | `development` | | `development` \| `staging` \| `production` \| `test` |
| `PORT` | | `3000` | | HTTP listen port |
| `API_PREFIX` | | `api` | | URL base prefix |
| `API_DEFAULT_VERSION` | | `1` | | Default URI version segment |
| `API_ENABLE_LEGACY_UNVERSIONED` | | `true` | | Enable `/api/*` → `/api/v1/*` rewrite |
| `API_LEGACY_UNVERSIONED_SUNSET` | | *(empty)* | | ISO date for `Sunset` header on legacy routes |
| `ENABLE_SWAGGER` | | `false` | | Set `true` only in non-prod |

### Database

| Variable | Required in prod | Default | Secret | Notes |
|---|---|---|---|---|
| `DB_HOST` | ✅ | `localhost` | | PostgreSQL host |
| `DB_PORT` | | `5432` | | PostgreSQL port |
| `DB_USERNAME` | ✅ | `postgres` | | DB username |
| `DB_PASSWORD` | ✅ | `postgres` | ✅ | DB password |
| `DB_DATABASE` | ✅ | `tycoon_db` | | Database name |
| `DB_SYNCHRONIZE` | | `false` | | **Never `true` in production** — use migrations |
| `DB_LOGGING` | | `false` | | Enable TypeORM query logging |
| `DB_POOL_SIZE` | | `5` (local) / `20` (RDS) | | Max open connections per instance |
| `DB_POOL_IDLE_TIMEOUT_MS` | | `10000` (local) / `30000` (RDS) | | Idle connection close timeout |
| `DB_STATEMENT_TIMEOUT_MS` | | `0` (local) / `30000` (RDS) | | Max statement duration; 0 = disabled |
| `DB_CONNECT_TIMEOUT_MS` | | `5000` | | Pool connection wait timeout |

### Auth / JWT

| Variable | Required in prod | Default | Secret | Notes |
|---|---|---|---|---|
| `JWT_SECRET` | ✅ | *(must change)* | ✅ | Signing secret — minimum 32 chars |
| `JWT_EXPIRATION_TIME` | | `1d` | | Access token lifetime (legacy field) |
| `JWT_EXPIRES_IN` | | `15m` | | Access token lifetime |
| `JWT_REFRESH_EXPIRES_IN` | | `7d` | | Refresh token lifetime |
| `JWT_CLOCK_SKEW_SECONDS` | | `60` | | Clock skew tolerance in seconds |

### CORS

| Variable | Required in prod | Default | Secret | Notes |
|---|---|---|---|---|
| `CORS_ALLOWED_ORIGINS` | ✅ | `http://localhost:3000,http://localhost:3001` | | Comma-separated allowed origins |
| `CORS_CREDENTIALS` | | `true` | | Allow credentials; incompatible with `*` origin |
| `CORS_MAX_AGE` | | `86400` | | Preflight cache duration (seconds) |
| `CORS_DEV_WILDCARD` | | `true` | | Allow localhost + `*.local` in development |
| `WS_CORS_ORIGINS` | ✅ (prod) | *(falls back to `CORS_ALLOWED_ORIGINS`)* | | WebSocket allowed origins — no wildcards in prod |

### Redis

| Variable | Required in prod | Default | Secret | Notes |
|---|---|---|---|---|
| `REDIS_HOST` | ✅ | `localhost` | | Redis host |
| `REDIS_PORT` | | `6379` | | Redis port |
| `REDIS_PASSWORD` | | *(empty)* | ✅ | Redis auth password |
| `REDIS_DB` | | `0` | | Redis database index |
| `REDIS_TTL` | | `300` | | Default cache TTL (seconds) |

### Logging & Observability

| Variable | Required in prod | Default | Secret | Notes |
|---|---|---|---|---|
| `LOG_LEVEL` | | `debug` (dev) / `info` (prod) | | `error` \| `warn` \| `info` \| `http` \| `verbose` \| `debug` |
| `LOG_CONSOLE` | | `false` | | Enable stdout logging in production containers |
| `METRICS_ENABLED` | | `true` | | Expose `/metrics` Prometheus endpoint |
| `REQUEST_LOGGING_ENABLED` | | `true` | | Structured HTTP log per request |

### Payments & Webhooks

| Variable | Required in prod | Default | Secret | Notes |
|---|---|---|---|---|
| `PAYMENT_WEBHOOK_SECRET` | ✅ | *(empty)* | ✅ | Webhook signature secret — minimum 16 chars |
| `PAYMENT_PROVIDER` | | `stub` | | `stripe` \| `stub` — use `stripe` in prod |
| `STRIPE_SECRET_KEY` | ✅ (if stripe) | *(empty)* | ✅ | Restricted Stripe key with read-only PaymentIntent access |
| `RECONCILIATION_DRY_RUN` | | `false` | | Force dry-run regardless of `NODE_ENV` |

### Data Export (Privacy)

| Variable | Required in prod | Default | Secret | Notes |
|---|---|---|---|---|
| `DATA_EXPORT_DIR` | | `./storage/data-exports` | | Path for GDPR data export files |
| `DATA_EXPORT_TTL_HOURS` | | `24` | | Hours before export files are purged |

### Graceful Shutdown

| Variable | Required in prod | Default | Secret | Notes |
|---|---|---|---|---|
| `SHUTDOWN_TIMEOUT_MS` | | `15000` | | Must be < Kubernetes `terminationGracePeriodSeconds × 1000` |

### Game Defaults

| Variable | Required in prod | Default | Secret | Notes |
|---|---|---|---|---|
| `DEFAULT_AUCTION` | | `true` | | Enable auction rule by default |
| `DEFAULT_RENT_IN_PRISON` | | `false` | | Collect rent while in prison |
| `DEFAULT_MORTGAGE` | | `true` | | Enable mortgage rule |
| `DEFAULT_EVEN_BUILD` | | `true` | | Enforce even-build rule |
| `DEFAULT_RANDOMIZE_PLAY_ORDER` | | `true` | | Randomize turn order at game start |
| `DEFAULT_STARTING_CASH` | | `1500` | | Starting cash per player |

### Audit

| Variable | Required in prod | Default | Secret | Notes |
|---|---|---|---|---|
| `GAMES_AUDIT_ENABLED` | | `true` | | Enable audit logging for game operations |
| `GAMES_AUDIT_LOG_LEVEL` | | `info` | | `debug` \| `info` \| `warn` \| `error` |
| `GAMES_AUDIT_REDACT_SENSITIVE` | | `true` | | Redact passwords, tokens, wallets, emails, IPs in logs |
| `GAMES_AUDIT_LOG_VIEWS` | | `false` | | Log read-only operations (high volume — enable only for compliance) |
| `GAMES_AUDIT_ASYNC_TIMEOUT_MS` | | `5000` | | Timeout for async audit operations |
| `CACHE_AUDIT_ENABLED` | | `false` | | Log Redis cache set/delete/invalidate operations |
| `UPLOADS_OBSERVABILITY_ENABLED` | | `true` | | Track upload operation metrics |

### Uploads & Storage

| Variable | Required in prod | Default | Secret | Notes |
|---|---|---|---|---|
| `UPLOAD_MAX_FILE_SIZE_MB` | | `5` | | Maximum upload file size |
| `UPLOAD_ALLOWED_MIME_TYPES` | | `image/jpeg,image/png,image/webp` | | Comma-separated allowed MIME types |
| `UPLOAD_DIR` | | `./storage/uploads` | | Local upload directory (ignored if S3 configured) |
| `AWS_S3_BUCKET` | ✅ (if S3) | *(empty)* | | S3 bucket name |
| `AWS_REGION` | | `us-east-1` | | AWS region |
| `AWS_S3_ENDPOINT` | | *(empty)* | | Custom S3 endpoint (e.g. LocalStack) |
| `CLAMAV_HOST` | ✅ (recommended) | *(empty)* | | ClamAV host — scanning skipped when unset |
| `CLAMAV_PORT` | | `3310` | | ClamAV port |

### Email

| Variable | Required in prod | Default | Secret | Notes |
|---|---|---|---|---|
| `EMAIL_PROVIDER` | ✅ | `noop` | | `noop` (dev) \| `sendgrid` \| `ses` |
| `SENDGRID_API_KEY` | ✅ (if sendgrid) | *(empty)* | ✅ | SendGrid API key |
| `SENDGRID_FROM_EMAIL` | ✅ (if sendgrid) | *(empty)* | | Sender address |

---

## Frontend (`frontend/.env.example`)

Next.js app. `NEXT_PUBLIC_*` variables are **embedded in the browser bundle** — never put secrets here.

| Variable | Required in prod | Default | Secret | Notes |
|---|---|---|---|---|
| `NEXT_PUBLIC_NEAR_NETWORK` | | `testnet` | | NEAR network: `testnet` \| `mainnet` |
| `NEXT_PUBLIC_NEAR_CONTRACT_ID` | | `guest-book.testnet` | | NEAR contract ID for wallet sign-in |
| `NEXT_PUBLIC_WALLET_NETWORK_LABEL` | | `NEAR` | | Display label for the wallet chain in UI copy |
| `NEXT_PUBLIC_ENABLE_BOOSTS_SOCKET` | | `true` | | Enable live perks/boosts Socket.IO connection |
| `NEXT_PUBLIC_SOCKET_URL` | | *(falls back to `NEXT_PUBLIC_API_URL`)* | | Override for the Socket.IO endpoint |
| `NEXT_PUBLIC_API_URL` | ✅ (prod) | *(empty)* | | Base URL of the backend API |
| `NEXT_PUBLIC_API_MOCKING` | | `disabled` | | Set `enabled` to force MSW in the browser |
| `PORT` | | `3000` | | Dev server port |
| `NODE_ENV` | | `development` | | `development` \| `production` |

---

## Shop API (`shop-api/.env.example`)

Standalone NestJS microservice. Run from `shop-api/`.

| Variable | Required in prod | Default | Secret | Notes |
|---|---|---|---|---|
| `NODE_ENV` | ✅ | `development` | | `development` \| `production` |
| `PORT` | | `3000` | | HTTP listen port |
| `DB_HOST` | ✅ | `localhost` | | PostgreSQL host |
| `DB_PORT` | | `5432` | | PostgreSQL port |
| `DB_USER` | ✅ | `postgres` | | DB username |
| `DB_PASSWORD` | ✅ | `changeme` | ✅ | DB password |
| `DB_NAME` | ✅ | `shop` | | Database name |

---

## Port Matrix

Default ports when all services run locally side by side:

| Service | Port | Variable |
|---|---|---|
| Backend (NestJS API) | `3000` | `PORT` in `backend/.env` |
| Frontend (Next.js) | `3001` | `PORT` in `frontend/.env` (set explicitly to avoid clash) |
| Shop API | `3000` | `PORT` in `shop-api/.env` (use `3002` locally to avoid clash) |
| PostgreSQL (backend) | `5432` | `DB_PORT` |
| PostgreSQL (shop-api) | `5433` | `DB_PORT` (use a second instance or schema) |
| Redis | `6379` | `REDIS_PORT` |
| ClamAV | `3310` | `CLAMAV_PORT` |

> Tip: When running all services locally, set the frontend's `NEXT_PUBLIC_API_URL=http://localhost:3000`
> and the shop-api `PORT=3002` to avoid port collisions.

---

## Production Required Summary

The following variables have **no safe default** and will cause data loss, security issues,
or silent failures if left unset in production:

| Variable | Package | Risk if missing |
|---|---|---|
| `JWT_SECRET` | root, backend | All tokens are signed with a weak/shared key |
| `DB_PASSWORD` | root, backend, shop-api | Default password in production |
| `PAYMENT_WEBHOOK_SECRET` | backend | Webhook requests not verified — replay attacks possible |
| `STRIPE_SECRET_KEY` | backend | Ledger reconciliation broken if `PAYMENT_PROVIDER=stripe` |
| `CORS_ALLOWED_ORIGINS` | backend | CORS policy may block legitimate clients or be too permissive |
| `WS_CORS_ORIGINS` | backend | WebSocket connections may be rejected or open to all origins |
| `CLAMAV_HOST` | backend | Uploaded files not scanned for malware |
| `EMAIL_PROVIDER` | backend | Transactional emails silently dropped (`noop` default) |
| `NEXT_PUBLIC_API_URL` | frontend | All API calls fail |
| `DB_PASSWORD` | shop-api | Default password in production |
