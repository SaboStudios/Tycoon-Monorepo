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
4. **Erasure execution** — Backend runs a defined sequence via `DELETE /users/me/erase`:
   - Revoke all sessions (`refresh_tokens` table).
   - Delete game participation records (`game_players` table).
   - Delete notifications tied to the user (`notifications` table; deletes FK **without breaking** due to no `NOT NULL` FK constraint).
   - Delete gifts sent or received by the user (`gifts` table).
   - Delete purchases and inventory (`purchases`, `user_inventory` tables).
   - Delete audit trail records mentioning the user (`audit_trail` table).
   - Delete the user record (`users` table).
   - Log erasure in audit trail (action: `privacy:user_erasure`).
   - **Idempotent**: returns 200 and "already erased" if user is not found (supports re-runs).
5. **Downstream systems** — Any blockchain or third-party identifiers must be documented here when integrated: whether they can be deleted, or only unlinked from PII.
6. **Confirmation** — Support confirms completion. Audit log contains timestamp of erasure.

## Contract alignment

- **Smart contracts / on-chain**: If user wallets or NFTs are tied to accounts, document whether unlinking, burning, or leaving on-chain data untouched is required; PII must not remain only off-chain if policy requires full erasure of linkage.
- **Webhooks / payments**: Stripe or similar IDs may need redaction or retention for tax/fraud; reference finance policy.

## API endpoint

**Endpoint:** `DELETE /api/v1/users/me/erase`

**Authentication:** JWT Bearer token (authenticated user erases their own data)

**Response:**
```json
{
  "success": true,
  "message": "User erased" or "User already erased or not found"
}
```

**Status codes:**
- `200 OK` — Erasure completed or was already complete (idempotent)
- `401 Unauthorized` — No valid JWT token provided
- `5xx` — Database error during erasure (transaction rolled back, no partial deletes)

## Testing

**E2E test:** `backend/test/privacy-erasure.e2e-spec.ts`

Runs against a real Postgres instance and verifies:
- User data can be exported before erasure
- Erasure deletes the user and all notifications (no orphaned FKs)
- Re-running erasure on an already-erased user returns success (idempotent)
- Audit trail records the erasure action

**Run:** `npm run test:e2e -- privacy-erasure.e2e-spec.ts`

## Change process

When new tables store personal data, update:

1. `UserDataCollectorService` and `USER_DATA_EXPORT_TABLE_KEYS` (export parity).
2. `UserDataErasureService` to delete rows from those tables (add before deleting the user).
3. This document’s erasure steps for those tables.
4. `LEGAL_RETENTION.md` if a new exception applies.
5. Add assertions to the e2e test to verify the new table is cleaned up.
