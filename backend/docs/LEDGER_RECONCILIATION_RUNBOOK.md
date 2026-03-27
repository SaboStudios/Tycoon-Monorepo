# Ledger Reconciliation — Manual Resolution Runbook

## Overview

The nightly reconciliation job compares internal `purchases` records against the payment provider's order list and flags discrepancies. This runbook covers how to investigate and resolve them.

---

## Discrepancy Types

| Type | Meaning |
|---|---|
| `amount_mismatch` | Ledger `final_price` differs from provider amount by > $0.01 |
| `status_mismatch` | Ledger `status` differs from provider status |
| `missing_in_provider` | Purchase exists in DB but not in provider export |
| `missing_in_ledger` | Provider has a transaction not found in DB |

---

## Alert Threshold

The job emits a `WARN` log and sets `alertThresholdBreached: true` in the report when **> 5 %** of ledger records for the period have discrepancies. The CI workflow also fails the run so the on-call engineer is notified.

---

## Step-by-Step Resolution

### 1. Identify the run

```bash
# List recent discrepancies for a specific run
GET /api/admin/ledger-reconciliation/discrepancies?runId=<runId>
```

Or query the DB directly (read-only):

```sql
SELECT * FROM ledger_discrepancies
WHERE "runId" = '<runId>'
ORDER BY created_at DESC;
```

### 2. Investigate each discrepancy

#### `amount_mismatch`

1. Pull the purchase from the DB: `SELECT * FROM purchases WHERE id = <purchaseId>;`
2. Cross-check with the provider dashboard using `transactionId`.
3. Determine which side is authoritative (provider is usually source of truth for real money).
4. If the ledger is wrong, create a corrective audit entry — **do not UPDATE the purchase directly**; raise a support ticket for the finance team.

#### `status_mismatch`

1. Check if the webhook for this transaction was received (`admin_logs` table, action `payment.success` / `payment.failed`).
2. If the webhook was missed, replay it via the provider dashboard or re-trigger the webhook endpoint manually.
3. If the provider shows `refunded` but ledger shows `completed`, confirm with finance before updating.

#### `missing_in_provider`

1. Verify the `transaction_id` is not a test/sandbox transaction.
2. Check if the purchase was made via an internal balance (no provider record expected) — these can be safely ignored.
3. If a real money transaction is missing from the provider, escalate to the payment provider's support.

#### `missing_in_ledger`

1. Check if the provider transaction maps to a known `purchaseId`.
2. If the purchase exists but `transaction_id` was never set (webhook failure), update the purchase record and mark the discrepancy resolved.
3. If no matching purchase exists, investigate for potential fraud or double-charge.

### 3. Mark as resolved

```bash
PATCH /api/admin/ledger-reconciliation/discrepancies/<id>/resolve
Content-Type: application/json
Authorization: Bearer <admin_token>

{
  "resolutionNote": "Confirmed internal balance purchase — no provider record expected."
}
```

### 4. Escalation

| Severity | Condition | Action |
|---|---|---|
| P1 | `missing_in_ledger` with real money | Page on-call + notify finance |
| P2 | `alertThresholdBreached = true` | Notify engineering lead within 1 h |
| P3 | Isolated `amount_mismatch` < $1 | Log and resolve async |

---

## Dry-Run Mode

In staging (`NODE_ENV=staging`) or when `RECONCILIATION_DRY_RUN=true`, the job produces a full report but **writes nothing to the database**. The report is returned in the API response and uploaded as a CI artifact.

To run a dry-run manually:

```bash
POST /api/admin/ledger-reconciliation/run
{ "dryRun": true, "startDate": "2026-03-27T00:00:00Z", "endDate": "2026-03-28T00:00:00Z" }
```

---

## Environment Variables

| Variable | Default | Purpose |
|---|---|---|
| `RECONCILIATION_DRY_RUN` | `false` | Force dry-run in any environment |

---

## Read-Only Guarantee

The reconciliation service only issues `SELECT` queries against the `purchases` table. It never mutates payment or user data. Resolution is a separate explicit admin action.
