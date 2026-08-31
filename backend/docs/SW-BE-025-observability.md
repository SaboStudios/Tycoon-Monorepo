# SW-BE-025 — Metrics & Health: Observability improvements

**Issue:** Stellar Wave · Backend — SW-BE-025  
**Package:** `backend/`

---

## Summary

Hardened and consolidated the observability layer (logs, traces, metrics) for the NestJS API.
All changes are backward-compatible and behind feature flags.

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

## Environment variables

All variables have safe defaults and are already present in `env.validation.ts`.
No new schema changes required.

| Variable | Default | Effect |
|---|---|---|
| `METRICS_ENABLED` | `true` | `false` → `/metrics` returns 403 |
| `REQUEST_LOGGING_ENABLED` | `true` | `false` → HTTP metrics not recorded |

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

---

## Acceptance criteria checklist

- [x] PR references Stellar Wave and issue id **SW-BE-025**
- [x] No secrets in logs (correlation IDs are opaque UUIDs; `LoggerConfig` already redacts sensitive fields)
- [x] Backward-compatible (all flags default to previous on-behaviour)
- [x] Jest specs added for new behaviour
- [x] No schema / migration changes
