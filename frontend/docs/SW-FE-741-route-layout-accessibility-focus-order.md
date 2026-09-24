# SW-FE-741 — Route layout accessibility & focus order

## Summary

This change adds route-level focus management to the Tycoon frontend app layout. It ensures keyboard and assistive technology users receive focus on page content after client-side route transitions, and that the route layout exposes correct landmarks, a skip link, and keyboard-operable navigation.

## What changed

- Added `src/components/providers/route-focus-provider.tsx`
  - Focuses a hidden route focus anchor when the Next.js pathname changes
  - Tracks the last pathname in a ref to avoid repeated focus on unchanged routes
  - Handles platform edge cases gracefully when the anchor is missing or the pathname is unavailable
- Updated `frontend/src/app/layout.tsx` to wrap page content with `RouteFocusProvider`
- Added tests in `frontend/test/RouteFocusProvider.test.tsx`

## Route layout requirements (SW-FE-741/743/753-756)

### Landmarks & skip link (SW-FE-741)

- The app shell MUST expose exactly one `<header>`, one `<main id="main-content">`, and one `<footer>` landmark per route.
- A skip link MUST be the first focusable element in the DOM and target `#main-content`:
  - Visible on `:focus-visible`, visually hidden otherwise.
  - Activating it moves focus to `<main>` (which carries `tabIndex={-1}`).
- `<main>` MUST be the single scroll/focus target for route content; nested `<main>` elements are forbidden.

### Focus order (SW-FE-743)

- On client-side navigation, focus MUST move to the route focus anchor (`#route-focus`) rendered inside `<main>`.
- Focus MUST NOT be stolen on initial mount, on same-pathname re-renders, or when the user is mid-interaction (e.g. typing in an input).
- Tab order MUST follow DOM order: skip link → header nav → main content → footer.
- Modals/drawers MUST trap focus while open and restore focus to the invoking element on close.

### Keyboard operability (SW-FE-753)

- Every interactive control MUST be reachable and operable with `Tab`/`Shift+Tab`, `Enter`, and `Space`.
- Custom widgets MUST NOT rely on pointer-only handlers; provide keyboard equivalents.
- Visible focus indicators MUST be preserved (no `outline: none` without a replacement).

### Loading / empty / error states (SW-FE-754)

- Route-level loading, empty, and error states MUST render inside `<main>` so focus order and landmarks stay stable.
- Loading states MUST expose `role="status"` with an accessible label; error states MUST expose `role="alert"`.
- Error states MUST offer a keyboard-reachable retry action; retry MUST be idempotent (no duplicate in-flight requests).
- All state branches MUST use strict TypeScript null guards — no non-null assertions on route/query data.

### Live data & bundle (SW-FE-755)

- Route layout MUST consume live APIs only; MSW/mocks MUST NOT be present in the production bundle.
- Heavy wallet/board dependencies MUST be code-split so route layout does not regress CLS/bundle budgets.

### Telemetry (SW-FE-756)

- Route-level analytics MUST fire only after consent and MUST NOT include PII or tokens in labels.
- Unknown analytics providers MUST fail the build rather than silently no-op.

## Verification

- `npm test -- --run frontend/test/RouteFocusProvider.test.tsx`
- `npm run lint`
- `npm run bundle:check`
- Playwright smoke/critical journeys cover the route funnel

## Notes

This is an additive accessibility improvement and does not change the visual layout or navigation targets of existing pages.
