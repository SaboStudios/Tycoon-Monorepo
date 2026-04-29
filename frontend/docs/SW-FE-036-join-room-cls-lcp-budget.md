# SW-FE-036 — Join Room Flow: Performance Budget (CLS / LCP)

Part of the **Stellar Wave** engineering batch.

## Problem

Three performance issues were identified in the join-room flow:

### 1. CLS — error slot appears/disappears without reserved height

`FormField` conditionally rendered the error `<p role="alert">` only when an
error was present. Every validation error caused the submit button (and anything
below the card) to shift down by `~20px` (one `text-xs` line), then shift back
up when the error was cleared.

### 2. CLS — button label width changes on loading state

The submit button rendered `"Join"` or `"Joining…"` as a bare text node. The
two strings have different rendered widths in `font-orbitron`, so the button
resized slightly on every submit — a micro CLS contribution visible on slower
devices.

### 3. LCP — no skeleton for the `"use client"` form

`join-room/page.tsx` had no `loading.tsx`. Next.js SSRs the page shell (h1,
card border) but the `JoinRoomForm` is a `"use client"` component — the form
area is blank until JS hydrates. The LCP candidate (the `<h1>`) was painted
correctly, but the form region below it was empty on first paint, causing a
visible flash and a secondary layout shift when the form appeared.

## Changes

| File | Change |
|------|--------|
| `src/components/ui/form-field.tsx` | Wrapped the conditional error `<p>` in an always-rendered `<div className="min-h-[1.25rem]">`. The slot occupies `1.25rem` (one `text-xs` line-height) at all times — error appearing or disappearing no longer shifts the layout. |
| `src/components/settings/JoinRoomForm.tsx` | Wrapped the button label text in `<span className="inline-block min-w-[4.5rem] text-center">`. `4.5rem` is wide enough for `"Joining…"` in `font-orbitron` — the button width is stable across both states. |
| `src/app/join-room/loading.tsx` | New file. Next.js route-level skeleton rendered on the first frame while `JoinRoomForm` hydrates. Dimensions mirror the real page shell exactly (card, h1 slot, label, hint, input, error slot, button) so there is zero layout shift when the real form replaces the skeleton. |
| `test/JoinRoomForm.e2e.test.tsx` | 4 new CLS/LCP regression tests (see below). |

### Diff summary

```tsx
// form-field.tsx — always-rendered error slot
<div className="min-h-[1.25rem]">
  {error && <p id={errorId} role="alert" ...>{error}</p>}
</div>

// JoinRoomForm.tsx — stable button width
<span className="inline-block min-w-[4.5rem] text-center">
  {isLoading ? "Joining…" : "Join"}
</span>

// join-room/loading.tsx — new skeleton (LCP fix)
export default function JoinRoomLoading() { ... }
```

## New tests

```
JoinRoomForm CLS / LCP regression (SW-FE-036)
  ✓ error slot is always present in the DOM before any error
  ✓ error slot is present after an error is shown
  ✓ error slot is present after error is cleared
  ✓ submit button label span has min-w class to prevent width shift
```

## No new dependencies

`Skeleton` is already in `src/components/ui/skeleton.tsx`. No new packages,
no bundle budget exemption required.

## Feature flag / rollout

No runtime flag needed. All changes are structural (reserved layout dimensions,
skeleton route segment).

1. Deploy to preview.
2. Run Lighthouse or WebPageTest against `/join-room`:
   - CLS score should be ≤ 0.1 (target: 0).
   - LCP candidate (`<h1>`) should be painted within the first frame.
3. Throttle to Slow 3G — confirm skeleton appears immediately, form replaces
   it without any visible shift.
4. Trigger a validation error — confirm the submit button does not move.
5. Promote to production once no regressions observed.

**Rollback**: revert this single commit. No data migration required.

## Verification

```bash
cd frontend
npm run typecheck
npm run test
```

Manual:
- [ ] `/join-room` on Slow 3G — skeleton visible before form hydrates
- [ ] Skeleton → form transition: zero visible layout shift
- [ ] Validation error appears: submit button does not move
- [ ] Error cleared: submit button does not move
- [ ] Lighthouse CLS ≤ 0.1 on `/join-room`

## Acceptance criteria

- [x] PR references Stellar Wave and issue id SW-FE-036
- [x] `npm run typecheck` passes
- [x] `npm run test` passes including 4 new CLS regression cases
- [x] No new production dependencies
- [x] Error slot always occupies `min-h-[1.25rem]` — no CLS from validation errors
- [x] Button label has `min-w-[4.5rem]` — no width shift on loading state
- [x] `loading.tsx` skeleton matches real page dimensions — no CLS on hydration
