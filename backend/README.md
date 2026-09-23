# Tycoon Backend

NestJS 11 API for Tycoon. This service is the source of truth for money, dice,
inventory, and admin mutations. The NEAR wallet is the only supported chain UI
per ADR-003 until Stellar is gated ready.

## Requirements

- Node.js 20+
- pnpm (see root `package.json` for the pinned version)
- Postgres 15+ and Redis 7+ for local development

## Setup

```bash
pnpm install
cp .env.example .env   # fill in real values; never commit secrets
pnpm run start:dev
```

## Test database

`scripts/seed-test-db.sh` prepares a disposable database for local and CI runs.
It is **fail-closed**: it refuses to run when required environment variables are
missing and exits non-zero when a dependency (Postgres/Redis) is unreachable.

Required environment variables (no silent defaults):

- `DATABASE_URL` — Postgres connection string for the test database
- `REDIS_URL` — Redis connection string used by the test suite

Optional:

- `SEED_RESET` — set to `1` to drop and recreate the test schema before seeding

```bash
DATABASE_URL=postgres://user:pass@localhost:5432/tycoon_test \
REDIS_URL=redis://localhost:6379 \
  ./scripts/seed-test-db.sh
```

If a port is already in use or a service is already running, the script detects
it and reports the conflict instead of silently reusing or overwriting state.

## Smoke tests

`scripts/smoke-test.sh` exercises the running API end to end. It is also
fail-closed: missing `API_BASE_URL` or an unreachable API/Postgres/Redis causes a
non-zero exit with a clear message, so CI and local runs behave identically.

Required environment variables:

- `API_BASE_URL` — base URL of the API under test (e.g. `http://localhost:3000`)
- `DATABASE_URL` — Postgres connection string used for readiness checks
- `REDIS_URL` — Redis connection string used for readiness checks

```bash
API_BASE_URL=http://localhost:3000 \
DATABASE_URL=postgres://user:pass@localhost:5432/tycoon_test \
REDIS_URL=redis://localhost:6379 \
  ./scripts/smoke-test.sh
```

Exit codes:

- `0` — all checks passed
- `1` — a check failed (API returned an unexpected response)
- `2` — misconfiguration (missing env var)
- `3` — dependency outage (Postgres/Redis/API unreachable)
- `4` — port conflict or service already running

See `test/README.md` for the full test strategy and CI parity notes.

## Scripts

| Script | Purpose |
| --- | --- |
| `scripts/seed-test-db.sh` | Prepare and seed the disposable test database |
| `scripts/smoke-test.sh` | End-to-end smoke checks against a running API |

## Security

- The server remains the source of truth for money, dice, inventory, and admin
  mutations; clients never compute authoritative results.
- Do not commit secrets. Redact tokens in logs and avoid PII in telemetry labels.
- Report vulnerabilities per `SECURITY.md` at the repository root.
