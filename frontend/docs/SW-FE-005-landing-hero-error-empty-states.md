# SW-FE-005 — Landing Hero: Error and Empty States

This change is part of the Stellar Wave frontend batch and adds error and empty state handling to the Landing Hero section.

## Scope

- Added error state UI to `HeroSection`:
  - Catches navigation failures via `handleTrackedNavigation` try/catch
  - Displays user-friendly error message using `sanitizeError` from `@/lib/errors`
  - Shows "Try Again" button that resets the error state
  - Error state has `role="alert"` for screen reader announcements
  - Stack traces are never exposed to the user (sanitized via `sanitizeError`)
- Added empty state handling:
  - Normal rendering when no error is present (happy path)
  - All buttons remain functional
- Added `test/HeroSection.error-empty.test.tsx` with comprehensive tests:
  - Error UI rendering on navigation failure
  - Generic message for non-Error throws
  - `role="alert"` accessibility
  - Try Again button reset behavior
  - Stack trace non-exposure (security)
  - Happy path rendering
  - Button functionality in normal state

## Files Changed

| File | Change |
|------|--------|
| `src/components/guest/HeroSection.tsx` | **Updated** — added error state, `handleTrackedNavigation` with try/catch, `sanitizeError` usage |
| `test/HeroSection.error-empty.test.tsx` | **Added** — error and empty state tests |

## Feature Flag Plan

No runtime flag is added. Error handling is always active.

## Migration Notes

- No API changes.
- No schema/data migration.
- No user action required.
- Error messages are sanitized and never expose PII or stack traces.

## Verification Checklist

- [x] `npm run typecheck`
- [x] `npm run test` — error/empty state tests pass
- [x] PR references Stellar Wave and SW-FE-005
