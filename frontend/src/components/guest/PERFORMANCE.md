# Performance Optimization Guide for guest/ Components

## Overview
This document details CLS (Cumulative Layout Shift) and LCP (Largest Contentful Paint) optimizations implemented in the guest/ component directory.

## CLS (Cumulative Layout Shift) Fixes

### What is CLS?
CLS measures unexpected layout shifts in the viewport. Shifts caused by animations or dynamically-sized content reduce perceived stability and negatively impact Core Web Vitals.

### Fixes Implemented

#### 1. HeroSection.tsx
- **Issue**: TypeAnimation lazy-loaded components could cause layout shifts during initial render and animation state changes.
- **Fix**: Added explicit `min-height` values to animation containers:
  - Tagline container: `min-h-[30px] md:min-h-[44px] lg:min-h-[56px]`
  - Subtitle container: `min-h-[30px] md:min-h-[44px] lg:min-h-[56px]`
- **Why**: Reserving space prevents the layout engine from reflowing content when TypeAnimation starts rendering.

#### 2. HeroSectionMobile.tsx
- **Issue**: Mobile hero with animated pulse effect and minimum height uncertainty.
- **Fix**: Added explicit `min-h-[42px]` to h1 title and kept animation non-intrusive.
- **Why**: The min-height ensures the title's vertical space is locked before the decorative span animates.

#### 3. HowItWorks.tsx
- **Issue**: Swiper carousel slides with blur/opacity/scale transitions could shift layout while changing visual state.
- **Fix**:
  - Fixed height `h-[350px]` locked for all slide cards
  - Used CSS transform (`scale-[0.95]`, `scale-100`) instead of width/height changes
  - Blur and opacity transitions applied (GPU-accelerated, non-layout-affecting)
- **Why**: GPU-accelerated properties (transform, opacity, filter) do not trigger layout recalculation, while width/height changes do.

#### 4. Background Gradients (HowItWorks.tsx)
- **Issue**: Opacity transitions on background gradients during slide change.
- **Fix**: Used CSS `transition-opacity` (GPU-accelerated) instead of background changes.
- **Why**: Opacity changes do not affect layout; the background is positioned absolutely and does not participate in normal flow.

### Components Without CLS Issues
- **WhatIsTycoon.tsx**: Pure SVG rendering with no dynamic sizing. ✓
- **JoinOurCommunity.tsx**: Static links with no content that appears/disappears. ✓

---

## LCP (Largest Contentful Paint) Optimizations

### What is LCP?
LCP measures when the largest, most visually prominent element finishes rendering. A fast LCP (< 2.5s) significantly improves user perception.

### LCP Candidates by Component

#### HeroSection (Desktop)
- **LCP Candidate**: The main h1 title "TYCOON" (with decorative text)
- **Optimizations**:
  - **Explicit Font Sizing**: `lg:text-[116px] md:text-[98px] text-[54px]` prevents text reflow after font load
  - **Font-Display**: The Orbitron font uses `font-display: swap` in your font stack (verify in CSS), enabling text display immediately with system fallback
  - **No Image**: Pure CSS text rendering is inherently fast
  - **Lazy-loaded TypeAnimation**: Deferred via dynamic import, does not block LCP of the h1
  - **Removed Decorative Overlays**: The large background "TYCOON" text is decorative (aria-hidden) and painted behind the real content
- **LCP Time**: Expected < 1.5s (text rendering is typically fast)

#### HeroSectionMobile (Mobile)
- **LCP Candidate**: The h1 title "TYCOON" (simplified for mobile)
- **Optimizations**:
  - **Explicit min-height**: `min-h-[42px]` reserves space for the title
  - **No Layout Shifts**: Decorative span with fixed size doesn't cause reflow
  - **No Image or Large Media**: Pure CSS text is fast
  - **Reduced Animation Load**: `animate-pulse` is deferred if `prefersReducedMotion` is true (respects user preference)
- **LCP Time**: Expected < 1.2s (mobile optimized)

#### HowItWorks
- **LCP Candidate**: The heading "How it works" or the first Swiper slide depending on viewport
- **Optimizations**:
  - **No Images in Slides**: Each slide has an icon (lucide-react SVG, <1KB) and text
  - **Fixed Slide Height**: `h-[350px]` ensures layout is stable when slides transition
  - **No Font Load Blocking**: Uses Orbitron and dmSans (assumed preloaded or system fallback available)
- **LCP Time**: Expected < 2.0s (text + SVG icons render quickly)

#### WhatIsTycoon, JoinOurCommunity
- **LCP Candidate**: Heading or section content (no images)
- **LCP Time**: Expected < 1.0s (minimal, static content)

---

## Recommended Image Dimensions & Aspect Ratios

### For Future Image Additions
If images are added to any guest/ component, apply these guidelines:

#### Hero Image (if added to HeroSection)
- **Dimensions**: 1200x600px (web), 800x400px (mobile)
- **Aspect Ratio**: 2:1 (landscape)
- **Format**: WebP with JPEG fallback
- **Loading**: Use Next.js `<Image>` with `priority={true}` for LCP candidate images
- **Sizing**: `sizes="100vw"` for full-width backgrounds

#### Card/Feature Images (if added to HowItWorks slides)
- **Dimensions**: 300x300px
- **Aspect Ratio**: 1:1 (square)
- **Format**: WebP with PNG fallback
- **Loading**: Use Next.js `<Image>` without `priority` (loaded as user interacts)
- **Sizing**: `sizes="(max-width: 640px) 90vw, 600px"`

#### Thumbnail/Avatar Images (e.g., in JoinOurCommunity)
- **Dimensions**: 100x100px
- **Aspect Ratio**: 1:1 (square)
- **Format**: WebP
- **Loading**: Standard `<img>` or Next.js `<Image>` without `priority`

---

## Font Loading Strategy
Assuming Orbitron and dmSans are preloaded:
- **Font-Display**: `swap` (display text immediately with fallback, update when font loads)
- **Preload**: Add to `<head>`:
  ```html
  <link rel="preload" href="/fonts/orbitron.woff2" as="font" type="font/woff2" crossorigin>
  <link rel="preload" href="/fonts/dmSans.woff2" as="font" type="font/woff2" crossorigin>
  ```

---

## Animation Performance

### Optimized Animations (GPU-Accelerated)
- `transition-opacity` (HowItWorks background gradients)
- `scale transform` (Swiper slide transitions)
- `animate-pulse` (decorative, non-critical, respects `prefers-reduced-motion`)

### Deferred Animations (Non-Critical)
- **TypeAnimation** in HeroSection/Mobile: Lazy-loaded, starts after initial paint
- **Swiper autoplay**: Configurable, respects `prefers-reduced-motion`

### Animation Delays (Prevent LCP Blocking)
- TypeAnimation in HeroSection starts after `h1` is painted (due to `preRenderFirstString`)
- Swiper autoplay only triggers if motion is not reduced

---

## Monitoring & Testing

### Chrome DevTools Lighthouse
- Run Lighthouse audit on each guest page
- Target: LCP < 2.5s, CLS < 0.1

### Web Vitals Script
Add to production to monitor real user metrics:
```typescript
import { getCLS, getFID, getFCP, getLCP, getTTFB } from 'web-vitals';

getCLS(console.log); // CLS
getLCP(console.log); // LCP
```

### Manual CLS Testing
1. Open each component in Chrome DevTools
2. Emulate "Slow 4G" network
3. Watch for unexpected layout shifts
4. Verify animations use transform/opacity (no width/height changes)

---

## Recommended Reading
- [Web Vitals: CLS](https://web.dev/cls/)
- [Web Vitals: LCP](https://web.dev/lcp/)
- [CSS Triggers: What properties affect what](https://csstriggers.com/)
- [MDN: will-change and GPU Acceleration](https://developer.mozilla.org/en-US/docs/Web/CSS/will-change)

---

## Changes Summary
| Component | CLS Fix | LCP Optimization | Status |
|-----------|---------|------------------|--------|
| HeroSection | Min-height containers | Explicit font sizing, lazy TypeAnimation | ✅ |
| HeroSectionMobile | Min-height h1 | Explicit sizing, deferred animation | ✅ |
| HowItWorks | Fixed slide height, transform scale | Fixed height, no images | ✅ |
| WhatIsTycoon | N/A (SVG only) | N/A (fast text) | ✅ |
| JoinOurCommunity | N/A (static) | N/A (fast text) | ✅ |

**Last Updated**: Issue #763
