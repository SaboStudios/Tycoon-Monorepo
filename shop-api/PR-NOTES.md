# PR: feat(shop-api): Idempotency + Replay Protection for Purchases API

**Project:** Stellar Wave  
**Issue:** SW-001  
**Branch:** `feat/SW-001-purchases-idempotency`

---

## What this PR does

Adds idempotency and replay protection to `POST /purchases` so that retried or
duplicated requests never create double charges.

### Key design decisions

| Concern | Approach |
|---|---|
| Duplicate prevention | DB-level PK unique constraint on `idempotency_records.idempotencyKey` — no application-level locking needed |
| Concurrent in-flight | Optimistic insert; if the key is `PROCESSING`, return 409 immediately |
| Replay | On `COMPLETED` key, deserialise and return the cached response body verbatim |
| Retry after failure | `FAILED` keys are deleted so the client can retry with the same key |
| Transaction safety | Purchase insert runs inside a `QueryRunner` transaction; idempotency key is marked `COMPLETED` only after commit |
| Secret safety | Keys are masked in logs (`****xxxx`); no DB errors or stack traces reach HTTP responses |

---

## Files changed

```
shop-api/
├── src/
│   ├── idempotency/
│   │   ├── entities/idempotency-record.entity.ts   # PROCESSING/COMPLETED/FAILED state machine
│   │   ├── idempotency.module.ts
│   │   └── idempotency.service.ts                  # claimKey / markCompleted / markFailed
│   ├── purchases/
│   │   ├── dto/create-purchase.dto.ts
│   │   ├── entities/purchase.entity.ts
│   │   ├── purchases.controller.ts                 # @UseGuards(IdempotencyKeyGuard)
│   │   ├── purchases.module.ts
│   │   └── purchases.service.ts                    # transaction + idempotency flow
│   ├── common/
│   │   ├── filters/http-exception.filter.ts        # clean error shapes, no secret leakage
│   │   └── guards/idempotency-key.guard.ts         # validates header before handler
│   ├── migrations/
│   │   └── 1714000000000-CreateIdempotencyAndPurchases.ts
│   └── test/
│       ├── test-db.module.ts                       # in-memory SQLite for Jest
│       ├── purchases.e2e.spec.ts                   # full HTTP stack tests
│       ├── idempotency/idempotency.service.spec.ts
│       └── purchases/purchases.service.spec.ts
```

---

## Test coverage

| Suite | Scenarios |
|---|---|
| `idempotency.service.spec.ts` | new key, completed replay, concurrent 409, retry after failure, markFailed |
| `purchases.service.spec.ts` | success + DB state, duplicate replay, no double row, concurrent race, retry |
| `purchases.controller.spec.ts` | valid key, 409 propagation, GET found/not-found |
| `purchases.e2e.spec.ts` | 400 (missing/empty/long key, bad body), 201 success, replay, 409 concurrent race, retry, GET 200/404 |

---

## API contract (backward-compatible)

```
POST /purchases
Headers:
  Idempotency-Key: <uuid>   ← NEW required header
Body:
  { "userId": "...", "itemId": "...", "amount": 0.00 }

Responses:
  201  Purchase created (or replayed from cache — identical body)
  400  Missing/invalid Idempotency-Key header, or invalid body
  409  Key is currently being processed — retry after a short delay
```

Existing clients that don't send `Idempotency-Key` will receive a `400` instead
of silently creating duplicate purchases. This is intentional and safe — clients
must opt in to the new header.

---

## Rollout plan

1. **Deploy migration** (`npm run migration:run`) — adds `idempotency_records` table, no changes to `purchases`.
2. **Deploy service** — new header is required; coordinate with client teams to update before or simultaneously.
3. **Monitor** — watch for unexpected 400s (missing header) or 409s (client retry storms) in the first 30 min.
4. **Cleanup job** (follow-up ticket SW-002) — schedule a cron to purge `COMPLETED` records older than 24 h.

---

## How to run tests locally

```bash
npm install
npm test          # all unit + e2e (in-memory SQLite, no Postgres needed)
npm run test:cov  # with coverage report
```
