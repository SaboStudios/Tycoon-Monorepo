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

## Operational notes

- **Redis** must be up for Bull (`user-data` queue); otherwise jobs stay `pending`.
- **Disk**: exports are written under `DATA_EXPORT_DIR` (default `./storage/data-exports/<userId>/export-<jobId>.json`). Ensure disk space and backup policy exclude these paths from long-term retention if not required.
- **Stuck jobs**: If `processing` for a long time, check worker logs, Redis, and DB row for `user_data_export_jobs`.

## Escalation

- Repeated `failed` status: capture `errorMessage`, check application logs, verify DB connectivity and entity migrations (including `user_data_export_jobs`).

## Related docs

- `docs/privacy/DATA_CATEGORIES.md` — what appears in the package.  
- `docs/privacy/ERASURE_WORKFLOW.md` — deletion vs export.  
- `docs/privacy/LEGAL_RETENTION.md` — retention exceptions (legal).
