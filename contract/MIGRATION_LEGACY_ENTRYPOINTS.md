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
| 1 | `redeem_voucher` | `TycoonRewardSystem` | Removed from the ABI | Low — clients must use `redeem_voucher_from` |
| 2 | `test_mint` / `test_burn` | `TycoonRewardSystem` | Unguarded test helpers exposed as public entrypoints | **High** — arbitrary caller can inflate/deflate balances |
| 3 | `mint_registration_voucher` | `TycoonContract` | Uses raw untyped `invoke_contract` (legacy cross-contract pattern) | Medium — functional but not type-safe |

---

## 1. `redeem_voucher` — Removed entrypoint

### Current state

The `redeem_voucher` entrypoint has been **removed** from `TycoonRewardSystem`.  It previously panicked with `"Use redeem_voucher_from instead"`, which surfaced as an opaque host error to wallets and the backend and could not be simulated cleanly.  The entrypoint no longer exists in the ABI.

### Canonical replacement

```rust
pub fn redeem_voucher_from(e: Env, redeemer: Address, token_id: u128)
```

The replacement requires the caller to explicitly pass the `redeemer` address and authenticate it via `redeemer.require_auth()`.  This prevents a class of front-running attacks where an attacker could observe a pending redemption transaction and submit their own redemption first.  The kept path still burns exactly one voucher and pays the stored value.

### Migration steps

1. **Frontend / backend clients:** Replace all calls to `redeem_voucher(token_id)` with `redeem_voucher_from(redeemer, token_id)`.  Calls to the removed entrypoint will now fail at the client/ABI layer rather than with a panic string.
2. **Testing:** The reward tests exercise `redeem_voucher_from` and verify that exactly one voucher is burned and the stored value is paid out.
3. **Rollout:** No on-chain migration needed — the entrypoint is gone from the deployed WASM.  Client updates can be deployed incrementally.

### Feature flag / rollout

Not applicable — the removal is hard-coded in the contract source.  No feature flag is needed.

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
| `redeem_voucher_from_burns_and_pays` | Kept redeem path burns exactly one voucher and pays the stored value |
| `legacy_redeem_voucher_does_not_transfer_tokens` | No TYC must move via the removed entrypoint |
