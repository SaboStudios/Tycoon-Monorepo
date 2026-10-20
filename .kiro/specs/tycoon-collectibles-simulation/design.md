# Design Document: Tycoon Collectibles Simulation (SW-CON-002)

## Overview

This document describes the design for `simulation.rs`, a test-only module added to the `tycoon-collectibles` Soroban contract. The module provides a reusable `SimFixture` struct and a suite of scenario tests that exercise realistic multi-step game flows against the contract in the Soroban test environment.

The simulation code lives entirely inside `#[cfg(test)]` blocks and is therefore excluded from the deployed WASM binary. No on-chain migration is required. The work is tracked as **Stellar Wave SW-CON-002**.

### Goals

- Give developers high-confidence coverage of on-chain behaviour under production-like conditions.
- Eliminate boilerplate duplication across scenario tests through a shared fixture.
- Provide a foundation for property-based testing of stock invariants, balance conservation, and enumeration consistency.
- Integrate seamlessly with `cargo test --package tycoon-collectibles` — no new runtime dependencies.

### Non-Goals

- No new production (non-test) code is introduced.
- No new `Cargo.toml` dependencies beyond `soroban-sdk` with `testutils` (already present in `[dev-dependencies]`).
- No live-network or integration-against-Testnet testing.

---

## Architecture

```
contract/contracts/tycoon-collectibles/src/
├── lib.rs              ← adds `mod simulation;` inside #[cfg(test)]
├── simulation.rs       ← NEW: SimFixture + all scenario tests
├── test.rs             ← existing unit tests (unchanged)
├── types.rs
├── storage.rs
├── events.rs
├── errors.rs
└── transfer.rs
```

`simulation.rs` is a peer of `test.rs`. Both are gated by `#[cfg(test)]` and registered in `lib.rs`. The two modules are independent — `simulation.rs` does not import from `test.rs` and vice versa.

### Integration with lib.rs

The following block is appended to `lib.rs` inside the existing `#[cfg(test)]` section:

```rust
#[cfg(test)]
mod simulation;
```

Because `lib.rs` already ends with `#[cfg(test)] mod test;`, the new line is added directly below it:

```rust
#[cfg(test)]
mod test;

#[cfg(test)]
mod simulation;
```

---

## Components and Interfaces

### SimFixture

`SimFixture` is the central fixture struct. It holds all state needed to run a scenario and exposes builder methods for progressive configuration.

```rust
pub struct SimFixture {
    pub env: Env,
    pub contract_id: Address,
    pub client: TycoonCollectiblesClient<'static>,  // lifetime tied to env
    pub admin: Address,
    // Populated by with_shop()
    pub tyc_token: Option<Address>,
    pub usdc_token: Option<Address>,
    // Populated by with_fee_config()
    pub platform: Option<Address>,
    pub pool: Option<Address>,
}
```

#### Constructor

```rust
impl SimFixture {
    /// Create a fresh env, register the contract, initialize it with a generated admin.
    pub fn new() -> Self
}
```

`SimFixture::new()` performs:
1. `Env::default()`
2. `env.mock_all_auths()`
3. `env.register(TycoonCollectibles, ())`
4. `TycoonCollectiblesClient::new(&env, &contract_id)`
5. `client.initialize(&admin)`

#### Builder Methods

```rust
impl SimFixture {
    /// Deploy mock TYC and USDC stellar-asset contracts, call init_shop.
    /// Panics with a descriptive message if the contract is not yet initialized.
    pub fn with_shop(mut self) -> Self

    /// Call set_fee_config with the given basis-point values.
    /// Generates platform and pool addresses internally and stores them on self.
    pub fn with_fee_config(mut self, platform_bps: u32, creator_bps: u32, pool_bps: u32) -> Self

    /// Mint `amount` units of `token_addr` to `recipient` using StellarAssetClient.
    /// Convenience wrapper — does not mutate self.
    pub fn mint_tokens(&self, token_addr: &Address, recipient: &Address, amount: i128)
}
```

Builder methods follow the consuming-builder pattern (`mut self → Self`) so that fixture construction reads as a fluent chain:

```rust
let fix = SimFixture::new()
    .with_shop()
    .with_fee_config(250, 500, 1000);
```

#### Internal Helpers

```rust
fn create_mock_token(env: &Env, admin: &Address) -> Address {
    env.register_stellar_asset_contract_v2(admin.clone()).address()
}
```

This mirrors the pattern already used in `test.rs`.

---

### Scenario Test Functions

Each scenario is a standalone `#[test]` function inside `simulation.rs`. Scenarios are grouped by concern using comment banners.

#### Group 1 — Fixture Smoke Tests

```rust
#[test]
fn sim_fixture_new_initializes_contract()

#[test]
fn sim_fixture_with_shop_sets_token_addresses()

#[test]
fn sim_fixture_with_fee_config_stores_config()

#[test]
fn sim_mint_tokens_credits_recipient()
```

#### Group 2 — Buy-and-Hold Scenario

```rust
#[test]
fn sim_buy_hold_initial_stock_matches_stocked_amount()

#[test]
fn sim_buy_hold_single_purchase_updates_balance_and_stock()

#[test]
fn sim_buy_hold_multiple_buyers_each_get_one()

#[test]
fn sim_buy_hold_last_unit_exhausts_stock()

#[test]
fn sim_buy_hold_price_deducted_exactly_no_fee_config()
```

#### Group 3 — Perk Activation Scenario

```rust
#[test]
fn sim_perk_cash_tiered_all_strengths()

#[test]
fn sim_perk_tax_refund_all_strengths()

#[test]
fn sim_perk_non_tiered_all_variants()

#[test]
fn sim_perk_burn_while_paused_returns_contract_paused()

#[test]
fn sim_perk_burn_zero_balance_returns_insufficient_balance()
```

#### Group 4 — Fee Distribution Scenario

```rust
#[test]
fn sim_fee_platform_receives_correct_amount()

#[test]
fn sim_fee_pool_receives_correct_amount()

#[test]
fn sim_fee_buyer_balance_decreases_by_full_price()

#[test]
fn sim_fee_no_config_full_price_to_contract()

#[test]
fn sim_fee_event_emitted_with_correct_amounts()
```

#### Group 5 — Backend Minting Scenario

```rust
#[test]
fn sim_mint_admin_gets_valid_token_id_and_balance()

#[test]
fn sim_mint_registered_minter_succeeds()

#[test]
fn sim_mint_unauthorized_caller_rejected()

#[test]
fn sim_mint_token_ids_strictly_increasing()

#[test]
fn sim_mint_event_emitted_with_correct_fields()
```

#### Group 6 — Transfer and Enumeration Scenario

```rust
#[test]
fn sim_transfer_removes_from_sender_adds_to_recipient()

#[test]
fn sim_transfer_no_duplicate_entries_for_existing_owner()

#[test]
fn sim_enum_count_equals_list_length_after_operations()

#[test]
fn sim_enum_swap_remove_all_indices_accessible()

#[test]
fn sim_enum_pagination_consistent_with_tokens_of()
```

#### Group 7 — Pause and Emergency Scenario

```rust
#[test]
fn sim_pause_blocks_burn_for_perk()

#[test]
fn sim_pause_allows_buy_transfer_burn()

#[test]
fn sim_unpause_restores_burn_for_perk()

#[test]
fn sim_non_admin_cannot_pause()
```

---

### Scenario Flow Patterns

Each scenario follows the **Arrange → Act → Assert** pattern with explicit assertion messages:

```rust
// Arrange
let fix = SimFixture::new().with_shop();
let buyer = Address::generate(&fix.env);
fix.mint_tokens(fix.tyc_token.as_ref().unwrap(), &buyer, 10_000);
let token_id = fix.client.stock_shop(&5, &1 /*CashTiered*/, &3, &100, &50);

// Act
fix.client.buy_collectible_from_shop(&buyer, &token_id, &false);

// Assert
assert_eq!(
    fix.client.balance_of(&buyer, &token_id), 1,
    "sim_buy_hold: buyer balance should be 1 after purchase"
);
assert_eq!(
    fix.client.get_stock(&token_id), 4,
    "sim_buy_hold: stock should decrease by 1 after purchase"
);
```

---

### Event Verification Approach

Events are verified using `env.events().all()`, which returns a `Vec` of `(topics, data)` tuples. The approach mirrors the pattern already used in `test.rs`.

```rust
let events = fix.env.events().all();
```

Because `env.events().all()` returns all events since the last ledger close (or since the env was created in tests), scenarios that need to isolate specific events should:

1. Record the event count before the action: `let before = fix.env.events().all().len();`
2. Perform the action.
3. Slice the new events: `let new_events = fix.env.events().all();` then inspect `new_events.get(before).unwrap()` onward.

Event topic and data shapes are defined in `events.rs`:

| Event | Topics | Data |
|---|---|---|
| `emit_cash_perk_activated_event` | `(symbol_short!("perk"), symbol_short!("cash"), activator)` | `(token_id, cash_value)` |
| `emit_perk_activated_event` | `(symbol_short!("perk"), symbol_short!("activate"), activator)` | `(token_id, perk, strength)` |
| `emit_collectible_bought_event` | `(symbol_short!("coll_buy"), buyer)` | `(token_id, price, use_usdc)` |
| `emit_fee_distributed_event` | `(symbol_short!("fee_dist"), token_id)` | `(platform, platform_amount, pool, pool_amount, creator_amount)` |
| `emit_collectible_minted_event` | `(symbol_short!("coll_mint"), recipient)` | `(token_id, perk, strength)` |
| `emit_collectible_burned_event` | `(symbol_short!("burn"), symbol_short!("coll"), burner)` | `(token_id, perk, strength)` |

Event values are extracted using `FromVal`:

```rust
use soroban_sdk::{FromVal, IntoVal};

let (token_id_val, cash_val): (u128, i128) = FromVal::from_val(&fix.env, &event.1);
assert_eq!(cash_val, CASH_TIERS[(strength - 1) as usize] as i128,
    "sim_perk: cash value should match CASH_TIERS[strength-1]");
```

---

## Data Models

### SimFixture Fields

| Field | Type | Set by | Purpose |
|---|---|---|---|
| `env` | `Env` | `new()` | Soroban test environment |
| `contract_id` | `Address` | `new()` | Registered contract address |
| `client` | `TycoonCollectiblesClient` | `new()` | Typed contract client |
| `admin` | `Address` | `new()` | Admin address (mock_all_auths active) |
| `tyc_token` | `Option<Address>` | `with_shop()` | Mock TYC stellar-asset address |
| `usdc_token` | `Option<Address>` | `with_shop()` | Mock USDC stellar-asset address |
| `platform` | `Option<Address>` | `with_fee_config()` | Platform fee recipient |
| `pool` | `Option<Address>` | `with_fee_config()` | Pool fee recipient |

### Fee Calculation (reference)

The fee split used in scenario assertions mirrors `tycoon_lib::fees::calculate_fee_split`:

```
platform_amount = floor(price * platform_bps / 10000)
creator_amount  = floor(price * creator_bps  / 10000)
pool_amount     = floor(price * pool_bps     / 10000)
residue         = price - platform_amount - creator_amount - pool_amount
```

All four components sum to exactly `price`. Scenarios assert each component independently.

### Token ID Ranges

| Range | Source | Used by |
|---|---|---|
| `1..` | `increment_token_id` | `stock_shop` |
| `2_000_000_000..` | `get_next_collectible_id` | `mint_collectible` |

Scenarios that call `mint_collectible` assert `token_id >= 2_000_000_000`.

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

The `tycoon-collectibles` contract contains pure balance-accounting logic, fee-split arithmetic, and enumeration data structures — all of which are well-suited to property-based testing. The simulation module uses [proptest](https://docs.rs/proptest) — however, since `proptest` is not yet in `dev-dependencies`, the properties below are implemented as **parameterized example-based tests** that cover the full input space by iterating over all valid parameter combinations (e.g., all 5 strength levels, all 9 non-tiered perks). This satisfies the "no new runtime dependencies" constraint while still providing comprehensive coverage.

> **Note:** If `proptest` is added to `[dev-dependencies]` in a future PR, these properties can be upgraded to true property-based tests with minimal refactoring.

### Property 1: mint_tokens round-trip

*For any* valid non-zero amount and any recipient address, calling `mint_tokens(token, recipient, amount)` followed by `token::Client::balance(recipient)` should return exactly `amount`.

**Validates: Requirements 1.4**

---

### Property 2: Stock initialization

*For any* valid non-zero stock amount `S`, after calling `stock_shop` with amount `S`, `get_stock(token_id)` returns exactly `S`.

**Validates: Requirements 2.1**

---

### Property 3: Stock conservation on purchase

*For any* collectible with stock `S >= N` and `N` distinct buyers, after each buyer purchases one unit, each buyer's `balance_of` equals 1 and `get_stock` equals `S - N`.

**Validates: Requirements 2.2, 2.3**

---

### Property 4: Stock exhaustion

*For any* collectible with stock `S >= 1`, after exactly `S` purchases, `get_stock` returns 0 and the next `buy_collectible_from_shop` call returns `InsufficientStock`.

**Validates: Requirements 2.4**

---

### Property 5: Price conservation (no fee config)

*For any* collectible price `P` and buyer with token balance `B >= P`, after one purchase without a fee config, the buyer's token balance equals `B - P` and the contract's token balance increases by `P`.

**Validates: Requirements 2.5, 4.3**

---

### Property 6: Tiered perk burn

*For any* tiered perk (`CashTiered` or `TaxRefund`) at any strength `S` in `[1, 5]`, burning one unit via `burn_collectible_for_perk` reduces the caller's balance by 1 and emits a `(perk, cash, activator)` event with `cash_value == CASH_TIERS[S - 1]`.

**Validates: Requirements 3.1, 3.2**

---

### Property 7: Non-tiered perk burn

*For any* non-tiered perk `P` in `{RentBoost, PropertyDiscount, ExtraTurn, JailFree, DoubleRent, RollBoost, Teleport, Shield, RollExact}`, burning one unit via `burn_collectible_for_perk` reduces the caller's balance by 1 and emits a `(perk, activate, activator)` event.

**Validates: Requirements 3.3**

---

### Property 8: Pause blocks burn-for-perk

*For any* caller with `balance_of(caller, token_id) >= 1` and any valid perk, while the contract is paused, `burn_collectible_for_perk` returns `ContractPaused` and the caller's balance remains unchanged.

**Validates: Requirements 3.4, 7.1**

---

### Property 9: Zero balance burn rejected

*For any* caller with `balance_of(caller, token_id) == 0`, `burn_collectible_for_perk` returns `InsufficientBalance`.

**Validates: Requirements 3.5**

---

### Property 10: Fee conservation

*For any* collectible price `P` and fee config `(platform_bps, creator_bps, pool_bps)`, after one purchase:
- Platform balance increases by `floor(P * platform_bps / 10000)`
- Pool balance increases by `floor(P * pool_bps / 10000)`
- Buyer balance decreases by exactly `P`
- The `(fee_dist, token_id)` event is emitted with amounts matching the fee split

**Validates: Requirements 4.1, 4.2, 4.3, 4.5**

---

### Property 11: No-fee-config full transfer to contract

*For any* collectible price `P` without a fee config, after one purchase, the contract's token balance increases by exactly `P` and no `fee_dist` event is emitted.

**Validates: Requirements 4.4**

---

### Property 12: Authorized mint produces valid token and event

*For any* authorized caller (admin or registered backend minter), `mint_collectible(caller, recipient, perk, strength)` returns a `token_id >= 2_000_000_000`, sets `balance_of(recipient, token_id) == 1`, and emits a `(coll_mint, recipient)` event with the correct `token_id`, `perk`, and `strength`.

**Validates: Requirements 5.1, 5.2, 5.5**

---

### Property 13: Unauthorized mint rejected

*For any* caller that is neither the admin nor the registered backend minter, `mint_collectible` returns `Unauthorized` and no balance changes occur.

**Validates: Requirements 5.3**

---

### Property 14: Monotonically increasing token IDs

*For any* sequence of `N >= 2` sequential `mint_collectible` calls, each successive returned `token_id` is strictly greater than the previous, and each recipient's `balance_of` reflects only their own minted tokens.

**Validates: Requirements 5.4**

---

### Property 15: Transfer ownership consistency

*For any* sender owning token `T` with balance `B`, after transferring all `B` units to a recipient, `tokens_of(sender)` does not contain `T` and `tokens_of(recipient)` contains `T` exactly once.

**Validates: Requirements 6.1, 6.2**

---

### Property 16: Enumeration count-list invariant

*For any* owner address after any sequence of mint, transfer, and burn operations, `owned_token_count(owner)` equals `tokens_of(owner).len()`, and every token ID returned by `token_of_owner_by_index(owner, i)` for `i in 0..owned_token_count(owner)` is a valid, non-duplicate entry in `tokens_of(owner)`.

**Validates: Requirements 6.3, 6.4**

---

### Property 17: Pagination consistency

*For any* owner with `N` tokens and any page size `page_size >= 1`, iterating through all pages of `tokens_of_owner_page` returns the same set of token IDs as `tokens_of(owner)` with no duplicates and no omissions.

**Validates: Requirements 6.5**

---

### Property 18: Pause allows non-burn operations

*For any* valid caller with sufficient balance, while the contract is paused, `buy_collectible_from_shop`, `transfer`, and `burn` (direct) all succeed.

**Validates: Requirements 7.2**

---

### Property 19: Pause-unpause round-trip

*For any* caller with `balance_of(caller, token_id) >= 1` and a valid perk, after the admin pauses and then unpauses the contract, `burn_collectible_for_perk` succeeds and reduces the caller's balance by 1.

**Validates: Requirements 7.3**

---

### Property 20: Non-admin cannot change pause state

*For any* non-admin address, calling `set_pause` fails with an authorization error and the pause state remains unchanged.

**Validates: Requirements 7.4**

---

## Error Handling

### SimFixture Precondition Violations

`with_shop()` is called after `initialize()` in `SimFixture::new()`, so the normal builder chain is always safe. If a developer calls `with_shop()` on a manually constructed fixture where `initialize` was skipped, the underlying `init_shop` call will panic because `get_admin` will `unwrap()` on a missing key. The panic message from the SDK is sufficient; no additional wrapping is needed.

### Assertion Failures

Every `assert_eq!` and `assert!` in `simulation.rs` includes a descriptive message following this format:

```
"sim_{scenario_name}: {what was expected} (got {actual})"
```

Example:
```rust
assert_eq!(
    fix.client.get_stock(&token_id), 0,
    "sim_buy_hold_last_unit: stock should be 0 after purchasing all units"
);
```

This satisfies Requirement 8.5 — test failures identify the scenario, the assertion, and the actual vs. expected values.

### Error Variant Matching

For expected-error cases, the `try_*` client variants are used and matched against the specific error variant:

```rust
let result = fix.client.try_buy_collectible_from_shop(&buyer, &token_id, &false);
assert_eq!(
    result,
    Err(Ok(CollectibleError::InsufficientStock)),
    "sim_buy_hold_last_unit: should return InsufficientStock after stock exhausted"
);
```

---

## Testing Strategy

### Dual Testing Approach

The simulation module complements the existing `test.rs` unit tests:

| Layer | Location | Focus |
|---|---|---|
| Unit tests | `test.rs` | Individual function correctness, error paths, edge cases |
| Simulation scenarios | `simulation.rs` | Multi-step flows, cross-function invariants, event verification |

### Property Coverage

Each correctness property (Properties 1–20) is implemented as one or more `#[test]` functions in `simulation.rs`. Properties that cover a finite enumerable input space (e.g., all 5 strength levels, all 9 non-tiered perks) are implemented as loops within a single test function rather than separate tests, keeping the test count manageable.

### Test Configuration

- All tests use `env.mock_all_auths()` (set in `SimFixture::new()`).
- No ledger manipulation (`env.ledger().set(...)`) is needed for these scenarios.
- Token balances are set up via `StellarAssetClient::mint` (the same pattern as `test.rs`).
- No `std` import is needed beyond what `test.rs` already uses (`extern crate std;`).

### CI Commands

```bash
# Verify no compiler errors or warnings
cargo check --package tycoon-collectibles

# Run all tests including simulation scenarios
cargo test --package tycoon-collectibles
```

### No New Dependencies

`simulation.rs` uses only:
- `soroban_sdk` (already in `[dependencies]`)
- `soroban_sdk` with `testutils` feature (already in `[dev-dependencies]`)
- `tycoon_lib::fees::calculate_fee_split` (already in `[dependencies]` via `tycoon-lib`)
- Types and functions from the contract's own modules (`super::*`)

No changes to `Cargo.toml` are required.

### Rollout Notes

- `simulation.rs` is `#[cfg(test)]`-only. The deployed WASM binary is identical before and after this change.
- No on-chain migration is required.
- The PR body should reference **Stellar Wave** and **SW-CON-002**.
- If any simulation-derived logic is later promoted to production (e.g., a helper extracted from `SimFixture`), it would require a separate PR with a feature flag and migration plan documented at that time.
