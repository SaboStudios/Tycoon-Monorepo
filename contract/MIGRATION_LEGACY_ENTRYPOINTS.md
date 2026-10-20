# SW-CON-001 — Migration: Legacy Entrypoints Deprecation

**Status:** In progress  
**Stellar Wave batch:** Contract (Soroban / Stellar)  
**Issue ID:** SW-CON-001  
**PR:** (to be filled in)

---

## Overview

This document describes the deprecation path for three legacy entrypoints in the Tycoon Soroban contract suite:

| # | Entrypoint | Contract | Status | Risk |
|---|-----------|----------|--------|------|
| 1 | `redeem_voucher` | `TycoonRewardSystem` | Hard-deprecated (always panics) | Low — already enforced |
| 2 | `test_mint` / `test_burn` | `TycoonRewardSystem` | Unguarded test helpers exposed as public entrypoints | **High** — arbitrary caller can inflate/deflate balances |
| 3 | `mint_registration_voucher` | `TycoonContract` | Uses raw untyped `invoke_contract` (legacy cross-contract pattern) | Medium — functional but not type-safe |

---

## 1. `redeem_voucher` — Hard-deprecated entrypoint

### Current state

The `redeem_voucher` entrypoint in `TycoonRewardSystem` always panics with the message:

```rust
pub fn redeem_voucher(_e: Env, _token_id: u128) {
    panic!("Use redeem_voucher_from instead");
}
```

This is the **correct** deprecation pattern for Soroban contracts: the entrypoint remains in the ABI (so existing clients see a clear error) but cannot succeed.

### Canonical replacement

```rust
pub fn redeem_voucher_from(e: Env, redeemer: Address, token_id: u128)
```

The replacement requires the caller to explicitly pass the `redeemer` address and authenticate it via `redeemer.require_auth()`.  This prevents a class of front-running attacks where an attacker could observe a pending `redeem_voucher` transaction and submit their own redemption first.

### Migration steps

1. **Frontend / backend clients:** Replace all calls to `redeem_voucher(token_id)` with `redeem_voucher_from(redeemer, token_id)`.
2. **Testing:** The integration test suite in `contract/integration-tests/src/legacy_entrypoints.rs` verifies that:
   - `redeem_voucher` always panics.
   - `redeem_voucher_from` still works after a failed `redeem_voucher` attempt.
   - No TYC tokens are transferred by the deprecated path.
3. **Rollout:** No on-chain migration needed — the panic is already active.  Client updates can be deployed incrementally.

### Feature flag / rollout

Not applicable — the deprecation is hard-coded in the contract source.  No feature flag is needed.

---

## 2. `test_mint` / `test_burn` — Unguarded test helpers

### Current state

The `TycoonRewardSystem` contract exposes two public entrypoints with **no authorization guard**:

```rust
#[contractimpl]
impl TycoonRewardSystem {
    pub fn test_mint(e: Env, to: Address, token_id: u128, amount: u64) {
        Self::_mint(&e, to, token_id, amount);
    }

    pub fn test_burn(e: Env, from: Address, token_id: u128, amount: u64) {
        Self::_burn(&e, from, token_id, amount);
    }
}
```

These were added for unit testing but are **exposed as public contract entrypoints**.  In a production deployment, any address can call these functions to:

- Inflate voucher balances (via `test_mint`).
- Deflate voucher balances (via `test_burn`).

This is a **critical security risk** and must be resolved before mainnet deployment.

### Recommended fix

**Option A (preferred):** Remove the `#[contractimpl]` block entirely and move the helpers to a `#[cfg(test)]` module:

```rust
#[cfg(test)]
impl TycoonRewardSystem {
    pub fn test_mint(e: Env, to: Address, token_id: u128, amount: u64) {
        Self::_mint(&e, to, token_id, amount);
    }

    pub fn test_burn(e: Env, from: Address, token_id: u128, amount: u64) {
        Self::_burn(&e, from, token_id, amount);
    }
}
```

This ensures the helpers are only available in test builds and do not appear in the production WASM.

**Option B (fallback):** Add an admin-only guard:

```rust
pub fn test_mint(e: Env, to: Address, token_id: u128, amount: u64) {
    let admin: Address = e.storage().persistent().get(&DataKey::Admin).expect("Not initialized");
    admin.require_auth();
    Self::_mint(&e, to, token_id, amount);
}
```

This reduces the risk but still exposes the entrypoints in the ABI.  Option A is cleaner.

### Migration steps

1. **Code change:** Apply Option A (move to `#[cfg(test)]`).
2. **Testing:** The integration test suite in `contract/integration-tests/src/legacy_entrypoints.rs` documents the current unguarded behaviour as "canary tests".  After the fix, these tests will need to be updated or removed (they will no longer compile because the entrypoints won't exist in the client).
3. **Rollout:** Deploy the updated contract to testnet first.  Verify that no legitimate client code calls `test_mint` or `test_burn` (these should only appear in test harnesses).
4. **Mainnet:** Deploy the hardened contract.  The old entrypoints will no longer exist in the ABI.

### Feature flag / rollout

Not applicable — this is a source-level change.  The fix is binary: the entrypoints either exist or they don't.

---

## 3. `mint_registration_voucher` — Legacy untyped cross-contract invocation

### Current state

The `TycoonContract` (game contract) has an entrypoint that mints a voucher in the `TycoonRewardSystem` contract using a raw `env.invoke_contract` call:

```rust
pub fn mint_registration_voucher(env: Env, player: Address) {
    let owner = get_owner(&env);
    owner.require_auth();

    let reward_system = storage::get_reward_system(&env);
    let _token_id: u128 = env.invoke_contract(
        &reward_system,
        &Symbol::new(&env, "mint_voucher"),
        soroban_sdk::vec![&env, player.into_val(&env), 2_0000000u128.into_val(&env)],
    );
}
```

This pattern is **functional** but has several drawbacks:

- **No type safety:** The function name is a string (`"mint_voucher"`), so typos are not caught at compile time.
- **No parameter validation:** The arguments are passed as a `Vec<Val>`, so type mismatches are only detected at runtime.
- **No IDE support:** Autocomplete and refactoring tools cannot track cross-contract calls.

### Recommended fix

Replace the raw `invoke_contract` call with a typed client:

```rust
use tycoon_reward_system::TycoonRewardSystemClient;

pub fn mint_registration_voucher(env: Env, player: Address) {
    let owner = get_owner(&env);
    owner.require_auth();

    let reward_system = storage::get_reward_system(&env);
    let reward_client = TycoonRewardSystemClient::new(&env, &reward_system);
    let _token_id = reward_client.mint_voucher(&owner, &player, &2_000_000_000_000_000_000);
}
```

This provides:

- Compile-time type checking.
- IDE autocomplete and refactoring support.
- Clearer intent (the function signature is explicit).

### Migration steps

1. **Code change:** Replace `env.invoke_contract` with a typed client call.
2. **Testing:** The integration test suite in `contract/integration-tests/src/legacy_entrypoints.rs` locks in the current observable behaviour (owner can call it, a voucher is minted).  After the migration, the same tests must pass — this is the regression guard.
3. **Rollout:** Deploy the updated contract to testnet.  Verify that the voucher minting flow still works end-to-end.
4. **Mainnet:** Deploy the updated contract.  The behaviour is unchanged from the user's perspective.

### Feature flag / rollout

Not applicable — this is a refactoring with no observable behaviour change.  The migration can be deployed in a single step.

---

## Testing

All deprecation paths are covered by the integration test suite in:

```
contract/integration-tests/src/legacy_entrypoints.rs
```

Run the tests locally:

```bash
cd contract
make test-integration
```

Or run only the legacy entrypoint tests:

```bash
cargo test --package tycoon-integration-tests legacy_entrypoints -- --nocapture
```

### Test coverage

| Test | Purpose |
|------|---------|
| `legacy_redeem_voucher_always_panics` | Primary acceptance gate: deprecated entrypoint must panic |
| `legacy_redeem_voucher_does_not_transfer_tokens` | No TYC must move even if the panic is bypassed |
| `canonical_redeem_voucher_from_still_works_after_legacy_attempt` | Canonical path is unaffected by deprecated call |
| `test_mint_entrypoint_is_unguarded_canary` | Documents the unguarded `test_mint` risk |
| `test_burn_entrypoint_is_unguarded_canary` | Documents the unguarded `test_burn` risk |
| `test_burn_insufficient_balance_still_panics` | Underlying `_burn` guard is still active |
| `test_mint_then_burn_leaves_zero_balance_no_token_movement` | Test helpers do not move TYC tokens |
| `legacy_mint_registration_voucher_owner_succeeds` | Current behaviour: owner can mint via legacy path |
| `legacy_mint_registration_voucher_produces_redeemable_voucher` | Voucher is redeemable via canonical path |
| `legacy_mint_registration_voucher_non_owner_rejected` | Non-owner cannot call (auth guard is present) |
| `deprecated_call_does_not_corrupt_subsequent_canonical_flow` | State integrity after failed deprecated call |
| `test_mint_voucher_has_no_value_entry_redeem_panics` | Semantic gap between test helpers and canonical mint |

---

## CI / Acceptance Criteria

### PR checklist

- [ ] PR title references `SW-CON-001` and "legacy entrypoints deprecation".
- [ ] PR body includes a link to this migration document.
- [ ] `cargo check` passes for all workspace members.
- [ ] `make ci-full` passes (hygiene + build + wasm-check + test + integration tests).
- [ ] No new privileged patterns introduced (no unaudited oracle or admin backdoor).
- [ ] All tests in `legacy_entrypoints.rs` pass.

### CI commands

```bash
cd contract
make ci-full
```

This runs:

1. `cargo fmt --all -- --check` (hygiene)
2. `cargo clippy --workspace --all-targets -- -D warnings` (hygiene)
3. `cargo build --target wasm32-unknown-unknown --release` (WASM build)
4. `bash scripts/check-wasm-sizes.sh` (size check)
5. `cargo test --all` (unit tests)
6. `cargo test --package tycoon-integration-tests -- --nocapture` (integration tests)

---

## Security Review

### Privileged patterns

- **`test_mint` / `test_burn`:** These are unguarded and must be removed or admin-gated before mainnet.  The integration tests document this as a "canary" — if the fix is applied, the tests will need updating.
- **`mint_registration_voucher`:** This is owner-gated (correct) but uses an untyped cross-contract call (refactoring recommended, not a security issue).

### Oracle / external data

Not applicable — no external data sources are involved in these entrypoints.

### Audit recommendation

The `test_mint` / `test_burn` issue should be flagged in any pre-mainnet security audit.  The recommended fix (Option A: move to `#[cfg(test)]`) is straightforward and low-risk.

---

## Rollout Plan

### Phase 1: Integration tests (this PR)

- Add `legacy_entrypoints.rs` to the integration test suite.
- Verify all tests pass on the current contract code.
- Merge to `main` (or `develop`).

### Phase 2: Fix `test_mint` / `test_burn` (follow-up PR)

- Apply Option A (move to `#[cfg(test)]`).
- Update or remove the canary tests in `legacy_entrypoints.rs`.
- Deploy to testnet.
- Verify no legitimate clients call these entrypoints.
- Deploy to mainnet.

### Phase 3: Refactor `mint_registration_voucher` (follow-up PR)

- Replace `env.invoke_contract` with a typed client.
- Verify all tests in `legacy_entrypoints.rs` still pass (regression guard).
- Deploy to testnet.
- Deploy to mainnet.

### Phase 4: Remove `redeem_voucher` (long-term)

- After all clients have migrated to `redeem_voucher_from`, the deprecated entrypoint can be removed entirely.
- This is a breaking ABI change and should be coordinated with a major version bump.

---

## References

- **Stellar Wave batch:** Contract (Soroban / Stellar)
- **Issue ID:** SW-CON-001
- **Integration tests:** `contract/integration-tests/src/legacy_entrypoints.rs`
- **Soroban best practices:** [Soroban Docs — Contract Upgrades](https://soroban.stellar.org/docs/learn/contract-upgrades)
- **CEI pattern audit:** `contract/CEI_SECURITY_AUDIT.md`

---

## Changelog

| Date | Author | Change |
|------|--------|--------|
| 2026-04-23 | Kiro (SW-CON-001) | Initial migration document |
