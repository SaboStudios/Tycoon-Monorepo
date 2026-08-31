# CI Improvements — Issues #1512 · #1513 · #1514 · #1515

> Branch: `feat/SW-1512-1515-ci-improvements`

---

## #1512 — Path filters on CI workflows

### Problem
All three CI workflows (backend, frontend, contract) ran on every pull request
regardless of which files changed. A frontend-only PR was paying the cost of the
full contract Rust build, and vice-versa.

### Changes
| File | What changed |
|------|-------------|
| `.github/workflows/backend-ci.yml` | Added `paths:` filter for `backend/**`, `package-lock.json`, `.github/workflows/backend-ci.yml` |
| `.github/workflows/frontend-ci.yml` | Added `paths:` filter for `frontend/**`, `package-lock.json`, `.github/workflows/frontend-ci.yml` |
| `.github/workflows/contract-ci.yml` | Added `paths:` filter for `contract/**`, `.github/workflows/contract-ci.yml` |

### Behaviour after this change
| PR touches | backend CI | frontend CI | contract CI |
|-----------|-----------|------------|------------|
| `backend/` only | ✅ runs | ⏭ skipped | ⏭ skipped |
| `frontend/` only | ⏭ skipped | ✅ runs | ⏭ skipped |
| `contract/` only | ⏭ skipped | ⏭ skipped | ✅ runs |
| Root `package-lock.json` | ✅ runs | ✅ runs | ⏭ skipped |
| `.github/workflows/backend-ci.yml` | ✅ runs | ⏭ skipped | ⏭ skipped |
| Push to `main`/`master` | filtered same way above | — | — |
| `workflow_dispatch` | ✅ always runs | ✅ always runs | ✅ always runs |

### Notes
- `workflow_dispatch:` is kept unconditional so a maintainer can manually
  trigger any workflow at any time.
- The root `package-lock.json` triggers backend and frontend (not contract)
  because Rust/Cargo does not use it.
- Each workflow also re-triggers when its own workflow YAML is changed, so
  updating CI config is self-testing.

---

## #1513 — Dependabot grouped NestJS updates

### Problem
The monorepo has four `package.json` files. Root and `shop-api` are on
NestJS 10; `backend` is on NestJS 11. With no automation, security patches
lag and minor-version drift accumulates indefinitely.

### Changes
| File | What was created |
|------|-----------------|
| `.github/dependabot.yml` | New file — full Dependabot configuration |

### Configuration summary
| Directory | Schedule | Groups | Major NestJS bumps |
|-----------|----------|--------|-------------------|
| `/` (root) | Weekly (Monday) | `nestjs-root` (minor+patch) | **Ignored** — root stays on NestJS 10 |
| `/backend` | Weekly (Monday) | `nestjs-backend`, `typeorm-pg`, `testing-backend` | Allowed (already on 11) |
| `/shop-api` | Weekly (Monday) | `nestjs-shop-api`, `typeorm-pg-shop`, `testing-shop-api` | **Ignored** — shop-api stays on NestJS 10 |
| `/frontend` | Weekly (Monday) | `nextjs-react`, `testing-frontend` | — |
| `github-actions` | Weekly (Monday) | `github-actions-all` | — |

### Why major NestJS bumps are ignored on root/shop-api
Root (`^10`) and shop-api (`^10`) are intentionally pinned to NestJS 10 while
`backend` has migrated to NestJS 11. Allowing auto-PRs for major bumps on
those packages would create confusing noise before the migration is planned.
Remove the `ignore` entries in `dependabot.yml` when you are ready to upgrade.

### What Dependabot will do
- Open one PR per directory per week for grouped dependency updates.
- NestJS packages in each directory will be bumped together (no partial upgrades).
- GitHub Actions pins (`actions/checkout@v4`, etc.) will be kept up to date.

---

## #1514 — OpenAPI ↔ frontend client parity CI job

### Problem
`backend/scripts/generate-openapi.ts` generates `openapi.json`, but there
was no CI gate to catch drift between the spec and the frontend
`client.ts`/`dto.ts`. The specific historical bug: the backend DTO used
`accessToken` (camelCase) while an earlier version returned `access_token`
(snake_case). This mismatch was caught manually.

### Changes
| File | What was created |
|------|-----------------|
| `.github/workflows/openapi-parity.yml` | New workflow — regenerates + checks spec on every relevant PR |
| `backend/scripts/check-openapi-parity.mjs` | New Node.js check script |

### Workflow: `openapi-parity.yml`
**Triggers:** Any change to `backend/src/**`, `generate-openapi.ts`,
`check-openapi-parity.mjs`, `openapi.json`, `client.ts`, or `dto.ts`.

**Steps:**
1. Install backend deps + build NestJS.
2. Run `npm run codegen` to regenerate `openapi.json` from source.
3. `git diff --exit-code openapi.json` — fails if the committed file is stale.
4. Run `node scripts/check-openapi-parity.mjs` — performs semantic checks.
5. Upload `openapi.json` as a workflow artifact (retained 14 days).

**Runtime:** < 10 minutes (builds NestJS reflection layer only; no test suite).

### Check script: `check-openapi-parity.mjs`
Three check groups:

| Check | What it verifies |
|-------|-----------------|
| 1 — required paths | `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout`, `GET /users/me` all exist in spec |
| 2 — camelCase token fields | `/auth/login` and `/auth/refresh` response schemas contain `accessToken` and `refreshToken` (not `access_token`/`refresh_token`) |
| 3 — spec version | `info.version` is present |

### Extending the check
To add a new endpoint to the parity gate, add it to `REQUIRED_PATHS` in
`check-openapi-parity.mjs`:

```js
const REQUIRED_PATHS = [
  ['post', '/auth/login'],
  // add your endpoint here:
  ['get',  '/games'],
];
```

### Running locally
```bash
cd backend
npm run build:openapi   # regenerates openapi.json
node scripts/check-openapi-parity.mjs
```

---

## #1515 — Postgres service on backend CI for integration tests

### Problem
Most backend specs mocked TypeORM via `moduleNameMapper` in `jest.config.ts`.
This was fast but left real-DB behaviour untested on PRs. `redis.integration.spec.ts`
demonstrated the integration-test pattern but was not wired into PR CI.
Privacy e2e and auth-token-security specs need a live Postgres to test
migrations, cascade deletes, and token rotation correctly.

### Changes
| File | What changed |
|------|-------------|
| `.github/workflows/backend-ci.yml` | Split into two jobs: `backend-checks` (unit, lint, build) and `backend-integration` (integration + e2e, real Postgres) |
| `backend/test/jest-integration.json` | New Jest config targeting `*.integration.spec.ts` |
| `backend/package.json` | New `test:integration` script |

### CI job split

#### `backend-checks` (fast, ~10 min)
- Runs lint, admin-guard verification, build, **unit tests** (mocked DB/Redis).
- Only Redis service is spun up (needed for throttler/cache modules).
- Pool-load test excluded (runs nightly via `backend-pool-load-nightly.yml`).

#### `backend-integration` (real DB, ~20 min)
- Depends on `backend-checks` (runs only if lint/build pass).
- Postgres 16 + Redis 7 services.
- Runs migrations and verifies no pending migrations remain.
- Runs `test:integration` → all `*.integration.spec.ts` files.
- Runs `test:e2e` → all `*.e2e-spec.ts` files (pool-load excluded).

### Writing integration specs
Tag a spec as an integration test by following the naming convention:

```
test/my-feature.integration.spec.ts
```

The `jest-integration.json` config matches `.*\.integration\.spec\.ts$` and
sets `testTimeout: 30000` (30 s) to accommodate real DB round-trips.

**Do not** add `@group integration` annotations or Jest project config — the
filename convention is sufficient and keeps things simple.

### Environment variables available in integration job
| Variable | Value |
|----------|-------|
| `DB_HOST` | `localhost` |
| `DB_PORT` | `5432` |
| `DB_USERNAME` | `postgres` |
| `DB_PASSWORD` | `postgres` |
| `DB_DATABASE` | `tycoon_test` |
| `DB_SYNCHRONIZE` | `false` (migrations only) |
| `REDIS_HOST` | `localhost` |
| `REDIS_PORT` | `6379` |
| `JWT_SECRET` | `ci-only-jwt-secret` |
| `NODE_ENV` | `test` |

### Flake triage
If an integration spec flakes in CI:
1. Check the artifact upload from the failing run (`backend-integration-diagnostics`).
2. Isolate with `npm run test:integration -- --testNamePattern="<describe block>"`.
3. If the spec has ordering dependencies, ensure it uses `beforeAll`/`afterAll`
   to set up and tear down its own data rather than relying on migration state.

---

## Summary of all files changed

```
.github/
  dependabot.yml                          (new — #1513)
  workflows/
    backend-ci.yml                        (modified — #1512, #1515)
    frontend-ci.yml                       (modified — #1512)
    contract-ci.yml                       (modified — #1512)
    openapi-parity.yml                    (new — #1514)
backend/
  package.json                            (modified — #1515, added test:integration)
  scripts/
    check-openapi-parity.mjs              (new — #1514)
  test/
    jest-integration.json                 (new — #1515)
```
