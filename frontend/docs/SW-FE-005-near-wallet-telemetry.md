# SW-FE-005 — NEAR Wallet Connect: Telemetry Hooks (Privacy-Safe)

Part of the **Stellar Wave** engineering batch.

## What was added

### New events in `src/lib/analytics/taxonomy.ts`

| Event | Fields |
|---|---|
| `near_wallet_connected` | `network_id` |
| `near_wallet_disconnected` | `network_id` |
| `near_tx_submitted` | `network_id`, `method_name` |
| `near_tx_confirmed` | `network_id`, `method_name` |
| `near_tx_failed` | `network_id`, `method_name`, `error_type` |

`error_type` is a short classifier: `"rejected"` | `"no_outcome"` | `"on_chain"`.

### New module `src/lib/near/telemetry.ts`

Thin wrappers over the existing `track()` pipeline. Each function accepts only
non-PII parameters and passes them through `sanitizeAnalyticsPayload` automatically.

### Provider hooks in `near-wallet-provider.tsx`

| Lifecycle point | Event fired |
|---|---|
| `syncAccounts`: `null → accountId` | `near_wallet_connected` |
| `syncAccounts`: `accountId → null` | `near_wallet_disconnected` |
| Transaction enters pending state | `near_tx_submitted` |
| `signAndSendTransaction` returns `null/undefined` | `near_tx_failed(no_outcome)` |
| Outcome resolved, success | `near_tx_confirmed` |
| Outcome resolved, on-chain failure | `near_tx_failed(on_chain)` |
| User rejects wallet prompt | `near_tx_failed(rejected)` |

## Privacy guarantees

- **No account IDs** — `account_id` / `wallet_address` are not in any event schema.
- **No transaction hashes** — `hash` is not in any event schema.
- **Double protection** — `sanitizeAnalyticsPayload` strips any field not in the
  schema AND any field in the `blockedPiiKeys` set (which includes `wallet`,
  `wallet_address`, `token`, `session`, etc.).
- Tests assert both layers: schema inspection + `sanitizeAnalyticsPayload` output.

## No new dependencies

Uses the existing `track()` / `sanitizeAnalyticsPayload` pipeline already in
`src/lib/analytics/`. No bundle budget impact.

## Feature flag / rollout

Telemetry respects the existing `NEXT_PUBLIC_ENABLE_ANALYTICS` flag:

```bash
# Disable all analytics including NEAR telemetry
NEXT_PUBLIC_ENABLE_ANALYTICS=false
```

No separate flag is needed. Staged rollout:

1. Deploy to preview with `NEXT_PUBLIC_ANALYTICS_DEBUG=true` — verify events
   appear in `window.__tycoonAnalytics.events` with no PII fields.
2. Deploy to production — confirm events appear in the configured analytics
   provider dashboard (`plausible` / `ga4` / `posthog`).
3. If any issue, set `NEXT_PUBLIC_ENABLE_ANALYTICS=false` to disable immediately.

## Verification

```bash
cd frontend
npm run typecheck
npm run test
```

Manual (with `NEXT_PUBLIC_ANALYTICS_DEBUG=true`):
- [ ] Connect wallet → `near_wallet_connected` in `window.__tycoonAnalytics.events`
- [ ] Disconnect wallet → `near_wallet_disconnected`
- [ ] Submit tx → `near_tx_submitted`, then `near_tx_confirmed` or `near_tx_failed`
- [ ] Reject wallet prompt → `near_tx_failed` with `error_type: "rejected"`
- [ ] Confirm no `account_id`, `hash`, or `wallet_address` in any event payload

## Acceptance criteria

- [x] PR references Stellar Wave and issue id SW-FE-005
- [x] `npm run typecheck` passes
- [x] `npm run test` passes — 14 new cases in `near-telemetry.test.ts`
- [x] No PII fields in any NEAR event schema
- [x] No new production dependencies
- [x] Respects existing `NEXT_PUBLIC_ENABLE_ANALYTICS` kill-switch
