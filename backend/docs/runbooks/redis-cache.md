# Redis / Cache Layer — Operational Runbook

**Stellar Wave batch · SW-BE-036**  
Supersedes `backend/docs/REDIS_CACHE_RUNBOOK.md` (preserved for backwards reference).

---

## Table of contents

1. [Architecture overview](#1-architecture-overview)
2. [Environment variables](#2-environment-variables)
3. [Feature flag: cache audit trail](#3-feature-flag-cache-audit-trail)
4. [Rollout & migration](#4-rollout--migration)
5. [Normal operations](#5-normal-operations)
6. [Incident playbooks](#6-incident-playbooks)
7. [Graceful restart / reconnect](#7-graceful-restart--reconnect)
8. [TTL & hit/miss inspection](#8-ttl--hitmiss-inspection)
9. [Namespace flush cookbook](#9-namespace-flush-cookbook)
10. [Circuit-breaker / degraded-mode](#10-circuit-breaker--degraded-mode)
11. [Logging & secrets](#11-logging--secrets)
12. [Monitoring](#12-monitoring)
13. [Rollback](#13-rollback)

---

## 1. Architecture overview

| Component | Role |
|-----------|------|
| `RedisModule` (`@Global`) | Registers `cache-manager` with `cache-manager-ioredis-yet`. Exports `RedisService`, idempotency helpers, and `CacheModule` globally. |
| `RedisService` | Direct `ioredis` client for tokens, rate limits, sorted sets, `SCAN` helpers; uses `CACHE_MANAGER` for cache-manager get/set/del. |
| `redis.config.ts` | `ConfigFactory` that maps `process.env` to `ConfigService.get('redis')`. |
| `env.validation.ts` | Joi schema: single source of truth for allowed env shapes and defaults for Redis variables. |
| `GET /health/redis` | Smoke test: cache set/get for key `health-check` (10 s TTL). Returns `{ status, redis, timestamp }`. Returns HTTP 503 when disconnected. |
| `GET /health/ready` | Full readiness probe (Redis + DB). HTTP 503 when either is down. |
| `GET /health` | Aggregate: `healthy` / `degraded` / `unhealthy`. Only 503 when **all** deps are down; degraded still returns 200. |

> **Important:** `delByPattern` uses Redis `KEYS`, which blocks a large instance. Prefer `scanPage` for production maintenance across wide keyspaces unless the pattern matches a narrow set (< 1000 keys).

---

## 2. Environment variables

Validated at process startup via `validationSchema` in `src/config/env.validation.ts`.

| Variable | Default | Required in prod | Purpose |
|----------|---------|------------------|---------|
| `REDIS_HOST` | `localhost` | yes (real hostname) | Redis host |
| `REDIS_PORT` | `6379` | no | Redis port |
| `REDIS_PASSWORD` | _(empty allowed)_ | if ACL/password enabled | Auth string — **never log** |
| `REDIS_DB` | `0` | no | Logical database index |
| `REDIS_TTL` | `300` | no | Default TTL (seconds) for cache-manager store registration |
| `CACHE_AUDIT_ENABLED` | `false` | no | Emit `CACHE_SET/DEL/INVALIDATE` audit events |

---

## 3. Feature flag: cache audit trail

- **Enable:** `CACHE_AUDIT_ENABLED=true`, deploy, confirm DB volume for `audit_trails`.  
- **Disable:** `CACHE_AUDIT_ENABLED=false` or unset, deploy. Cache behavior is unchanged.  
- **Dependency:** `RedisModule` imports `AuditTrailModule`. Audit write failures are caught and logged — they never propagate to cache callers.

---

## 4. Rollout & migration

- No schema migration required. `CACHE_SET/DEL/CACHE_INVALIDATE` enum values fit in the existing `audit_trails.action varchar(50)`.
- Deploy application code first (backward compatible with audit flag off).
- Enable `CACHE_AUDIT_ENABLED` per environment when DB audit table capacity is confirmed.
- No minimum Redis version bump; platform standard is Redis 6+.

---

## 5. Normal operations

### Health check

```bash
# From any network-accessible host:
curl -sS "https://<host>/health/redis" | jq .
# Expect: { "status": "healthy", "redis": "connected", "timestamp": "..." }

# Readiness (Redis + DB):
curl -sS "https://<host>/health/ready" | jq .

# Aggregate (degraded mode visible here):
curl -sS "https://<host>/health" | jq .
```

### Connectivity smoke test from a pod

```bash
redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" \
  ${REDIS_PASSWORD:+-a "$REDIS_PASSWORD"} PING
# Expect: PONG
```

> Do **not** paste `REDIS_PASSWORD` into tickets, chat, or CI logs.

---

## 6. Incident playbooks

### 6.1 Redis down / connection refused

**Symptoms:** `GET /health/redis` → `unhealthy`, logs show `Redis connection error`, elevated `tycoon_redis_errors_total`.

**Steps:**

1. Confirm network policy / security group allows TCP from API pods to `REDIS_HOST:REDIS_PORT`.
2. Verify `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD`, `REDIS_DB` match the instance — use secrets manager, **not** logs.
3. Attempt a manual `PING` from a pod (see §5).
4. Restart Redis or trigger failover per infra runbook.
5. While Redis is down the API degrades gracefully:
   - Cache `get` returns `undefined` (misses silently)
   - Rate-limit increment returns `0` (callers are not blocked)
   - Auth token operations (set/get refresh token) will throw and surface as 5xx
6. Once Redis is back, `GET /health/redis` will return healthy; no app restart needed — ioredis auto-reconnects.

### 6.2 Elevated latency on admin cache invalidation

**Symptoms:** Latency spikes during admin operations that call `delByPattern` with broad patterns (e.g. `cache:*`).

**Steps:**

1. Check Redis slowlog during the window: `SLOWLOG GET 10`.
2. Narrow the invalidation pattern, or switch to `RedisService.scanPage()` + batched `del` (see §9).
3. Consider scheduling broad flushes during low-traffic windows.

### 6.3 Audit table pressure after enabling `CACHE_AUDIT_ENABLED`

**Symptoms:** DB CPU up, slower requests.

**Steps:**

1. Set `CACHE_AUDIT_ENABLED=false`, redeploy.
2. Add a retention/archival policy on `audit_trails` (product decision).
3. Re-enable after capacity is confirmed or with async batching if introduced in a future change.

### 6.4 High cache miss rate

**Symptoms:** `tycoon_cache_misses_total` growing disproportionately; elevated DB load.

**Steps:**

1. Inspect TTLs (see §8).
2. Confirm the cache key construction in the calling service matches what is written on `set`.
3. Check whether a deploy recently flushed the cache (see §9).

---

## 7. Graceful restart / reconnect

### Application-side reconnect (automatic)

`ioredis` has built-in auto-reconnect with exponential back-off. No application restart is required after a Redis restart unless the process panics.  
The `RedisService` constructor registers `connect` / `disconnect` / `error` listeners that log state changes and update the `tycoon_redis_connections_total` gauge.

### Draining before a Redis maintenance window

1. Put the API in **degraded mode** (optional but recommended for cache-heavy flows):
   ```bash
   # Toggle a feature flag or maintenance mode in your runtime config if present
   ```
2. Restart/upgrade Redis instance.
3. The ioredis client will reconnect automatically when Redis is available again.
4. Confirm recovery: `curl -sS https://<host>/health/redis | jq .status` → `"healthy"`.
5. Optionally warm the cache after restart (e.g. trigger a background job that pre-populates hot keys).

### Force-close the ioredis connection cleanly (e.g. during NestJS shutdown)

`RedisService.quit()` is called automatically during `BeforeApplicationShutdown` via graceful-shutdown hooks registered in `GracefulShutdownService`. This sends a Redis `QUIT` command before the process exits.

```bash
# Verify the pod is draining before termination in k8s:
kubectl logs <pod> | grep "Closing Redis connection"
```

---

## 8. TTL & hit/miss inspection

### Check TTL for a specific key

```bash
redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" \
  ${REDIS_PASSWORD:+-a "$REDIS_PASSWORD"} \
  TTL "cache:<key>"
# -1 = no TTL (persistent), -2 = key does not exist, >0 = seconds remaining
```

### Inspect hit/miss rates via Prometheus

```promql
# Hit rate over the last 5 minutes:
rate(tycoon_cache_hits_total[5m])
  /
(rate(tycoon_cache_hits_total[5m]) + rate(tycoon_cache_misses_total[5m]))

# Absolute miss count (raw):
increase(tycoon_cache_misses_total[1h])
```

### Inspect hit/miss rates via Redis INFO (aggregate, all keyspaces)

```bash
redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" \
  ${REDIS_PASSWORD:+-a "$REDIS_PASSWORD"} \
  INFO stats | grep -E "keyspace_hits|keyspace_misses"
# keyspace_hits:123456
# keyspace_misses:7890
```

### List keys matching a pattern (safe — uses SCAN)

```bash
redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" \
  ${REDIS_PASSWORD:+-a "$REDIS_PASSWORD"} \
  --scan --pattern "cache:shop:*"
```

---

## 9. Namespace flush cookbook

> **Warning:** Flushing keys is irreversible. The cache will be cold after any flush, increasing DB load until keys are repopulated.

### Flush a specific key

```bash
redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" \
  ${REDIS_PASSWORD:+-a "$REDIS_PASSWORD"} \
  DEL "cache:<exact-key>"
```

### Flush all keys in a namespace (pattern-based, application API)

Use `RedisService.delByPattern(pattern)` via an admin script or temporary controller:

```typescript
// Example: delete all shop cache keys
await redisService.delByPattern('cache:shop:*');
```

> `delByPattern` uses `KEYS` internally — **avoid on instances with > 100 k keys**. Use the scan-based alternative below for large keyspaces.

### Flush by namespace using SCAN (safe for large instances)

```bash
# Using redis-cli SCAN loop (bash):
CURSOR=0
PATTERN="cache:shop:*"
while true; do
  RESULT=$(redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" \
    ${REDIS_PASSWORD:+-a "$REDIS_PASSWORD"} \
    SCAN $CURSOR MATCH "$PATTERN" COUNT 100)
  CURSOR=$(echo "$RESULT" | head -1)
  KEYS=$(echo "$RESULT" | tail -n +2)
  if [ -n "$KEYS" ]; then
    echo "$KEYS" | xargs redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" \
      ${REDIS_PASSWORD:+-a "$REDIS_PASSWORD"} DEL
  fi
  [ "$CURSOR" = "0" ] && break
done
```

### Flush all cache keys (nuclear option — dev/staging only)

```bash
# Only do this in dev/staging. In production, coordinate with the team first.
redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" \
  ${REDIS_PASSWORD:+-a "$REDIS_PASSWORD"} \
  FLUSHDB
```

---

## 10. Circuit-breaker / degraded-mode

The application implements **graceful degradation** at the service level — there is no external circuit-breaker library. The behavior per operation type:

| Operation | Redis down behaviour |
|-----------|----------------------|
| `get` | Returns `undefined`; caller treats as cache miss and falls through to DB |
| `set` | Throws (caller should handle); audit event suppressed |
| `del` / `delByPattern` | Throws (callers should handle) |
| `incrementRateLimit` | Returns `0` (callers not blocked — fail-open) |
| `setRefreshToken` | Throws → auth token refresh fails for affected user |
| `getRefreshToken` | Returns `null` → auth will require re-login |
| `scanPage` | Returns `{ nextCursor: 0, keys: [] }` (fail-safe empty result) |
| `getSortedPage` | Returns `{ items: [], total: 0 }` (fail-safe empty result) |

### Health endpoint degraded-mode signals

`GET /health` returns HTTP 200 `{ "status": "degraded" }` when Redis is down but the database is up. This allows Kubernetes readiness probes to choose which endpoint to use:

- Use `/health/ready` for probes that should **stop traffic** when Redis is down.
- Use `/health` for probes that should remain up and use degraded mode.

---

## 11. Logging & secrets

- **Never** log `REDIS_PASSWORD`, full Redis URLs with auth, or refresh token values.
- `RedisService` logs at **debug** for cache hit/miss and user identifiers for token operations.
- Keep production `LOG_LEVEL` at `info` or higher unless troubleshooting.
- Error messages include the ioredis `error.message` only — no passwords or secrets.

---

## 12. Monitoring

### Prometheus metrics

| Metric | Labels | Purpose |
|--------|--------|---------|
| `tycoon_redis_operations_total` | `operation` | Total Redis ops by type |
| `tycoon_redis_errors_total` | `operation` | Errors by op type |
| `tycoon_cache_hits_total` | — | Cache hits |
| `tycoon_cache_misses_total` | — | Cache misses |
| `tycoon_redis_operation_duration_seconds` | `operation` | Latency histogram |
| `tycoon_redis_connections_total` | — | Gauge: 1 connected, 0 disconnected |

### Recommended alerts

- `tycoon_redis_errors_total` rate > 0 for > 2 min → PagerDuty/Slack.
- Synthetic health check on `GET /health/redis` every 30 s → alert on 503.
- Cache hit rate < 50% sustained over 10 min → investigate TTL config or key construction.

---

## 13. Rollback

1. Revert or redeploy the previous image.
2. If audit volume was the issue, set `CACHE_AUDIT_ENABLED=false` without reverting code.
3. No data migration rollback required for audit enum strings.
4. If a bad cache flush caused cold cache load spike, scale out DB replicas temporarily.

---

## Related docs

- `backend/docs/REDIS_CACHE_RUNBOOK.md` — original runbook (preserved).
- `backend/docs/AUTH_JWT_RUNBOOK.md` — refresh tokens use Redis-backed flows.
- `backend/docs/webhooks-runbook.md` — webhook idempotency uses Redis.
- `backend/src/modules/redis/` — module source.
- `backend/src/health/health.controller.ts` — health endpoint implementation.
