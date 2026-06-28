# Cross-Contract Auth Matrix — tycoon-game

**Issue:** #1005  
**Crate:** `contract/contracts/tycoon-game/`  
**Contract:** `TycoonContract`  
**SDK:** soroban-sdk 23  
**Version:** 0.2.0  

---

## Overview

This document enumerates every cross-contract interaction originating from `tycoon-game` and every inbound call path that exercises privileged logic inside it. For each interaction the table records the caller role, the callee contract, the entrypoint invoked, what auth is required, and the security verdict.

---

## 1. Outbound Cross-Contract Calls (tycoon-game → external)

| # | Caller entrypoint | Callee contract | Callee method | Auth model | CEI status | Notes |
|---|---|---|---|---|---|---|
| OUT-1 | `admin_mint_registration_voucher` | `reward_system` (stored at init) | `mint_voucher(player, amount)` | Owner auth required on caller side (`require_admin`). Callee address is immutable after `initialize`. | ✅ Safe — no local state written after the cross-contract call | Reward system address cannot be changed post-deploy; reduces substitution risk. |
| OUT-2 | `admin_withdraw_funds` | TYC / USDC token contract (stored at init) | `transfer(from, to, amount)` | Owner auth required (`require_admin`). Token address validated against stored TYC/USDC before call. | ✅ Safe — balance check and auth happen before the `transfer`; no local state written after | `amount` is cast-guarded (`assert!(amount <= i128::MAX as u128)`) before the call. |

---

## 2. Inbound Privileged Call Paths (external → tycoon-game)

### 2.1 Owner-only entrypoints

All of the following require the stored `Owner` address to sign the transaction (`require_admin` → `owner.require_auth()`).

| Entrypoint | Checks performed | State mutated | Notes |
|---|---|---|---|
| `initialize` | Re-init guard; self-address guard on all four address params | `Owner`, `TycToken`, `UsdcToken`, `RewardSystem`, `BackendGameController` (optional), `StateVersion`, `IsInitialized` | One-time bootstrap; all writes are atomic before the flag is set. |
| `admin_migrate` | Owner auth | `StateVersion` | Idempotent at current version. |
| `admin_withdraw_funds` | Owner auth; token whitelist; balance sufficiency; i128 overflow guard | None (token transfer is external) | CEI-compliant. |
| `admin_set_collectible_info` | Owner auth | `Collectible(token_id)` in persistent storage | Overwrite-safe. |
| `admin_set_cash_tier_value` | Owner auth | `CashTier(tier)` in persistent storage | |
| `admin_set_game_controller` | Owner auth | `BackendGameController` in instance storage | Emits `ControllerUpdated`. |
| `admin_transfer_ownership` | Owner auth (current owner) | `Owner` in instance storage | Emits `OwnershipTransferred` with old + new addresses. |
| `admin_mint_registration_voucher` | Owner auth | None locally; triggers `mint_voucher` on reward system | No idempotency guard — see open item OI-5. |

### 2.2 Backend game controller entrypoints

The `backend_game_controller` role is granted by the owner via `admin_set_game_controller`. It is narrowly scoped: only one entrypoint accepts calls from this role.

| Entrypoint | Accepted callers | Checks performed | State mutated | Notes |
|---|---|---|---|---|
| `remove_player_from_game` | `Owner` **or** `BackendGameController` | `caller.require_auth()`; equality check against stored owner and controller | None — event emission only | If `BackendGameController` is unset (`None`), only the owner may call. |

### 2.3 Player-facing entrypoints

| Entrypoint | Auth required | Duplicate guard | Notes |
|---|---|---|---|
| `register_player` | `caller.require_auth()` | Panics if address already registered | Username length enforced (3–20 chars). |

### 2.4 Public read-only entrypoints (no auth required)

| Entrypoint | Returns | Notes |
|---|---|---|
| `get_user` | `Option<User>` | `None` for unregistered addresses. |
| `get_collectible_info` | `(perk, strength, tyc_price, usdc_price, shop_stock)` | Panics with `"Collectible does not exist"` if unknown. |
| `get_cash_tier_value` | `u128` | Panics with `"Cash tier does not exist"` if unknown. |
| `export_state` | `ContractStateDump` | Debug snapshot; no auth, no side effects. |

---

## 3. Role Rotation Capability

| Role | Rotation mechanism | Rotation auth | Event emitted |
|---|---|---|---|
| `Owner` | `admin_transfer_ownership(new_owner)` | Current owner | `OwnershipTransferred(old, new)` |
| `BackendGameController` | `admin_set_game_controller(new_controller)` | Owner | `ControllerUpdated(new_controller)` |
| `RewardSystem` | ❌ Immutable after `initialize` | N/A | N/A |
| `TycToken` / `UsdcToken` | ❌ Immutable after `initialize` | N/A | N/A |

---

## 4. Attack Surface Summary

| Vector | Mitigation | Status |
|---|---|---|
| Re-entrancy via `admin_withdraw_funds` | No state mutation after `token.transfer`; CEI order preserved | ✅ Mitigated |
| Re-entrancy via `admin_mint_registration_voucher` | No local state to corrupt; reward system address is immutable | ✅ Low risk (see OI-5 in checklist) |
| Privilege escalation via `remove_player_from_game` | `caller.require_auth()` enforced; equality check against two stored addresses | ✅ Mitigated |
| Substituting reward system address post-deploy | `RewardSystem` key is instance storage and has no setter after `initialize` | ✅ Mitigated by immutability |
| Substituting token address for withdrawal | `admin_withdraw_funds` validates token against stored TYC/USDC whitelist | ✅ Mitigated |
| Integer overflow on token amounts | `assert!(amount <= i128::MAX as u128)` before cast | ✅ Mitigated |
| Calling admin functions before init | `require_admin` panics with `"Contract not initialized"` if owner key absent | ✅ Mitigated |
| Re-initialization | `is_initialized` guard panics with `"Contract already initialized"` | ✅ Mitigated |

---

## 5. Open Items

| ID | Severity | Description | Status |
|---|---|---|---|
| OI-5 | Info | `admin_mint_registration_voucher` has no idempotency guard — same player can receive multiple vouchers if called repeatedly | 🔲 Tracked in `SECURITY_REVIEW_CHECKLIST.md` as BLK-002 |
| OI-6 | Info | Reward system is immutable; ensure it is audited before mainnet `initialize` | 🔲 Pending |

---

## 6. Validation Performed

- All entrypoints in `src/lib.rs` enumerated and cross-referenced against `src/storage.rs` and `src/events.rs`.
- CEI ordering verified against `SECURITY_REVIEW_CHECKLIST.md` §2.
- No new code introduced; this is a documentation artefact only.
