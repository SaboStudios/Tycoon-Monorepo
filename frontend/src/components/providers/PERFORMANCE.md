# Providers Performance Analysis (CLS / LCP)

> Scope: `frontend/src/components/providers/` — Issue #769

## Overview

Providers are non-visual context wrappers. None of them render layout-shifting
DOM directly, but several have async initialisation paths that can affect paint
timing if not handled carefully.

---

## Provider Breakdown

| Provider | Renders DOM? | Async? | CLS Risk | LCP Risk |
|----------|-------------|--------|----------|----------|
| `auth-provider` | No | Yes (refresh) | None | None |
| `theme-provider` | No | No (sync effect) | Low — see below | None |
| `route-focus-provider` | Yes (`<div>` wrapper) | No | None | None |
| `analytics-provider` | No (returns null) | No | None | None |
| `msw-provider` | No (returns null) | Yes (dynamic import) | None | None |
| `pwa-provider` | Yes (fixed banner) | Yes (SW registration) | None — fixed position | None |
| `near-wallet-provider` | No | Yes (dynamic import) | None | Low — see below |
| `toast-provider` | Yes (ToastContainer) | No | None | None |
| `i18n-provider` | Transparent wrapper | No | None | None |

---

## Detailed Analysis

### theme-provider — CLS Risk: Low

**Concern**: On first paint, `preference` starts as `"system"` and `systemTheme`
starts as `"light"` (SSR safe defaults). The `useEffect` resolves the real system
theme and stored preference synchronously on mount.

**Risk**: A brief flash where the wrong theme is applied before the effect runs.
This is a colour-scheme shift, not a layout shift — it does not move elements and
does not contribute to CLS score.

**Mitigation already in place**:
- The app-level theme-script (injected in `<head>`) applies `data-theme` before
  React hydrates, preventing a visual flash in practice.
- `applyTheme` writes `document.documentElement.style.colorScheme` so the browser
  renders the correct scrollbar colour from the first paint.

**Status**: ✅ No CLS contribution. Flash-of-wrong-theme mitigated by inline script.

---

### near-wallet-provider — LCP Risk: Low

**Concern**: The wallet selector and its modal CSS are loaded via dynamic `import()`
inside a `useEffect`. If modal CSS were eagerly loaded it would be a render-blocking
stylesheet on the critical path.

**Mitigation already in place** (`near-wallet-provider.tsx:114`):
```ts
// Load modal CSS only when the selector is actually bootstrapped so
// it stays off the critical CSS path and does not block LCP.
import("@near-wallet-selector/modal-ui/styles.css"),
```
The CSS is fetched in parallel with the JS modules, but only after the component
mounts — never on the critical render path.

**Status**: ✅ Modal CSS is off the critical path. No LCP impact.

---

### pwa-provider — CLS Risk: None

**Pattern**: The install / update banners use `position: fixed` at the bottom of
the viewport. Fixed-position elements are removed from document flow and cannot
shift other content.

**Body padding**: `SiteShell` applies `pb-24` so page content is never obscured by
the banner, but this padding is static and does not change when the banner appears.

**Status**: ✅ No CLS. Fixed-position banners do not affect layout flow.

---

### route-focus-provider — CLS Risk: None

**Pattern**: Wraps all page content in a `<div role="region">` with `outline-none`.
The wrapper is a transparent flex child and adds no dimensions of its own.

**Status**: ✅ No CLS. Wrapper div inherits flow from parent.

---

### analytics-provider — LCP Risk: None

Returns `null`. No DOM, no network requests on the critical path. Analytics events
are fired inside `useEffect` (after paint).

**Status**: ✅ No impact on CLS or LCP.

---

### msw-provider — LCP Risk: None

Returns `null`. The mock worker is dynamically imported only in `development` mode
and only inside `useEffect`, so it is never present in production builds and never
blocks the initial render.

**Status**: ✅ No impact on CLS or LCP.

---

## Recommendations

1. **Keep modal CSS import lazy** in `near-wallet-provider` — do not hoist it to a
   top-level import or it will become render-blocking.
2. **Do not add layout-contributing DOM** to `AnalyticsProvider` or `MSWProvider` —
   they should always return `null`.
3. **If adding a loading skeleton** to `AuthProvider` in the future, use a fixed
   height placeholder matching the final content height to avoid a layout shift when
   the skeleton swaps to real content.
4. **PWA banners**: if a second banner type is added, ensure it is also `position: fixed`
   and that `SiteShell`'s bottom padding accounts for the tallest possible banner.

---

## Summary

| Metric | Status |
|--------|--------|
| CLS risk | ✅ None — no provider renders layout-contributing DOM that changes size after paint |
| LCP risk | ✅ None — heavy assets (wallet CSS) are lazy-loaded off the critical path |
| Render-blocking resources | ✅ None introduced by providers |
| Theme flash | ✅ Mitigated by inline theme-script in `<head>` |

**Last Updated**: 2026-06-26
**Components Audited**: auth-provider, theme-provider, route-focus-provider,
analytics-provider, msw-provider, pwa-provider, near-wallet-provider,
toast-provider, i18n-provider
