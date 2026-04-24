# SW-FE-006 — Shop Grid: Telemetry Hooks (Privacy-Safe)

Part of the **Stellar Wave** engineering batch.

## What was added

### New events in `src/lib/analytics/taxonomy.ts`

| Event | Fields |
|---|---|
| `shop_grid_viewed` | `route`, `item_count`, `source` |
| `shop_item_impression` | `route`, `item_id`, `item_name`, `item_category`, `item_rarity` |
| `shop_purchase_initiated` | `route`, `item_id`, `item_name`, `item_category`, `item_rarity`, `currency`, `value` |

### New hook `src/hooks/useShopTelemetry.ts`

Thin wrappers over the existing `track()` pipeline. Accepts only non-PII parameters
and passes them through `sanitizeAnalyticsPayload` automatically.

### ShopGrid wiring (`src/components/game/ShopGrid.tsx`)

| Lifecycle point | Event fired |
|---|---|
| Items become visible (not loading, not error) | `shop_grid_viewed` |
| User clicks Buy on an item | `shop_purchase_initiated` |

A new optional prop `telemetrySource` (default `"shop_page"`) lets callers
identify the surface (e.g. `"game_overlay"`) in the `source` field.

## Privacy guarantees

- **No user IDs** — `user_id` / `wallet_address` / `session_id` are not in any event schema.
- **No transaction hashes** — `hash` / `token` are not in any event schema.
- **Double protection** — `sanitizeAnalyticsPayload` strips any field not in the
  schema AND any field in the `blockedPiiKeys` set.
- Tests assert both layers: schema inspection + `sanitizeAnalyticsPayload` output.

## No new dependencies

Uses the existing `track()` / `sanitizeAnalyticsPayload` pipeline already in
`src/lib/analytics/`. No bundle budget impact.

## Feature flag / rollout

Telemetry respects the existing `NEXT_PUBLIC_ENABLE_ANALYTICS` flag:

```bash
# Disable all analytics including Shop grid telemetry
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
- [ ] Load shop page → `shop_grid_viewed` in `window.__tycoonAnalytics.events`
- [ ] Click Buy on any item → `shop_purchase_initiated` with correct item fields
- [ ] Confirm no `user_id`, `wallet_address`, or `session_id` in any event payload
- [ ] Set `NEXT_PUBLIC_ENABLE_ANALYTICS=false` → no events fired

## Acceptance criteria

- [x] PR references Stellar Wave and issue id SW-FE-006
- [x] `npm run typecheck` passes
- [x] `npm run test` passes — new cases in `ShopGrid.test.tsx` and `useShopTelemetry.test.ts`
- [x] No PII fields in any Shop grid event schema
- [x] No new production dependencies
- [x] Respects existing `NEXT_PUBLIC_ENABLE_ANALYTICS` kill-switch
