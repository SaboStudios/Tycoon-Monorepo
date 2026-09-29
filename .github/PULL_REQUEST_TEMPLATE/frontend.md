# Frontend PR

<!-- Scope: frontend/ (Next.js 16 / React 19). Security issues: report privately per SECURITY.md. -->

## Summary

<!-- What changes and why. "Closes #123". -->

## Changelog

<!-- Entry added under "## [Unreleased]" in frontend/CHANGELOG.md, or: No changelog: <reason of at least 10 characters> -->

## Test plan

<!-- Commands + results, e.g.
cd frontend
npx vitest run <files>
npm run build && node scripts/check-bundle-size.mjs
npx playwright test <spec>
-->

## Rollback

<!-- Revert / env flag / order of operations. -->

## Frontend checklist

- [ ] Strict TypeScript null guards; no new `!` non-null assertions on route/query/API data
- [ ] Loading, empty, and error states covered; API 500 is distinguished from an empty result
- [ ] Keyboard focus order and visible focus preserved (SW-FE-741); new controls have accessible names
- [ ] Double CTA clicks are idempotent; wallet reject and auth expiry are recoverable
- [ ] Bundle budget holds (`node scripts/check-bundle-size.mjs`), heavy wallet/board deps code-split, no CLS regressions
- [ ] Analytics only after consent, via `src/lib/analytics` (no ad hoc beacons); no PII in payloads
- [ ] No MSW or mocks in the production bundle; CSP-compatible (no inline scripts, no new third-party hosts without review)
- [ ] No Stellar copy in player-facing UI (`node scripts/check-deny-list.mjs`)
- [ ] Vitest RTL and Playwright specs added or updated for the changed funnel
