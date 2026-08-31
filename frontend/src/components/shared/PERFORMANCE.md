# Shared Components Performance Analysis (CLS / LCP)

> Scope: `frontend/src/components/shared/` — Issue #775

## Components Audited

| Component | File | LCP Candidate | CLS Risk |
|-----------|------|--------------|----------|
| Navbar (desktop) | `Navbar.tsx` | Logo image | Low |
| NavbarMobile | `NavbarMobile.tsx` | None | Low |
| Footer | `Footer.tsx` | None (below fold) | Low |

---

## CLS (Cumulative Layout Shift)

### Navbar (`Navbar.tsx`)

1. **Logo image container (`Navbar.tsx:23-25`)**
   - Container: `relative h-8 w-8` — explicit 32×32 px slot reserved before image loads.
   - `fill` on `<Image>` fills the container; no layout shift on image load.
   - **Status**: ✅ Fixed dimensions prevent CLS.

2. **Sticky header height**
   - `sticky top-0 h-16` — 64 px explicitly reserved for the header.
   - `SiteShell` compensates with `scroll-mt-16` and `pb-24 md:pb-8` on the body area.
   - **Status**: ✅ No CLS.

3. **Nav pill container**
   - `rounded-full border … px-3 py-1.5` — fixed padding; no dynamic size changes.
   - Active-link colour switch uses CSS class swap only (no dimension change).
   - **Status**: ✅ No CLS.

4. **Auth section (login link / email + logout button)**
   - Both states occupy similar horizontal space (`text-xs rounded-full px-4 py-1.5`).
   - Hydration switch from SSR (unauthenticated) to client (authenticated) swaps text only.
   - **Recommendation**: If a hydration flash causes a visible width jump, wrap in a
     fixed-min-width container: `min-w-[80px]`.
   - **Status**: ✅ Low risk; acceptable for authenticated-only content.

### NavbarMobile (`NavbarMobile.tsx`)

1. **Bottom bar**
   - `fixed bottom-4` — outside document flow; zero CLS contribution.
   - Width: `w-[90%] max-w-md` — stable on orientation change.
   - **Status**: ✅ No CLS.

2. **Slide-up panel**
   - `absolute bottom-16` — positioned relative to viewport, outside flow.
   - Opens/closes via conditional render; does not shift page content.
   - **Status**: ✅ No CLS.

### Footer (`Footer.tsx`)

1. **Logo image**
   - `width={60} height={55}` — explicit intrinsic dimensions reserve space before load.
   - Added `loading="lazy"` — footer is never above fold; defers image fetch.
   - **Status**: ✅ Fixed dimensions + lazy loading applied.

2. **Social icon links**
   - React Icons SVGs render inline at `text-[20px]` (20 px square).
   - No async loading; icons are included in the JS bundle.
   - **Status**: ✅ No CLS.

---

## LCP (Largest Contentful Paint)

### Navbar logo

- Uses `<Image fill priority>` — Next.js emits a `<link rel="preload">` for this asset.
- Container is `h-8 w-8` (32×32 px); the logo is an LCP candidate on route-change repaints.
- **Status**: ✅ `priority` prop ensures eager loading. No change needed.

### Footer logo

- Rendered at the bottom of the page, never above fold.
- Added `loading="lazy"` to defer the request until the user scrolls near the footer.
- **Impact**: Frees early bandwidth for above-fold LCP assets (logo, hero image).
- **Status**: ✅ `loading="lazy"` applied.

### NavbarMobile

- Bottom bar contains no images; LCP is not applicable.
- **Status**: ✅ No change needed.

---

## Font Loading

- `font-dm-sans` and `font-orbitron` are applied via Tailwind utility classes.
- Font subsetting and `display: swap` are managed by `next/font` at the application level.
- **Status**: ✅ No component-level changes required.

---

## Summary

| Component | CLS | LCP | Change Applied |
|-----------|-----|-----|----------------|
| Navbar | ✅ | ✅ | None — already optimal |
| NavbarMobile | ✅ | N/A | None — no images |
| Footer | ✅ | N/A | Added `loading="lazy"` to logo |

### Recommendations for Future Work

- **Auth section width stability**: If A/B tests show a hydration-caused CLS on the
  auth button swap, wrap the auth section in `min-w-[120px] flex justify-end`.
- **Preconnect hint**: If the social link icons ever switch to remote CDN sources,
  add a `<link rel="preconnect">` in the document `<head>`.
- **Monitoring**: Track `CLS` and `LCP` via Web Vitals integration. Navbar logo should
  report LCP < 2.5 s on a simulated 4G connection.

---

**Last Updated**: 2026-06-25  
**Components Audited**: Navbar, NavbarMobile, Footer
