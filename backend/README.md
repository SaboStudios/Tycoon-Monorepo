# Tycoon Backend

NestJS 10 · TypeScript · TypeORM · PostgreSQL · Redis

Production-grade REST + WebSocket API for the Tycoon gaming platform. Runs on
**port 3000** (`http://localhost:3000`). API routes are versioned under
`/api/v1/*`.

---

## Quick start

```bash
cd backend

# 1. Install dependencies
npm install

# 2. Copy and edit env
cp .env.example .env

# 3. Start database (Docker — recommended)
docker-compose up -d

# 4. Apply migrations
npm run migration:run

# 5. Start in dev mode (hot-reload)
npm run start:dev
```

API: `http://localhost:3000/api/v1`  
pgAdmin: `http://localhost:5050` (admin@tycoon.com / admin)  
Metrics: `http://localhost:3000/metrics` (Prometheus)  
Health: `http://localhost:3000/health`

---

## Project structure

```
backend/
├── src/
│   ├── app.module.ts              # Root module — wires all feature modules
│   ├── main.ts                    # Bootstrap (port, versioning, CORS, shutdown)
│   ├── config/                    # app.config.ts, database.config.ts
│   ├── common/                    # Guards, interceptors, pipes, decorators, filters
│   ├── health/                    # /health endpoint (Terminus)
│   ├── observability/             # Prometheus middleware wiring
│   ├── database/
│   │   ├── migrations/            # Versioned TypeORM migrations (run in order)
│   │   └── seeds/                 # Idempotent seed scripts (board tiles, games)
│   └── modules/                   # 30 feature modules (see below)
├── docs/                          # Runbooks, ADRs, security guides
├── test/                          # E2E and integration tests
├── scripts/                       # smoke-test.sh, seed-test-db.sh, verify-admin-guards
├── k8s/                           # Kubernetes deployment manifests
├── grafana/dashboards/            # Prometheus/Grafana dashboard JSON
├── docker-compose.yml
└── .env.example
```

---

## Module tree

All 30 feature modules live in `src/modules/`:

| Module | Path | What it does |
|--------|------|--------------|
| **admin-analytics** | `src/modules/admin-analytics/` | Aggregated metrics and analytics for admin dashboards. [README](src/modules/admin-analytics/README.md) · [Architecture](src/modules/admin-analytics/ARCHITECTURE.md) |
| **admin-logs** | `src/modules/admin-logs/` | Admin action log — stores and queries operator audit entries |
| **audit-trail** | `src/modules/audit-trail/` | Cross-module audit interceptor; writes structured events for compliance |
| **auth** | `src/modules/auth/` | JWT authentication, refresh tokens, admin auth controller. [Runbook](docs/AUTH_JWT_RUNBOOK.md) |
| **board-styles** | `src/modules/board-styles/` | Manages visual board skin catalog and user-selected styles |
| **chance** | `src/modules/chance/` | Chance card deck — draw, apply, and observe card effects |
| **community-chest** | `src/modules/community-chest/` | Community Chest card deck with observability and DTO validation |
| **coupons** | `src/modules/coupons/` | Coupon creation, validation, usage tracking, and idempotency |
| **email** | `src/modules/email/` | Transactional email via Bull queue processor and provider abstraction |
| **fetch-notification** | `src/modules/fetch-notification/` | Long-poll / server-sent notification delivery for in-game events |
| **games** | `src/modules/games/` | Core game lifecycle: create, join, start, rounds, WebSocket gateway. [Matchmaking runbook](docs/GAMES_MATCHMAKING_RUNBOOK.md) |
| **gifts** | `src/modules/gifts/` | Player-to-player gift sending with security and rate-limit guards. [README](src/modules/gifts/README.md) |
| **jobs** | `src/modules/jobs/` | Background job processors (Bull); metrics for queue depth and throughput |
| **ledger-reconciliation** | `src/modules/ledger-reconciliation/` | Scheduled reconciliation of internal ledger vs transaction records. [Runbook](docs/LEDGER_RECONCILIATION_RUNBOOK.md) |
| **metrics** | `src/modules/metrics/` | Prometheus HTTP metrics middleware (`tycoon_http_requests_total`, `tycoon_http_request_duration_seconds`) |
| **monetization** | `src/modules/monetization/` | Reward distribution, coupon webhooks, and payment event routing |
| **mux-protocol** | `src/modules/mux-protocol/` | Multiplexes WebSocket message frames; audit service for protocol events |
| **near** | `src/modules/near/` | NEAR Protocol integration — wallet validation and on-chain calls |
| **perks** | `src/modules/perks/` | Player perk catalog — CRUD, admin management, user entitlement |
| **perks-boosts** | `src/modules/perks-boosts/` | Active boost lifecycle: apply, expire, WebSocket gateway for real-time updates |
| **privacy** | `src/modules/privacy/` | GDPR data export (async job + download) and erasure flows |
| **properties** | `src/modules/properties/` | Board property catalog — seeding, pricing, ownership helpers |
| **redis** | `src/modules/redis/` | Redis cache service, validated cache, idempotency interceptor. [Runbook](docs/REDIS_CACHE_RUNBOOK.md) |
| **shop** | `src/modules/shop/` | Client-facing shop: item catalog, purchase endpoint, inventory, cache invalidation. [Runbook](docs/SHOP_PURCHASES_RUNBOOK.md) · [ADR-001](docs/ADR-001-shop-purchase-ownership.md) |
| **skins** | `src/modules/skins/` | Player avatar / board skin ownership and assignment |
| **tour-analytics** | `src/modules/tour-analytics/` | Tracks onboarding tour steps and completion rates |
| **uploads** | `src/modules/uploads/` | File upload pipeline: virus scan, validation, storage, observability |
| **users** | `src/modules/users/` | User accounts, preferences, suspension, admin management |
| **waitlist** | `src/modules/waitlist/` | Pre-launch waitlist — sign-up, admin management, bulk import |
| **webhooks** | `src/modules/webhooks/` | Outbound webhook dispatch, retries, audit, observability. [Runbook](docs/webhooks-runbook.md) |

---

## API versioning & deprecation

- **Stable path**: `/api/v1/*`
- **Compat path**: `/api/*` (routes to v1, returns `Deprecation: true` header)
- **Sunset**: set `API_LEGACY_UNVERSIONED_SUNSET` (ISO date) to emit an RFC `Sunset` header
- **Breaking changes**: bump to a new major version (`/api/v2/*`); `v1` stays stable until announced window closes
- **New clients**: always use versioned paths

---

## Observability (Prometheus + Grafana)

- **Scrape**: `GET /metrics` (not under `/api` prefix)
- **Series**:
  - `tycoon_http_requests_total` — labels `method`, `route_group` (`admin` | `public` | `internal`), `status_class`
  - `tycoon_http_request_duration_seconds` — histogram; `admin` and `public` only
- **Grafana**: import `grafana/dashboards/tycoon-http-overview.json`

---

## Database management

Schema changes are **migrations-only** in production. `DB_SYNCHRONIZE` is
ignored when `NODE_ENV=production` or `NODE_ENV=provision`.

| Command | Purpose |
|---------|---------|
| `npm run migration:generate -- src/database/migrations/Name` | Generate migration from entity drift (dev only) |
| `npm run migration:run` | Apply all pending migrations |
| `npm run migration:show` | List pending vs applied |
| `npm run migration:revert` | Roll back the last applied migration |

### Fresh database setup

```bash
# 1. Create database
psql -U postgres -c "CREATE DATABASE tycoon_db;"

# 2. Set DB_SYNCHRONIZE=false in .env

# 3. Run migrations
npm run migration:run

# 4. (optional) Seed board tiles
npm run seed -- src/database/seeds/seed-board-tiles.ts
```

### Rollback policy

Prefer forward-fix migrations. For incidents: `npm run migration:revert` (one
step at a time). Restore from backup if multiple steps are needed. Test `down`
methods in staging before applying in production.

---

## Testing

```bash
npm run test          # unit tests
npm run test:e2e      # end-to-end (requires running Postgres + Redis)
npm run test:cov      # coverage report
```

E2E tests spin up the full NestJS app. See `test/README.md` for the integration
DB helper and env requirements.

---

## Available scripts

| Script | Description |
|--------|-------------|
| `npm run start:dev` | Dev mode with hot-reload |
| `npm run start:debug` | Debug mode |
| `npm run start:prod` | Production mode (requires `npm run build` first) |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm run lint` | ESLint |
| `npm run format` | Prettier |
| `npm run migration:run` | Apply pending migrations |
| `npm run migration:generate` | Generate migration from entity diff |
| `npm run migration:revert` | Revert last migration |
| `npm run migration:show` | List migration status |

---

## Key environment variables

| Variable | Default | Notes |
|----------|---------|-------|
| `NODE_ENV` | `development` | `production` / `provision` disables DB_SYNCHRONIZE |
| `PORT` | `3000` | API listen port |
| `API_PREFIX` | `api` | URL prefix |
| `API_DEFAULT_VERSION` | `1` | URI version segment |
| `API_ENABLE_LEGACY_UNVERSIONED` | `true` | Enable `/api/*` compat route |
| `API_LEGACY_UNVERSIONED_SUNSET` | — | ISO date for Sunset header |
| `DB_HOST` | `localhost` | |
| `DB_PORT` | `5432` | |
| `DB_USERNAME` | `postgres` | |
| `DB_PASSWORD` | `postgres` | |
| `DB_DATABASE` | `tycoon_db` | |
| `DB_SYNCHRONIZE` | `false` | Never `true` in prod |
| `REDIS_HOST` | `localhost` | |
| `REDIS_PORT` | `6379` | |
| `JWT_SECRET` | — | Required |
| `JWT_EXPIRATION` | `1d` | |
| `CORS_ORIGIN` | `http://localhost:3000` | |
| `SHOP_API_URL` | — | URL of the shop-api microservice (see ADR-001) |
| `SHOP_PURCHASES_BACKEND_PROXY_ENABLED` | `false` | Feature flag: proxy purchase writes to shop-api |

Full list in `.env.example`.

---

## Documentation index

| Doc | Location |
|-----|----------|
| Auth & JWT runbook | [`docs/AUTH_JWT_RUNBOOK.md`](docs/AUTH_JWT_RUNBOOK.md) |
| Shop purchases runbook | [`docs/SHOP_PURCHASES_RUNBOOK.md`](docs/SHOP_PURCHASES_RUNBOOK.md) |
| Shop architecture (ADR-001) | [`docs/ADR-001-shop-purchase-ownership.md`](docs/ADR-001-shop-purchase-ownership.md) |
| Shop architecture overview | [`../docs/SHOP_ARCHITECTURE.md`](../docs/SHOP_ARCHITECTURE.md) |
| Redis cache runbook | [`docs/REDIS_CACHE_RUNBOOK.md`](docs/REDIS_CACHE_RUNBOOK.md) |
| Redis idempotency tests | [`docs/SW-BE-033-redis-idempotency-replay-tests.md`](docs/SW-BE-033-redis-idempotency-replay-tests.md) |
| Ledger reconciliation runbook | [`docs/LEDGER_RECONCILIATION_RUNBOOK.md`](docs/LEDGER_RECONCILIATION_RUNBOOK.md) |
| Games matchmaking runbook | [`docs/GAMES_MATCHMAKING_RUNBOOK.md`](docs/GAMES_MATCHMAKING_RUNBOOK.md) |
| Webhooks runbook | [`docs/webhooks-runbook.md`](docs/webhooks-runbook.md) |
| Graceful shutdown | [`docs/GRACEFUL_SHUTDOWN.md`](docs/GRACEFUL_SHUTDOWN.md) |
| Database pool | [`docs/DATABASE_POOL.md`](docs/DATABASE_POOL.md) |
| Token refresh security | [`docs/TOKEN_REFRESH_SECURITY_GUIDE.md`](docs/TOKEN_REFRESH_SECURITY_GUIDE.md) |
| CORS security guide | [`docs/CORS_SECURITY_GUIDE.md`](docs/CORS_SECURITY_GUIDE.md) |
| Admin routes matrix | [`docs/ADMIN_ROUTES_MATRIX.md`](docs/ADMIN_ROUTES_MATRIX.md) |
| Adding admin capabilities | [`docs/ADDING_ADMIN_CAPABILITIES.md`](docs/ADDING_ADMIN_CAPABILITIES.md) |
| Observability (SW-BE-025) | [`docs/SW-BE-025-observability.md`](docs/SW-BE-025-observability.md) |
| Games ADR-002 (realtime) | [`docs/ADR-002-games-realtime-transport.md`](docs/ADR-002-games-realtime-transport.md) |

---

## Game defaults & idempotency

Default game settings (from `game.config.ts`):

| Setting | Default |
|---------|---------|
| auction | `true` |
| rentInPrison | `false` |
| mortgage | `true` |
| evenBuild | `true` |
| randomizePlayOrder | `true` |
| startingCash | `1500` |

Seeds (`admin-seed.ts`, `game-seed.ts`) are idempotent — safe to run multiple
times. Board tile seeding uses `ON CONFLICT (position) DO UPDATE`.

---

## Support

Backend team: **#team-backend** on Slack.  
For shop microservice issues see [`../shop-api/PR-NOTES.md`](../shop-api/PR-NOTES.md) and [`../docs/SHOP_ARCHITECTURE.md`](../docs/SHOP_ARCHITECTURE.md).
