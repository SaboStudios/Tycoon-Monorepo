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

---

## 1. Architecture overview

| Component | Role |
|-----------|------|
| `RedisModule` (`@Global`) | Registers `cache-manager` with `cache-manager-ioredis-yet` (same host/db/password as app config). Exports `RedisService`, idempotency helpers, and `CacheModule`. |
| `RedisService` | Direct `ioredis` client for tokens, rate limits, sorted sets, `KEYS`/`SCAN` helpers; uses `CACHE_MANAGER` for cache-manager get/set/del. |
| `redis.config.ts` | `ConfigFactory` for `ConfigService.get('redis')`. |
| `env.validation.ts` | Joi schema: single source of truth for allowed env shapes and defaults for Redis-related variables. |
| `GET /health/redis` | Smoke test: cache set/get for key `health-check` (short TTL). Routed **outside** the versioned API prefix (see `configureApiVersioning` exclusions). |

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

---

## 7. Logging & secrets

- **Do not** log `REDIS_PASSWORD`, full Redis URLs with auth, or refresh token values. `RedisService` logs keys at **debug** for cache hit/miss and identifiers like `userId` for token operations — keep production `LOG_LEVEL` at `info` or higher unless troubleshooting.
- Error messages include Redis/ioredis `message` only (no password).

---

## 8. Monitoring

Prometheus metrics (non-exhaustive):

- `tycoon_redis_operations_total{operation="..."}`
- `tycoon_redis_errors_total`
- `tycoon_cache_hits_total` / `tycoon_cache_misses_total`
- `tycoon_redis_operation_duration_seconds`

Alert on sustained error rate and on `health/redis` failing synthetic checks.

---

## 9. Rollback

1. Revert or redeploy previous image.
2. If audit volume was the issue, set `CACHE_AUDIT_ENABLED=false` without reverting code.
3. No data migration rollback is required for audit enum strings.

---

## Related docs

- `docs/AUTH_JWT_RUNBOOK.md` — refresh tokens also use Redis-backed flows in auth.
- `docs/webhooks-runbook.md` — webhook idempotency uses Redis.
