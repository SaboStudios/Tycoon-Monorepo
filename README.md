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

- **`shop-api/`** — Shop microservice (NestJS)
  - Purchases API: `shop-api/src/purchases/` (authoritative purchase writes)
  - Uses its own PostgreSQL database
  - Docker: `shop-api/Dockerfile` + `shop-api/docker-compose.yml`

## Quick Start

### Prerequisites

See [ADR-001](backend/docs/ADR-001-shop-purchase-ownership.md) for the purchase write path architecture and [docs/SHOP_ARCHITECTURE.md](docs/SHOP_ARCHITECTURE.md) ([ADR-003](backend/docs/ADR-003-shop-purchase-field-mapping.md)) for the field-by-field mapping between the two `Purchase` entities.

### 1. Start infrastructure

## Running shop-api locally

### Via Docker Compose (recommended)

```bash
cd shop-api
docker compose up --build
```

This starts:

| Service | Port | Notes |
|---|---|---|
| `shop-api` | `3000` | Non-root container; healthcheck on `GET /health` |
| `shop-postgres` | `5433` (host) → `5432` (container) | Isolated from the `backend` Postgres on `5432` |

Wait for `docker compose ps` to show `shop-api` as `healthy`, then:

```bash
curl http://localhost:3000/health
```

### Without Docker

```bash
cd shop-api
npm install
cp .env.example .env   # point DB_* at a local Postgres
npm run start:dev
```

See [`shop-api/README.md`](shop-api/README.md) for logging, cleanup jobs, and test instructions.

## Testing

## Running backend locally

```bash
cd backend
docker compose up -d   # Postgres + Redis + pgAdmin, ports 5432/6379/5050
npm install
npm run start:dev
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

## Project: Stellar Wave
