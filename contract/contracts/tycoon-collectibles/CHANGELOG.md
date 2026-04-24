# Changelog - tycoon-collectibles

All notable changes to this project will be documented in this file.

## [Unreleased] - SW-CT-024

### Added
- `ENTRYPOINTS.md` — authoritative classification of all 37 entrypoints into:
  13 admin-only, 5 caller-authenticated, 2 dual-role (admin or minter),
  17 public read-only. Includes auth-rejection test coverage table.
- `src/entrypoint_auth_tests.rs` — 9 auth-rejection tests for admin entrypoints
  previously lacking no-auth coverage: `migrate`, `init_shop`, `set_fee_config`,
  `restock_collectible`, `update_collectible_prices`, `set_collectible_for_sale`,
  `set_pause`, `set_base_uri`, `set_token_metadata`.

## [Unreleased] - SW-CT-020

### Added
- `src/coverage_tests.rs` — 9 targeted unit tests covering previously uncovered
  paths:
  - `migrate` no-op when already at v1, and idempotent double-call.
  - `set_fee_config` + `buy_collectible_from_shop` via `stock_shop` flow with
    fee distribution (platform / pool / creator / residue).
  - `set_fee_config` with all-zero fees: full price goes to contract as residue.
  - `set_backend_minter` rejection when `new_minter == contract_address`.
  - `token_uri` returns empty string when no base URI is configured.
  - `update_collectible_prices` on a stocked collectible changes the effective
    purchase price.
  - `stock_shop` + `buy_collectible_from_shop` round-trip without fee config.
  - `is_contract_paused` reflects `set_pause` state transitions.
- `integration-tests/tests/collectibles_integration.rs` — 6 cross-contract
  integration tests:
  - Collectibles contract initializes alongside TYC / USDC token contracts.
  - Full shop workflow: `stock_shop` → `buy_collectible_from_shop` with TYC.
  - Full shop workflow: `stock_shop` → `buy_collectible_from_shop` with USDC.
  - Fee distribution: platform and pool receive correct shares.
  - Mint-transfer-burn lifecycle across two accounts.
  - Pause guard: `burn_collectible_for_perk` fails while paused, succeeds after
    unpause.
- `tycoon-collectibles` added to `integration-tests/Cargo.toml` dev-dependencies.

## [Unreleased] - SW-CT-022

### Added
- `ACCEPTANCE_CRITERIA.md` — full acceptance criteria for SW-CT-022 covering all contract functions, error paths, events, and test coverage checklist.
- `README.md` rewritten to document the complete contract interface: lifecycle, shop administration, purchasing (with CEI notes), perk mechanics, backend minting, metadata, enumeration, error reference, event reference, and storage layout.
- `CHANGELOG.md` updated with this entry.
- Tests: `test_initialize_already_initialized` — verifies double-init returns `AlreadyInitialized`.
- Tests: `test_migrate` — verifies `migrate` advances state version and is idempotent.
- Tests: `test_buy_from_shop_with_fee_distribution` — verifies fee split is applied correctly when a fee config is set.
- Tests: `test_burn_collectible_for_perk_new_perks` — verifies all new perks (5–11) can be burned and emit the correct `perk/activate` event.

## [0.1.0] - 2026-03-27

### Added
- Initial Soroban implementation.
- State schema versioning (#413).
