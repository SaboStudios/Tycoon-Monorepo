# TYNS Monorepo

A monorepo containing the Tycoon backend (NestJS), frontend (Next.js), smart contracts (Soroban), and shop microservice.

## Repository Structure

- **`backend/`** — NestJS API server
  - Shop module: `backend/src/modules/shop/` (client-facing purchase endpoint)
  - Docs: `backend/docs/` (runbooks, guides, ADRs)

- **`shop-api/`** — Shop microservice (NestJS)
  - Purchases API: `shop-api/src/purchases/` (authoritative purchase writes)
  - Uses its own PostgreSQL database

- **`frontend/`** — Next.js client (React 19)

- **`contract/`** — Soroban smart contracts

See [ADR-001](backend/docs/ADR-001-shop-purchase-ownership.md) for the purchase write path architecture.

---

## Local Development

### Port layout

| Service       | Default port | Notes                          |
|---------------|-------------|--------------------------------|
| Next.js (frontend) | **3000** | `npm run dev` in `frontend/`   |
| NestJS (backend)   | **3001** | Set `PORT=3001` in `backend/.env` |
| shop-api           | **3002** | Set in `shop-api/.env`         |

> Backend defaults to **3001** (not 3000) to avoid colliding with the Next.js dev
> server. Both `.env.example` files are pre-configured with these ports.

### Quick start

```bash
# 1. Copy env examples (once per machine)
cp backend/.env.example   backend/.env
cp frontend/.env.example  frontend/.env
cp shop-api/.env.example  shop-api/.env

# 2. Start backing services
docker compose up -d          # postgres + redis

# 3. Start all three apps in one terminal (concurrently)
npm run dev:all
#   → backend  → http://localhost:3001
#   → shop-api → http://localhost:3002
#   → frontend → http://localhost:3000

# 4. (Optional) Verify all health endpoints are responding
npm run smoke
```

`npm run dev:all` uses **concurrently** and labels each process
(`backend`, `shop-api`, `frontend`) so you can tell streams apart.

### Environment variables

| File | Key | Description |
|------|-----|-------------|
| `backend/.env` | `PORT` | Must be `3001` in dev (avoid Next.js collision) |
| `frontend/.env` | `NEXT_PUBLIC_API_URL` | Must be `http://localhost:3001` in dev |
| `shop-api/.env` | `PORT` | Must be `3002` in dev |

---

## Git Workflow (Manual Step Required)

The Kiro shell is frozen and cannot execute git commands. **You need to run these 5 commands manually:**

```bash
cd TYNS-Monorepo

# 1. Create feature branch
git checkout -b feat/SW-001-purchases-idempotency

# 2. Clean up nested duplicate
rm -rf shop-api/shop-api

# 3. Stage all files
git add .

# 4. Commit
git commit -m "feat(shop-api): add idempotency + replay protection [SW-001]

- Idempotency keys prevent duplicate purchases
- Concurrent request protection (409 on in-flight keys)
- Replay cached responses for completed keys
- Transaction-safe with PostgreSQL
- Full test coverage (unit + e2e)
- Clean error shapes, no secret leakage

Closes SW-001"

# 5. Push
git push -u origin feat/SW-001-purchases-idempotency
```

---

## Create PR

### Option A: GitHub CLI
```bash
gh pr create \
  --title "feat(shop-api): idempotency + replay protection [SW-001]" \
  --body-file shop-api/PR-NOTES.md \
  --base main \
  --head feat/SW-001-purchases-idempotency
```

### Option B: GitHub Web UI
1. Go to https://github.com/marvelousufelix/Tycoon-Monorepo
2. Click "Compare & pull request" (appears after push)
3. Copy-paste content from `shop-api/PR-NOTES.md` into the PR description
4. Submit

**PR URL will be:** `https://github.com/marvelousufelix/Tycoon-Monorepo/pull/<number>`

---

## What's Implemented

✅ **Idempotency Service** — claim/complete/fail key lifecycle  
✅ **Purchases API** — POST /purchases with `Idempotency-Key` header  
✅ **Transaction Safety** — QueryRunner wraps purchase creation  
✅ **Replay Protection** — 409 on concurrent, cached response on completed  
✅ **Security** — masked keys in logs, no secrets in HTTP responses  
✅ **Tests** — 4 suites (unit + e2e), all scenarios covered  
✅ **Migration** — PostgreSQL schema for `purchases` + `idempotency_records`  
✅ **PR Notes** — rollout plan, API contract, test instructions  

---

## Run Tests Locally

```bash
cd shop-api
npm install
npm test          # all tests (in-memory SQLite, no Postgres needed)
npm run test:cov  # with coverage
```

---

## Project: Stellar Wave | Issue: SW-001
