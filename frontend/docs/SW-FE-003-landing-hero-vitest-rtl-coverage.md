# SW-FE-003 — Landing Hero: Vitest / RTL Coverage

This change is part of the Stellar Wave frontend batch and adds comprehensive Vitest / React Testing Library coverage for the Landing Hero section.

## Scope

- Added `test/HeroSection.test.tsx` with full RTL coverage for `HeroSection`:
  - Render structure (section, h1, title, CTAs, welcome message, description)
  - Accessibility (aria-labels, aria-hidden on decorative elements, single h1)
  - Animation behavior (preRenderFirstString, non-empty sequences)
  - CTA button interactions (navigation routing)
  - Reduced motion respect (prefers-reduced-motion: reduce)
- Updated `test/HeroSection.performance.test.tsx` — kept as-is for performance guardrails
- All tests follow existing patterns in the codebase (vitest, @testing-library/react)

## Files Changed

| File | Change |
|------|--------|
| `test/HeroSection.test.tsx` | **Added** — comprehensive RTL coverage |
| `src/components/guest/HeroSection.tsx` | **Updated** — fixed duplicate import, added missing variables (`typeSpeed`, `subSpeed`, `prefersReducedMotion`, `handleTrackedNavigation`) |

## Feature Flag Plan

No runtime flag is added. Tests run in CI via `npm run test`.

## Migration Notes

- No API changes.
- No schema/data migration.
- No user action required.

## Verification Checklist

- [x] `npm run typecheck`
- [x] `npm run test` — all HeroSection tests pass
- [x] PR references Stellar Wave and SW-FE-003
