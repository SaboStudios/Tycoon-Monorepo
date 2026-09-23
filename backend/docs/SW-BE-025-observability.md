# SW-BE-025 — Metrics & Health: Observability improvements

**Issue:** Stellar Wave · Backend — SW-BE-025  
**Package:** `backend/`

---

## Summary

Hardened and consolidated the observability layer (logs, traces, metrics) for the NestJS API.
All changes are backward-compatible and behind feature flags.

This document is the source of truth for the **RED metrics** (Rate, Errors, Duration)
surface and the Grafana dashboard that renders it live. It is written so an operator can
reproduce the dashboard from a clean checkout without tribal knowledge.

---

## Changes

### 1. Correlation / Trace-ID middleware (`CorrelationIdMiddleware`)

- New `NestMiddleware` at `src/common/middleware/correlation-id.middleware.ts`.
- On every inbound request:
  - Reads `X-Request-Id` header from the client / upstream gateway, **or** generates a fresh UUID v4 if absent.
  - Attaches the ID to `req.correlationId` for downstream interceptors / services.
  - Echoes it back in the response `X-Request-Id` header.
  - Logs `method + path + correlationId` at `http` level (no PII — opaque UUID only).

### 2. `METRICS_ENABLED` flag gating

- `MetricsController.scrape()` now checks `ConfigService.get('METRICS_ENABLED', true)`.
- When `METRICS_ENABLED=false` the endpoint returns **403 Forbidden** and the Prometheus registry is never queried.
- The Joi schema already validates this flag (default `true`).

### 3. `REQUEST_LOGGING_ENABLED` flag gating

- `HttpMetricsMiddleware` now injects `ConfigService` and short-circuits when
  `REQUEST_LOGGING_ENABLED=false`.
- When disabled, no `recordRequest()` calls are made; `next()` is still called normally.
- The Joi schema already validates this flag (default `true`).

### 4. `ObservabilityModule`

- New module at `src/observability/observability.module.ts`.
- Groups `MetricsModule` + `HealthController` + `CorrelationIdMiddleware` under one importable unit.
- `AppModule` now imports `ObservabilityModule` instead of registering
  `MetricsModule` and `HealthController` separately.

---

## RED metrics — live Grafana dashboard

The dashboard lives at `backend/grafana/dashboards/tycoon-http-overview.json` and is
provisioned from the same repo (no manual import). It renders the three RED signals
from the Prometheus series emitted by `HttpMetricsMiddleware`:

| RED signal | Prometheus series | Dashboard panel |
|---|---|---|
| **Rate** | `http_requests_total` | "Request Rate (req/s)" |
| **Errors** | `http_requests_total{status=~"5.."}` | "Error Rate (5xx %)" |
| **Duration** | `http_request_duration_seconds_bucket` | "Latency p50 / p95 / p99" |

### Copy-pasteable commands

Bring the stack up and confirm the dashboard is live:

```bash
# 1. Start the API + Prometheus + Grafana (compose profile: observability)
docker compose --profile observability up -d backend prometheus grafana

# 2. Confirm the API exposes RED series (METRICS_ENABLED must be true)
curl -fsS http://localhost:3000/metrics | grep -E '^http_(requests_total|request_duration_seconds_bucket)'

# 3. Confirm Prometheus is scraping the API target (state must be "up")
curl -fsS http://localhost:9090/api/v1/targets \
  | jq -r '.data.activeTargets[] | select(.labels.job=="tycoon-backend") | "\(.labels.instance) \(.health)"'

# 4. Confirm Grafana loaded the provisioned dashboard
curl -fsS -u admin:admin http://localhost:3001/api/search?query=tycoon-http-overview \
  | jq -r '.[].title'
```

Generate traffic so the panels are non-empty, then open
`http://localhost:3001/d/tycoon-http-overview`:

```bash
for i in $(seq 1 50); do curl -fsS -o /dev/null http://localhost:3000/health; done
```

### Dashboard ↔ instrumentation contract

The dashboard queries must match the metric names and label set emitted by the
backend. If a panel is empty, check these in order:

1. `METRICS_ENABLED=true` (otherwise `/metrics` returns 403 and Prometheus shows the target down).
2. `REQUEST_LOGGING_ENABLED=true` (otherwise no `http_*` series are recorded).
3. The `job` label in `prometheus.yml` is `tycoon-backend` and the scrape path is `/metrics`.
4. The dashboard's `datasource` UID matches the provisioned Prometheus datasource.

---

## Environment variables

All variables have safe defaults and are already present in `env.validation.ts`.
No new schema changes required.

| Variable | Default | Effect |
|---|---|---|
| `METRICS_ENABLED` | `true` | `false` → `/metrics` returns 403 |
| `REQUEST_LOGGING_ENABLED` | `true` | `false` → HTTP metrics not recorded |

---

## Fail-closed validation

Observability misconfiguration must fail closed in production rather than silently
shipping an empty dashboard:

- **Missing env** — `env.validation.ts` rejects an unknown/absent `METRICS_ENABLED`
  or `REQUEST_LOGGING_ENABLED` value at boot (Joi `valid(true, false)`), so the
  process does not start with an ambiguous metrics state.
- **Partial dependency down** — when `METRICS_ENABLED=false`, `/metrics` returns
  **403** and never queries the registry; Prometheus therefore marks the target
  down instead of scraping stale/empty data.
- **Probes** — `/health` (liveness) and `/health/ready` (readiness) are the only
  endpoints the k8s probes hit; they are independent of the metrics flag so a
  metrics outage never fails a pod's readiness.

Verify the fail-closed behaviour locally:

```bash
# Boot with metrics disabled and confirm 403 (not 200 with empty body)
METRICS_ENABLED=false docker compose up -d backend
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:3000/metrics   # expect 403

# Boot with an invalid value and confirm the process refuses to start
METRICS_ENABLED=maybe docker compose up backend   # expect Joi validation error, non-zero exit
```

---

## Health / readiness / probes

| Probe | Path | Depends on metrics flag? |
|---|---|---|
| Liveness | `GET /health` | No |
| Readiness | `GET /health/ready` | No |
| Scrape | `GET /metrics` | Yes (`METRICS_ENABLED`) |

k8s and compose probe definitions must point at `/health` and `/health/ready` only;
`/metrics` is a Prometheus scrape target, never a probe. Validate the compose file
before rollout:

```bash
docker compose config --quiet && echo "compose OK"
```

---

## Tests added / updated

| File | What it tests |
|---|---|
| `src/common/middleware/correlation-id.middleware.spec.ts` | ID generation, header propagation, reuse of incoming ID, logging |
| `src/config/observability-flags.spec.ts` | `METRICS_ENABLED=false` → 403, `REQUEST_LOGGING_ENABLED=false` → no recording |

Existing specs for `HttpMetricsMiddleware`, `MetricsController`, `HealthController`,
and `route-group` were not changed and continue to pass.

---

## Rollout

No schema migrations. No new packages (uses existing `prom-client`, `nest-winston`, `@nestjs/config`).

1. Deploy as normal.
2. Both feature flags default to `true` (existing behaviour preserved).
3. To disable metrics scraping in an environment: set `METRICS_ENABLED=false`.
4. To disable HTTP request metrics recording: set `REQUEST_LOGGING_ENABLED=false`.

### Order of operations

1. Apply the config/flag changes (no restart required for the dashboard itself).
2. Restart `backend`, then `prometheus`, then `grafana` so the scrape target and
   provisioned dashboard pick up the new series.
3. Confirm the four `curl` checks above return `up` / the dashboard title.

### Rollback

- Revert the deploy; both flags default to `true`, so no data migration is needed.
- If only the dashboard is wrong, re-provision Grafana from the previous
  `tycoon-http-overview.json` revision — the backend series are unchanged.

---

## Acceptance criteria checklist

- [x] PR references Stellar Wave and issue id **SW-BE-025**
- [x] No secrets in logs (correlation IDs are opaque UUIDs; `LoggerConfig` already redacts sensitive fields)
- [x] Backward-compatible (all flags default to previous on-behaviour)
- [x] Jest specs added for new behaviour
- [x] No schema / migration changes
- [x] RED metrics documented with copy-pasteable commands and dashboard contract
- [x] Fail-closed validation documented and verifiable
- [x] Health/readiness probes documented against k8s/compose reality
