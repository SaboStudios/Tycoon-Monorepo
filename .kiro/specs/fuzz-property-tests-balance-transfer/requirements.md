# Requirements Document

## Introduction

This feature adds property-based and fuzz testing to the arithmetic-heavy Soroban smart contracts in the `contract/` workspace — specifically `tycoon-token` (balance, transfer, mint, burn, allowance) and `tycoon-reward-system` (voucher minting, redemption, withdrawal). The goal is to surface overflow, underflow, and invariant violations that example-based unit tests may miss, using `proptest` for property-based tests and `cargo-fuzz` for coverage-guided fuzzing. A minimal seed corpus is committed as test fixtures, crash reproducers are stored alongside them, and a CI job runs the proptest suite on every PR while the cargo-fuzz targets are gated to an optional nightly workflow to avoid timeout.

## Glossary

- **Proptest_Suite**: The collection of `proptest`-based test modules added to `tycoon-token` and `tycoon-reward-system` under their `src/` directories.
- **Fuzz_Target**: A `cargo-fuzz` binary under `contract/fuzz/fuzz_targets/` that feeds arbitrary byte input to a contract entry point.
- **Seed_Corpus**: A directory of minimal, hand-crafted input files committed under `contract/fuzz/corpus/<target_name>/` that guide the fuzzer toward interesting paths from the start.
- **Crash_Reproducer**: A file committed under `contract/fuzz/artifacts/<target_name>/` that reproduces a previously discovered panic or assertion failure.
- **CI_Pipeline**: The GitHub Actions workflow defined in `.github/workflows/ci.yml` that runs on every pull request.
- **Nightly_Workflow**: A separate GitHub Actions workflow (`.github/workflows/fuzz-nightly.yml`) triggered on a schedule or manually, which runs `cargo-fuzz` targets with a bounded time limit.
- **Property**: A boolean predicate over arbitrary inputs that must hold for all generated values within the configured test case budget.
- **Invariant**: A condition that must remain true before and after every state-mutating operation (e.g., total supply equals sum of all balances).
- **TycoonToken**: The Soroban smart contract in `contract/contracts/tycoon-token/` implementing a fungible token with `i128` balances.
- **RewardSystem**: The Soroban smart contract in `contract/contracts/tycoon-reward-system/` implementing voucher minting, redemption, and fund withdrawal with `u128`/`u64` arithmetic.
- **CONTRIBUTING_md**: The `CONTRIBUTING.md` file at the repository root that documents how to run tests locally.

---

## Requirements

### Requirement 1: Proptest Dependency and Configuration

**User Story:** As a contract developer, I want `proptest` available as a dev-dependency in the arithmetic-heavy contract crates, so that I can write property-based tests without additional setup.

#### Acceptance Criteria

1. THE `tycoon-token` crate's `Cargo.toml` SHALL declare `proptest` as a `[dev-dependencies]` entry with a pinned minor version.
2. THE `tycoon-reward-system` crate's `Cargo.toml` SHALL declare `proptest` as a `[dev-dependencies]` entry with a pinned minor version.
3. WHEN `cargo test --all` is run from the `contract/` directory, THE Proptest_Suite SHALL compile and execute without requiring any additional flags or environment variables.
4. THE Proptest_Suite SHALL use `proptest`'s `no_std`-compatible configuration where required by the Soroban build target, or SHALL be gated behind `#[cfg(test)]` so it does not affect WASM output.

---

### Requirement 2: Token Balance Conservation Property

**User Story:** As a contract developer, I want a property test that verifies balance conservation across transfer operations, so that I can be confident no tokens are created or destroyed during transfers.

#### Acceptance Criteria

1. THE Proptest_Suite SHALL define a property: for any two distinct addresses and any transfer amount in `[1, i128::MAX/2]`, WHEN `transfer` succeeds, THE sum of `balance(from) + balance(to)` after the transfer SHALL equal the sum before the transfer.
2. THE Proptest_Suite SHALL define a property: for any valid mint amount, WHEN `mint` is called, THE `total_supply` SHALL increase by exactly that amount.
3. THE Proptest_Suite SHALL define a property: for any valid burn amount not exceeding the holder's balance, WHEN `burn` is called, THE `total_supply` SHALL decrease by exactly that amount.
4. FOR ALL sequences of mint and burn operations with arbitrary valid amounts, THE `total_supply` SHALL equal the algebraic sum of all minted amounts minus all burned amounts (round-trip supply invariant).

---

### Requirement 3: Token Overflow and Boundary Properties

**User Story:** As a contract developer, I want property tests that probe arithmetic boundaries in the token contract, so that overflow and underflow paths are exercised with values that example tests rarely reach.

#### Acceptance Criteria

1. THE Proptest_Suite SHALL define a property: WHEN `mint` is called with an amount that would cause `balance + amount` to exceed `i128::MAX`, THE TycoonToken SHALL panic or return an error rather than silently wrapping.
2. THE Proptest_Suite SHALL define a property: WHEN `transfer` is called with `amount > balance(from)`, THE TycoonToken SHALL reject the operation and leave both balances unchanged.
3. THE Proptest_Suite SHALL define a property: WHEN `transfer_from` is called with `amount > allowance(from, spender)`, THE TycoonToken SHALL reject the operation and leave the allowance and both balances unchanged.
4. THE Proptest_Suite SHALL define a property: for any non-negative amount, WHEN `approve` is called followed by `transfer_from` with the exact approved amount, THE allowance SHALL be reduced to zero and the transfer SHALL succeed.
5. IF `burn` or `burn_from` is called with an amount exceeding the holder's balance, THEN THE TycoonToken SHALL panic or return an error and leave `total_supply` unchanged.

---

### Requirement 4: Reward System Voucher Arithmetic Properties

**User Story:** As a contract developer, I want property tests for the reward system's voucher minting and redemption arithmetic, so that I can verify value preservation and overflow safety across arbitrary inputs.

#### Acceptance Criteria

1. THE Proptest_Suite SHALL define a property: for any `tyc_value` in `[1, u128::MAX/2]`, WHEN `mint_voucher` is called, THE voucher's stored `tyc_value` SHALL equal the input value (value immutability invariant).
2. THE Proptest_Suite SHALL define a property: for any sequence of `mint_voucher` calls with distinct token IDs, THE `owned_token_count` for the recipient SHALL equal the number of successful mints (monotonic count invariant).
3. THE Proptest_Suite SHALL define a property: WHEN `redeem_voucher_from` is called for a voucher with `tyc_value = V` and the contract holds at least `V` TYC, THE redeemer's TYC balance SHALL increase by exactly `V` and the contract's TYC balance SHALL decrease by exactly `V`.
4. THE Proptest_Suite SHALL define a property: WHEN `redeem_voucher_from` is called twice for the same `token_id`, THE second call SHALL be rejected and the redeemer's balance SHALL remain unchanged after the first redemption.
5. IF `withdraw_funds` is called with an amount exceeding the contract's token balance, THEN THE RewardSystem SHALL reject the operation and leave all balances unchanged.

---

### Requirement 5: Discount Calculation Properties (Backend)

**User Story:** As a backend developer, I want property tests for the coupon discount calculation logic, so that I can verify the discount never exceeds the purchase amount and percentage/fixed calculations are correct for arbitrary inputs.

#### Acceptance Criteria

1. THE Proptest_Suite SHALL define a property: for any `purchaseAmount` in `[0.01, 1_000_000]` and any percentage coupon value in `[0.01, 100]`, THE calculated discount SHALL be in `[0, purchaseAmount]`.
2. THE Proptest_Suite SHALL define a property: for any `purchaseAmount` and a fixed coupon value exceeding `purchaseAmount`, THE `calculateDiscount` function SHALL return `purchaseAmount` (discount is capped at purchase amount).
3. THE Proptest_Suite SHALL define a property: for any percentage coupon with a `max_discount_amount` cap, THE calculated discount SHALL not exceed `min(purchaseAmount * rate, max_discount_amount)`.
4. THE Proptest_Suite SHALL define a property: for any `originalPrice` and `discountAmount`, THE `finalPrice` computed as `Math.max(0, originalPrice - discountAmount)` SHALL be non-negative.

---

### Requirement 6: Seed Corpus

**User Story:** As a developer running fuzz tests locally, I want a committed seed corpus of minimal inputs, so that the fuzzer starts from meaningful states rather than random bytes and reaches interesting paths faster.

#### Acceptance Criteria

1. THE Seed_Corpus SHALL contain at least one input file per Fuzz_Target committed under `contract/fuzz/corpus/<target_name>/`.
2. THE Seed_Corpus for the token transfer target SHALL include inputs representing: zero amount, amount equal to balance, amount exceeding balance, and `i128::MAX`.
3. THE Seed_Corpus for the reward system target SHALL include inputs representing: minimum voucher value (1), maximum safe voucher value, and a double-redemption attempt sequence.
4. WHEN `cargo fuzz run <target> contract/fuzz/corpus/<target_name>` is executed, THE Fuzz_Target SHALL process all seed corpus files without panicking on valid inputs.
5. THE Seed_Corpus files SHALL be binary-encoded in the format expected by the corresponding `libfuzzer`-compatible harness (raw bytes or structured via `arbitrary`).

---

### Requirement 7: Crash Reproducer Fixtures

**User Story:** As a developer, I want crash reproducer files committed as test fixtures, so that previously discovered bugs are automatically re-tested as regression cases on every CI run.

#### Acceptance Criteria

1. THE Crash_Reproducer files SHALL be stored under `contract/fuzz/artifacts/<target_name>/` and committed to the repository.
2. WHEN a new crash is discovered during a fuzz run, THE developer SHALL add the reproducer file to the appropriate `contract/fuzz/artifacts/<target_name>/` directory before closing the associated issue.
3. WHEN `cargo fuzz run <target> contract/fuzz/artifacts/<target_name>/` is executed, THE Fuzz_Target SHALL reproduce the original panic for each committed reproducer.
4. THE CI_Pipeline SHALL execute `cargo test` for any `#[test]` regression wrappers that replay crash reproducer inputs, ensuring previously fixed bugs do not regress.

---

### Requirement 8: Proptest Suite in CI

**User Story:** As a developer, I want the proptest suite to run automatically on every pull request, so that property violations are caught before merge without blocking CI with long fuzz runs.

#### Acceptance Criteria

1. THE CI_Pipeline SHALL execute `cargo test --all` in the `contract/` directory, which SHALL include all Proptest_Suite tests.
2. THE Proptest_Suite SHALL configure `PROPTEST_CASES` to a value of at most 1024 per property so that the full suite completes within 3 minutes on a standard GitHub Actions runner.
3. WHEN any property in the Proptest_Suite fails, THE CI_Pipeline SHALL report a failing status check and block merge.
4. WHEN all properties pass, THE CI_Pipeline SHALL report a passing status check.
5. THE Proptest_Suite SHALL persist a `proptest-regressions/` directory in the repository so that any previously failing minimal example is re-run on subsequent CI executions.

---

### Requirement 9: Optional Nightly Fuzz Job

**User Story:** As a developer, I want an optional nightly CI job that runs cargo-fuzz targets with a time limit, so that coverage-guided fuzzing can find new crashes without blocking pull request workflows.

#### Acceptance Criteria

1. THE Nightly_Workflow SHALL be defined in `.github/workflows/fuzz-nightly.yml` and triggered on a `schedule` (nightly) and on `workflow_dispatch` (manual trigger).
2. THE Nightly_Workflow SHALL run each Fuzz_Target with `cargo fuzz run <target> -- -max_total_time=300` (5-minute limit per target) to bound total CI time.
3. WHEN a Fuzz_Target discovers a new crash, THE Nightly_Workflow SHALL upload the crash artifact using `actions/upload-artifact` so it can be retrieved and committed as a Crash_Reproducer.
4. THE Nightly_Workflow SHALL NOT block pull request merge checks; it SHALL run independently of the CI_Pipeline.
5. THE Nightly_Workflow SHALL install the `nightly` Rust toolchain and the `cargo-fuzz` binary before executing fuzz targets, as `cargo-fuzz` requires nightly.

---

### Requirement 10: CONTRIBUTING.md Documentation

**User Story:** As a new contributor, I want clear instructions in CONTRIBUTING.md for running property tests and fuzz targets locally, so that I can reproduce and investigate failures without guessing the correct commands.

#### Acceptance Criteria

1. THE CONTRIBUTING_md SHALL include a section titled "Property-Based and Fuzz Tests" that documents how to run the Proptest_Suite locally using `cargo test --all` from the `contract/` directory.
2. THE CONTRIBUTING_md SHALL document the command to run a single Fuzz_Target locally: `cargo fuzz run <target_name>` from the `contract/` directory, including the prerequisite of installing the nightly toolchain.
3. THE CONTRIBUTING_md SHALL document how to add a new Crash_Reproducer to the fixtures directory after a fuzz crash is found.
4. THE CONTRIBUTING_md SHALL document the `PROPTEST_CASES` environment variable and how to increase it locally for more thorough testing.
5. WHEN a developer follows the documented steps in CONTRIBUTING_md, THE Proptest_Suite SHALL run successfully on a machine with a stable Rust toolchain and the Soroban SDK dependencies installed.
