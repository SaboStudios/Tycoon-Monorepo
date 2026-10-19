# SW-FE-753–756 — Settings and Shop route accessibility & type safety

## What changed

- Settings now has a labelled main landmark, a skip link targeting the settings controls, a polite status announcer, visible keyboard focus styles, and an accessible name for the back button.
- Shop now has equivalent route landmarks, a deterministic skip-link-first keyboard order, labelled preview articles, and an `aria-live` status for purchase-tracking feedback.
- Shop purchase telemetry accepts only complete, finite-price preview items. Invalid data is ignored, and analytics provider failures are caught and announced so they cannot interrupt interaction with the remaining controls.
- Route tests cover landmarks, focus order, normal telemetry, the analytics failure state, and null/invalid preview data.
- **#1480**: Dedicated `page.a11y.test.tsx` for settings adds full focus-order coverage matching the join-room a11y suite pattern (skip link order, back button order, content region tabindex, keyboard activation).
- **#1776**: Settings danger zone now requires an explicit confirmation step before any destructive action runs, with strict TypeScript null guards and full a11y coverage.

## Danger zone confirmation (#1776)

- The danger-zone action is a two-step flow: the trigger button opens a confirmation dialog; the destructive action only runs after the user confirms inside the dialog.
- Confirmation dialog requirements:
  - `role="dialog"` with `aria-modal="true"` and `aria-labelledby` pointing at the dialog heading; `aria-describedby` points at the consequence copy.
  - Focus moves to the dialog on open (initial focus on the cancel control so the destructive action is never the default).
  - Focus is trapped within the dialog while open; `Tab`/`Shift+Tab` cycle only through the dialog controls.
  - `Escape` cancels the flow and closes the dialog without running the destructive action.
  - On close (confirm or cancel) focus returns to the trigger button that opened the dialog.
  - The confirm control is disabled while the destructive request is in flight to prevent double CTA clicks; the dialog stays open until the request settles.
- Strict TypeScript null guards:
  - The trigger ref is nullable and every `ref.current` access is guarded before use.
  - The dialog element is only queried/used when the dialog is open; no non-null assertions on possibly-unmounted nodes.
  - The pending destructive handler is typed as `(() => Promise<void>) | null` and is only invoked after a null check.
- Loading / empty / error states:
  - Loading: confirm control shows a busy state (`aria-busy`, disabled) while the destructive request is pending.
  - Empty: when there is no destructive action available, the danger zone renders an explanatory empty state instead of an enabled trigger.
  - Error: a failed destructive request surfaces an error message in the dialog (announced via the polite status region) and re-enables the confirm control so the user can retry or cancel.
- Idempotency: the confirm handler ignores repeat invocations while a request is in flight, so concurrent duplicate clicks cannot fire the destructive action twice.

## Acceptance criteria

- [x] Settings has labelled main landmark
- [x] Settings has skip link (sr-only, focus:not-sr-only, focus:ring-2)
- [x] Skip link is first focusable — precedes back button and all settings controls
- [x] Back button has aria-label="Go back" and calls router.back()
- [x] Settings content region has id, tabindex=-1, and focus-visible ring classes
- [x] Status announcer: role=status, aria-live=polite, aria-atomic=true
- [x] Single h1 with id="settings-page-title" matching aria-labelledby
- [x] No regression on join-room
- [x] Danger zone requires explicit confirmation before the destructive action runs
- [x] Confirmation dialog traps focus, cancels on Escape, and returns focus to the trigger
- [x] Danger-zone state and confirm flow use strict null guards (no non-null assertions)
- [x] Danger-zone loading, empty, and error states are covered
- [x] Confirm control is disabled while the request is in flight (no double CTA clicks)

## Verification

```bash
cd frontend
pnpm test -- --run src/app/settings/page.test.tsx src/app/settings/page.a11y.test.tsx src/app/shop/page.test.tsx
pnpm typecheck
pnpm lint
```

No route API or persisted-data contract changed.
