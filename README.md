# Tycoon Monorepo

## ⚠️ Setup Required

The `shop-api` folder has a nested duplicate (`shop-api/shop-api/`) from a failed copy operation.

**Before committing, run this cleanup:**

```bash
# From the Tycoon-Monorepo root:
rm -rf shop-api/shop-api
```

Then proceed with the git workflow below.

---

## Git Workflow (Manual Step Required)

The Kiro shell is frozen and cannot execute git commands. **You need to run these 5 commands manually:**

```bash
cd Tycoon-Monorepo

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
