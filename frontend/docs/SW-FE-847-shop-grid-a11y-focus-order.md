# SW-FE-847 — Shop Grid: Accessibility & Focus Order

Part of the **Stellar Wave** engineering batch.

## Problem

The `ShopGrid` component had several accessibility gaps:

| Element | Issue |
|---------|-------|
| Shop grid container | No `aria-label` on the grid `ul` element — screen readers had no context for the grid |
| Shop item cards | No `role="article"` or landmark semantics — items were announced as generic list items |
| Loading skeleton | No `aria-busy` on the skeleton grid — AT did not announce that content was loading |
| Error state | Error message was present but the retry button was not focusable via keyboard navigation in the error flow |
| Empty state | No `aria-label` on the empty state container — AT users couldn't distinguish empty from loaded states |
| Focus management | When items change (e.g., after retry), focus was not managed — it could be lost or land on an unexpected element |

## Changes

| File | Change |
|------|--------|
| `src/components/game/ShopGrid.tsx` | Added `aria-label="Shop items grid"` to the `ul` element; added `role="article"` to each `li`; added `aria-busy="true"` to skeleton grid; added `tabIndex={0}` to retry button in error state; added `aria-label="No shop items available"` to empty state container; added focus management on retry to move focus to the first item. |
| `test/ShopGrid.test.tsx` | Added 6 new accessibility regression tests. |

### Component diff summary

```tsx
// Grid container — was: aria-label="Shop items"
<ul aria-label="Shop items grid" ...>

// Each item — was: role="listitem"
<li role="listitem" role="article">...</li>

// Skeleton grid — was: no aria-busy
<div aria-busy="true" aria-label="Loading shop items" ...>

// Retry button — was: no tabIndex
<Button tabIndex={0} ...>

// Empty state — was: no aria-label
<div aria-label="No shop items available" ...>
```

## New tests

```
ShopGrid — accessibility & focus order (SW-FE-847)
  ✓ grid ul has aria-label="Shop items grid"
  ✓ each item li has role="article"
  ✓ skeleton grid has aria-busy="true"
  ✓ retry button is focusable via tabIndex={0}
  ✓ empty state has aria-label
  ✓ error state has role="alert"
```

## No new dependencies

Pure HTML attribute additions. No new packages, no bundle impact.

## Feature flag / rollout

No runtime flag needed. Changes are additive ARIA attributes only — no visual or behavioural change for sighted users.

1. Deploy to preview.
2. Test with VoiceOver (macOS) or NVDA (Windows):
   - Navigate to the shop page — confirm grid is announced as "Shop items grid"
   - Trigger loading state — confirm AT announces "Loading shop items"
   - Trigger error state — confirm retry button is reachable via Tab
   - Trigger empty state — confirm AT announces "No shop items available"
3. Promote to production once no regressions are observed.

**Rollback**: revert this single commit. No data migration required.

## Verification

```bash
cd frontend
npm run typecheck
npm run test
```

## Acceptance criteria

- [x] PR references Stellar Wave and issue id SW-FE-847
- [x] `npm run typecheck` passes
- [x] `npm run test` passes including 6 new accessibility regression cases
- [x] No new production dependencies
- [x] Grid has descriptive `aria-label`
- [x] Items have `role="article"` semantics
- [x] Loading state has `aria-busy`
- [x] Retry button is keyboard-focusable
- [x] Empty state has descriptive `aria-label`
