# Runbook: user data export (support)

## Overview

Users can request a **JSON export** of the data categories listed in `docs/privacy/DATA_CATEGORIES.md`. Export is **asynchronous**: the API creates a job, processes it on the `user-data` queue, and exposes a **short-lived download URL** when the job is `ready`.

## API (authenticated user)

1. **Start export** — `POST /api/v1/users/me/data-export` (or legacy unversioned `/api/users/me/data-export` if enabled).  
   - Response: `{ "jobId": <number> }`.  
   - Rate limit: 3 requests per hour per user (subject to change).

2. **Poll status** — `GET /api/v1/users/me/data-export/:jobId`.  
   - While pending/processing: `status` is `pending` or `processing`; no `downloadUrl`.  
   - When `status` is `ready`, response includes `downloadUrl` (relative path with `token` query param).  
   - On failure: `status` is `failed` and `errorMessage` may be present.

3. **Download** — `GET` the `downloadUrl` (no `Authorization` header; token authenticates the request).  
   - Returns `application/json` attachment.  
   - Link expires after `DATA_EXPORT_TTL_HOURS` (default 24h) from completion; job row may still exist but download should be rejected if expired.

## Authorization

- Every privacy entrypoint is **deny-by-default**. A user may only act on their **own** data: `POST/GET /users/me/data-export*` resolves the subject from the authenticated principal, never from a client-supplied `userId`.
- Admin/support paths (e.g. cross-user export or erasure) are gated by the existing `AdminGuard`; a non-admin principal receives `403` and the attempt is logged (redacted).
- A `jobId` that does not belong to the caller returns `404` (not `403`) to avoid job-id enumeration.

## Idempotency

- `POST /users/me/data-export` accepts an `Idempotency-Key` header and reuses the existing `IdempotencyInterceptor` / idempotent-decorator pattern. Replaying the same key returns the **same** `jobId` instead of enqueuing a duplicate job.
- Concurrent duplicate requests (double-click, retry after timeout) collapse to a single job; the second caller receives the original `jobId`.
- Erasure requests follow the same key semantics so a retried erasure does not create a second deletion job.

## Failure modes (fail-closed)

- **Redis down**: Bull (`user-data`) cannot accept jobs. The start endpoint returns `503` and does **not** create a job row, so no half-created export is left behind. Existing `pending` jobs stay `pending` until Redis recovers.
- **Postgres down**: status and start endpoints return `503`; no partial writes are committed.
- **shop-api / RPC down**: export assembly that depends on those services fails the job with `status: failed` and a redacted `errorMessage`; it never emits a partial package as `ready`.
- **Auth expiry mid-flow**: polling and download re-validate the token; an expired session returns `401` and the client must re-authenticate. Download tokens are independent of the session and expire per `DATA_EXPORT_TTL_HOURS`.

## Operational notes

- **Redis** must be up for Bull (`user-data` queue); otherwise jobs stay `pending`.
- **Disk**: exports are written under `DATA_EXPORT_DIR` (default `./storage/data-exports/<userId>/export-<jobId>.json`). Ensure disk space and backup policy exclude these paths from long-term retention if not required.
- **Stuck jobs**: If `processing` for a long time, check worker logs, Redis, and DB row for `user_data_export_jobs`.

## Logging & telemetry

- Never log download tokens, `Authorization` headers, or raw PII. Log the `jobId`, `userId` (as an opaque id), and status transitions only.
- Telemetry labels must not contain email, wallet address, or token values; use the numeric `jobId` and a coarse `status` label.

## Escalation

- Repeated `failed` status: capture `errorMessage`, check application logs, verify DB connectivity and entity migrations (including `user_data_export_jobs`).

## Related docs

- `docs/privacy/DATA_CATEGORIES.md` — what appears in the package.  
- `docs/privacy/ERASURE_WORKFLOW.md` — deletion vs export.  
- `docs/privacy/LEGAL_RETENTION.md` — retention exceptions (legal).
