# PR Notes — SW-BE-036 & SW-BE-037 [Stellar Wave · Backend]

Closes #80 — SW-BE-036 [Stellar Wave · Backend]  
Closes #81 — SW-BE-037 [Stellar Wave · Backend]

---

## Summary

Two observability/runbook improvements for the NestJS backend, bundled together as they share no runtime dependencies and are both backward-compatible.

---

## SW-BE-036 — Redis / cache layer: operational runbooks

### What changed

| File | Change |
|------|--------|
| `backend/docs/runbooks/redis-cache.md` | **New** — canonical expanded runbook (supersedes `docs/REDIS_CACHE_RUNBOOK.md`). |
| `backend/src/health/health.redis-runbook.spec.ts` | **New** — runbook-level Jest specs for `HealthController` Redis scenarios. |

### Runbook additions (vs the existing `REDIS_CACHE_RUNBOOK.md`)

The existing doc covered env vars, audit trail feature flag, and basic incident playbooks. The new canonical doc at `backend/docs/runbooks/redis-cache.md` adds:

- **§7 Graceful restart / reconnect** — ioredis auto-reconnect behavior, pre-maintenance drain steps, `GracefulShutdownService.quit()` flow, Kubernetes log verification.
- **§8 TTL & hit/miss inspection** — `redis-cli TTL` cookbook, PromQL hit-rate queries, `INFO stats` aggregates, `--scan` key listing.
- **§9 Namespace flush cookbook** — single key, pattern-based flush via `delByPattern`, safe SCAN-loop bash script for large instances, `FLUSHDB` with "dev/staging only" warning.
- **§10 Circuit-breaker / degraded-mode** — per-operation fail-open/fail-closed table, `/health` vs `/health/ready` probe selection guidance for Kubernetes.
- Expanded monitoring table (all metrics including `tycoon_redis_connections_total` gauge) and recommended Prometheus alert thresholds.

### Test coverage

`health.redis-runbook.spec.ts` covers:
- Normal operation: `/health/redis` returns healthy + valid ISO timestamp.
- Redis down (§6.1): `/health/redis` returns HTTP 503 with `redis: disconnected`.
- Degraded mode (§10): `/health` returns HTTP 200 `degraded` when Redis is down but DB is up.
- Readiness probe (§10): `/health/ready` returns HTTP 503 when Redis is down.
- Liveness always healthy regardless of dependencies.

### Migration / rollout notes

- No code changes to production paths.
- No new env vars.
- No schema changes.
- Deploy at any time; no coordination required.

---

## SW-BE-037 — Uploads & validation: observability

### What changed

| File | Change |
|------|--------|
| `backend/src/modules/uploads/uploads-observability.service.ts` | Added `recordUploadStart()` method. |
| `backend/src/modules/uploads/uploads-observability.interceptor.ts` | Calls `recordUploadStart()` before `next.handle()`. |
| `backend/src/modules/uploads/uploads-observability.interceptor.spec.ts` | Replaced empty stub with full spec (239 lines). |

### What was missing

The interceptor only recorded outcomes *after* the handler resolved or rejected. There was no structured log for the upload *start* event, making it impossible to distinguish "upload started but never completed" from "no upload attempted" in production logs.

### Changes

**`recordUploadStart()`** — new method on `UploadsObservabilityService`:
- Emits a structured `upload_start` log at `Logger.log` level.
- Logs `route`, `trace_id`, `ts` (timestamp), `mimeType`, and `sizeBytes` — no file content, no secrets.
- Respects the `UPLOADS_OBSERVABILITY_ENABLED` feature flag (no-ops when disabled).

**Interceptor** — `recordUploadStart` called synchronously before `next.handle()`:
- Uses the same `route`, `traceId`, and file metadata already derived from the request.
- `req.file` may be `undefined` at start time (file not yet parsed by Multer for some routes) — fields fall back to `'n/a'` safely.

### No breaking changes

- Upload API contract unchanged.
- No new env vars (reuses `UPLOADS_OBSERVABILITY_ENABLED`).
- No schema changes.
- `recordUploadStart` is additive — existing callers of `UploadsObservabilityService` are unaffected.

### Test coverage

`uploads-observability.interceptor.spec.ts` now covers:
- `recordUploadStart` fires before handler resolves.
- `recordUploadStart` receives correct route and traceId.
- `recordUploadOutcome` records `success` after handler resolves with correct metadata.
- Response value propagated unchanged on success.
- `validation_error` on `BadRequestException`.
- `multer_error` on `PayloadTooLargeException`.
- Original error re-thrown after recording.
- `x-request-id` used as traceId when valid.
- Fallback traceId generated when header absent or > 128 chars.
- `uploadTraceId` stamped on request object.
- `uploadsRouteLabel` bucketing for 11 route patterns.

### Migration / rollout notes

- No migration needed.
- Observability is on by default (`UPLOADS_OBSERVABILITY_ENABLED=true`). To disable: `UPLOADS_OBSERVABILITY_ENABLED=false`, redeploy.
- The new `upload_start` log line will appear in production logs after deploy. Log volume increase is minimal (one `log`-level line per upload request).

---

## CI checklist

- [x] `backend/` Jest specs added for both issues
- [x] No secrets in logs
- [x] Backward-compatible — no API contract changes
- [x] No new required env vars
- [x] No schema migrations

## Branch

`feat/SW-BE-036-037-redis-runbook-uploads-observability`
