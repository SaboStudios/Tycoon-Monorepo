# Database Connection Pool

## RDS vs Local differences

| Setting | Local / Test | RDS (production / provision) |
|---|---|---|
| `DB_POOL_SIZE` | `5` | `20` |
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

## TypeORM DataSource options reference

All options are set in `src/config/database.config.ts` via `buildDataSourceOptions()`.
Override any value with the corresponding environment variable — no code change needed.

```
DB_POOL_SIZE              # max open connections per instance
DB_POOL_IDLE_TIMEOUT_MS   # ms before idle connection is closed
DB_STATEMENT_TIMEOUT_MS   # ms hard limit per statement (0 = off)
DB_CONNECT_TIMEOUT_MS     # ms to wait for a connection from the pool
```

---

## No idle connection leaks in long-running workers

Workers (BullMQ processors, cron jobs) reuse the shared TypeORM `DataSource`
and therefore share the same pool. Because `idleTimeoutMillis` is set below the
RDS idle client timeout, connections are returned to the OS before RDS drops
them. The pool load test (`test/pool-load.spec.ts`) asserts that
`pool.waitingCount === 0` after a burst, confirming no connections are leaked.

---

## Nightly pool load & budget regression runbook

The nightly pool load job is defined in
[`.github/workflows/backend-pool-load-nightly.yml`](../../.github/workflows/backend-pool-load-nightly.yml).
It runs `test/pool-load.spec.ts` against a real Postgres and **fails closed**:
a budget regression (or a missing env / partial dependency outage) exits
non-zero and the job goes red — it never silently passes.

### Budgets enforced by the job

| Budget | Threshold | Env override |
|---|---|---|
| Peak waiting connections | `0` after burst settles | `POOL_LOAD_MAX_WAITING` |
| Pool exhaustion events | `0` | `POOL_LOAD_MAX_EXHAUSTION` |
| p95 acquire latency | `250` ms | `POOL_LOAD_P95_MS` |
| Leaked connections | `0` | `POOL_LOAD_MAX_LEAKED` |

A run is a **regression** when any measured value exceeds its budget. The job
prints a `BUDGET REGRESSION` block and exits `1`.

### Run it locally (copy-paste)

```bash
# 1. Start a throwaway Postgres matching CI
docker run --rm -d --name tycoon-pool-pg \
  -e POSTGRES_USER=tycoon -e POSTGRES_PASSWORD=tycoon -e POSTGRES_DB=tycoon \
  -p 5432:5432 postgres:16-alpine

# 2. Export the required env (the job fails closed if any are missing)
export DB_HOST=127.0.0.1 DB_PORT=5432 \
       DB_USERNAME=tycoon DB_PASSWORD=tycoon DB_DATABASE=tycoon \
       DB_POOL_SIZE=20 DB_POOL_IDLE_TIMEOUT_MS=30000 \
       DB_STATEMENT_TIMEOUT_MS=30000 DB_CONNECT_TIMEOUT_MS=5000

# 3. Run the pool load spec (same command CI uses)
npm --prefix backend run test:pool-load

# 4. Tear down
docker rm -f tycoon-pool-pg
```

### Interpreting results

- **Green** — every budget met; nothing to do.
- **`BUDGET REGRESSION`** — read the printed table; the offending metric is
  marked `FAIL`. Common causes: `DB_POOL_SIZE` lowered, a new query holding a
  connection across an `await`, or a missing `release()` on a manual query runner.
- **`MISSING ENV`** — the job refuses to run without the required variables
  above. Set them; do not bypass.
- **`DEPENDENCY UNAVAILABLE`** — Postgres/Redis did not become ready within the
  wait window. The job fails closed rather than reporting a false pass.

### Rollback / order of operations

1. **Do not** merge a change that turns the nightly job red.
2. If a regression lands, revert the offending commit first
   (`git revert <sha>`) — do not "fix forward" by raising budgets.
3. If a budget must change, land it as its own PR with a linked issue and a
   note in this runbook explaining the new threshold and why.
4. Re-run the job manually (`workflow_dispatch`) to confirm green before
   closing the incident.
5. Only after green: resume normal deploys. Budgets are a gate, not a target.
