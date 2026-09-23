# Database Connection Pool

> Operational runbook for Tycoon backend Postgres pool sizing and nightly load
> budgets. Cross-links: [`backend/README.md`](../README.md),
> [`CONTRIBUTING.md`](../../CONTRIBUTING.md), and the nightly CI job
> [`.github/workflows/backend-pool-load-nightly.yml`](../../.github/workflows/backend-pool-load-nightly.yml).

## RDS vs Local differences

| Setting | Local / Test | RDS (production / provision) |
|---|---|---|
| `DB_POOL_SIZE` | `5` | `20` |
| `DB_POOL_MIN` | `0` | `2` |
| `DB_POOL_IDLE_TIMEOUT_MS` | `10 000` ms | `30 000` ms |
| `DB_STATEMENT_TIMEOUT_MS` | `0` (disabled) | `30 000` ms |
| `DB_CONNECT_TIMEOUT_MS` | `5 000` ms | `5 000` ms |
| SSL | disabled | `rejectUnauthorized: true` |
| `DB_SYNCHRONIZE` | allowed (`true`/`false`) | always `false` — use migrations |

### Why these values?

**Pool size**  
RDS `db.t3.medium` has `max_connections ≈ 100`. With up to 4 app replicas each
holding 20 connections that is 80 total, leaving 20 for migrations, admin tools,
and read replicas. Local dev uses 5 to avoid exhausting a Docker Postgres
container during parallel test runs.

**Pool min**  
Production keeps 2 warm connections per replica so the first request after a
quiet period does not pay full TCP + TLS + auth latency. Local/test keep 0 so
idle test processes release connections immediately.

**Idle timeout**  
RDS closes idle client connections after 600 s by default. Setting
`idleTimeoutMillis = 30 000` (30 s) ensures the pool proactively recycles
connections well before RDS drops them, preventing `connection reset` errors in
long-running workers.

**Statement timeout**  
Disabled locally so seed scripts and long migrations can run uninterrupted.
Set to 30 s on RDS to kill runaway queries before they hold row locks and
cascade into pool exhaustion.

**SSL**  
RDS requires TLS. Local Postgres (Docker) does not have a certificate, so SSL
is disabled for `development` and `test`.

---

## Fail-closed boot validation

`src/config/database.config.ts` validates pool env vars at boot via
`validatePoolConfig()`. In `NODE_ENV=production` the process **refuses to start**
when any of the following hold, so a misconfigured deploy never serves traffic:

| Condition | Error code |
|---|---|
| `DB_POOL_SIZE` missing / not a positive integer | `DB_POOL_SIZE_INVALID` |
| `DB_POOL_MIN` > `DB_POOL_SIZE` | `DB_POOL_MIN_EXCEEDS_SIZE` |
| `DB_POOL_IDLE_TIMEOUT_MS` < `DB_CONNECT_TIMEOUT_MS` | `DB_IDLE_BELOW_CONNECT` |
| `DB_STATEMENT_TIMEOUT_MS` = `0` (disabled) | `DB_STATEMENT_TIMEOUT_DISABLED` |
| `DB_POOL_SIZE` > `DB_POOL_MAX_ALLOWED` (default `50`) | `DB_POOL_SIZE_ABOVE_BUDGET` |

Outside production the same checks log a `warn` and fall back to safe defaults
so local dev and CI are never blocked. The thrown error message names the
failing variable and the expected range — no secrets or connection strings are
included.

---

## Pool exhaustion alerting

`HttpMetricsService` exposes three Prometheus gauges and one counter scraped at
`GET /metrics`:

| Metric | Type | Description |
|---|---|---|
| `tycoon_db_pool_total` | Gauge | Total open connections (idle + active) |
| `tycoon_db_pool_idle` | Gauge | Idle connections available for reuse |
| `tycoon_db_pool_waiting` | Gauge | Requests queued waiting for a free connection |
| `tycoon_db_pool_exhaustion_total` | Counter | Times waiting ≥ 80 % of pool size |

### Recommended Grafana / CloudWatch alert

```
tycoon_db_pool_waiting / DB_POOL_SIZE >= 0.8
```

Fire a `warning` alert when this ratio is sustained for > 30 s. Fire a
`critical` alert when `tycoon_db_pool_exhaustion_total` increases by > 5 in
1 minute.

---

## Nightly load budgets

`.github/workflows/backend-pool-load-nightly.yml` runs `test/pool-load.spec.ts`
on a nightly cron against an ephemeral Postgres service container. The job
enforces these budgets and fails the run when any is exceeded:

| Budget | Threshold |
|---|---|
| `pool.waitingCount` after burst | `0` |
| p95 acquire latency | `< 50 ms` |
| `tycoon_db_pool_exhaustion_total` delta | `0` |

Run the same check locally (dry-run, no CI required):

```bash
# from backend/
DB_POOL_SIZE=20 DB_POOL_MIN=2 \
DB_POOL_IDLE_TIMEOUT_MS=30000 DB_STATEMENT_TIMEOUT_MS=30000 \
npm run test -- test/pool-load.spec.ts
```

The workflow uses `permissions: contents: read` only and reads DB credentials
from the ephemeral service container — no repository secrets are referenced.

---

## TypeORM DataSource options reference

All options are set in `src/config/database.config.ts` via `buildDataSourceOptions()`.
Override any value with the corresponding environment variable — no code change needed.

```
DB_POOL_SIZE              # max open connections per instance
DB_POOL_MIN               # min warm connections kept open
DB_POOL_IDLE_TIMEOUT_MS   # ms before idle connection is closed
DB_STATEMENT_TIMEOUT_MS   # ms hard limit per statement (0 = off)
DB_CONNECT_TIMEOUT_MS     # ms to wait for a connection from the pool
DB_POOL_MAX_ALLOWED       # upper bound enforced by boot validation (default 50)
```

---

## Health / readiness probes

`GET /health` (liveness) returns `200` as long as the process is up.
`GET /ready` (readiness) performs a `SELECT 1` through the pool and returns
`503` when the pool cannot acquire a connection within `DB_CONNECT_TIMEOUT_MS`.
Kubernetes (`backend/k8s/deployment.yaml`) and Compose
(`backend/docker-compose.yml`) wire these to the same paths and timeouts
documented above; keep them in sync when changing pool budgets.

---

## No idle connection leaks in long-running workers

Workers (BullMQ processors, cron jobs) reuse the shared TypeORM `DataSource`
and therefore share the same pool. Because `idleTimeoutMillis` is set below the
RDS idle client timeout, connections are returned to the OS before RDS drops
them. The pool load test (`test/pool-load.spec.ts`) asserts that
`pool.waitingCount === 0` after a burst, confirming no connections are leaked.

---

## Operator rollback / order of operations

1. **Before deploy** — confirm `DB_POOL_SIZE * replicas <= max_connections - 20`
   (headroom for migrations and admin tools).
2. **Deploy** — the new pod fails fast at boot if pool env vars are invalid
   (`DB_*` error codes above); the previous ReplicaSet keeps serving.
3. **Verify** — `kubectl exec` into a pod and check `GET /ready` returns `200`,
   then watch `tycoon_db_pool_waiting` for 5 minutes.
4. **Rollback** — `kubectl rollout undo deployment/backend` (or
   `docker compose up -d --no-deps backend` with the previous image tag).
   Pool env vars are read at boot only, so no migration or data rollback is
   required for a sizing change.
5. **Post-incident** — if exhaustion alerts fired, lower `DB_POOL_SIZE` per
   replica or add replicas; re-run the nightly load budget job before the next
   release.
