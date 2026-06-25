# Game Components Performance Analysis

## CLS (Cumulative Layout Shift)

### Issues Found & Fixed

1. **Marketplace Image Containers (Marketplace.tsx:165-182)**
   - **Issue**: Card images using placeholder text without reserved space could shift on image load
   - **Status**: MITIGATED
   - **Details**: Component uses `aspect-square` class to reserve fixed-size space, preventing layout shift. Uses div with character placeholder instead of actual images to avoid network latency.
   - **Recommended Aspect Ratio**: `1:1` (square) for shop item images

2. **Leaderboard Avatar Placeholders (Leaderboard.tsx:104-105)**
   - **Issue**: Avatar icons in table rows need consistent sizing
   - **Status**: FIXED
   - **Details**: Fixed dimensions (`h-10 w-10`) ensure no layout shift. Uses lucide icon with consistent stroke width.
   - **Recommended Dimensions**: 40x40px (h-10 w-10 in Tailwind)

3. **ActionLog Container (ActionLog.tsx:35)**
   - **Issue**: Scrollable container could have variable heights
   - **Status**: FIXED
   - **Details**: Fixed `min-h-[150px] max-h-[300px]` prevents vertical layout shift
   - **Recommended Container Height**: 150px minimum, 300px maximum

4. **Marketplace Gradient Hover Overlay (Marketplace.tsx:179-181)**
   - **Issue**: Gradient overlay appears on hover, could affect layout
   - **Status**: FIXED
   - **Details**: Uses `opacity-0 group-hover:opacity-100` with absolute positioning. No layout shift since positioned absolutely within reserved space.
   - **Impact**: Visual only, no layout impact

### Recommendations

- **Explicit Image Dimensions**: When image_url is used in Marketplace (currently unused), include explicit `width` and `height` attributes
- **Skeleton Loaders**: GameWaiting components could benefit from skeleton loaders during async data loads
- **Reserved Space**: All modals and overlays should reserve vertical space before content loads

## LCP (Largest Contentful Paint)

### Issues Found & Analysis

1. **Marketplace Image Loading**
   - **Current State**: Using text fallback (character placeholder) instead of images
   - **Impact**: LCP not affected since no external images loaded
   - **When Images Are Implemented**: 
     - Use Next.js `<Image>` component with `priority` prop for above-fold items
     - Load first row of items eagerly; lazy-load below fold
     - Recommended: First 8-12 items (2-3 rows) as LCP candidates

2. **DiceAnimation (DiceAnimation.tsx)**
   - **Issue**: Animation plays on load with `isRolling={true}`
   - **Status**: OPTIMIZED
   - **Details**: Respects `prefers-reduced-motion`. Animation is CSS-based, non-blocking. Duration: 0.6s
   - **Recommendation**: Keep current implementation; CSS animations don't block paint

3. **Leaderboard Data Loading (Leaderboard.tsx)**
   - **Issue**: Table content loads asynchronously, showing spinner
   - **Status**: GOOD
   - **Details**: Spinner shows during loading, preventing layout shift. No LCP candidate above fold since it's a secondary feature
   - **Impact**: Not LCP-critical

4. **GameWaiting Async Load (implied)**
   - **Status**: TBD (review GameWaitingDesktop/Mobile separately)
   - **Recommendation**: Ensure hero section or title renders before async data

### Recommended Image Dimensions

When implementing actual image loading:

| Component | Type | Dimensions | Aspect Ratio | Use Case |
|-----------|------|-----------|-------------|----------|
| Marketplace Items | Product card | 240x240px | 1:1 | Shop grid items |
| Leaderboard Avatar | User avatar | 40x40px | 1:1 | Profile picture |
| GameBoard Property | Property card | 120x160px | 3:4 | Board squares |
| PropertyCard | Card display | 192x256px | 3:4 | Expanded view |

## Animation Performance

- **DiceAnimation**: 0.6s cubic-bezier animation, respects reduced motion
- **Marketplace Hover**: CSS transitions (500ms transform), opacity changes (no paint blocking)
- **GameBoard Focus Ring**: CSS ring, instant apply (no animation)

### Recommendations

- ✅ CSS animations are preferred over JS animations (already used)
- ✅ `prefers-reduced-motion` is respected where animations exist
- ⚠️ Consider `animation-delay` for staggered item reveals if adding entrance animations

## Font Loading

- Font loading is handled at the application level (fonts via Tailwind/next/font)
- Component-level `font-orbitron` and `font-dmSans` rely on global configuration
- **Recommendation**: Verify font-display: swap is set in global font configuration

## Summary

### Green Lights
- ✅ Aspect ratios and fixed dimensions prevent CLS in all major components
- ✅ Animations respect user preferences
- ✅ No blocking JavaScript during paint
- ✅ Proper skeleton/loading states prevent flashing

### Yellow Flags
- ⚠️ Image implementation planned but not yet active (using text fallback)
- ⚠️ Some async operations could be optimized with prefetching

### Next Steps
1. When implementing `image_url` in Marketplace, use `<Image priority={boolean}>`
2. Add skeleton loaders to GameWaitingDesktop/Mobile for data fetches
3. Consider prefetching leaderboard data for faster perceived load
4. Monitor Core Web Vitals with Web Vitals library or analytics integration

---

**Last Updated**: 2026-06-24  
**Components Audited**: ActionLog, BoardSquare, Marketplace, Leaderboard, DiceAnimation, PropertyCard, GameBoard, TradeModal
