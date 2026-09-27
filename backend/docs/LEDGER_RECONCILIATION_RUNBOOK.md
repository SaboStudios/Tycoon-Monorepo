# Ledger Reconciliation Runbook

Operational runbook for reconciling the Tycoon ledger (Postgres) against the
shop-api purchase source of truth and the on-chain stake vault escrow.

Related docs:

- `docs/API_ERROR_RESPONSE_STANDARDS.md` — error envelope + error codes.
- `frontend/docs/ADR-003-wallet-strategy-near-only.md` — NEAR-only wallet UI
  until Stellar is gated ready.
- `backend/docs/AUTH_JWT_RUNBOOK.md` — JWT/AdminGuard authz for admin paths.
- `contract/README.md` — stake vault contract surface and invariants.

## Scope

This runbook covers reconciliation of:

1. Shop purchases (shop-api is the source of truth) vs. backend ledger rows.
2. On-chain stake vault escrow deposits, payouts, and refunds vs. ledger rows.

## Stake vault escrow invariants

These invariants MUST hold at all times. Any drift is an incident.

- **Conservation of value**: for every stake vault, the sum of escrowed
  deposits equals the sum of settled payouts plus refunds plus the current
  escrow balance. No value is created or destroyed by payout/refund paths.
- **Idempotency**: a payout or refund is applied at most once per
  `(vault_id, stake_id, operation)` tuple. Duplicate submissions (client
  retries, reconnect replays, RPC re-delivery) MUST be rejected with the
  documented conflict error code and MUST NOT move funds twice.
- **Authorization**: only the vault owner (or an authorized admin via
  `AdminGuard`) may trigger a payout or refund. Untrusted clients cannot
  bypass server authority; the server is the source of truth for money.
- **Fail-closed on writes**: if Postgres, Redis, shop-api, or the chain RPC is
  unavailable, payout/refund writes MUST fail closed. Never partially apply a
  refund.
- **Refund eligibility**: a refund is only valid while the stake is in an
  escrowed, unsettled state. Settled or already-refunded stakes are terminal.

## Reconciliation procedure

1. Snapshot the ledger: export ledger rows for the reconciliation window
   (deposits, payouts, refunds) keyed by `requestId`/correlation id.
2. Snapshot the chain: export stake vault escrow events for the same window.
3. Join on `(vault_id, stake_id, operation)` and classify each row:
   - `matched` — ledger and chain agree.
   - `ledger_only` — ledger row with no chain event (possible failed write).
   - `chain_only` — chain event with no ledger row (possible missed write).
   - `amount_mismatch` — both present, amounts differ.
4. For every non-`matched` row, capture the `requestId` and the error code
   returned to the caller (see `docs/API_ERROR_RESPONSE_STANDARDS.md`).
5. Do NOT auto-correct. Escalate per the severity table below.

## Severity and escalation

| Condition | Severity | Action |
| --- | --- | --- |
| `amount_mismatch` on any payout/refund | SEV1 | Page on-call; freeze refunds via kill switch. |
| `chain_only` refund | SEV1 | Page on-call; investigate missed ledger write. |
| `ledger_only` refund | SEV2 | Verify chain state before retrying; retry is idempotent. |
| Duplicate refund attempts rejected | INFO | Expected; confirm idempotency guard fired. |

## Kill switch / feature flag

Refund and payout writes are gated behind the stake vault escrow feature
flag. To halt refunds during an incident:

1. Disable the stake vault escrow flag (fail-closed: new refunds are
   rejected with the documented unavailable error code).
2. Record the flag change and the `requestId`s of in-flight requests.
3. Reconcile the window before re-enabling.

## Rollback notes

- Reverting the refund code path does not move funds; escrow balances are
  unchanged by a code rollback.
- After rollback, re-run reconciliation for the affected window and confirm
  all rows are `matched` or explicitly escalated.

## Observability

- Every payout/refund path logs `requestId`/correlation id, `vault_id`,
  `stake_id`, and the resulting error code. No tokens or PII in labels.
- Emit metrics for refund attempts, successes, idempotent rejections, and
  fail-closed rejections so drift is detectable before reconciliation.
