# Event Schema / ContractEvent Audit — tycoon-game

**Issue:** #1006  
**Crate:** `contract/contracts/tycoon-game/`  
**Source:** `src/events.rs`  
**Contract:** `TycoonContract`  
**SDK:** soroban-sdk 23  
**Version:** 0.2.0  

---

## Overview

This document audits every event emitted by `TycoonContract`, verifying schema
consistency, topic/data correctness, and off-chain indexing adequacy. It also
identifies any state-changing paths that are missing events.

---

## 1. Event Inventory

| # | Event name | Emitted by | Topics (position 0 = discriminator) | Data | Emitter function |
|---|---|---|---|---|---|
| EV-1 | `FundsWithdrawn` | `admin_withdraw_funds` | `(Symbol("FundsWithdrawn"), &token: Address, &to: Address)` | `amount: u128` | `emit_funds_withdrawn` |
| EV-2 | `PlayerRemovedFromGame` | `remove_player_from_game` | `(Symbol("PlayerRemovedFromGame"), game_id: u128, &player: Address)` | `turn_count: u32` | `emit_player_removed_from_game` |
| EV-3 | `ControllerUpdated` | `admin_set_game_controller` | `(Symbol("ControllerUpdated"), &new_controller: Address)` | `()` | `emit_controller_updated` |
| EV-4 | `PlayerRegistered` | `register_player` | `(Symbol("PlayerRegistered"), &player: Address)` | `()` | `emit_player_registered` |
| EV-5 | `OwnershipTransferred` | `admin_transfer_ownership` | `(Symbol("OwnershipTransferred"), &old_owner: Address, &new_owner: Address)` | `()` | `emit_ownership_transferred` |

---

## 2. Schema Verification

### EV-1 — `FundsWithdrawn`

```
topics: (Symbol("FundsWithdrawn"), token: Address, to: Address)
data:   amount: u128
```

- **Discriminator:** `"FundsWithdrawn"` — unique within this contract. ✅
- **token** (topic 1): identifies which asset was moved; essential for multi-asset treasury queries. ✅
- **to** (topic 2): recipient address; indexed for wallet-level queries. ✅
- **amount** (data): u128 covers the full Stellar token range (max i128 ≈ 1.7 × 10³⁸ stroops). ✅
- **Missing fields:** none — caller identity (owner) is implicit from auth; to and token are sufficient.

**Verdict:** ✅ Schema correct and complete.

---

### EV-2 — `PlayerRemovedFromGame`

```
topics: (Symbol("PlayerRemovedFromGame"), game_id: u128, player: Address)
data:   turn_count: u32
```

- **Discriminator:** `"PlayerRemovedFromGame"` — unique. ✅
- **game_id** (topic 1): enables game-scoped event filtering. ✅
- **player** (topic 2): enables player-scoped event filtering. ✅
- **turn_count** (data): informational; carries the turn at which the player was removed. ✅
- **Missing fields:** caller identity is not included. Acceptable — the `caller` must have been the owner or backend controller (enforced by auth), so the removal is always authorised.

**Verdict:** ✅ Schema correct and complete.

---

### EV-3 — `ControllerUpdated`

```
topics: (Symbol("ControllerUpdated"), new_controller: Address)
data:   ()
```

- **Discriminator:** `"ControllerUpdated"` — unique. ✅
- **new_controller** (topic 1): new controller address. Sufficient for indexers watching role changes. ✅
- **Previous controller** is not included in the event. This is a minor gap for audit trails.

> **ESA-01 (Low):** `ControllerUpdated` does not include the previous controller address. Indexers must reconstruct the prior value from the previous event or from storage reads. Recommendation: add `old_controller: Option<Address>` to the data field.

**Verdict:** ⚠️ Functional but audit trail is incomplete (see ESA-01).

---

### EV-4 — `PlayerRegistered`

```
topics: (Symbol("PlayerRegistered"), player: Address)
data:   ()
```

- **Discriminator:** `"PlayerRegistered"` — unique. ✅
- **player** (topic 1): enables player-scoped event filtering. ✅
- **Username** is not included in the event. Username is stored on-chain and can be fetched via `get_user`.

> **ESA-02 (Info):** `PlayerRegistered` does not include the username. Off-chain indexers that want player names must follow up with a `get_user` query. This is acceptable given that username data is available on-chain; emitting it in the event would duplicate stored state.

**Verdict:** ✅ Schema correct; the omission of username is an intentional trade-off.

---

### EV-5 — `OwnershipTransferred`

```
topics: (Symbol("OwnershipTransferred"), old_owner: Address, new_owner: Address)
data:   ()
```

- **Discriminator:** `"OwnershipTransferred"` — unique. ✅
- **old_owner** (topic 1): enables indexers to track who relinquished ownership. ✅
- **new_owner** (topic 2): enables indexers to track who gained ownership. ✅
- Both addresses present — full audit trail supported. ✅

**Verdict:** ✅ Schema correct and complete.

---

## 3. Coverage Check — State-Changing Paths vs Events

| Entrypoint | State mutation | Event emitted | Status |
|---|---|---|---|
| `initialize` | Writes all init keys | ❌ None | ℹ️ Intentional — one-time bootstrap; see note below |
| `admin_migrate` | Advances `StateVersion` | ❌ None | ⚠️ See ESA-03 |
| `admin_withdraw_funds` | Transfers tokens | ✅ `FundsWithdrawn` | ✅ |
| `admin_set_collectible_info` | Writes `Collectible(token_id)` | ❌ None | ⚠️ See ESA-04 |
| `admin_set_cash_tier_value` | Writes `CashTier(tier)` | ❌ None | ⚠️ See ESA-05 |
| `admin_set_game_controller` | Writes `BackendGameController` | ✅ `ControllerUpdated` | ✅ |
| `admin_transfer_ownership` | Writes `Owner` | ✅ `OwnershipTransferred` | ✅ |
| `admin_mint_registration_voucher` | Cross-contract call only | ❌ None locally | ⚠️ See ESA-06 |
| `register_player` | Writes `User`, `Registered` | ✅ `PlayerRegistered` | ✅ |
| `remove_player_from_game` | Emits event only | ✅ `PlayerRemovedFromGame` | ✅ |

> **`initialize` note:** No event is emitted on initialization. This is intentional — the deploy-and-initialize transaction is itself an auditable on-chain record, and emitting an event from inside `initialize` on Soroban adds marginal value because the function is invoked in a known deployment context. Indexers can detect initialization by watching for the first successful call to any entrypoint after contract deployment.

---

## 4. Open Items

| ID | Severity | Description | Recommendation |
|---|---|---|---|
| ESA-01 | Low | `ControllerUpdated` missing previous controller address | Add `old_controller: Option<Address>` to data |
| ESA-02 | Info | `PlayerRegistered` does not include username | Acceptable — username available via `get_user` |
| ESA-03 | Low | `admin_migrate` emits no event; migration version change is silent | Emit `MigrationExecuted(old_version, new_version)` |
| ESA-04 | Info | `admin_set_collectible_info` emits no event | Emit `CollectibleUpdated(token_id)` for off-chain catalogue sync |
| ESA-05 | Info | `admin_set_cash_tier_value` emits no event | Emit `CashTierUpdated(tier, value)` for off-chain sync |
| ESA-06 | Low | `admin_mint_registration_voucher` emits no local event | Emit `RegistrationVoucherMinted(player)` for idempotency tracking and audit |

---

## 5. Soroban Event Model Notes

- All events use `env.events().publish(topics, data)` with the `#[allow(deprecated)]` attribute to acknowledge the current SDK API status.
- Topic tuple max size in soroban-sdk 23 is 4 elements. All events are within budget.
- Event discriminator Symbols are ≤ 32 bytes. All current discriminators are within the limit.
- Events are non-reversible — they are recorded even if the transaction later fails (within the same invocation boundary). This is consistent across all current emitters.

---

## 6. Validation Performed

- All functions in `src/lib.rs` enumerated against `src/events.rs`.
- Topic and data types verified against `soroban_sdk::Env::events().publish` signature.
- Symbol lengths checked: longest is `"PlayerRemovedFromGame"` (21 chars) — within the 32-byte limit.
- No duplicate discriminators found.
- No sensitive data (keys, secrets, prices) exposed in event topics.
