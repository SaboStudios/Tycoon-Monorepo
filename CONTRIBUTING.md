# Contributing to Tycoon Monorepo

Thanks for contributing! This guide covers local setup and the workflow we use for pull requests, with a focus on the `frontend/` app.

## Repository layout

- `frontend/` — Next.js app (React 19, TypeScript, Vitest, Storybook)
- `backend/` — NestJS API
- `contract/` — Soroban smart contracts
- `shop-api/` — shop service

## Frontend setup

Requirements: **Node 20** (matches the version pinned in `.github/workflows/frontend-ci.yml` and `.nvmrc`).

If you use [nvm](https://github.com/nvm-sh/nvm), run `nvm use` from the repository root to automatically switch to the correct version:

```bash
nvm use   # reads .nvmrc → switches to Node 20
```

```bash
cd frontend
npm ci --legacy-peer-deps
```

`--legacy-peer-deps` is required — the frontend's dependency tree has peer dependency ranges that `npm`'s default resolver rejects.

Common commands, run from `frontend/`:

```bash
npm run dev             # start the dev server
npm run build            # production build (also type-checks via `next build`)
npm run typecheck        # tsc --noEmit
npm run lint              # eslint
npm test -- --run         # run the Vitest suite once (CI mode)
npm run test:coverage     # Vitest with coverage
npm run test:e2e          # Playwright end-to-end suite (all browsers)
npm run test:e2e:smoke    # Playwright: join-room smoke path only (chromium)
npm run test:e2e:critical # Playwright: critical-journeys only (chromium)
npm run storybook         # Storybook dev server
npm run build-storybook   # static Storybook build
```

Before opening a PR that touches `frontend/`, make sure `npm test -- --run`, `npm run typecheck`, and `npm run build` all pass locally — these are the checks enforced by [Frontend CI](.github/workflows/frontend-ci.yml).

### Continuous integration

[Frontend CI](.github/workflows/frontend-ci.yml) runs three jobs on every PR:

| Job | What it runs | Blocking? |
| --- | --- | --- |
| `frontend-checks` | `npm test -- --run`, `npm run build` | yes |
| `frontend-lint` | `npm run lint` | **advisory** — the existing tree still has violations. New code must not add any ESLint **errors or warnings**; run `npm run lint` before pushing. Once the backlog reaches zero this job flips to blocking. |
| `frontend-e2e` | Playwright: `test:e2e:smoke` (blocking) + `test:e2e:critical` (advisory) | smoke blocks |

The E2E job installs Chromium (`npx playwright install --with-deps chromium`),
boots the app via Playwright's `webServer` with the MSW browser worker forced on
(`NEXT_PUBLIC_API_MOCKING=enabled`), and uploads the HTML report plus
traces/screenshots as artifacts on failure.

To run the E2E suite locally:

```bash
cd frontend
npx playwright install chromium   # first time only
npm run test:e2e:smoke            # or: npm run test:e2e
```

## Shop API setup

Requirements: **Node 20**.

```bash
cd shop-api
npm ci
```

Common commands, run from `shop-api/`:

```bash
npm run start:dev       # start the dev server (default port 3002)
npm run build            # production build
npm test                 # Jest unit + e2e suite (runs with --runInBand)
```

The shop-api runs on **port 3002** by default. It must not be started on
`3000` (frontend dev server) or `3001` (backend API). Local runtime requires
PostgreSQL; the test suite uses an in-memory SQLite database
(`src/test/test-db.module.ts`) and needs no external services or secrets.

From the repo root, `npm run install:all`, `npm run test:all`, and
`npm run dev:all` all include `shop-api/` alongside `backend/` and `frontend/`.

### Continuous integration

[Shop API CI](.github/workflows/shop-api-ci.yml) runs on every PR that touches
`shop-api/**`: Node 20, `npm ci`, `npm run build`, and
`npm test -- --runInBand`. Failures block the PR. No secrets are required.

## Workflow

1. Create a branch off `main`: `feature/<issue-number>-short-description` or `fix/<issue-number>-short-description`.
2. Implement the change, adding or updating tests alongside it.
3. Run the relevant checks for the part of the repo you touched (see above for frontend; `backend/` and `contract/` have their own `npm`/`make` scripts).
4. Commit using [Conventional Commits](https://www.conventionalcommits.org/) (`feat(...)`, `fix(...)`, `docs(...)`, etc.).
5. Open a PR against `main` using the PR template, referencing the issue with `closes #<issue-number>`.

## Shop Purchase Write Path

The shop purchase logic is governed by [ADR-001](backend/docs/ADR-001-shop-purchase-ownership.md), which establishes:

- **Single Write Path:** All purchase writes flow through `shop-api` (`POST /shop-api/purchases`)
- **Backend Proxy:** The backend's `POST /shop/purchase` endpoint proxies to shop-api (details in ADR-001)
- **Idempotency Contract:** All clients must send the `Idempotency-Key` header for purchases (documented in `SHOP_PURCHASES_RUNBOOK.md`)

**When touching purchase code**, verify:
1. No dual-writes (a single purchase request should result in exactly one record in shop-api)
2. The idempotency key is passed through correctly and honored by both endpoints
3. Schema/field mappings between backend DTOs and shop-api requests are documented
4. Audit trails show shop-api as the source of truth

Refer to the runbook for operational procedures and the ADR for architectural decisions.

---

## Picking up your first issue

New to the codebase? Start with issues labeled [`good first issue`](https://github.com/SaboStudios/Tycoon-Monorepo/labels/good%20first%20issue) — these are scoped to a single file or small area. Once you're comfortable with the codebase conventions, move on to [`help wanted`](https://github.com/SaboStudios/Tycoon-Monorepo/labels/help%20wanted) issues, which are larger or touch more of the system. Issues are also labeled by area (`frontend`, `backend`, `contract`) to help you find ones matching your experience.
