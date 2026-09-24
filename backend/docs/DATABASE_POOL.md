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
