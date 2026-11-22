# Changelog

## Unreleased

### Fixed

- `SessionFixationGuard` now treats a missing `nonceCreatedAt` and a negative nonce age as expired, rotating the session nonce in both cases (#2116).

### Added

- `parseExpiresIn` helper in `src/config/jwt.config.ts` converting `s`/`m`/`h`/`d` JWT lifetimes to seconds, with tests.
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
- `JWT_CLOCK_SKEW_SECONDS` is parsed as an integer in the 0-300 range (default 60) and invalid values now fail config load instead of producing `NaN`.

### Changed

- `API_PREFIX` now represents the base prefix (`api`) instead of embedding a version segment.

### Fixed

- Coupon minimum purchase validation now compares integer minor units instead of floats, and the error message reports the stored minimum amount.
- Coupon percentage discounts are validated to 1-100 in both the DTO and `calculateDiscount`; fixed discounts above the purchase amount are rejected instead of silently clamped.

### Policy

- Breaking API changes must be introduced via a new API version (for example `v2`) and documented in this changelog.
- New clients must target explicit versioned endpoints (`/api/v1/*`).
