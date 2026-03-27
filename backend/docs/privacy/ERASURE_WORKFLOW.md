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

## Contract alignment

- **Smart contracts / on-chain**: If user wallets or NFTs are tied to accounts, document whether unlinking, burning, or leaving on-chain data untouched is required; PII must not remain only off-chain if policy requires full erasure of linkage.
- **Webhooks / payments**: Stripe or similar IDs may need redaction or retention for tax/fraud; reference finance policy.

## Change process

When new tables store personal data, update:

1. `UserDataCollectorService` and `USER_DATA_EXPORT_TABLE_KEYS` (export parity).
2. This document’s erasure steps for those tables.
3. `LEGAL_RETENTION.md` if a new exception applies.
