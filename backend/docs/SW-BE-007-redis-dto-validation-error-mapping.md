# SW-BE-007 — Redis / Cache Layer: DTO Validation and Error Mapping

Part of the **Stellar Wave** engineering batch.

## What was added

### New files

| File | Purpose |
|---|---|
| `src/modules/redis/dto/cache-operation.dto.ts` | Validated DTOs for `get`, `set`, `del`, `scanPage` |
| `src/modules/redis/errors/cache.errors.ts` | `CacheValidationException`, `CacheOperationException`, `mapCacheError` |
| `src/modules/redis/validated-cache.service.ts` | Thin validation wrapper over `RedisService` |
| `src/modules/redis/cache-exception.filter.ts` | Exception filter — structured, secret-free JSON responses |

### Modified files

| File | Change |
|---|---|
| `src/modules/redis/redis.module.ts` | Registers and exports `ValidatedCacheService` and `CacheExceptionFilter` |

### New test files

| File | Cases |
|---|---|
| `cache-operation-dto.spec.ts` | 16 — key/pattern/ttl/count constraints |
| `cache-errors.spec.ts` | 10 — exception shape + `mapCacheError` secret redaction |
| `validated-cache.service.spec.ts` | 16 — validation rejection + error mapping per operation |
| `cache-exception-filter.spec.ts` | 3 — response shaping for 400 / 500 |

## Design decisions

- `ValidatedCacheService` is **additive** — existing callers of `RedisService` are unaffected.
  New code should inject `ValidatedCacheService` instead.
- `CacheExceptionFilter` is **local** — apply it with `@UseFilters(CacheExceptionFilter)` on
  controllers that use `ValidatedCacheService`. It does not replace the global `AllExceptionsFilter`.
- `mapCacheError` strips IP addresses, `password=…` fragments, and `redis://:pwd@` credentials
  before they reach the response body or structured logs.

## No schema changes

No database migrations required. No new environment variables.

## Feature flag / rollout

No separate flag needed. The new service is opt-in:

1. Deploy — existing code paths are unchanged.
2. Migrate a controller: replace `RedisService` injection with `ValidatedCacheService`
   and add `@UseFilters(CacheExceptionFilter)`.
3. Verify in staging that invalid inputs return `400 CACHE_INVALID_KEY` and Redis
   errors return `500 CACHE_OPERATION_FAILED` with no secrets in the body.
4. Roll back by reverting the controller injection — no state change required.

## Verification

```bash
cd backend
npm run test -- --testPathPattern="cache-operation-dto|cache-errors|validated-cache|cache-exception-filter"
npm run test   # full suite must stay green
```

## Acceptance criteria

- [x] PR references Stellar Wave and issue id SW-BE-007
- [x] `npm run test` passes — 45 new cases across 4 spec files
- [x] No secrets (IPs, passwords, tokens) in error response bodies
- [x] Backward-compatible — existing `RedisService` callers unaffected
- [x] No new production dependencies
- [x] No database migrations
