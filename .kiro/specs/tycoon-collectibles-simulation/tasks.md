# Implementation Plan: Tycoon Collectibles Simulation (SW-CON-002)

## Overview

Create `simulation.rs` — a `#[cfg(test)]`-only module containing a reusable `SimFixture` struct and 30+ scenario tests across 7 groups. Register the module in `lib.rs`. Zero WASM impact; no new `Cargo.toml` dependencies.

## Tasks

- [ ] 1. Create `simulation.rs` with module header and imports
  - Create `Tycoon-Monorepo/contract/contracts/tycoon-collectibles/src/simulation.rs`
  - Add `extern crate std;` at the top (matches `test.rs` pattern)
  - Add `use super::*;` to import all contract types and functions
  - Add `use soroban_sdk::{testutils::{Address as _, Events}, Address, Env, FromVal, IntoVal};`
  - Add `use soroban_sdk::testutils::stellar_asset_contract::StellarAssetClient;` for `mint_tokens`
  - Add the `create_mock_token` private helper: `fn create_mock_token(env: &Env, admin: &Address) -> Address { env.register_stellar_asset_contract_v2(admin.clone()).address() }`
  - _Requirements: 8.1, 8.4_

- [ ] 2. Implement `SimFixture` struct and `new()` constructor
  - Define the `SimFixture` struct with fields: `env: Env`, `contract_id: Address`, `client: TycoonCollectiblesClient<'static>`, `admin: Address`, `tyc_token: Option<Address>`, `usdc_token: Option<Address>`, `platform: Option<Address>`, `pool: Option<Address>`
  - Implement `SimFixture::new()`: call `Env::default()`, `env.mock_all_auths()`, `env.register(TycoonCollectibles, ())`, construct `TycoonCollectiblesClient::new(&env, &contract_id)`, generate admin via `Address::generate(&env)`, call `client.initialize(&admin)`
  - _Requirements: 1.1_

- [ ] 3. Implement `with_shop()`, `with_fee_config()`, and `mint_tokens()` builder methods
  - Implement `with_shop(mut self) -> Self`: call `create_mock_token` twice for TYC and USDC, call `self.client.init_shop(&tyc, &usdc)`, store addresses in `self.tyc_token` and `self.usdc_token`
  - Implement `with_fee_config(mut self, platform_bps: u32, creator_bps: u32, pool_bps: u32) -> Self`: generate `platform` and `pool` addresses, call `self.client.set_fee_config(&platform_bps, &creator_bps, &pool_bps, &platform, &pool)`, store on `self`
  - Implement `mint_tokens(&self, token_addr: &Address, recipient: &Address, amount: i128)`: construct `StellarAssetClient::new(&self.env, token_addr)` and call `.mint(recipient, &amount)`
  - _Requirements: 1.2, 1.3, 1.4_

- [ ] 4. Group 1 — Fixture smoke tests
  - Write `sim_fixture_new_initializes_contract`: assert `client.is_contract_paused()` returns `false` and no panic occurs during construction
  - Write `sim_fixture_with_shop_sets_token_addresses`: assert `fix.tyc_token.is_some()` and `fix.usdc_token.is_some()` after `SimFixture::new().with_shop()`
  - Write `sim_fixture_with_fee_config_stores_config`: assert `fix.platform.is_some()` and `fix.pool.is_some()` after chaining `with_fee_config(250, 500, 1000)`
  - Write `sim_mint_tokens_credits_recipient`: mint 5000 TYC to a generated address and assert `StellarAssetClient::balance` equals 5000 (Property 1)
  - _Requirements: 1.1, 1.2, 1.3, 1.4_

  - [ ]* 4.1 Write property test for `mint_tokens` round-trip (Property 1)
    - **Property 1: mint_tokens round-trip**
    - Iterate amounts `[1, 100, 10_000, i128::MAX / 2]`; for each, mint to a fresh address and assert balance equals amount exactly
    - **Validates: Requirements 1.4**

- [ ] 5. Group 2 — Buy-and-hold scenario
  - Write `sim_buy_hold_initial_stock_matches_stocked_amount`: stock 5 units, assert `get_stock(token_id) == 5` (Property 2)
  - Write `sim_buy_hold_single_purchase_updates_balance_and_stock`: stock 5, fund buyer, buy 1, assert `balance_of == 1` and `get_stock == 4` (Property 3)
  - Write `sim_buy_hold_multiple_buyers_each_get_one`: stock 3, fund 3 buyers, each buys 1, assert each `balance_of == 1` and `get_stock == 0` (Property 3)
  - Write `sim_buy_hold_last_unit_exhausts_stock`: stock 1, buy it, assert `get_stock == 0`, then assert `try_buy_collectible_from_shop` returns `Err(Ok(CollectibleError::InsufficientStock))` (Property 4)
  - Write `sim_buy_hold_price_deducted_exactly_no_fee_config`: stock 1 at price 1000, fund buyer with 2000, buy, assert buyer balance is 1000 and contract balance is 1000 (Property 5)
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

  - [ ]* 5.1 Write property tests for stock conservation (Properties 2–5)
    - **Property 2: Stock initialization** — loop stock amounts `[1, 10, 100]`
    - **Property 3: Stock conservation on purchase** — loop buyer counts `[1, 2, 5]`
    - **Property 4: Stock exhaustion** — verify `InsufficientStock` after last unit
    - **Property 5: Price conservation (no fee config)** — loop prices `[1, 500, 10_000]`
    - **Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5**

- [ ] 6. Group 3 — Perk activation scenario
  - Write `sim_perk_cash_tiered_all_strengths`: loop strengths 1–5; for each, stock+buy a `CashTiered` collectible, burn for perk, assert `balance_of == 0`, record event count before burn, assert new event has topics `(perk, cash, caller)` and data cash value equals `CASH_TIERS[strength-1]` (Property 6)
  - Write `sim_perk_tax_refund_all_strengths`: same loop for `TaxRefund` (perk=2), same event shape assertion (Property 6)
  - Write `sim_perk_non_tiered_all_variants`: loop perk variants 3–11 (`RentBoost` through `RollExact`); for each, stock+buy, burn, assert `balance_of == 0` and event topics `(perk, activate, caller)` (Property 7)
  - Write `sim_perk_burn_while_paused_returns_contract_paused`: pause contract, assert `try_burn_collectible_for_perk` returns `Err(Ok(CollectibleError::ContractPaused))`, assert balance unchanged (Property 8)
  - Write `sim_perk_burn_zero_balance_returns_insufficient_balance`: assert `try_burn_collectible_for_perk` with zero balance returns `Err(Ok(CollectibleError::InsufficientBalance))` (Property 9)
  - Use `fix.env.events().all()` with before/after index slicing for event isolation
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

  - [ ]* 6.1 Write property tests for perk burn (Properties 6–9)
    - **Property 6: Tiered perk burn** — all 5 strengths × 2 tiered perks
    - **Property 7: Non-tiered perk burn** — all 9 non-tiered variants
    - **Property 8: Pause blocks burn-for-perk** — verify balance unchanged
    - **Property 9: Zero balance burn rejected**
    - **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5**

- [ ] 7. Group 4 — Fee distribution scenario
  - Write `sim_fee_platform_receives_correct_amount`: configure `platform_bps=250`, buy at price 10000, assert platform token balance equals `floor(10000 * 250 / 10000) == 250` (Property 10)
  - Write `sim_fee_pool_receives_correct_amount`: configure `pool_bps=1000`, buy at price 10000, assert pool token balance equals 1000 (Property 10)
  - Write `sim_fee_buyer_balance_decreases_by_full_price`: configure any fee split, fund buyer with 20000, buy at price 10000, assert buyer balance is exactly 10000 (Property 10)
  - Write `sim_fee_no_config_full_price_to_contract`: no fee config, buy at price 5000, assert contract token balance increases by 5000 and no `fee_dist` event is emitted (Property 11)
  - Write `sim_fee_event_emitted_with_correct_amounts`: configure `(250, 500, 1000)` bps, buy at price 10000, find `fee_dist` event, assert platform=250, pool=1000, creator=500 (Property 10)
  - Use `tycoon_lib::fees::calculate_fee_split` to compute expected amounts in assertions
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

  - [ ]* 7.1 Write property tests for fee conservation (Properties 10–11)
    - **Property 10: Fee conservation** — loop prices `[100, 1000, 9999]` × fee configs `[(100,200,300), (250,500,1000)]`
    - **Property 11: No-fee-config full transfer to contract**
    - **Validates: Requirements 4.1, 4.2, 4.3, 4.4, 4.5**

- [ ] 8. Group 5 — Backend minting scenario
  - Write `sim_mint_admin_gets_valid_token_id_and_balance`: call `mint_collectible` as admin, assert returned `token_id >= 2_000_000_000` and `balance_of(recipient, token_id) == 1` (Property 12)
  - Write `sim_mint_registered_minter_succeeds`: call `set_backend_minter`, then call `mint_collectible` as minter, assert success and `balance_of == 1` (Property 12)
  - Write `sim_mint_unauthorized_caller_rejected`: call `mint_collectible` as random address, assert `try_mint_collectible` returns `Err(Ok(CollectibleError::Unauthorized))` and no balance change (Property 13)
  - Write `sim_mint_token_ids_strictly_increasing`: call `mint_collectible` 3 times, assert each returned `token_id` is strictly greater than the previous (Property 14)
  - Write `sim_mint_event_emitted_with_correct_fields`: mint one collectible, find `coll_mint` event, assert topics contain recipient and data contains correct `token_id`, `perk`, `strength` (Property 12)
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

  - [ ]* 8.1 Write property tests for backend minting (Properties 12–14)
    - **Property 12: Authorized mint produces valid token and event**
    - **Property 13: Unauthorized mint rejected**
    - **Property 14: Monotonically increasing token IDs** — N=5 sequential mints
    - **Validates: Requirements 5.1, 5.2, 5.3, 5.4, 5.5**

- [ ] 9. Group 6 — Transfer and enumeration scenario
  - Write `sim_transfer_removes_from_sender_adds_to_recipient`: mint token to sender, transfer all units, assert `tokens_of(sender)` does not contain `token_id` and `tokens_of(recipient)` contains it (Property 15)
  - Write `sim_transfer_no_duplicate_entries_for_existing_owner`: recipient already owns the token type, transfer more units, assert `tokens_of(recipient)` contains `token_id` exactly once (Property 15)
  - Write `sim_enum_count_equals_list_length_after_operations`: perform mint+transfer+burn sequence, assert `owned_token_count(owner) == tokens_of(owner).len()` for all involved addresses (Property 16)
  - Write `sim_enum_swap_remove_all_indices_accessible`: mint 3 different token types to one owner, transfer the middle one away (triggering swap-remove), assert all remaining indices 0..`owned_token_count` are accessible via `token_of_owner_by_index` with no panic (Property 16)
  - Write `sim_enum_pagination_consistent_with_tokens_of`: mint 75 tokens to one owner, collect all pages with `page_size` 1, 10, and 50, assert each page set equals `tokens_of(owner)` with no duplicates (Property 17)
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

  - [ ]* 9.1 Write property tests for transfer and enumeration (Properties 15–17)
    - **Property 15: Transfer ownership consistency**
    - **Property 16: Enumeration count-list invariant** — after mint, transfer, burn
    - **Property 17: Pagination consistency** — page sizes 1, 10, 50 over 75 tokens
    - **Validates: Requirements 6.1, 6.2, 6.3, 6.4, 6.5**

- [ ] 10. Group 7 — Pause and emergency scenario
  - Write `sim_pause_blocks_burn_for_perk`: stock+buy a collectible, pause, assert `try_burn_collectible_for_perk` returns `ContractPaused` (Property 8)
  - Write `sim_pause_allows_buy_transfer_burn`: pause contract, assert `buy_collectible_from_shop`, `transfer`, and `burn` (direct) all succeed without error (Property 18)
  - Write `sim_unpause_restores_burn_for_perk`: pause then unpause, assert `burn_collectible_for_perk` succeeds and `balance_of` decreases by 1 (Property 19)
  - Write `sim_non_admin_cannot_pause`: assert `try_set_pause` called by a non-admin address returns an auth error and `is_contract_paused()` remains unchanged (Property 20)
  - _Requirements: 7.1, 7.2, 7.3, 7.4_

  - [ ]* 10.1 Write property tests for pause lifecycle (Properties 8, 18–20)
    - **Property 8: Pause blocks burn-for-perk** (cross-reference with Group 3)
    - **Property 18: Pause allows non-burn operations**
    - **Property 19: Pause-unpause round-trip**
    - **Property 20: Non-admin cannot change pause state**
    - **Validates: Requirements 7.1, 7.2, 7.3, 7.4**

- [ ] 11. Register `simulation` module in `lib.rs`
  - In `Tycoon-Monorepo/contract/contracts/tycoon-collectibles/src/lib.rs`, add `#[cfg(test)] mod simulation;` on the line directly below the existing `#[cfg(test)] mod test;` line
  - _Requirements: 8.1_

- [ ] 12. Checkpoint — verify compilation and tests pass
  - Run `cargo check --package tycoon-collectibles` and confirm zero errors and zero warnings
  - Run `cargo test --package tycoon-collectibles` and confirm all simulation scenario tests pass
  - Ensure all tests pass, ask the user if questions arise.
  - _Requirements: 8.2, 8.3_

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP
- All test code is `#[cfg(test)]`-only — the deployed WASM binary is unchanged
- Each task references specific requirements for traceability
- Property tests are implemented as parameterized loops (no new `proptest` dependency) per the design's "no new runtime dependencies" constraint
- Fee split assertions should use `tycoon_lib::fees::calculate_fee_split` to stay in sync with production logic
- Event isolation uses the before/after index pattern: record `fix.env.events().all().len()` before the action, then slice from that index after
- Token IDs from `stock_shop` start at 1; from `mint_collectible` start at `2_000_000_000`
- PR body must reference **Stellar Wave** and **SW-CON-002**
