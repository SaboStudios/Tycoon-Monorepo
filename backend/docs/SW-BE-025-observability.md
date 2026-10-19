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

## ERROR_TRACKING ↔ backend `requestId` correlation

The frontend error-tracking surface (`frontend/docs/ERROR_TRACKING.md`) reports client
failures to the backend. To make a client report traceable end-to-end, every API error
response carries the same opaque correlation ID the backend already attaches to the
request, and the frontend forwards it verbatim.

### Contract

- The backend `CorrelationIdMiddleware` (change 1 above) sets `req.correlationId` and
echoes it in the `X-Request-Id` response header on **every** response, including errors.
- Error responses additionally include the ID in the JSON body as `requestId`, per
  `docs/API_ERROR_RESPONSE_STANDARDS.md`:

  ```json
  {
    "statusCode": 500,
    "error": "Internal Server Error",
    "message": "Unexpected error",
    "requestId": "3f1c9b2e-6a4d-4f0e-9c1a-2b7d5e8f0a11"
  }
  ```

- `requestId` is the **same** value as the `X-Request-Id` response header and the
  `correlationId` in the backend logs — never a second, independently generated ID.
- The value is an opaque UUID only. It must never contain user identifiers, tokens,
  emails, wallet addresses, or any other PII, so it is safe to attach to telemetry.

### Frontend reporting rules

- On any non-2xx API response, the frontend reads `requestId` from the error body and
  falls back to the `X-Request-Id` response header when the body is absent or unparsable
  (e.g. a gateway 502 with an HTML body).
- The resolved `requestId` is attached to the error report as a correlation field. If
  neither source yields a value, the report is still sent with `requestId: null` — the
  frontend must never fabricate an ID.
- Error reports are only emitted after analytics consent is granted, and the payload is
  scrubbed of PII before send (see `frontend/docs/ERROR_TRACKING.md`).

### Operator lookup

Given a `requestId` from a user report, find the matching backend log line:

```bash
# Search the backend logs for the correlation ID from the user's error report
kubectl logs -l app=tycoon-backend --since=24h \
  | grep -F '<requestId-from-report>'
```

Because the middleware logs `method + path + correlationId` and echoes the same value in
`X-Request-Id`, a single grep joins the client report to the server request without any
additional tracing infrastructure.

---

## Health vs readiness probes (backend & shop-api)

Liveness and readiness are **distinct** endpoints with different semantics. A pod must
never be restarted because a dependency is briefly unavailable, and must never receive
traffic while a required dependency is down.

### Endpoint contract

| Probe | Path | Purpose | Dependency checks | Failure action |
|---|---|---|---|---|
| **Liveness** | `GET /health` | Process is alive and the event loop is responsive | **None** — no DB/Redis/RPC calls | k8s restarts the pod |
| **Readiness** | `GET /health/ready` | Pod can serve traffic | Postgres + Redis (and shop-api for the backend proxy) | k8s removes the pod from the Service endpoints |

Both endpoints are served by `HealthController` in `src/health/` and are registered
through `ObservabilityModule`. The same contract is implemented in `shop-api/src/health/`
so both services expose identical probe paths.

### Liveness (`GET /health`)

- Returns `200 { "status": "ok" }` as long as the process is running.
- **Must not** touch Postgres, Redis, shop-api, or any RPC. A dependency outage must not
  cause a liveness failure, otherwise a transient DB blip would trigger a restart loop.
- Independent of `METRICS_ENABLED` / `REQUEST_LOGGING_ENABLED` so a metrics outage never
  fails a pod's liveness.

### Readiness (`GET /health/ready`)

- Returns `200 { "status": "ok", "checks": { ... } }` only when **every** required
dependency reports healthy.
- Returns **503 Service Unavailable** with `{ "status": "error", "checks": { ... } }`
  when any required dependency is down — **fail-closed**: an unknown or errored check is
  treated as unhealthy, never as healthy.
- Checks performed:
  - **Postgres** — a lightweight `SELECT 1` against the pool.
  - **Redis** — `PING` against the shared client.
  - **shop-api** (backend only) — `GET <SHOP_API_URL>/health/ready`; the backend is not
    ready to serve purchase reads/writes if the purchases source of truth is unreachable.
- Each check is bounded by a short timeout so a hung dependency fails the probe instead of
  hanging the kubelet.

### Response shape

```json
{
  "status": "ok",
  "checks": {
    "postgres": "up",
    "redis": "up",
    "shopApi": "up"
  }
}
```

On failure the same shape is returned with `status: "error"` and the failing check set to
`"down"`, plus HTTP `503`. Check values are fixed enum strings (`up` / `down`) only — no
connection strings, hostnames, credentials, or error messages are echoed, so the probe
response is safe to expose and never leaks secrets or PII.

### Kubernetes wiring

```yaml
livenessProbe:
  httpGet:
    path: /health
    port: 3000
  initialDelaySeconds: 10
  periodSeconds: 10
readinessProbe:
  httpGet:
    path: /health/ready
    port: 3000
  initialDelaySeconds: 5
  periodSeconds: 5
  failureThreshold: 3
```

### Operator expectations

- **Pod restarting in a loop** → check `/health` (liveness). A liveness failure means the
  process itself is wedged; dependency outages should not appear here.
- **Pod Running but not receiving traffic** → check `/health/ready` (readiness). A `503`
  means a dependency is down; the pod is correctly held out of the Service endpoints.
- **Backend ready but purchases failing** → confirm the `shopApi` check in
  `/health/ready`; a `down` value means the backend is (correctly) not advertising
  readiness for purchase traffic.
- Probes are **read-only** and never mutate state; the server remains the source of truth
  for money, dice, and inventory. No new admin or WS surfaces are introduced by this work.

Verify locally:

```bash
# Liveness — always 200 while the process is up
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:3000/health          # expect 200

# Readiness — 200 when deps are up, 503 when any dep is down
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:3000/health/ready    # expect 200

# Fail-closed: stop Redis and confirm readiness flips to 503 while liveness stays 200
docker compose stop redis
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:3000/health          # expect 200
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:3000/health/ready    # expect 503
```

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
  metrics outage never fails a pod's readiness. Readiness itself fails closed: any
  dependency check that errors or times out is reported as `down` and returns `503`.

Verify the fail-closed behaviour locally:

```bash
# Boot with metrics disabled and confirm 403 (not 200 with empty body)
METRICS_ENABLED=false docker compose up -d backend
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:3000/metrics   # expect 403

# Boot with an invalid value and confirm the process refuses to start
METRICS_ENABLED=maybe docker compose up backend   # expect Joi validation error, non-zero exit
```
