# SW-FE-741 — Route layout accessibility & focus order

## Summary

This change adds route-level focus management to the Tycoon frontend app layout. It ensures keyboard and assistive technology users receive focus on page content after client-side route transitions.

## What changed

- Added `src/components/providers/route-focus-provider.tsx`
  - Focuses a hidden route focus anchor when the Next.js pathname changes
  - Tracks the last pathname in a ref to avoid repeated focus on unchanged routes
  - Handles platform edge cases gracefully when the anchor is missing or the pathname is unavailable
- Updated `frontend/src/app/layout.tsx` to wrap page content with `RouteFocusProvider`
- Added tests in `frontend/test/RouteFocusProvider.test.tsx`

## Verification

- `npm test -- --run frontend/test/RouteFocusProvider.test.tsx`
- `npm run lint`

## Notes

This is an additive accessibility improvement and does not change the visual layout or navigation targets of existing pages.
