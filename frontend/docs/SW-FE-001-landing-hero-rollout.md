# SW-FE-001 - Landing Hero Rollout
This change is part of the Stellar Wave frontend batch and targets home page hero performance and accessibility.

## Scope
- Eager render the above-the-fold hero on `/`.
- Defer below-the-fold sections with lightweight placeholders.
- Stabilize animated hero copy to reduce layout movement.
- **Accessibility (SW-FE-001):** Fix heading hierarchy, landmark labels, button names, and decorative element hiding in `HeroSection`.

## Accessibility Changes
| Issue | Fix |
|---|---|
| Two `<h1>` elements (decorative bg + real title) | Decorative bg `<h1>` changed to `<p>` with `aria-hidden="true"` |
| `<section>` had no accessible name | Added `aria-label="Hero"` |
| Buttons had no accessible names | Added `aria-label` to all 4 CTA buttons |
| Decorative background `<div>` exposed to AT | Added `aria-hidden="true"` |
| Decorative SVG shapes inside buttons exposed to AT | Added `aria-hidden="true"` on each `<svg>` |
| Decorative inner `<span>` labels inside buttons | Added `aria-hidden="true"` (button `aria-label` carries the name) |
| Decorative `?` span in title | Added `aria-hidden="true"` |

Focus order is now: section landmark → welcome text → animated tagline → `<h1>` title → description → CTA buttons (top to bottom). No focusable decorative elements remain in the tab sequence.

## Feature Flag Plan
No runtime flag is added in this patch to keep bundle/runtime complexity low.
Use a staged rollout instead:
1. Deploy to preview and compare Core Web Vitals (LCP/CLS) vs baseline.
2. Deploy to a low-traffic environment first (internal/canary).
3. Promote to full production once no regressions are observed.

If rollback is needed, revert this single patch set touching `HeroSection` and its test file.

## Migration Notes
- No API changes.
- No schema/data migration.
- No user action required.
- `HeroSectionMobile` already had correct `aria-label` attributes; no changes needed there.

## Verification Checklist
- `npm run typecheck`
- `npm run test`
- Confirm home route renders primary CTA and title immediately on first paint.
- Verify with a screen reader (or axe DevTools) that only one `h1` is announced and all buttons have meaningful names.
- Monitor LCP and CLS in production telemetry after deploy.
