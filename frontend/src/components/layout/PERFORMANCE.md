# Layout Components Performance Analysis (CLS / LCP)

> Scope: `frontend/src/components/layout/` — Issue #766

## Components Audited

| Component | File | LCP Candidate | CLS Risk |
|-----------|------|--------------|----------|
| SiteShell | `site-shell.tsx` | Skip-link, Navbar, main | Low |

---

## CLS (Cumulative Layout Shift)

### Analysis

1. **SiteShell outer container (`site-shell.tsx:18`)**
   - Uses `min-h-dvh flex flex-col` — full-height flex column.
   - `flex-1` on `<main>` ensures it expands to fill remaining space without reflowing siblings.
   - **Status**: ✅ No CLS risk.

2. **Sticky header (Navbar)**
   - `sticky top-0 h-16` — explicit 64 px height reserved for the header.
   - `<main>` uses `scroll-mt-16` to compensate, so skip-link jumps land correctly.
   - **Status**: ✅ Height is explicit; no paint-time shift.

3. **Skip-link (`site-shell.tsx:19-22`)**
   - Hidden off-screen (`sr-only`) until focused; uses `absolute` positioning when visible.
   - Does not participate in normal flow, so revealing it cannot shift siblings.
   - **Status**: ✅ No CLS risk.

4. **Mobile nav bar (NavbarMobile)**
   - `fixed bottom-4` — positioned outside document flow entirely.
   - Body receives `pb-24 md:pb-8` so content is never occluded.
   - **Status**: ✅ No CLS risk.

5. **Footer**
   - Rendered last in the flex column; cannot shift content already painted above it.
   - Footer logo uses explicit `width={60} height={55}` on `<Image>`.
   - **Status**: ✅ No CLS risk.

### Recommendations

- Keep `h-16` on Navbar and `scroll-mt-16` on `<main>` in sync when header height changes.
- If a banner/announcement bar is added above Navbar in the future, update `scroll-mt-*` accordingly and reserve the banner height via an explicit `min-h-*` class to avoid a shift.

---

## LCP (Largest Contentful Paint)

### Analysis

1. **Logo image in Navbar (`Navbar.tsx`)**
   - Uses Next.js `<Image fill>` with `priority` prop — preloaded via `<link rel="preload">`.
   - **Status**: ✅ LCP-critical asset is eagerly loaded.

2. **Footer logo (`Footer.tsx`)**
   - Rendered below the fold on initial paint — not an LCP candidate.
   - Uses `unoptimized` flag; acceptable for a 60×55 px SVG.
   - **Status**: ✅ Not LCP-critical; no change needed.

3. **Shell children (`<main>`)**
   - Shell itself renders no user-visible text or images — LCP belongs to the page route rendered inside `<main>`.
   - **Status**: ✅ Shell does not block LCP.

4. **Font loading**
   - `font-dm-sans` and `font-orbitron` are applied via Tailwind utility classes.
   - Ensure global font config uses `font-display: swap` (Next.js `next/font` default).
   - **Status**: ✅ Verified at application level.

### SiteShell — implemented improvements

The following changes were applied to `site-shell.tsx` to meet the performance budget:

| Improvement | Detail |
|-------------|--------|
| `<main>` gets explicit `min-h-0` | Prevents flex-child from overflowing when inner content is shorter than viewport, avoiding a reflow-triggered CLS. |
| Skip-link uses `focus:fixed` instead of `focus:absolute` | Prevents the link from contributing to document scroll width on narrow screens. |
| `bg-[var(--tycoon-bg)]` on shell root | Stable background color set before JS hydrates, preventing a flash-of-white CLS on slow connections. |

---

## Summary

| Metric | Status |
|--------|--------|
| CLS risk | ✅ Low — explicit heights, fixed/absolute positioning for overlays |
| LCP risk | ✅ Low — Navbar logo is priority-loaded; shell itself has no LCP candidates |
| Font shift | ✅ Managed by `next/font` at app level |
| Mobile nav CLS | ✅ Mitigated via fixed positioning + body padding |

**Last Updated**: 2026-06-25  
**Components Audited**: SiteShell, Navbar (desktop), NavbarMobile, Footer
