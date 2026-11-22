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

### Fixed

- `AuctionManager.createAuction` now rejects non-finite, zero, or negative `startingBid` and `minBidIncrement` values before inserting the auction.

### Changed

- `API_PREFIX` now represents the base prefix (`api`) instead of embedding a version segment.

### Fixed

- Coupon percentage discounts are validated to 1-100 in both the DTO and `calculateDiscount`; fixed discounts above the purchase amount are rejected instead of silently clamped.

### Policy

- Breaking API changes must be introduced via a new API version (for example `v2`) and documented in this changelog.
- New clients must target explicit versioned endpoints (`/api/v1/*`).
