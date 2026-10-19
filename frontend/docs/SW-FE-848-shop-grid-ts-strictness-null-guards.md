# SW-FE-848 — Shop Grid: TypeScript Strictness & Null Guards

Part of the **Stellar Wave** engineering batch.

## Problem

Three type-safety gaps existed in the Shop grid under `strict: true`:

| Location | Issue |
|----------|-------|
| `ShopGrid.tsx` — `handlePurchase` | `items.find((i) => String(i.id) === itemId)` could return `undefined`; the subsequent `item.name`, `item.type`, `item.rarity`, `item.currency`, `item.price` accesses were unsafe if `item` was `undefined`. |
| `ShopGrid.tsx` — `itemRefs.current[index]` | Array access could be `undefined`; calling `.focus()` on `undefined` would throw at runtime. |
| `ShopItem.tsx` — `rarityColors[rarity]` | `rarity` could be a string not in the `rarityColors` map; the fallback `?? rarityColors.common` was present but the `rarityBadgeColors[rarity]` fallback was an empty string `""` instead of a valid class. |

## Changes

| File | Change |
|------|--------|
| `src/components/game/ShopGrid.tsx` | Added early return in `handlePurchase` if `item` is `undefined`; added null-safe focus call `itemRefs.current[next]?.focus()` (already present, verified). |
| `src/components/game/ShopItem.tsx` | Changed `rarityBadgeColors[rarity] ?? ""` to `rarityBadgeColors[rarity] ?? rarityBadgeColors.common` for consistent fallback. |
| `test/ShopGrid.test.tsx` | Added 5 new unit tests for null/undefined guards. |

### Diff summary

```ts
// ShopGrid.tsx — handlePurchase null guard
const handlePurchase = useCallback(
  (itemId: string) => {
    const item = items.find((i) => String(i.id) === itemId);
    if (!item) return; // ← added null guard
    trackPurchaseInitiated({ ... });
    onPurchase?.(itemId);
  },
  [items, onPurchase, trackPurchaseInitiated],
);

// ShopItem.tsx — rarityBadgeColors fallback
// Before:
rarityBadgeColors[rarity] ?? ""
// After:
rarityBadgeColors[rarity] ?? rarityBadgeColors.common
```

## New tests

```
ShopGrid — TypeScript strictness & null guards (SW-FE-848)
  ✓ handlePurchase returns early when item is not found
  ✓ handlePurchase still fires telemetry when item exists
  ✓ handlePurchase still calls onPurchase when item exists
  ✓ renders without error when items is undefined
  ✓ renders without error when items is null
```

## No new dependencies

Pure TypeScript changes. No new packages, no bundle impact.

## Feature flag / rollout

No runtime flag needed. All changes are type-level or defensive runtime guards with identical happy-path behaviour.

1. `npm run typecheck` — must pass with zero new errors.
2. `npm run test` — all existing + 5 new tests must pass.
3. Deploy to preview; no observable behaviour change for end users.

**Rollback**: revert this single commit. No data migration required.

## Verification

```bash
cd frontend
npm run typecheck
npm run test
```

## Acceptance criteria

- [x] PR references Stellar Wave and issue id SW-FE-848
- [x] `npm run typecheck` passes
- [x] `npm run test` passes including 5 new regression cases
- [x] No new production dependencies
- [x] `handlePurchase` is safe against missing items
- [x] `rarityBadgeColors` fallback is a valid class string
