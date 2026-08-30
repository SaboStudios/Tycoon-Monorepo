# TYNS Monorepo

A monorepo containing the Tycoon backend (NestJS), frontend (Next.js), smart contracts (Soroban), and shop microservice.

## Repository Structure

- **`backend/`** — NestJS API server
  - Shop module: `backend/src/modules/shop/` (client-facing purchase endpoint)
  - Docs: `backend/docs/` (runbooks, guides, ADRs)

- **`shop-api/`** — Shop microservice (NestJS)
  - Purchases API: `shop-api/src/purchases/` (authoritative purchase writes)
  - Uses its own PostgreSQL database
  - Docker: `shop-api/Dockerfile` + `shop-api/docker-compose.yml`

- **`frontend/`** — Next.js client (React 19)

- **`contract/`** — Soroban smart contracts

See [ADR-001](backend/docs/ADR-001-shop-purchase-ownership.md) for the purchase write path architecture.

---

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

---

## Running backend locally

```bash
cd backend
docker compose up -d   # Postgres + Redis + pgAdmin, ports 5432/6379/5050
npm install
npm run start:dev
```

---

## Project: Stellar Wave
