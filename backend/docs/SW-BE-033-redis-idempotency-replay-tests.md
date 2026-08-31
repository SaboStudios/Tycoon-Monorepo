# SW-BE-033 — Redis / Cache Layer: Idempotency and Replay Tests

Part of the **Stellar Wave** engineering batch.

## Canonical Idempotency Pattern

All idempotency implementations in the codebase must follow a single, canonical claim/complete/fail pattern to ensure consistent replay behavior and prevent double-execution under concurrent requests.

### Pattern Overview

Every idempotent operation follows these three phases:

1. **Claim** — Atomically reserve the idempotency key before the operation runs
   - If the key is already claimed by another request, reject with HTTP 409 Conflict
   - Use Redis `SET ... NX` (only if not exists) to ensure atomicity
   - TTL: short (e.g., 60s) to time out stalled in-flight operations

2. **Complete** — After the operation succeeds, store the cached result
   - Update the key status to "complete" and cache the full response
   - TTL: long (e.g., 24h) to allow replays for extended periods
   - If a replay request arrives before this step, return 409 (still in-flight)

3. **Fail** — If the operation fails, release the claim to allow retries
   - Delete the key (or mark as "failed" and let TTL expire)
   - Subsequent requests with the same key can retry the operation
   - Do not cache error responses (exceptions are not idempotent)

### Replay Behavior

When a replayed request arrives (same idempotency key, in "complete" state):
- Return the cached response with status code and body
- Set header `X-Idempotency-Replayed: true` to inform the client
- Do not re-execute the handler or modify state
- Validate request integrity if needed (e.g., check body hasn't changed)

### Implementation Location

Shared helper: `backend/src/common/idempotency/` provides the core claim/complete/fail logic.
All modules (shop, uploads, etc.) use this shared helper rather than inventing their own.

### Modules Using This Pattern

- `backend/src/modules/shop` — purchase idempotency
- `backend/src/modules/uploads` — upload idempotency
- (shop-api is intentionally separate, documented in its own ADR)

## What was changed

### New test files

| File | Scenarios |
|---|---|
| `src/modules/redis/idempotency.service.spec.ts` | 26 — `get`, `markProcessing`, `markComplete`, `markFailed`, `delete`, claim-complete-fail lifecycle |
| `src/modules/redis/idempotency.interceptor.spec.ts` | 22 — non-mutating pass-through, fresh request, replay header, null/array responses, in-flight 409, error-path key deletion, HttpException re-throw |
| `src/modules/shop/shop-purchase-idempotency.spec.ts` | 11 — HTTP-level replay, replayed header, duplicate-key 409, no-header double-create, TTL expiry, error-path key deletion |
| `test/idempotency-replay.e2e-spec.ts` | 15 — full-stack e2e using a self-contained NestJS module; covers replay, header, different keys, in-flight, no-header, error path, `x-idempotency-key` alias, TTL expiry |

### Production code

No production code changes. `IdempotencyService` and `IdempotencyInterceptor` were already implemented. This item improves and formalises the test coverage.

## Design notes

- All tests use an **in-memory store** (a `Map<string, IdempotencyRecord>`) so no Redis process is required in CI.
- The `jest.config.ts` `rootDir` is `src/`; the new e2e spec lives in `test/` and is picked up by `jest-e2e.json` (matches `*.e2e-spec.ts`).
- Mocks for `ioredis`, `@nestjs/config`, and `@nestjs/cache-manager` already exist under `test/mocks/` — no new mocks needed.
- The `IdempotencyInterceptor` accepts both `idempotency-key` and `x-idempotency-key` (falls back to the second if the first is absent). The e2e spec validates the alias.

## No schema changes

No database migrations. No new environment variables. No new npm dependencies.

## Feature flag / rollout

No feature flag required. The `IdempotencyInterceptor` is applied selectively via `@UseInterceptors(IdempotencyInterceptor)` on individual controllers. No global registration was added.

Rollout steps for any controller that wants idempotency:
1. Inject `IdempotencyInterceptor` in the controller's module providers.
2. Add `@UseInterceptors(IdempotencyInterceptor)` to the controller class or specific mutating actions.
3. Clients send `Idempotency-Key: <uuid>` on POST/PUT/PATCH/DELETE.
4. Completed responses are cached in Redis with a 24 h TTL; in-flight keys return 409; replays return the cached body with `X-Idempotency-Replayed: true`.
5. To roll back: remove the decorator — no state changes occur; Redis TTLs expire naturally.

## Verification

```bash
cd backend

# Unit + integration specs (rootDir = src)
npm run test -- --testPathPattern="idempotency"

# e2e spec
npx jest --config test/jest-e2e.json --testPathPattern="idempotency-replay"

# Full backend suite must remain green
npm run test
```

## Acceptance criteria

- [x] PR references Stellar Wave and issue id SW-BE-033
- [x] No secrets in logs — keys are namespaced (`idempotency:<key>`) but never logged
- [x] Backward-compatible — existing callers of `RedisService` are unaffected
- [x] No schema changes, no new dependencies
- [x] Jest specs added: 4 spec files, 74 cases total
- [x] Tests run without a live Redis instance (in-memory store)
