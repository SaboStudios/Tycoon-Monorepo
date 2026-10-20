# Requirements Document

## Introduction

This feature adds **simulation scenarios** to the `tycoon-collectibles` Soroban contract. Simulation scenarios are structured test fixtures and scenario-runner utilities that exercise realistic multi-step game flows — such as a player buying a collectible, holding it across turns, and burning it for a perk — within the Soroban test environment. The goal is to give developers and reviewers high-confidence coverage of the contract's on-chain behaviour under conditions that closely mirror production use, without requiring a live network.

This work is part of the **Stellar Wave** engineering batch and is tracked as **SW-CON-002**.

---

## Glossary

- **Simulation_Runner**: The test module (`src/simulation.rs`) that defines and executes scenario fixtures against the `TycoonCollectibles` contract.
- **Scenario**: A named, self-contained test fixture that sets up initial state, executes a sequence of contract calls, and asserts expected outcomes.
- **Fixture**: A reusable helper struct that initialises a fresh `Env`, deploys the contract, and optionally configures the shop and fee settings.
- **TycoonCollectibles**: The Soroban smart contract under test, located at `contract/contracts/tycoon-collectibles/`.
- **Perk**: An on-chain game effect attached to a collectible token (e.g., `CashTiered`, `ExtraTurn`, `Shield`).
- **Shop**: The on-chain marketplace within `TycoonCollectibles` where players purchase collectibles using TYC or USDC tokens.
- **CEI**: Checks–Effects–Interactions, the reentrancy-safe ordering pattern enforced in `buy_collectible_from_shop`.
- **Backend_Minter**: A privileged address authorised by the admin to mint reward collectibles via `mint_collectible` and `backend_mint`.
- **Stellar_Wave**: The engineering batch programme under which this work is delivered.
- **SW-CON-002**: The Stellar Wave issue identifier for this feature.

---

## Requirements

### Requirement 1: Simulation Fixture Infrastructure

**User Story:** As a contract developer, I want a reusable simulation fixture, so that I can write scenario tests without duplicating setup boilerplate.

#### Acceptance Criteria

1. THE Simulation_Runner SHALL provide a `SimFixture` struct that initialises a fresh `soroban_sdk::Env`, registers the `TycoonCollectibles` contract, and exposes a typed client.
2. WHEN `SimFixture::with_shop()` is called, THE Simulation_Runner SHALL also deploy mock TYC and USDC stellar-asset contracts, call `init_shop`, and return the fixture with token addresses accessible.
3. WHEN `SimFixture::with_fee_config(platform_bps, creator_bps, pool_bps)` is called, THE Simulation_Runner SHALL call `set_fee_config` on the contract with the provided basis-point values and store the platform and pool addresses on the fixture.
4. THE Simulation_Runner SHALL expose a helper `mint_tokens(token_addr, recipient, amount)` that mints the specified amount of a stellar-asset token to a recipient address, so that scenarios can fund buyer wallets without repeating asset-client boilerplate.
5. IF `SimFixture::with_shop()` is called before `initialize`, THEN THE Simulation_Runner SHALL return an error or panic with a descriptive message indicating that the contract must be initialised first.

---

### Requirement 2: Buy-and-Hold Scenario

**User Story:** As a contract developer, I want a simulation that covers the full buy-and-hold flow, so that I can verify stock management and balance accounting across multiple purchases.

#### Acceptance Criteria

1. WHEN the buy-and-hold scenario runs, THE Simulation_Runner SHALL stock a collectible with a known `token_id`, `perk`, `strength`, `tyc_price`, and initial `amount`, then verify that `get_stock` returns the stocked amount before any purchase.
2. WHEN a buyer purchases one unit via `buy_collectible_from_shop`, THE Simulation_Runner SHALL verify that `balance_of(buyer, token_id)` increases by 1 and `get_stock(token_id)` decreases by 1.
3. WHEN multiple buyers each purchase one unit of the same collectible, THE Simulation_Runner SHALL verify that each buyer's balance equals 1 and the total stock decreases by the number of purchases.
4. WHEN the last unit of a collectible is purchased, THE Simulation_Runner SHALL verify that `get_stock(token_id)` returns 0 and a subsequent purchase attempt returns `InsufficientStock`.
5. THE Simulation_Runner SHALL verify that the buyer's payment token balance decreases by exactly the collectible price after each purchase (no fee config case).

---

### Requirement 3: Perk Activation Scenario

**User Story:** As a contract developer, I want simulation scenarios for each perk type, so that I can confirm that burn-for-perk emits the correct events and updates balances correctly.

#### Acceptance Criteria

1. WHEN the perk activation scenario runs for a `CashTiered` collectible at each strength level (1–5), THE Simulation_Runner SHALL verify that `burn_collectible_for_perk` reduces the caller's balance by 1 and emits a `(perk, cash, activator)` event with the cash value matching `CASH_TIERS[strength - 1]`.
2. WHEN the perk activation scenario runs for a `TaxRefund` collectible at each strength level (1–5), THE Simulation_Runner SHALL verify the same balance reduction and event emission as for `CashTiered`.
3. WHEN the perk activation scenario runs for each non-tiered perk (variants 3–11: `RentBoost`, `PropertyDiscount`, `ExtraTurn`, `JailFree`, `DoubleRent`, `RollBoost`, `Teleport`, `Shield`, `RollExact`), THE Simulation_Runner SHALL verify that `burn_collectible_for_perk` reduces the caller's balance by 1 and emits a `(perk, activate, activator)` event.
4. WHEN the perk activation scenario runs while the contract is paused, THE Simulation_Runner SHALL verify that `burn_collectible_for_perk` returns `ContractPaused` and the caller's balance remains unchanged.
5. WHEN the perk activation scenario runs with a caller who holds zero units of the token, THE Simulation_Runner SHALL verify that `burn_collectible_for_perk` returns `InsufficientBalance`.

---

### Requirement 4: Fee Distribution Scenario

**User Story:** As a contract developer, I want a simulation that verifies fee splits during shop purchases, so that I can confirm that platform, pool, and creator addresses receive the correct amounts.

#### Acceptance Criteria

1. WHEN the fee distribution scenario runs with a configured fee split, THE Simulation_Runner SHALL verify that after `buy_collectible_from_shop` the platform address token balance increases by `floor(price * platform_bps / 10000)`.
2. WHEN the fee distribution scenario runs with a configured fee split, THE Simulation_Runner SHALL verify that after `buy_collectible_from_shop` the pool address token balance increases by `floor(price * pool_bps / 10000)`.
3. WHEN the fee distribution scenario runs with a configured fee split, THE Simulation_Runner SHALL verify that the buyer's token balance decreases by exactly the full collectible price (platform + pool + creator + residue = price).
4. WHEN the fee distribution scenario runs without a fee config, THE Simulation_Runner SHALL verify that the full price is transferred to the contract address and no fee-distribution event is emitted.
5. THE Simulation_Runner SHALL verify that the `(fee_dist, token_id)` event is emitted with the correct platform amount, pool amount, and creator amount when a fee config is present.

---

### Requirement 5: Backend Minting Scenario

**User Story:** As a contract developer, I want a simulation that covers backend reward minting, so that I can verify that only authorised callers can mint and that minted collectibles are correctly attributed.

#### Acceptance Criteria

1. WHEN the backend minting scenario runs with the admin as caller, THE Simulation_Runner SHALL verify that `mint_collectible` returns a `token_id` in the range `[2_000_000_000, ∞)` and that `balance_of(recipient, token_id)` equals 1.
2. WHEN the backend minting scenario runs with a registered `Backend_Minter` as caller, THE Simulation_Runner SHALL verify that `mint_collectible` succeeds and the recipient receives the collectible.
3. WHEN the backend minting scenario runs with an unauthorised caller (neither admin nor registered minter), THE Simulation_Runner SHALL verify that `mint_collectible` returns `Unauthorized` and no balance change occurs.
4. WHEN `mint_collectible` is called multiple times, THE Simulation_Runner SHALL verify that each call returns a strictly increasing `token_id` and each recipient's balance reflects only their own minted tokens.
5. THE Simulation_Runner SHALL verify that the `(coll_mint, recipient)` event is emitted with the correct `token_id`, `perk`, and `strength` after each successful `mint_collectible` call.

---

### Requirement 6: Transfer and Enumeration Scenario

**User Story:** As a contract developer, I want a simulation that exercises token transfers and enumeration consistency, so that I can confirm that ownership lists remain accurate after complex multi-party flows.

#### Acceptance Criteria

1. WHEN the transfer scenario runs with a player who owns multiple token types, THE Simulation_Runner SHALL verify that after transferring all units of one token type to another player, `tokens_of(sender)` no longer contains that `token_id` and `tokens_of(recipient)` contains it.
2. WHEN the transfer scenario runs and a recipient already owns units of the transferred token type, THE Simulation_Runner SHALL verify that `tokens_of(recipient)` does not contain duplicate entries for that `token_id`.
3. WHEN the enumeration scenario runs after a sequence of mints, transfers, and burns, THE Simulation_Runner SHALL verify that `owned_token_count(owner)` equals the length of `tokens_of(owner)` for every address involved.
4. WHEN the enumeration scenario exercises the swap-remove path (removing a non-last token from an owner's list), THE Simulation_Runner SHALL verify that all remaining token IDs are still accessible via `token_of_owner_by_index` and no index is out of bounds.
5. THE Simulation_Runner SHALL verify that `tokens_of_owner_page` returns results consistent with `tokens_of` for page sizes of 1, 10, and 50 across a collection of 75 tokens.

---

### Requirement 7: Pause and Emergency Scenario

**User Story:** As a contract developer, I want a simulation that covers the pause/unpause lifecycle, so that I can confirm that the emergency stop correctly gates perk burns without affecting other operations.

#### Acceptance Criteria

1. WHEN the pause scenario runs and the admin pauses the contract, THE Simulation_Runner SHALL verify that `burn_collectible_for_perk` returns `ContractPaused` for any caller.
2. WHILE the contract is paused, THE Simulation_Runner SHALL verify that `buy_collectible_from_shop`, `transfer`, and `burn` (direct) continue to succeed.
3. WHEN the admin unpauses the contract, THE Simulation_Runner SHALL verify that `burn_collectible_for_perk` succeeds for a caller with a valid balance and perk.
4. IF a non-admin address calls `set_pause`, THEN THE Simulation_Runner SHALL verify that the call fails with an authorization error and the pause state remains unchanged.

---

### Requirement 8: Automated Test Coverage and CI Integration

**User Story:** As a CI engineer, I want all simulation scenarios to run as part of the standard `cargo test` suite, so that regressions are caught automatically on every PR.

#### Acceptance Criteria

1. THE Simulation_Runner SHALL be implemented as a Rust test module (`#[cfg(test)]`) within `contract/contracts/tycoon-collectibles/src/simulation.rs`, registered in `lib.rs`.
2. WHEN `cargo test --package tycoon-collectibles` is executed, THE Simulation_Runner SHALL run all simulation scenario tests and report pass/fail results.
3. WHEN `cargo check --package tycoon-collectibles` is executed, THE Simulation_Runner SHALL produce no compiler errors or warnings.
4. THE Simulation_Runner SHALL not introduce any new runtime dependencies beyond `soroban-sdk` with the `testutils` feature already declared in `[dev-dependencies]`.
5. IF any simulation scenario test fails, THEN THE Simulation_Runner SHALL output a descriptive assertion message identifying the scenario name, the failing assertion, and the actual vs. expected values.

---

### Requirement 9: PR and Rollout Documentation

**User Story:** As a reviewer, I want the PR to include rollout and migration notes, so that I can understand the deployment impact and verify there are no breaking changes.

#### Acceptance Criteria

1. THE Simulation_Runner SHALL be implemented as test-only code (`#[cfg(test)]`), so that it produces no changes to the deployed WASM binary.
2. THE Simulation_Runner documentation SHALL state that no on-chain migration is required because simulation code is excluded from the production build.
3. THE Simulation_Runner documentation SHALL reference **Stellar Wave** and issue **SW-CON-002** in the PR body.
4. THE Simulation_Runner documentation SHALL include the CI commands required to verify the feature: `cargo check --package tycoon-collectibles` and `cargo test --package tycoon-collectibles`.
5. WHERE a future feature flag or phased rollout is needed for any simulation-derived production logic, THE Simulation_Runner documentation SHALL describe the flag mechanism and the conditions under which it would be enabled.
