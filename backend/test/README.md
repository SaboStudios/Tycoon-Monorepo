# Backend Tests

## SQLite vs Postgres

Production runs on **Postgres** (`src/config/database.config.ts`). Most
unit/e2e specs use **`better-sqlite3`** (`:memory:`, `synchronize: true`) for
speed and zero setup — see `auth-token-security.e2e-spec.ts`,
`admin-role-verification.e2e-spec.ts`, `observability.e2e-spec.ts`.

SQLite is a close-enough stand-in for schema/CRUD coverage, but it diverges
from Postgres in ways that can hide bugs or fail outright:

- **`ILIKE`** is Postgres-only. Any suite exercising case-insensitive search
  (e.g. `waitlist.service`, `uploads.service`, `PaginationService`) needs a
  real Postgres connection — these are covered by `*.service.spec.ts` unit
  tests with a mocked repository/query builder instead of an e2e/sqlite DB.
- **`jsonb` columns** (`AuditTrail`, `Upload`, `Perk`, webhook/ledger
  entities) fall back to text storage under sqlite. Basic read/write works,
  but Postgres JSON operators (`->`, `->>`, `@>`) and GIN indexes are not
  exercised.
- **Arrays, `EXTRACT()`, `gen_random_uuid()`** and other Postgres-specific
  SQL are not supported by sqlite.

**Rule of thumb:** if a suite builds raw SQL/QueryBuilder fragments or relies
on Postgres-only column types, run it against real Postgres
(`docker-compose.yml` / `docker-compose.ci.yml`) rather than sqlite.

## Smoke test & test DB seeding (CI/local parity)

`scripts/smoke-test.sh` and `scripts/seed-test-db.sh` are the shared entry
points used by both CI and local runs. They are **fail-closed**: they never
fall back to implicit defaults for connection details or credentials, and
they exit non-zero when a required dependency is missing or unreachable.

### Required environment

Both scripts require these variables to be set explicitly. There are no
built-in defaults — a missing value aborts the run before any network or DB
work happens.

| Variable | Used by | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | both | Postgres connection string (must be `postgres://` / `postgresql://`) |
| `API_BASE_URL` | smoke-test | Base URL of the running backend (e.g. `http://localhost:3000`) |
| `REDIS_URL` | smoke-test | Redis connection string used by the readiness probe |

Optional, with safe non-secret defaults:

| Variable | Default | Purpose |
| --- | --- | --- |
| `SMOKE_TIMEOUT_SECONDS` | `5` | Per-request timeout for HTTP probes |
| `SMOKE_RETRIES` | `3` | Retry attempts for transient dependency failures |
| `SEED_RESET` | `false` | When `true`, truncates seed tables before inserting |

### Running locally

```bash
# 1. Start dependencies (Postgres + Redis) and the API
docker compose up -d postgres redis
npm run start:dev &

# 2. Export the required variables (no defaults are applied)
export DATABASE_URL="postgres://tycoon:tycoon@localhost:5432/tycoon"
export API_BASE_URL="http://localhost:3000"
export REDIS_URL="redis://localhost:6379"

# 3. Seed the test database, then run the smoke test
./scripts/seed-test-db.sh
./scripts/smoke-test.sh
```

### Running in CI

CI exports the same variables from job-level secrets/services before invoking
the scripts, so the local and CI paths exercise identical logic. Fork PRs that
cannot access secrets will fail closed with a clear message rather than
silently skipping checks.

### Failure modes

- **Missing env** — the script prints the missing variable name(s) and exits
  `2` before touching the network or database.
- **Dependency outage** — Postgres, Redis, or the API being unreachable is
  reported with the failing dependency and exits non-zero (no partial
  success).
- **Port conflict / already-running service** — the scripts detect an
  occupied port or an already-listening service and exit non-zero with the
  conflicting port, instead of racing or reusing an unknown process.
- **Idempotency** — re-running `seed-test-db.sh` is safe; set `SEED_RESET=true`
  to force a clean truncate-and-reseed.

### Rollback / order of operations

1. Stop the API and any locally started dependencies.
2. Re-run `./scripts/seed-test-db.sh` with `SEED_RESET=true` to restore a known
   baseline.
3. Re-run `./scripts/smoke-test.sh` to confirm parity before resuming work.
