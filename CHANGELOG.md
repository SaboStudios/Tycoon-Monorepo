# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### Added

- Chromatic visual-regression baselines for the wallet, join, and shop Storybook stories, with deterministic props/mocks so snapshots stay stable across runs.
- Chromatic CI job in the frontend workflow that publishes the wallet/join/shop stories and reports visual diffs on pull requests (project token supplied via `CHROMATIC_PROJECT_TOKEN` secret; no secrets committed).

### Docs

- Documented the baseline approval workflow for reviewing, accepting, and rejecting visual diffs on wallet/join/shop stories.
