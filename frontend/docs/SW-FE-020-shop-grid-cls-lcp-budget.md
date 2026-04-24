# SW-FE-020 — Shop Grid: Performance Budget (CLS / LCP)

Part of the **Stellar Wave** engineering batch.

## Problem

Two performance regressions were identified in the Shop grid:

### 1. CLS — spinner-only loading state causes layout shift

`ShopGrid` rendered a centred `<Spinner>` while items were loading. When the
spinner was replaced by the real grid the entire page reflowed, producing a
large CLS contribution because no space was reserved for the incoming cards.

### 2. CLS — image-less cards have no reserved height

`ShopItem` cards contain only text and an emoji icon. Without a fixed minimum
height each card collapses to its content height on first paint, then expands
as fonts and icons resolve — shifting everything below the grid.

## Changes

| File | Change |
|------|--------|
| `src/components/game/ShopGrid.tsx` | Removed `Spinner` import. Loading state now renders a skeleton grid using the same `grid-cols-*` classes and `gap-4` as the real grid. Each skeleton card has `min-h-[160px]` matching the real card. Count is `columns × 2` so the viewport area is fully reserved. |
| `src/components/game/ShopItem.tsx` | Added `min-h-[160px]` to the card wrapper `div`. Cards now hold their space in the layout regardless of content length. |
| `src/components/game/ShopGrid.test.tsx` | Updated loading-state tests (skeleton assertions replace spinner assertions). Updated accessibility test (`aria-busy` / `aria-label` instead of `role="status"`). Added `CLS / LCP regression (SW-FE-020)` describe block with 4 tests. |

## No new dependencies

`Skeleton` is already in `src/components/ui/skeleton.tsx`. No bundle budget
exemption is required.

## Feature flag / rollout

No runtime flag needed. Changes are purely structural (reserved layout
dimensions, CSS class parity between skeleton and real grid).

1. Deploy to preview.
2. Run Lighthouse or WebPageTest against `/shop` — compare CLS and LCP scores
   against the baseline in `bundle-baseline.json`.
3. Confirm the skeleton grid matches the real grid column layout at all
   breakpoints (mobile 1-col, tablet 2-col, desktop 3-col).
4. Promote to production once no regressions are observed.

**Rollback**: revert this single commit. No data migration required.

## Verification checklist

```bash
cd frontend
npm run typecheck
npm run test
```

Manual:
- [ ] Navigate to `/shop` on a throttled connection — skeleton grid appears with
      correct column count before items load
- [ ] Confirm no visible layout shift when skeleton transitions to real cards
- [ ] Run Lighthouse — CLS score ≤ 0.1
- [ ] Confirm `ShopItem` cards maintain consistent height across rarity variants

## Acceptance criteria

- [x] PR references Stellar Wave and issue id SW-FE-020
- [x] `npm run typecheck` passes
- [x] `npm run test` passes including 4 new CLS regression cases
- [x] No new production dependencies
- [x] Skeleton grid uses identical column classes to real grid (zero CLS on transition)
- [x] `ShopItem` card has `min-h-[160px]` (no CLS from image-less cards)
