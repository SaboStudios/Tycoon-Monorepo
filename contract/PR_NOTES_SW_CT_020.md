# PR: SW-CT-020 — tycoon-collectibles unit / integration coverage

**Stellar Wave · Contract (Soroban / Stellar) · Issue #609**

---

## Summary

Adds targeted unit tests and cross-contract integration tests for the
`tycoon-collectibles` Soroban contract, closing coverage gaps identified in
SW-CT-020.

---

## Changes

### `contract/contracts/tycoon-collectibles/src/coverage_tests.rs` (new)

9 unit tests covering previously untested paths:

| Test | Path covered |
|---|---|
| `test_migrate_noop_when_already_v1` | `migrate` when version already 1 |
| `test_migrate_idempotent` | `migrate` called twice |
| `test_set_fee_config_and_buy_distributes_fees` | `set_fee_config` + `buy_collectible_from_shop` via `stock_shop` with fee split |
| `test_set_fee_config_zero_fees_residue_to_contract` | All-zero fee config → full residue to contract |
| `test_set_backend_minter_rejects_self` | `set_backend_minter` with contract's own address → `Unauthorized` |
| `test_token_uri_no_base_uri_returns_empty` | `token_uri` with no base URI configured |
| `test_update_prices_on_stocked_collectible` | `update_collectible_prices` changes effective purchase price |
| `test_stock_shop_buy_no_fee_config` | `stock_shop` + `buy_collectible_from_shop` without fee config |
| `test_is_contract_paused_reflects_state` | `is_contract_paused` / `set_pause` state transitions |

### `contract/contracts/tycoon-collectibles/src/lib.rs`

Added `#[cfg(test)] mod coverage_tests;` registration.

### `contract/integration-tests/Cargo.toml`

Added `tycoon-collectibles` to `[dev-dependencies]`.

### `contract/integration-tests/tests/collectibles_integration.rs` (new)

6 cross-contract integration tests:

| Test | Scenario |
|---|---|
| `test_collectibles_initializes_with_token_contracts` | Init alongside TYC / USDC token contracts |
| `test_shop_workflow_stock_and_buy_tyc` | `stock_shop` → `buy_collectible_from_shop` with TYC |
| `test_shop_workflow_stock_and_buy_usdc` | `stock_shop` → `buy_collectible_from_shop` with USDC |
| `test_fee_distribution_on_shop_purchase` | Platform + pool receive correct fee shares |
| `test_mint_transfer_burn_lifecycle` | Mint → transfer → burn across two accounts |
| `test_pause_prevents_perk_burn` | Pause guard blocks perk activation; unpause restores it |

### `contract/contracts/tycoon-collectibles/CHANGELOG.md`

Added `[Unreleased] - SW-CT-020` section.

---

## Rollout / Migration

No on-chain state changes. Tests only — no new contract entrypoints, no storage
schema changes, no migration required.

---

## CI

- `cargo check` passes for `tycoon-collectibles` and `tycoon-integration-tests`.
- `cargo test -p tycoon-collectibles` runs all unit tests including the new
  `coverage_tests` module.
- `cargo test -p tycoon-integration-tests` runs all integration tests including
  `collectibles_integration`.

---

## Acceptance Criteria

- [x] PR references Stellar Wave and issue id (SW-CT-020)
- [x] `cargo check` passes for affected workspace members
- [x] New tests cover previously untested code paths
- [x] No unaudited oracle or privileged pattern introduced
- [x] Follows Stellar / Soroban best practices (CEI, `mock_all_auths`, no `std`)
