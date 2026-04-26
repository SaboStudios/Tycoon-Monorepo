# Security Review Checklist — tycoon-game (SW-CT-007)

**Issue:** SW-CT-007
**Reviewer:** (assign before merge)
**Date:** 2026-04-26
**Contract:** `contract/contracts/tycoon-game/src/lib.rs`
**SDK:** soroban-sdk 23
**Version:** 0.2.0

---

## 1. Access Control

| # | Check | Status | Notes |
|---|---|---|---|
| AC-1 | `initialize` can only be called once | ✅ | Guards on `DataKey::IsInitialized`; panics with `"Contract already initialized"` |
| AC-2 | `initialize` requires `initial_owner.require_auth()` | ✅ | Owner must sign the initialization transaction |
| AC-3 | `admin_migrate` requires owner via `require_admin` | ✅ | |
| AC-4 | `admin_withdraw_funds` requires owner via `require_admin` | ✅ | |
| AC-5 | `admin_set_collectible_info` requires owner via `require_admin` | ✅ | |
| AC-6 | `admin_set_cash_tier_value` requires owner via `require_admin` | ✅ | |
| AC-7 | `admin_set_game_controller` requires owner via `require_admin` | ✅ | |
| AC-8 | `admin_mint_registration_voucher` requires owner via `require_admin` | ✅ | |
| AC-9 | `require_admin` panics with `"Contract not initialized"` if owner key absent | ✅ | Prevents calling admin functions before `initialize` |
| AC-10 | `register_player` requires `caller.require_auth()` | ✅ | Player must sign their own registration |
| AC-11 | `remove_player_from_game` requires `caller.require_auth()` | ✅ | Caller must sign; then checked against owner or backend controller |
| AC-12 | `remove_player_from_game` rejects callers that are neither owner nor backend controller | ✅ | Panics with `"Unauthorized: caller must be owner or backend game controller"` |
| AC-13 | `get_user`, `get_collectible_info`, `get_cash_tier_value`, `export_state` are read-only with no auth | ✅ | Public view functions; no state mutation |
| AC-14 | No unaudited oracle or privileged pattern without review | ✅ | No oracle used; `backend_game_controller` is the only privileged off-chain role and is admin-controlled |

---

## 2. CEI (Checks-Effects-Interactions) Pattern

| # | Function | Checks before effects? | Effects before interactions? | Status |
|---|---|---|---|---|
| CEI-1 | `admin_withdraw_funds` | ✅ validates token address and balance | ✅ no state mutation after `token.transfer` | ✅ |
| CEI-2 | `admin_mint_registration_voucher` | ✅ admin auth check first | ✅ no local state written; cross-contract call is the only action | ⚠️ See note below |
| CEI-3 | `initialize` | ✅ re-init guard first | ✅ all storage writes before any external interaction | ✅ |
| CEI-4 | `register_player` | ✅ auth + duplicate + username length checks | ✅ storage writes only; no external calls | ✅ |
| CEI-5 | `remove_player_from_game` | ✅ auth + role check | ✅ event emission only; no external calls | ✅ |

> **CEI-2 note:** `admin_mint_registration_voucher` makes a cross-contract call to the reward system via `env.invoke_contract`. There is no local state to protect before the call, so CEI ordering is satisfied. However, the reward system address is stored at initialization and cannot be changed post-deploy, which limits the attack surface. Ensure the reward system contract is audited before mainnet.

---

## 3. Input Validation

| # | Check | Status | Notes |
|---|---|---|---|
| IV-1 | `initialize` — rejects re-initialization | ✅ | `"Contract already initialized"` |
| IV-2 | `admin_withdraw_funds` — rejects token addresses other than TYC or USDC | ✅ | `"Invalid token address"` |
| IV-3 | `admin_withdraw_funds` — rejects withdrawal exceeding contract balance | ✅ | `"Insufficient contract balance"` |
| IV-4 | `register_player` — rejects duplicate registration | ✅ | `"Address already registered"` |
| IV-5 | `register_player` — rejects username shorter than 3 characters | ✅ | `"Username must be 3-20 characters"` |
| IV-6 | `register_player` — rejects username longer than 20 characters | ✅ | `"Username must be 3-20 characters"` |
| IV-7 | `get_collectible_info` — rejects unknown `token_id` | ✅ | `"Collectible does not exist"` |
| IV-8 | `get_cash_tier_value` — rejects unknown `tier` | ✅ | `"Cash tier does not exist"` |
| IV-9 | `admin_withdraw_funds` — `amount` is `u128`; no negative value possible | ✅ | Type-level guarantee |

---

## 4. Integer Arithmetic

| # | Check | Status | Notes |
|---|---|---|---|
| INT-1 | `admin_withdraw_funds` — `amount as i128` cast | ⚠️ | If `amount > i128::MAX` the cast silently truncates. Add an explicit bounds check: `assert!(amount <= i128::MAX as u128, "amount exceeds i128::MAX")` before the cast |
| INT-2 | `TreasurySnapshot::invariant_holds` — uses `checked_add` | ✅ | Returns `false` on overflow rather than panicking |
| INT-3 | `TreasurySnapshot::assert_invariant` — panics with descriptive message | ✅ | |
| INT-4 | No arithmetic on user-supplied values in storage reads/writes | ✅ | Collectible prices and stock are stored as-is; no on-chain arithmetic on them |

---

## 5. Storage & State Consistency

| # | Check | Status | Notes |
|---|---|---|---|
| ST-1 | `DataKey` variants are distinct; no key collision possible | ✅ | Enum variants with typed payloads |
| ST-2 | `IsInitialized` flag is set atomically with all other init state | ✅ | Set last in `initialize` after all other keys are written |
| ST-3 | `BackendGameController` is `Option<Address>`; absence is handled correctly | ✅ | `get_backend_game_controller` returns `None`; `remove_player_from_game` handles `None` safely via `is_some_and` |
| ST-4 | `User` struct stores `registered_at` from `env.ledger().timestamp()` | ✅ | Ledger timestamp is consensus-derived; not manipulable by a single validator |
| ST-5 | `StateVersion` is set to `1` during `initialize`; `admin_migrate` advances it safely | ✅ | No version can be skipped or decremented |
| ST-6 | `Collectible` and `CashTier` entries use `persistent` storage | ✅ | Appropriate for long-lived game data |
| ST-7 | `Owner`, `TycToken`, `UsdcToken`, `RewardSystem`, `BackendGameController`, `StateVersion`, `IsInitialized` use `instance` storage | ✅ | Appropriate for contract-lifetime configuration |
| ST-8 | `User` and `Registered` entries use `persistent` storage keyed by `Address` | ✅ | Per-player data correctly scoped |

---

## 6. Event Emission

| # | Function | Event | Status |
|---|---|---|---|
| EV-1 | `admin_withdraw_funds` | `FundsWithdrawn` (topics: token, to; data: amount) | ✅ |
| EV-2 | `remove_player_from_game` | `PlayerRemovedFromGame` (topics: game_id, player; data: turn_count) | ✅ |
| EV-3 | `initialize` | No event emitted | ℹ️ Intentional — initialization is a one-time bootstrap; indexers can detect it from the transaction |
| EV-4 | `register_player` | No event emitted | ℹ️ Consider adding a `PlayerRegistered` event for off-chain indexing |
| EV-5 | `admin_set_game_controller` | No event emitted | ⚠️ Controller rotation is a privileged action; recommend adding a `ControllerUpdated` event for auditability |

---

## 7. Privileged Roles

| Role | How granted | How rotated | Notes |
|---|---|---|---|
| `owner` | Set in `initialize` | No rotation mechanism | ⚠️ Owner key cannot be rotated post-deploy. If the owner key is compromised, the contract cannot be recovered. Consider adding an `admin_transfer_ownership` entrypoint. |
| `backend_game_controller` | Set by owner via `admin_set_game_controller` | Owner calls `admin_set_game_controller` with new address | ✅ Rotation is supported |

---

## 8. Denial-of-Service / Gas

| # | Check | Status | Notes |
|---|---|---|---|
| DOS-1 | No unbounded loops in any public function | ✅ | |
| DOS-2 | No dynamic storage reads proportional to user count | ✅ | All reads are O(1) keyed lookups |
| DOS-3 | `admin_withdraw_funds` makes a single external token transfer | ✅ | |
| DOS-4 | `admin_mint_registration_voucher` makes a single cross-contract call | ✅ | |

---

## 9. Stellar / Soroban Best Practices

| # | Check | Status | Notes |
|---|---|---|---|
| SBP-1 | Uses `soroban_sdk::token::Client` for token transfers | ✅ | |
| SBP-2 | Uses `env.current_contract_address()` for self-reference | ✅ | |
| SBP-3 | `#[contracttype]` on `DataKey`, `CollectibleInfo`, `User`, `ContractStateDump` | ✅ | |
| SBP-4 | `overflow-checks = true` in release profile | ✅ | Workspace `Cargo.toml` |
| SBP-5 | `panic = "abort"` in release profile | ✅ | |
| SBP-6 | No `unsafe` blocks | ✅ | |
| SBP-7 | `#[no_std]` | ✅ | |
| SBP-8 | Deprecated shims carry `#[deprecated(since = "0.2.0")]` | ✅ | Clear migration signal for integrators |
| SBP-9 | `require_admin` is a single internal helper — auth boundary is easy to audit | ✅ | |

---

## 10. Open Items (Must Resolve Before Mainnet)

| ID | Severity | Description | Owner | Status |
|---|---|---|---|---|
| OI-1 | Medium | `amount as i128` cast in `admin_withdraw_funds` is unchecked — add `assert!(amount <= i128::MAX as u128)` | | 🔲 Open |
| OI-2 | Medium | No owner rotation mechanism — add `admin_transfer_ownership` to allow key rotation | | 🔲 Open |
| OI-3 | Low | `admin_set_game_controller` emits no event — add `ControllerUpdated` event for auditability | | 🔲 Open |
| OI-4 | Low | `register_player` emits no event — add `PlayerRegistered` event for off-chain indexing | | 🔲 Open |
| OI-5 | Info | Reward system address is immutable post-deploy — ensure it is audited before `initialize` is called on mainnet | | 🔲 Pending audit |
| OI-6 | Info | External audit recommended before mainnet | | 🔲 Pending budget |

---

## 11. Sign-Off

| Role | Name | Date | Signature |
|---|---|---|---|
| Smart Contract Dev | | | |
| Tech Lead | | | |
| Security Reviewer | | | |
| External Auditor | | | (pending) |
