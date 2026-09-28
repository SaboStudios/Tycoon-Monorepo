# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### Added

- Chromatic visual-regression baselines for the wallet, join, and shop Storybook stories, with deterministic props/mocks so snapshots stay stable across runs.
- Chromatic CI job in the frontend workflow that publishes the wallet/join/shop stories and reports visual diffs on pull requests (project token supplied via `CHROMATIC_PROJECT_TOKEN` secret; no secrets committed).
- PR compliance CI gate (`.github/workflows/pr-compliance.yml`, `scripts/check-changelog.mjs`). Every package touched by a PR needs a new bullet under `## [Unreleased]` in its CHANGELOG, touched CHANGELOGs must follow Keep a Changelog, and the PR description must follow the template: required sections filled in, an issue linked, no secrets. Opt out with `No changelog: <reason>` or the `skip-changelog` label (#1762).
- Default PR template (`.github/PULL_REQUEST_TEMPLATE.md`) plus `frontend`, `backend` and `shop-api` templates next to the existing `contract` template (#1762).
- `frontend/CHANGELOG.md`, `shop-api/CHANGELOG.md` and `contract/CHANGELOG.md`, so every package has a changelog (#1762).
- `frontend-gates` CI job that runs the zero-dependency gate self-tests (`node --test`) without `npm ci` (#1759).

### Changed

- `lib/analytics/providers.ts` now re-exports the frontend allowlist instead of keeping its own list, which had drifted: it used `google-analytics` while the runtime used `ga4` (#1761).

### Docs

- Documented the baseline approval workflow for reviewing, accepting, and rejecting visual diffs on wallet/join/shop stories.
- CONTRIBUTING.md "Changelog and PR template" section with copy-paste commands; README links to the new gates (#1762).
