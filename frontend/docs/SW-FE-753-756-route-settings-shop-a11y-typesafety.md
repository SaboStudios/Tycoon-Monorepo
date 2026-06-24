# SW-FE-753–756 — Settings and Shop route accessibility & type safety

## What changed

- Settings now has a labelled main landmark, a skip link targeting the settings controls, a polite status announcer, visible keyboard focus styles, and an accessible name for the back button.
- Shop now has equivalent route landmarks, a deterministic skip-link-first keyboard order, labelled preview articles, and an `aria-live` status for purchase-tracking feedback.
- Shop purchase telemetry accepts only complete, finite-price preview items. Invalid data is ignored, and analytics provider failures are caught and announced so they cannot interrupt interaction with the remaining controls.
- Route tests cover landmarks, focus order, normal telemetry, the analytics failure state, and null/invalid preview data.

## Verification

```bash
cd frontend
pnpm test -- --run src/app/settings/page.test.tsx src/app/shop/page.test.tsx
pnpm typecheck
pnpm lint
```

No route API or persisted-data contract changed.
