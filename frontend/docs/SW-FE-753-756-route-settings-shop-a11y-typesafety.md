# SW-FE-753–756 — Settings and Shop route accessibility & type safety

## What changed

- Settings now has a labelled main landmark, a skip link targeting the settings controls, a polite status announcer, visible keyboard focus styles, and an accessible name for the back button.
- Shop now has equivalent route landmarks, a deterministic skip-link-first keyboard order, labelled preview articles, and an `aria-live` status for purchase-tracking feedback.
- Shop purchase telemetry accepts only complete, finite-price preview items. Invalid data is ignored, and analytics provider failures are caught and announced so they cannot interrupt interaction with the remaining controls.
- Route tests cover landmarks, focus order, normal telemetry, the analytics failure state, and null/invalid preview data.
- **#1480**: Dedicated `page.a11y.test.tsx` for settings adds full focus-order coverage matching the join-room a11y suite pattern (skip link order, back button order, content region tabindex, keyboard activation).

## Acceptance criteria

- [x] Settings has labelled main landmark
- [x] Settings has skip link (sr-only, focus:not-sr-only, focus:ring-2)
- [x] Skip link is first focusable — precedes back button and all settings controls
- [x] Back button has aria-label="Go back" and calls router.back()
- [x] Settings content region has id, tabindex=-1, and focus-visible ring classes
- [x] Status announcer: role=status, aria-live=polite, aria-atomic=true
- [x] Single h1 with id="settings-page-title" matching aria-labelledby
- [x] No regression on join-room

## Verification

```bash
cd frontend
pnpm test -- --run src/app/settings/page.test.tsx src/app/settings/page.a11y.test.tsx src/app/shop/page.test.tsx
pnpm typecheck
pnpm lint
```

No route API or persisted-data contract changed.
