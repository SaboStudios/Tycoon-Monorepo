# Erasure workflow (contract / backend alignment)

## Purpose

Describe how **account deletion** and **anonymization** requests are handled so product, support, legal, and engineering share the same expectations. Implementation may be phased; this document is the source of truth for **what** must happen; **how** is implemented in services, jobs, and (where relevant) on-chain or partner systems.

## Definitions

- **Deletion**: Remove or irreversibly destroy personal data where no retention exception applies.
- **Anonymization**: Replace direct identifiers with non-attributable placeholders while retaining non-personal aggregates or records required for fraud prevention, accounting, or legal obligations.
- **Backend**: NestJS API, PostgreSQL, Redis/Bull workers, file exports under `DATA_EXPORT_DIR`.

## High-level flow

1. **Request intake** — User or support opens a ticket; identity is verified per support runbook.
2. **Classification** — Determine whether the case is full deletion, anonymization-only, or export-only (export does not delete).
3. **Export (optional)** — User may request a data package first (`POST /users/me/data-export`); job completes asynchronously; download uses a short-lived signed URL.
4. **Erasure execution** — Backend runs a defined sequence (to be implemented or extended):
   - Revoke sessions (`refresh_tokens`).
   - Remove or anonymize user profile and preferences.
   - Handle related rows per table (game state, inventory, gifts, notifications, etc.) according to policy: delete, anonymize foreign keys, or retain under a **retention exception** (see `LEGAL_RETENTION.md`).
5. **Downstream systems** — Any blockchain or third-party identifiers must be documented here when integrated: whether they can be deleted, or only unlinked from PII.
6. **Confirmation** — Support confirms completion and retention basis if any data remains.

## Cross-service execution

Erasure and export span more than the backend API. Each service owns its slice and must be driven by the same request so the workflow is consistent end-to-end.

- **backend (NestJS)** — Owns the request record, identity verification, and orchestration. It revokes sessions, anonymizes/deletes profile and preferences, and fans out erasure commands to downstream services. It is the only service that talks to the user directly.
- **shop-api (NestJS, purchases SoT)** — Owns purchase, entitlement, and payment-linkage records. On erasure it anonymizes buyer identifiers while retaining transaction rows required for tax/fraud (see `LEGAL_RETENTION.md`); on export it contributes purchase history to the package.
- **contract (Soroban)** — On-chain state is immutable. Erasure cannot delete ledger entries; the backend must **unlink** wallet addresses from PII (drop the address↔account association) and record that on-chain data is retained unlinked. Export includes the linkage the user currently holds, not historical on-chain history.
- **Redis / Bull workers** — Carry the async export and erasure jobs. Job payloads must reference the request by ID only; no PII or tokens in queue payloads or logs.

### Orchestration contract

1. Backend creates an erasure request row (idempotency key = request ID) and marks it `pending`.
2. Backend performs its own local erasure steps and records per-step status.
3. Backend calls each downstream service's erasure endpoint with the request ID and idempotency key. Each service is idempotent on that key: a retry returns the prior result instead of re-running.
4. A service that is unavailable leaves its step `pending`; the request stays `pending` and is retried by the worker. The workflow is **fail-closed**: it never reports `completed` while any step is unresolved.
5. When all steps report `done` (or `retained` with a documented exception), the request is marked `completed` and support is notified.

### Idempotency and retries

- Every erasure/export entrypoint accepts an idempotency key and reuses the existing `IdempotencyInterceptor` / idempotent decorator pattern.
- Duplicate requests (double-click, reconnect retry, worker redelivery) must resolve to the same request and the same result.
- Partial failures are retried per step; a step that already succeeded is not re-executed.

### Authorization

- Deny-by-default on every privacy entrypoint.
- A user may only act on their own data; the subject is derived from the authenticated principal, never from a client-supplied user ID.
- Admin/support paths are gated by the existing `AdminGuard`; support actions are attributed to the operator for audit.
- No unauthenticated access to export downloads; signed URLs are short-lived and scoped to the requesting user.

### Failure modes

- **Dependency outage (Postgres/Redis/shop-api/RPC)** — Fail-closed on writes: do not mark erasure complete, do not delete partial state without recording it, and surface the request as `pending` for retry.
- **Auth expiry mid-flow** — The request is already persisted; the worker continues under its own service credentials, not the user's session.
- **Token expiry mid-session** — Export download links expire; the user re-requests a fresh link rather than reusing an expired one.
- **Duplicate tab joins / concurrent duplicate requests** — Collapsed by the idempotency key.
- **Event reordering after reconnect / Redis pubsub lag** — Steps are keyed by request ID and are order-independent; a late step result updates status without re-running completed steps.

### Logging and telemetry

- Redact tokens and PII in logs and telemetry; reference requests by ID only.
- Do not place secrets, tokens, or PII in queue payloads, metric labels, or error messages.

## Contract alignment

- **Smart contracts / on-chain**: If user wallets or NFTs are tied to accounts, document whether unlinking, burning, or leaving on-chain data untouched is required; PII must not remain only off-chain if policy requires full erasure of linkage. On-chain entries are retained unlinked; the backend drops the address↔account association.
- **Webhooks / payments**: Stripe or similar IDs may need redaction or retention for tax/fraud; reference finance policy. shop-api anonymizes buyer identifiers while retaining transaction rows under the retention exception.

## Change process

When new tables store personal data, update:

1. `UserDataCollectorService` and `USER_DATA_EXPORT_TABLE_KEYS` (export parity).
2. This document’s erasure steps for those tables.
3. `LEGAL_RETENTION.md` if a new exception applies.
4. The owning service’s erasure/export handler if the table lives outside the backend.
