# Redis & cache layer — operational runbook

**Stellar Wave batch · SW-BE-007**

Covers the global Redis client and Nest `CacheModule` wiring under `backend/src/modules/redis/`, `backend/src/config/redis.config.ts`, and Redis-related keys in `backend/src/config/env.validation.ts`.

---

## Table of contents

1. [Architecture overview](#1-architecture-overview)
2. [Environment variables](#2-environment-variables)
3. [Feature flag: cache audit trail](#3-feature-flag-cache-audit-trail)
4. [Rollout & migration](#4-rollout--migration)
5. [Normal operations](#5-normal-operations)
6. [Incident playbooks](#6-incident-playbooks)
7. [Logging & secrets](#7-logging--secrets)
8. [Monitoring](#8-monitoring)
9. [Rollback](#9-rollback)
10. [Cache namespaces & stampede protection](#10-cache-namespaces--stampede-protection)
11. [SW-BE-007 error mapping](#11-sw-be-007-error-mapping)

---

## 1. Architecture overview

| Component | Role |
|-----------|------|
| `RedisModule` (`@Global`) | Registers `cache-manager` with `cache-manager-ioredis-yet` (same host/db/password as app config). Exports `RedisService`, idempotency helpers, and `CacheModule`. |
| `RedisService` | Direct `ioredis` client for tokens, rate limits, sorted sets, `KEYS`/`SCAN` helpers, **cache versioning** (`getCacheVersion`, `incrementCacheVersion`); uses `CACHE_MANAGER` for cache-manager get/set/del. |
| `redis.config.ts` | `ConfigFactory` for `ConfigService.get('redis')`. |
| `env.validation.ts` | Joi schema: single source of truth for allowed env shapes and defaults for Redis-related variables. |
| `GET /health/redis` | Smoke test: cache set/get for key `health-check` (short TTL). Routed **outside** the versioned API prefix (see `configureApiVersioning` exclusions). |
| `CacheInterceptor` | Intercepts GET requests and caches responses. For versioned resources (e.g., shop catalog), includes the cache version in the key. |

**Important:** `delByPattern` uses Redis `KEYS`, which can block a large instance. Prefer `scanPage` for wide keyspaces in production maintenance unless you know the pattern is narrow.

---

## 2. Environment variables

Validated at process startup via `validationSchema` in `src/config/env.validation.ts` (loaded by `ConfigModule` in `app.module.ts`).

| Variable | Default | Required in prod | Purpose |
|----------|---------|------------------|---------|
| `REDIS_HOST` | `localhost` | yes (real hostname) | Redis host |
| `REDIS_PORT` | `6379` | no | Redis port |
| `REDIS_PASSWORD` | _(empty allowed)_ | if Redis ACL/password enabled | Auth string — **never log** |
| `REDIS_DB` | `0` | no | Logical database index |
| `REDIS_TTL` | `300` | no | Default TTL (seconds) for cache-manager store registration |
| `CACHE_AUDIT_ENABLED` | `false` | no | When `true`, successful `set` / `del` / `delByPattern` emit `AuditTrailService` actions `CACHE_SET`, `CACHE_DEL`, `CACHE_INVALIDATE` |
| `CACHE_STAMPEDE_LOCK_TTL_MS` | `5000` | no | Max lifetime of a single-flight lock (ms). Must be `> 0`; keep it above the p99 origin latency. |
| `CACHE_STAMPEDE_WAIT_TIMEOUT_MS` | `2000` | no | Max time a follower waits for the leader to populate the cache before falling back to the origin (ms). |
| `CACHE_STAMPEDE_WAIT_INTERVAL_MS` | `50` | no | Poll interval for followers waiting on the lock (ms). |

`redis.config.ts` maps `CACHE_AUDIT_ENABLED` to `cacheAuditEnabled` using the string `true` (lowercase) for parity with typical `.env` files. Joi accepts standard truthy/falsy strings and coerces to boolean for validation output; the Nest `registerAs` factory still reads `process.env` directly for this flag.

---

## 3. Feature flag: cache audit trail

- **Enable:** set `CACHE_AUDIT_ENABLED=true`, deploy, confirm DB volume for `audit_trails` and application error rate (audit writes are best-effort; failures are logged, not thrown from cache callers).
- **Disable:** set `CACHE_AUDIT_ENABLED=false` or unset, deploy. Cache behavior is unchanged; only audit emissions stop.
- **Dependency:** `RedisModule` imports `AuditTrailModule`. If the audit table is unavailable, audit `log()` rejections are caught inside `RedisService`; cache operations still succeed.

---

## 4. Rollout & migration

- **Schema:** New `AuditAction` enum string values (`CACHE_SET`, `CACHE_DEL`, `CACHE_INVALIDATE`) are stored in `audit_trails.action` (`varchar(50)`). No Alembic/TypeORM migration is required for length; existing rows are unchanged.
- **Order of operations:** Deploy application code first (backward compatible). Then optionally enable `CACHE_AUDIT_ENABLED` per environment.
- **Redis version:** No minimum version bump required for this runbook; follow your platform standard (e.g. Redis 6+ for TLS if used outside this repo).

---

## 4.5. Cache key versioning for shop catalog

**Rationale:** The shop catalog is frequently cached but also frequently mutated by admins (price changes, item deactivation, etc.). Instead of using broad, blocking `KEYS` patterns to invalidate the cache, we use **cache key versioning**: each time an admin mutation occurs, a version counter increments, and the `CacheInterceptor` includes this version in generated cache keys. Subsequent reads automatically miss old entries and fetch fresh data.

**Implementation:**

- **Version key:** `{environment}:cache-version:shop:catalog` (stored in Redis, default 0)
- **Cache key format:** `cache:GET:/api/v1/shop/items:userId:queryParams:vN` (where N is the current version)
- **Mutation triggers:** When `ShopService.create()`, `ShopService.update()`, `ShopService.remove()`, or `ShopService.bulkUpdate()` is called, `invalidateCache()` increments the version
- **TTL:** Shop catalog cache entries expire after 300 seconds (5 minutes) regardless of version changes

**Versioning example:**

1. Admin calls `PATCH /admin/shop/1/price` → price updated to $99.99 → version increments from 1 → 2
2. Next `GET /api/v1/shop/items` request generates cache key with `:v2` suffix
3. If cache still had an entry from `:v1`, it is not found (cache miss)
4. Fresh data is fetched and cached under `:v2`
5. Subsequent requests for the next 5 minutes hit the `:v2` cache entry

**Methods:**

- `redisService.getCacheVersion(namespace)` → returns current version (e.g., 2)
- `redisService.incrementCacheVersion(namespace)` → increments and returns new version (e.g., 3)

---

## 5. Normal operations

### Health check

```bash
curl -sS "https://<host>/health/redis" | jq .
```

Expect `status: "healthy"` and `redis: "connected"` when Redis and cache-manager store are reachable.

### Connectivity from an app pod (read-only)

```bash
redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" ${REDIS_PASSWORD:+-a "$REDIS_PASSWORD"} PING
```

Do **not** paste `REDIS_PASSWORD` into tickets, chat, or CI logs.

---

## 6. Incident playbooks

### 6.1 Redis down / connection refused

**Symptoms:** `GET /health/redis` returns `unhealthy`, logs show `Redis connection error`, elevated `tycoon_redis_errors_total`.

**Steps:**

1. Confirm network policy / security group from API to Redis.
2. Verify `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD`, `REDIS_DB` match the instance (use secrets manager, not logs).
3. Restart Redis or failover per infra runbook; API degrades gracefully for some paths (e.g. cache get returns `undefined`) but features depending on strong consistency will fail.

### 6.2 Elevated latency on admin cache invalidation

**Symptoms:** Spikes when calling APIs that run `delByPattern` with broad patterns.

**Steps:**

1. Narrow invalidation patterns or move to `scanPage` + batched `del` for large keyspaces.
2. Review slowlog on Redis during the window.

### 6.3 Audit table pressure after enabling `CACHE_AUDIT_ENABLED`

**Symptoms:** DB CPU up, slower requests.

**Steps:**

1. Turn flag off temporarily.
2. Add retention/archival policy for `audit_trails` (product decision).
3. Re-enable with lower traffic or async batching if introduced in a future change.

### 6.4 Cache stampede (thundering herd) on a hot namespace

**Symptoms:** A single hot key expires and origin (Postgres / shop-api / RPC) QPS spikes; `tycoon_cache_stampede_leader_total` and `tycoon_cache_stampede_follower_total` both climb; p99 latency on the affected endpoint rises while cache hit ratio dips.

**Steps:**

1. Confirm the stampede counters are moving and that the affected namespace is the one you expect (see §10).
2. Verify `CACHE_STAMPEDE_LOCK_TTL_MS` is greater than the p99 origin latency for that namespace; if not, raise it and redeploy.
3. If followers are timing out (`tycoon_cache_stampede_wait_timeout_total` climbing), raise `CACHE_STAMPEDE_WAIT_TIMEOUT_MS` or reduce origin latency.
4. If Redis itself is the bottleneck, follow §6.1 — stampede protection degrades to direct origin calls, it does not block requests.

---

## 7. Logging & secrets

- **Do not** log `REDIS_PASSWORD`, full Redis URLs with auth, or refresh token values. `RedisService` logs keys at **debug** for cache hit/miss and identifiers like `userId` for token operations — keep production `LOG_LEVEL` at `info` or higher unless troubleshooting.
- Error messages include Redis/ioredis `message` only (no password).
- Stampede lock keys are logged at **debug** only; they contain the namespace and cache key but never payloads or PII.

---

## 8. Monitoring

Prometheus metrics (non-exhaustive):

- `tycoon_redis_operations_total{operation="..."}`
- `tycoon_redis_errors_total`
- `tycoon_cache_hits_total` / `tycoon_cache_misses_total`
- `tycoon_redis_operation_duration_seconds`
- `tycoon_cache_stampede_leader_total{namespace="..."}` — requests that acquired the single-flight lock and populated the cache
- `tycoon_cache_stampede_follower_total{namespace="..."}` — requests that waited on an in-flight leader
- `tycoon_cache_stampede_wait_timeout_total{namespace="..."}` — followers that timed out and fell back to the origin

Alert on sustained error rate and on `health/redis` failing synthetic checks. Alert when `tycoon_cache_stampede_wait_timeout_total` grows faster than `tycoon_cache_stampede_leader_total` for a namespace — that indicates the lock TTL is too short relative to origin latency.

---

## 9. Rollback

1. Revert or redeploy previous image.
2. If audit volume was the issue, set `CACHE_AUDIT_ENABLED=false` without reverting code.
3. No data migration rollback is required for audit enum strings.
4. Stampede protection is additive and self-healing: lock keys carry a TTL (`CACHE_STAMPEDE_LOCK_TTL_MS`) and expire on their own, so reverting the image leaves no orphaned state. If you must disable it without a redeploy, set `CACHE_STAMPEDE_LOCK_TTL_MS` to a very small value (e.g. `1`) so locks expire immediately and every request behaves as a direct origin call.

---

## 10. Cache namespaces & stampede protection

### Namespace conventions

Every cache key is namespaced so that invalidation, metrics, and stampede locks stay scoped and never collide across features:

| Namespace | Key shape | Owner |
|-----------|-----------|-------|
| `auth` | `auth:<userId>:<purpose>` | Auth module (refresh tokens, sessions) |
| `game` | `game:<gameId>:<field>` | Game module |
| `shop` | `shop:<sku>:<field>` | shop-api proxy |
| `admin` | `admin:<resource>:<id>` | Admin module |
| `health` | `health-check` | `GET /health/redis` |

Rules:

- Namespace is the first colon-delimited segment of the key.
- Never write a key without a namespace; the cache interceptor derives it from the `@CacheOptions` decorator (see below).
- Invalidation patterns must be namespace-scoped (e.g. `game:*`), never `*`.

### Cache interceptor surface (unchanged)

The existing cache interceptor feature surface is preserved:

- **TTL** — per-route TTL from `@CacheOptions({ ttl })`, falling back to `REDIS_TTL`.
- **Namespace** — per-route namespace from `@CacheOptions({ namespace })`, defaulting to the controller/module name.
- **`@CacheOptions` decorator** — `ttl`, `namespace`, and `key` behavior are unchanged; stampede protection wraps the existing miss path and does not alter key derivation.

### Single-flight / distributed lock behavior

When a request misses the cache for a namespace, the interceptor uses a Redis `SET NX PX` lock to elect a single leader:

1. **Leader** — acquires `lock:<namespace>:<key>` with `SET NX PX CACHE_STAMPEDE_LOCK_TTL_MS`. It calls the origin, writes the result to the cache with the normal TTL, then releases the lock. Emits `tycoon_cache_stampede_leader_total{namespace}`.
2. **Follower** — fails to acquire the lock, so it polls the cache every `CACHE_STAMPEDE_WAIT_INTERVAL_MS` up to `CACHE_STAMPEDE_WAIT_TIMEOUT_MS`. If the leader populates the cache, the follower returns the cached value. Emits `tycoon_cache_stampede_follower_total{namespace}`.
3. **Follower timeout** — if the wait budget elapses, the follower falls back to calling the origin directly (fail-open for reads) and emits `tycoon_cache_stampede_wait_timeout_total{namespace}`. This bounds worst-case latency and prevents a stuck leader from blocking traffic.
4. **Redis unavailable** — if the lock cannot be acquired because Redis is down, the request proceeds directly to the origin (reads fail-open). Writes are governed by §11.

Locks are always released in a `finally` block and additionally expire via their TTL, so a crashed leader cannot deadlock a namespace.

### Copy-pasteable commands

Inspect active stampede locks for a namespace (read-only):

```bash
redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" ${REDIS_PASSWORD:+-a "$REDIS_PASSWORD"} \
  --scan --pattern 'lock:game:*'
```

Count locks per namespace without `KEYS`:

```bash
redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" ${REDIS_PASSWORD:+-a "$REDIS_PASSWORD"} \
  --scan --pattern 'lock:*' | awk -F: '{print $2}' | sort | uniq -c
```

Inspect a specific lock's remaining TTL (ms):

```bash
redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" ${REDIS_PASSWORD:+-a "$REDIS_PASSWORD"} \
  PTTL 'lock:game:<gameId>:<field>'
```

Force-expire a stuck lock (only after confirming no leader is in flight):

```bash
redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" ${REDIS_PASSWORD:+-a "$REDIS_PASSWORD"} \
  DEL 'lock:game:<gameId>:<field>'
```

---

## 11. SW-BE-007 error mapping

Redis cache failures map to the standard error envelope defined in `docs/API_ERROR_RESPONSE_STANDARDS.md`. The server remains the source of truth for money, dice, inventory, and admin mutations.

| Condition | Read path | Write path | Error code | HTTP |
|-----------|-----------|------------|------------|------|
| Cache miss | Call origin, populate cache | n/a | — | — |
| Redis unavailable | Fail-open: call origin directly | **Fail-closed**: reject | `SW-BE-007` | `503` |
| Lock acquisition error | Fail-open: call origin directly | **Fail-closed**: reject | `SW-BE-007` | `503` |
| Follower wait timeout | Fail-open: call origin directly | n/a | — | — |
| Serialization error on set | Log, return origin value | **Fail-closed**: reject | `SW-BE-007` | `503` |

Rules:

- **Reads fail-open.** A cache outage must never take down read traffic; the origin is authoritative.
- **Writes fail-closed.** Any mutation that depends on cache consistency (inventory, dice, admin) must reject with `SW-BE-007` / `503` rather than proceed on stale or unverifiable state.
- The error envelope follows `docs/API_ERROR_RESPONSE_STANDARDS.md`: `{ "statusCode": 503, "code": "SW-BE-007", "message": "...", "requestId": "..." }`. Never include `REDIS_PASSWORD`, connection strings, or PII in the message.
- `SW-BE-007` is emitted only for cache-layer failures; origin failures keep their own codes.

---

## Related docs

- `docs/AUTH_JWT_RUNBOOK.md` — refresh tokens also use Redis-backed flows in auth.
- `docs/webhooks-runbook.md` — webhook idempotency uses Redis.
- `docs/API_ERROR_RESPONSE_STANDARDS.md` — canonical error envelope and `SW-BE-007` mapping.
