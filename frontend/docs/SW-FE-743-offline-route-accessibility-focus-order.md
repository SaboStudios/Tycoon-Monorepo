# SW-FE-743 — Offline route accessibility & focus order

## Summary

This update improves the Tycoon offline fallback route by adding accessible page structure, a live network status experience, and clearly ordered keyboard actions.

## What changed

- Added `frontend/src/components/offline/OfflineStatus.tsx`
  - Detects browser online/offline state using `navigator.onLine`
  - Exposes a polite `aria-live` connection status update
  - Persists the last network check timestamp in `sessionStorage`
  - Provides a prominent refresh/retry action for reconnecting
- Updated `frontend/src/app/offline/page.tsx`
  - Wrapped offline content in a semantic `<main>` landmark
  - Added `aria-labelledby` to support screen readers
  - Preserved a deterministic focus order for the retry button and home navigation
- Added integration and unit coverage for new offline route behavior

## Verification

- `cd frontend && pnpm test -- --run src/app/offline/page.test.tsx src/components/offline/__tests__/OfflineStatus.test.tsx`
- `cd frontend && pnpm lint`

## Notes

This fix is isolated to the offline shell route and does not change server-side behavior or the offline service worker fallback contract.

## Offline cache exclusions (#2159)

The `/shop` page and every `/api/shop/*` call (items, inventory, purchase, purchases,
gift) are excluded from the offline cache — see `docs/SW-deny-list.md` and
`isCacheExcludedPath` in `frontend/src/lib/pwa/constants.ts`. A player who loses
connectivity on `/shop` lands on this offline route instead of a cached shop page, so
they are never shown a stale price or a purchase button that looks live.
