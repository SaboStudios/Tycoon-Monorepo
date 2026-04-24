# Changelog - tycoon-game

All notable changes to this project will be documented in this file.

## [0.2.0] - 2026-04-24 — SW-CT-012

### Added
- Formal `admin_*` entrypoints: `admin_migrate`, `admin_withdraw_funds`,
  `admin_set_collectible_info`, `admin_set_cash_tier_value`,
  `admin_set_game_controller`, `admin_mint_registration_voucher`.
- `require_admin` internal helper — single source of truth for owner auth.
- Separate `#[contractimpl]` blocks clearly labelled *Admin-only* and *Public*.
- `admin_access_control_tests` module (13 tests, ACT-01 – ACT-13) covering
  auth rejection for every admin entrypoint and backward-compat shims.

### Changed
- Admin-only functions now live in a dedicated `#[contractimpl]` block with
  doc comments; public functions are in a separate block.

### Deprecated
- Old entrypoint names (`migrate`, `withdraw_funds`, `set_collectible_info`,
  `set_cash_tier_value`, `set_backend_game_controller`,
  `mint_registration_voucher`) are kept as thin shims marked `#[deprecated]`
  and will be removed in v1.0.0.

## [0.1.0] - 2026-03-27

### Added
- Initial Soroban implementation.
- State schema versioning (#413).
