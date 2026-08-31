# Tycoon Monorepo

Tycoon is a multiplayer board game platform backed by smart contracts on Stellar (Soroban) and NEAR (wallet auth). This monorepo contains the game backend, frontend, shop microservice, and on-chain contracts.

## Architecture

```
┌────────────┐       HTTP / WS        ┌────────────┐      HTTP (proxy)     ┌──────────┐
│            │ ◄──────────────────────► │            │ ────────────────────► │          │
│  frontend  │                         │  backend   │                       │ shop-api │
│ (Next.js)  │                         │ (NestJS)  │                       │ (NestJS) │
└─────┬──────┘                         └─────┬──────┘                       └────┬─────┘
      │                                      │                                  │
      │ NEAR wallet                          │ PostgreSQL + Redis               │ PostgreSQL
      │ (wallet-selector)                    │ (tycoon_db)                      │ (shop db)
      │                                      │                                  │
      ▼                                      ▼                                  ▼
┌────────────┐                         ┌────────────┐                     ┌──────────┐
│   NEAR     │                         │   Redis    │                     │ Postgres │
│  testnet   │                         │  (cache)   │                     │          │
└────────────┘                         └────────────┘                     └──────────┘

┌────────────┐
│  contract/ │  Soroban smart contracts (Stellar)
│            │  Built with Rust + soroban-sdk v23
└────────────┘
```

| Package | Stack | Purpose |
|---------|-------|---------|
| `frontend/` | Next.js 16, React 19, Tailwind, Vitest, Playwright | Player-facing web app |
| `backend/` | NestJS 11, TypeORM, PostgreSQL, Redis | Game API, auth, shop proxy |
| `shop-api/` | NestJS 10, TypeORM, PostgreSQL | Authoritative purchase writes (idempotent) |
| `contract/` | Rust, Soroban SDK v23 | On-chain game logic, tokens, collectibles |

## Repository Structure

```
tycoon-monorepo/
├── frontend/          # Next.js client (React 19)
├── backend/           # NestJS API server
│   └── docs/          # ADRs, runbooks, guides
├── shop-api/          # Shop microservice (purchases)
├── contract/          # Soroban smart contracts (Rust)
├── .github/workflows/ # CI pipelines
└── CONTRIBUTING.md    # Setup & contribution guide
```

See [ADR-001](backend/docs/ADR-001-shop-purchase-ownership.md) for the purchase write path architecture and [ADR-003](frontend/docs/ADR-003-wallet-strategy-near-only.md) for the wallet strategy (NEAR-only until Stellar contracts are production-ready).

## Quick Start

### Prerequisites

- **Node.js ≥ 20** (all JS packages)
- **Docker** (for PostgreSQL and Redis)
- **Rust + wasm32-unknown-unknown** (for `contract/` only)

### 1. Start infrastructure

```bash
cd backend
docker compose up -d          # PostgreSQL on :5432, Redis on :6379, pgAdmin on :5050
```

### 2. Install dependencies

```bash
cd frontend && npm ci --legacy-peer-deps
cd ../backend && npm install
cd ../shop-api && npm install
```

### 3. Configure environment

Each package has a `.env.example` — copy it to `.env` and fill in values:

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
cp shop-api/.env.example shop-api/.env
```

### 4. Run migrations & start services

```bash
# Backend (port 3000)
cd backend
npm run migration:run
npm run start:dev

# Frontend (port 3000 — see port collision note below)
cd frontend
npm run dev

# Shop API (port 3002 — see port collision note below)
cd shop-api
npm run start:dev
```

### Contracts (optional)

```bash
cd contract
make dev          # fmt + clippy + test + WASM build
make ci           # Full CI parity (build + size check + tests)
```

## ⚠️ Port Collision

Both `backend/` and `frontend/` default to **port 3000**. If you run them simultaneously, one will fail to bind.

**Recommended local ports:**

| Service | Default Port | Notes |
|---------|-------------|-------|
| `backend/` | 3000 | API at `localhost:3000/api/v1/*` |
| `frontend/` | 3000 | Change via `next dev -p 3001` |
| `shop-api/` | 3000 | Change via `PORT=3002 npm run start:dev` |
| PostgreSQL | 5432 | Via Docker |
| Redis | 6379 | Via Docker |
| pgAdmin | 5050 | Via Docker |

To run frontend on a different port:

```bash
cd frontend
npm run dev -- -p 3001
```

To run shop-api on a different port:

```bash
cd shop-api
PORT=3002 npm run start:dev
```

Update `backend/.env` CORS settings if you change frontend's port:

```
CORS_ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001
```

## Testing

Each package has its own test suite:

```bash
# Backend — unit + e2e (Jest)
cd backend
npm test              # unit tests
npm run test:e2e      # end-to-end tests (requires running DB)

# Frontend — unit + e2e (Vitest + Playwright)
cd frontend
npm test -- --run     # unit tests
npm run typecheck     # TypeScript check
npm run test:e2e:smoke  # Playwright smoke tests

# Shop API — unit + e2e (Jest)
cd shop-api
npm test              # unit tests (in-memory SQLite, no Postgres needed)
npm run test:cov      # with coverage

# Contracts — Rust tests
cd contract
make test             # cargo test --all
```

## Continuous Integration

CI runs on every PR via GitHub Actions:

| Workflow | What it checks |
|----------|---------------|
| [Backend CI](.github/workflows/backend-ci.yml) | Build, test, migrations, admin guard verification |
| [Frontend CI](.github/workflows/frontend-ci.yml) | Typecheck, build, lint, Vitest, Playwright E2E |
| [Contract CI](.github/workflows/contract-ci.yml) | Format, clippy, test, WASM build + size budget |

See [CONTRIBUTING.md](CONTRIBUTING.md) for the full contribution workflow, including branch naming, commit conventions, and per-package CI checks.

## Wallet Strategy

The frontend uses **NEAR wallet** exclusively (via `@near-wallet-selector`) until Stellar smart contracts are production-ready. See [ADR-003](frontend/docs/ADR-003-wallet-strategy-near-only.md) for the full rationale.

- Wallet provider: `frontend/src/components/providers/near-wallet-provider.tsx`
- Error handling: `frontend/src/lib/near/errors.ts`
- Telemetry: `frontend/src/lib/near/telemetry.ts` (privacy-safe, no PII)

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for setup instructions, workflow, and CI details.

Key links:
- [CONTRIBUTING.md](CONTRIBUTING.md) — setup, workflow, first-issue guide
- [ADR-001](backend/docs/ADR-001-shop-purchase-ownership.md) — purchase write path ownership
- [ADR-003](frontend/docs/ADR-003-wallet-strategy-near-only.md) — wallet strategy (NEAR-only)
- [Admin Routes Matrix](ADMIN_ROUTES_MATRIX.md) — admin guard coverage

## License

MIT
