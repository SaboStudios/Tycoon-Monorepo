# Graceful Shutdown & Health/Readiness Probes

This document describes how Tycoon backend services (backend and shop-api)
shut down gracefully and how orchestrators should probe them.

## Liveness vs Readiness

Tycoon exposes two distinct probe endpoints on every NestJS service
(`backend` and `shop-api`). They must not be conflated.

| Probe | Endpoint | Meaning | Orchestrator action |
|-------|----------|---------|---------------------|
| Liveness | `GET /health` | The process is alive and the event loop is responsive. It does **not** check dependencies. | Restart the container only if this fails repeatedly. |
| Readiness | `GET /ready` | The process can serve traffic: required dependencies (Postgres, Redis) are reachable. | Remove the instance from the load balancer / do not route traffic. |

### Semantics

- **`/health` (liveness)** returns `200` with a minimal body
  (`{ "status": "ok" }`). It must never depend on Postgres, Redis, or any
  downstream service. A dependency outage must not cause a liveness failure,
  otherwise the orchestrator will restart-loop healthy processes.
- **`/ready` (readiness)** returns `200` only when all required dependencies
  are reachable. If any required dependency is down it returns `503` with
  `{ "status": "unavailable", "checks": { ... } }`.

### Fail-closed behavior

Readiness is **fail-closed**: if a required dependency cannot be verified, the
probe reports not-ready. Writes (purchases, inventory, admin mutations) must
never be served by an instance that is not ready. The server remains the source
of truth for money, dice, and inventory.

## Probe responses

Probe responses are intentionally minimal and must not leak secrets or PII.

- Do **not** include connection strings, credentials, hostnames, or user data.
- Dependency check results are reported as coarse status only
  (e.g. `"postgres": "up" | "down"`), never with error messages that could
  contain connection details.
- Telemetry labels for probe metrics must use bounded values
  (service name, probe name, status) and must not include request payloads,
  tokens, or PII.

Example readiness response when healthy:

```json
{ "status": "ok", "checks": { "postgres": "up", "redis": "up" } }
```

Example readiness response when a dependency is down:

```json
{ "status": "unavailable", "checks": { "postgres": "up", "redis": "down" } }
```

## Metrics

Probe outcomes are recorded using the existing observability conventions
(RED metrics). Each probe emits a counter/histogram labelled with the service
name, probe name (`health` / `ready`), and outcome (`ok` / `unavailable`).
Labels stay bounded and free of secrets or PII.

## Graceful shutdown sequence

On `SIGTERM` / `SIGINT`:

1. The service stops accepting new connections (readiness flips to not-ready
   so the orchestrator drains traffic first).
2. In-flight requests are allowed to complete within the shutdown grace period.
3. Database and Redis connections are closed cleanly.
4. The process exits `0`.

If the grace period elapses, the process exits non-zero and the orchestrator
may force-kill it.

## Operator expectations

- Configure liveness probes against `/health` and readiness probes against
  `/ready` for both `backend` and `shop-api`.
- Do not point liveness probes at `/ready`; a dependency outage would then
  trigger unnecessary restarts.
- During a Postgres or Redis outage, expect instances to report not-ready and
  be removed from rotation. Writes fail closed until dependencies recover.
- After dependencies recover, readiness returns to `200` automatically; no
  manual restart is required.

## Nightly pool load & budget regression

The nightly pool load job (`.github/workflows/backend-pool-load-nightly.yml`)
replays the pool load against a staging environment and asserts that the
budget (latency/error SLO) has not regressed. It is **fail-closed**: a budget
regression, a missing required env var, or a partial dependency outage must
produce a non-zero exit and a red job — never a silent pass.

### Required configuration

The job fails closed when any of the following are missing or empty:

- `POOL_LOAD_BASE_URL` — target environment base URL (staging only).
- `POOL_LOAD_DURATION` — load duration (e.g. `5m`).
- `POOL_LOAD_CONCURRENCY` — concurrent virtual users.
- `POOL_LOAD_BUDGET_P95_MS` — maximum allowed p95 latency in ms.
- `POOL_LOAD_BUDGET_ERROR_RATE` — maximum allowed error rate (0–1).

Secrets (auth tokens, DB/Redis URLs) are injected via GitHub Actions secrets
and must never be echoed to logs. The workflow redacts them before printing.

### Running the pool load locally

```bash
# 1. Export the same env the nightly job uses (never commit real secrets).
export POOL_LOAD_BASE_URL="https://staging.example.com"
export POOL_LOAD_DURATION="5m"
export POOL_LOAD_CONCURRENCY="50"
export POOL_LOAD_BUDGET_P95_MS="400"
export POOL_LOAD_BUDGET_ERROR_RATE="0.01"

# 2. Verify required env is present before running (fail-closed).
for v in POOL_LOAD_BASE_URL POOL_LOAD_DURATION POOL_LOAD_CONCURRENCY \
         POOL_LOAD_BUDGET_P95_MS POOL_LOAD_BUDGET_ERROR_RATE; do
  if [ -z "${!v:-}" ]; then echo "missing required env: $v" >&2; exit 1; fi
done

# 3. Run the pool load and capture the budget report.
npm run pool-load -- --report pool-load-report.json
```

### Interpreting budget results

The run exits non-zero when either budget is exceeded:

- `p95_ms > POOL_LOAD_BUDGET_P95_MS` → latency regression.
- `error_rate > POOL_LOAD_BUDGET_ERROR_RATE` → reliability regression.

Inspect `pool-load-report.json` for the observed p95 and error rate. A partial
dependency outage (Postgres/Redis/shop-api/RPC) surfaces as an elevated error
rate and therefore fails the budget check — do not lower the budget to make a
red run green.

### Rollback / order of operations

1. **Confirm the regression is real** — re-run the job once to rule out a
   transient dependency blip; check `/ready` on the target environment.
2. **Do not merge** the change that introduced the regression. The nightly job
   is a gate; a red run blocks promotion.
3. **Roll back** the offending deploy to the last green revision
   (`kubectl rollout undo deployment/backend` or the equivalent compose tag),
   then re-run the nightly job to confirm green.
4. **Order of operations** when recovering from a dependency outage: restore
   Postgres/Redis first, confirm `/ready` returns `200`, then re-run the pool
   load. Writes stay fail-closed until readiness recovers.
5. **Escalate** if the regression persists after rollback — open an incident
   and link the failing run URL.

## Related documents

- `docs/API_ERROR_RESPONSE_STANDARDS.md` — error response shape and status codes.
- `SHOP_PURCHASES_RUNBOOK.md` — purchase write path and idempotency semantics.
- `ADR-001` / `ADR-003` — architecture and chain gating notes.
- `.github/workflows/backend-pool-load-nightly.yml` — nightly pool load job.
