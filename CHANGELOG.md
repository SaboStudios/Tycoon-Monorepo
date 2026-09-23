# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Versions follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
Each package in this monorepo maintains its own version; breaking changes in any
package are recorded here under the relevant section.

> **How to update this file:** When your PR introduces a user-visible change,
> add a bullet under the `[Unreleased]` section in the appropriate package block.
> Use the category that fits: `Added`, `Changed`, `Deprecated`, `Removed`, `Fixed`,
> `Security`. See [CONTRIBUTING.md](CONTRIBUTING.md) for the full workflow.

---

## [Unreleased]

### Backend

#### Added
- API versioning via URI path (`/api/v1/*`) with centralized bootstrap configuration.
- Optional unversioned compatibility route (`/api/*`) rewriting to `/api/v1/*`, with
  `Deprecation: true` and optional `Sunset` headers.
- Idempotency + replay protection on `POST /shop/purchase` — clients must send
  `Idempotency-Key` header or receive `400`.
- Prometheus metrics endpoint (`/metrics`) controlled by `METRICS_ENABLED`.
- Graceful shutdown with configurable `SHUTDOWN_TIMEOUT_MS` (default 15 000 ms).
- Privacy erasure pipeline (GDPR right-to-erasure) in the users module.
- Redis-backed idempotency helper shared across shop, uploads, and webhook modules.
- Ledger reconciliation drift exported as a Prometheus gauge with Grafana panel.
- Admin role verification guard (`AdminGuard`) applied to all `/admin/*` routes.

#### Changed
- `API_PREFIX` now represents the base prefix (`api`) not a versioned segment.
- `POST /shop/purchase` proxies writes to `shop-api`; the backend no longer writes
  directly — see [ADR-001](backend/docs/ADR-001-shop-purchase-ownership.md).

#### Security
- Auth tokens validated for key-name consistency (`accessToken` vs `access_token`).

---

### Frontend

#### Added
- NEAR wallet connect/disconnect flow (`NearWalletConnect.tsx`, `frontend/src/lib/near/`).
- Keyboard shortcuts panel with focus-trap accessibility.
- Shop grid with CLS/LCP budget enforcement and TypeScript strict-null guards.
- MSW handlers for shop, auth, hero, and join-room API mocking in tests.
- Storybook baseline + Chromatic visual-regression snapshots.
- Bundle size CI gate enforced by `.size-limit.json`.

#### Changed
- All "Stellar Network" UI copy replaced with "NEAR wallet" per
  [ADR-003](frontend/docs/ADR-003-wallet-strategy-near-only.md).
- Join-room endpoint wired to live backend WebSocket; MSW mock retained for tests.

#### Fixed
- Footer Telegram icon rendering.
- Login auth DTO field mismatch.

---

### Shop API (`shop-api/`)

#### Added
- New NestJS microservice owning all purchase writes (`POST /purchases`).
- Idempotency + replay protection: `Idempotency-Key` header required on all purchase
  requests; concurrent in-flight requests return `409`; completed keys replay the
  cached response.
- `QueryRunner` transaction wrapping purchase creation and idempotency state machine.
- PostgreSQL migration `1714000000000-CreateIdempotencyAndPurchases` — adds
  `idempotency_records` and `purchases` tables.

> **⚠ Breaking change (shop-api v0 → v1):**  
> `POST /purchases` now **requires** an `Idempotency-Key: <uuid>` header.  
> Requests without this header receive `400 Bad Request`.  
> Coordinate deployment with client teams before rolling out.

---

### Contract (`contract/`)

#### Added
- Soroban workspace with seven crates: `tycoon-main-game`, `tycoon-game`,
  `tycoon-token`, `tycoon-reward-system`, `tycoon-collectibles`,
  `tycoon-boost-system`, `tycoon-lib`.
- `Makefile` with `dev`, `ci`, `ci-full`, `wasm-check`, `wasm-hashes` targets.
- WASM size budget enforcement via `contract/ci/wasm-size-budget.json`.
- CI artifact upload: WASM binaries + `wasm-hashes.txt` + `wasm-size-report.md`.

> **Note:** No Soroban contracts are deployed to testnet or mainnet yet.
> All crates are scaffolding. See [docs/WALLET_STRATEGY.md](docs/WALLET_STRATEGY.md)
> for the gate criteria before any Stellar UI copy may ship.

---

## Policy

- **Breaking API changes** must be introduced via a new API version (e.g. `/api/v2/*`)
  and documented in this file under the `Backend` section with a `⚠ Breaking change` callout.
- **Contract hash bumps** (new WASM deployed to testnet or mainnet) must be recorded
  under the `Contract` section with the old and new SHA-256 hashes and the deployment
  transaction ID.
- **Schema migrations** must reference the migration filename and the tables affected.

[Unreleased]: https://github.com/SaboStudios/Tycoon-Monorepo/compare/HEAD...HEAD
