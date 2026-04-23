# Changelog - tycoon-collectibles

All notable changes to this project will be documented in this file.

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
