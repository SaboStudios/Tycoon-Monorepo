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

## Related documents

- `docs/API_ERROR_RESPONSE_STANDARDS.md` — error response shape and status codes.
- `SHOP_PURCHASES_RUNBOOK.md` — purchase write path and idempotency semantics.
- `ADR-001` / `ADR-003` — architecture and chain gating notes.
