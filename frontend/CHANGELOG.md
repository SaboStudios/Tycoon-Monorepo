# Changelog

All notable changes to the Tycoon frontend (`frontend/`) are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Add entries under `## [Unreleased]`. CI enforces this; see CONTRIBUTING.md.

## [Unreleased]

### Added

- Analytics consent banner and a withdraw/reset control on `/privacy-policy#analytics-choices`. Telemetry is sent only after explicit consent, and withdrawal applies to the next event (#1761).
- `GET /.well-known/farcaster.json` mini app manifest. It is deny-by-default: it returns 404 unless an account association signed for this exact host is configured through server env (#1760).
- Bundle budget and regression gate for Next 16 (Turbopack and webpack builds): per-route budgets, a join-room budget, regression checks against `bundle-baseline.json`, and detection of MSW code in client chunks (#1759).
- Playwright specs for the consent funnel and the well-known manifest, plus a `playwright.config.ts` and `vitest.config.ts` so the suites can run.

### Changed

- **Behaviour change:** `NEXT_PUBLIC_ENABLE_ANALYTICS` must now be exactly `true` to enable analytics. It was previously on unless set to `"false"`. Any other value fails `next build` (#1761).
- Analytics providers are validated against a single allowlist (`src/lib/analytics/allowlist.ts`: `plausible`, `ga4`, `posthog`). An unknown id fails `next build` instead of being silently dropped (#1761).
- Analytics payload values that look like emails, NEAR account ids, keys, hashes or JWTs are dropped, and query strings and fragments are stripped from `route` (#1761).
- CI calls the bundle gate with `node scripts/check-bundle-size.mjs` after the build. The step that ran before the build, when there was nothing to measure, has been removed (#1759).

### Removed

- Dead `public/.well-known/farcaster.json/route.ts`. It never executed from `public/`, imported a missing module, and hardcoded another project's domain (#1760).

### Docs

- `BUNDLE_BUDGET.md`, `docs/SW-FE-1760-farcaster-manifest.md` and `docs/SW-FE-1761-analytics-allowlist-consent.md` (runbooks with rollback steps). SW-FE-005, SW-FE-006 and SW-FE-039 now describe the consent requirement.
