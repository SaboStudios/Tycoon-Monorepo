# Changelog

## Unreleased

### Added

- API versioning strategy using URI versioning (`/api/v1/*`) with centralized bootstrap configuration.
- Optional unversioned compatibility route (`/api/*`) that rewrites to `/api/v1/*`.
- Deprecation headers for compatibility routes:
  - `Deprecation: true`
  - Optional `Sunset` header controlled by `API_LEGACY_UNVERSIONED_SUNSET`.
- New environment variables:
  - `API_DEFAULT_VERSION`
  - `API_ENABLE_LEGACY_UNVERSIONED`
  - `API_LEGACY_UNVERSIONED_SUNSET`

### Changed

- Documented the JWT environment variables (`JWT_SECRET`, `JWT_EXPIRES_IN`, `JWT_REFRESH_EXPIRES_IN`, `JWT_CLOCK_SKEW_SECONDS`) in `docs/AUTH_JWT_RUNBOOK.md` (#2120).
- `API_PREFIX` now represents the base prefix (`api`) instead of embedding a version segment.

### Policy

- Breaking API changes must be introduced via a new API version (for example `v2`) and documented in this changelog.
- New clients must target explicit versioned endpoints (`/api/v1/*`).
