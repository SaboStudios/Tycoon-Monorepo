# SW-FE-008 — Landing Hero: MSW Fixtures Parity with API

This change is part of the Stellar Wave frontend batch and adds MSW (Mock Service Worker) fixtures and handlers for the Landing Hero section, ensuring parity between mock data and the actual API contract.

## Scope

- Added `src/mocks/fixtures/hero.ts` with:
  - `HeroAnnouncement` interface — mirrors API contract for announcements
  - `HeroFeature` interface — mirrors API contract for feature cards
  - `HeroContentResponse` interface — top-level hero content response
  - `mockHeroAnnouncements` — sample announcement data
  - `mockHeroFeatures` — sample feature card data
  - `mockHeroContent` — full hero content response
  - `mockHeroContentEmpty` — empty state fixture (no announcements, no features)
  - `mockHeroApiError` — error state fixture (500 server error)
- Added `src/mocks/handlers/hero.ts` with MSW handlers:
  - `GET /api/hero/content` — returns full hero content
  - `GET /api/hero/content?empty=true` — returns empty content
  - `GET /api/hero/content?error=true` — returns 500 error
  - `GET /api/hero/announcements` — returns paginated announcements
  - `GET /api/hero/features` — returns paginated features
- Updated `src/mocks/handlers/index.ts` — exports `heroHandlers`
- Updated `src/mocks/browser.ts` — registers hero handlers in MSW worker
- Added `test/hero-msw-handlers.test.ts` with comprehensive tests:
  - Response shape validation
  - Announcement field shape
  - Feature field shape
  - Paginated endpoints
  - Fixture type checks

## Files Changed

| File | Change |
|------|--------|
| `src/mocks/fixtures/hero.ts` | **Added** — hero fixtures with full API contract parity |
| `src/mocks/handlers/hero.ts` | **Added** — MSW handlers for hero endpoints |
| `src/mocks/handlers/index.ts` | **Updated** — added `heroHandlers` export |
| `src/mocks/browser.ts` | **Updated** — registered hero handlers |
| `test/hero-msw-handlers.test.ts` | **Added** — MSW handler tests |

## Feature Flag Plan

No runtime flag is added. MSW is only active in development/test environments.

## Migration Notes

- No API changes.
- No schema/data migration.
- No user action required.
- MSW handlers are available for future hero API integration.

## Verification Checklist

- [x] `npm run typecheck`
- [x] `npm run test` — hero MSW handler tests pass
- [x] Fixture types match API contract
- [x] PR references Stellar Wave and SW-FE-008
