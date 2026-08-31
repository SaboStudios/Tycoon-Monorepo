# Contributing to Tycoon Monorepo

Thanks for contributing! This guide covers local setup and the workflow we use for pull requests across the monorepo.

## Repository layout

- `frontend/` — Next.js app (React 19, TypeScript, Vitest, Playwright)
- `backend/` — NestJS API and shared backend services
- `shop-api/` — purchase API and idempotency write path
- `contract/` — Soroban smart contracts and Rust workspace
- `docs/` and `backend/docs/` — shared docs and operational guides

## Required tooling

Use the package manager and runtime versions that are already pinned for each workspace:

Requirements: **Node 20** (matches the version pinned in `.github/workflows/frontend-ci.yml` and `.nvmrc`).

If you use [nvm](https://github.com/nvm-sh/nvm), run `nvm use` from the repository root to automatically switch to the correct version:

```bash
nvm use   # reads .nvmrc → switches to Node 20
```

```bash
cd frontend
npm install --legacy-peer-deps
```

`--legacy-peer-deps` is required because the frontend dependency tree still contains peer ranges that `npm` rejects by default.

Common commands:

```bash
npm run dev             # start Next.js dev server
npm run build           # production build (type-check + bundle)
npm run typecheck      # tsc --noEmit
npm run lint            # ESLint
npm test -- --run       # Vitest once (CI mode)
npm run test:coverage   # vitest coverage
npm run test:e2e        # Playwright E2E suite
npm run test:e2e:smoke  # join-room smoke path
npm run storybook       # Storybook
```

Before opening a PR for frontend work, run the relevant checks locally. Current CI expectations are `npm test -- --run`, `npm run typecheck`, and `npm run build` for the touched app.

## Backend setup

```bash
cd backend
npm install
npm test
```

Useful backend commands:

```bash
npm run build
npm run lint
npm run test:e2e
npm run migration:run
```

## Shop API setup

```bash
cd shop-api
npm install
npm test
```

Useful commands:

```bash
npm run build
npm run start:dev
npm run migration:run
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

1. Create a branch off `main` using a descriptive name: `feature/<issue-number>-short-description` or `fix/<issue-number>-short-description`.
2. Implement the change and add or update tests alongside it.
3. Run the checks relevant to the area you touched.
4. Commit using [Conventional Commits](https://www.conventionalcommits.org/) (`feat(...)`, `fix(...)`, `docs(...)`, etc.).
5. Open a PR against `main` using the PR template and reference the issue with `closes #<issue-number>`.

## CI honesty

- `frontend/` should only claim frontend CI is passing when the actual command output verifies it.
- `contract/` must not claim `make ci` is working unless it has been run successfully in the repository state being submitted.
- If a check is still failing or not yet wired up, call that out in the PR description and paste the exact output when relevant.

## Shop Purchase Write Path

The shop purchase logic is governed by [ADR-001](backend/docs/ADR-001-shop-purchase-ownership.md), which establishes:

- **Single Write Path:** all purchase writes flow through `shop-api` (`POST /shop-api/purchases`)
- **Backend Proxy:** the backend's `POST /shop/purchase` endpoint proxies to shop-api
- **Idempotency Contract:** clients must send the `Idempotency-Key` header for purchases

When touching purchase code, verify:

1. No dual writes occur.
2. The idempotency key is passed through correctly.
3. DTO and schema mappings are documented.
4. Audit trails show `shop-api` as the source of truth.

## Picking up your first issue

Start with issues labeled [`good first issue`](https://github.com/SaboStudios/Tycoon-Monorepo/labels/good%20first%20issue). Once you're comfortable with the codebase, move on to [`help wanted`](https://github.com/SaboStudios/Tycoon-Monorepo/labels/help%20wanted). Issues are also labeled by area (`frontend`, `backend`, `contract`, `shop-api`) to help you find ones matching your experience.
