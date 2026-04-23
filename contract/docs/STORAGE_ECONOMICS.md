# Storage Economics & State Bloat

Stellar/Soroban charges **rent** on persistent and instance storage entries. Every byte stored
costs XLM that must be pre-funded; entries whose rent balance runs out are evicted. This document
covers per-user/per-item state sizes, refund patterns, product limits, and links to official
Stellar storage economics.

---

## Stellar Storage Primer

| Storage type | Scope | Rent charged? | Evictable? |
|---|---|---|---|
| `instance` | Whole contract | Yes (per ledger) | Yes (whole contract) |
| `persistent` | Per key | Yes (per ledger) | Yes (individual key) |
| `temporary` | Per key | Yes (per ledger) | Yes (individual key) |

Rent is denominated in **stroops** (1 XLM = 10 000 000 stroops). The network charges
`fee_per_write_1kb` per kilobyte written and a recurring rent fee proportional to entry size and
TTL. See [Stellar Storage Fees](https://developers.stellar.org/docs/learn/fundamentals/fees-resource-limits-metering#storage-fees).

---

## State Size Estimates

### tycoon-game

| Entry | Key type | Approx. size | Storage tier | Notes |
|---|---|---|---|---|
| `Owner` | `instance` | ~57 B | instance | Single address |
| `TycToken` | `instance` | ~57 B | instance | Single address |
| `UsdcToken` | `instance` | ~57 B | instance | Single address |
| `IsInitialized` | `instance` | ~1 B | instance | bool |
| `RewardSystem` | `instance` | ~57 B | instance | Single address |
| `BackendGameController` | `instance` | ~57 B | instance | Single address |
| `User(Address)` | `persistent` | ~150 B | persistent | Per registered user |
| `Registered(Address)` | `persistent` | ~58 B | persistent | Per registered user |
| `Collectible(u128)` | `persistent` | ~40 B | persistent | Per collectible type |
| `CashTier(u32)` | `persistent` | ~20 B | persistent | Per tier (max 5) |

**Per-user footprint (tycoon-game):** ~208 B (`User` + `Registered` entries)

`User` struct breakdown:
```
id: u64            →  8 B
username: String   → ~32 B (variable, assume 20-char avg)
address: Address   → 57 B
registered_at: u64 →  8 B
games_played: u32  →  4 B
games_won: u32     →  4 B
─────────────────────────
Total              ~113 B + key overhead (~35 B) ≈ 150 B
```

---

### tycoon-collectibles

| Entry | Key type | Approx. size | Storage tier | Notes |
|---|---|---|---|---|
| `ADMIN` | `instance` | ~57 B | instance | |
| `MINTER` | `instance` | ~57 B | instance | |
| `PAUSED` | `instance` | ~1 B | instance | bool |
| `SHOP_CFG` | `instance` | ~114 B | instance | 2 addresses |
| `NEXT_TID` | `instance` | ~16 B | instance | u128 |
| `BASE_URI` | `instance` | ~150 B | instance | BaseURIConfig |
| `BAL(owner, token_id)` | `persistent` | ~90 B | persistent | Per owner × token type |
| `PERK(token_id)` | `persistent` | ~20 B | persistent | Per token type |
| `STRENGTH(token_id)` | `persistent` | ~20 B | persistent | Per token type |
| `OWNED(owner)` | `persistent` | ~57 + 16×N B | persistent | Vec of token IDs per owner |
| `TIDX(owner, token_id)` | `persistent` | ~90 B | persistent | Per owner × token type |
| `META(token_id)` | `persistent` | ~400 B | persistent | Per token type (metadata) |
| `PRICE(token_id)` | `persistent` | ~32 B | persistent | Per token type |
| `STOCK(token_id)` | `persistent` | ~8 B | persistent | Per token type |

**Per-user footprint (tycoon-collectibles):**

| Items held | `BAL` entries | `OWNED` vec | `TIDX` entries | Total |
|---|---|---|---|---|
| 1 | 90 B | 73 B | 90 B | ~253 B |
| 5 | 450 B | 137 B | 450 B | ~1 037 B |
| 10 | 900 B | 217 B | 900 B | ~2 017 B |
| 25 | 2 250 B | 457 B | 2 250 B | ~4 957 B |
| 50 | 4 500 B | 857 B | 4 500 B | ~9 857 B |

`OWNED` vec size = 57 B (key overhead) + 16 B × N (u128 per token ID).

---

### tycoon-boost-system

| Entry | Key type | Approx. size | Storage tier | Notes |
|---|---|---|---|---|
| `PlayerBoosts(Address)` | `persistent` | ~57 + 60×N B | persistent | Vec of Boost structs |

`Boost` struct breakdown:
```
id: u128                →  16 B
boost_type: BoostType   →   4 B (enum)
value: u32              →   4 B
priority: u32           →   4 B
expires_at_ledger: u32  →   4 B
─────────────────────────────────
Total per Boost         ~  32 B + enum tag ≈ 36 B
```

**Per-user footprint (tycoon-boost-system):**

| Boosts held | Entry size |
|---|---|
| 0 | 0 B (key absent) |
| 1 | ~93 B |
| 5 | ~237 B |
| 10 (max) | ~417 B |

`MAX_BOOSTS_PER_PLAYER = 10` caps this entry at ~417 B.

---

### tycoon-main-game (pause/admin state)

All keys are `instance` or `persistent` admin-level entries. No per-user keys exist in this
contract; state is bounded by the number of pause events and signers.

| Entry | Approx. size | Storage tier |
|---|---|---|
| `Admin` | ~57 B | instance |
| `IsInitialized` | ~1 B | instance |
| `PauseConfig` | ~57 + 57×S B | persistent |
| `Paused` | ~1 B | persistent |
| `PausedBy` | ~57 B | persistent |
| `PausedAt` | ~8 B | persistent |
| `PauseExpiry` | ~4 B | persistent |
| `PauseReason` | ~10 B | persistent |

S = number of multisig signers.

---

## Product Implications: Maximum Items

The `OWNED` vec in `tycoon-collectibles` is the primary unbounded per-user structure. As it grows,
a single `get_owned_tokens` call reads the entire vec, increasing CPU and memory fees.

| Limit | Rationale |
|---|---|
| **Soft limit: 50 items/user** | `OWNED` vec stays under 1 KB; read cost stays within a single ledger's resource budget |
| **Hard limit: 200 items/user** | `OWNED` vec ~3.3 KB; approaching the point where a single read may exceed per-transaction limits |
| **Boost cap: 10/user** | Already enforced on-chain via `MAX_BOOSTS_PER_PLAYER` |

Recommendation: enforce a configurable `max_items_per_user` constant (default 50) in
`tycoon-collectibles` and reject mints that would exceed it. This prevents state bloat and keeps
read costs predictable.

---

## Refund Patterns for Removed Keys

Soroban does not automatically refund rent when a key is removed; however, removing a key stops
future rent accrual and frees the ledger entry. The contracts already implement correct removal
patterns:

### tycoon-collectibles — balance zeroing
```rust
// storage.rs
pub fn set_balance(env: &Env, owner: &Address, token_id: u128, amount: u64) {
    let key = (BALANCE_PREFIX, owner.clone(), token_id);
    if amount == 0 {
        env.storage().persistent().remove(&key); // ← key removed, rent stops
    } else {
        env.storage().persistent().set(&key, &amount);
    }
}
```

Same pattern applies to `set_shop_stock` and `set_owned_tokens_vec`.

### tycoon-main-game — unpause cleanup
```rust
// storage.rs
pub fn unpause(env: &Env) {
    env.storage().persistent().set(&DataKey::Paused, &false);
    env.storage().persistent().remove(&DataKey::PausedBy);   // ← freed
    env.storage().persistent().remove(&DataKey::PausedAt);   // ← freed
    env.storage().persistent().remove(&DataKey::PauseExpiry);// ← freed
    env.storage().persistent().remove(&DataKey::PauseReason);// ← freed
}
```

### Archival / pruning guidance

| Scenario | Action |
|---|---|
| User transfers all collectibles | `OWNED` vec becomes empty → `set_owned_tokens_vec` removes the key |
| Boost expires | Call `remove_expired_boosts` to filter the `PlayerBoosts` vec and re-set (or remove if empty) |
| User account deletion | Remove `User(addr)` and `Registered(addr)` keys in `tycoon-game` |
| Collectible type retired | Remove `META`, `PRICE`, `STOCK`, `PERK`, `STRENGTH` keys for that `token_id` |

There is no automatic archival today. A future admin function should allow batch removal of
expired/zero-balance entries to reclaim ledger space.

---

## NEAR Storage Economics Reference

> **Note:** These contracts run on **Stellar/Soroban**, not NEAR. The issue referenced NEAR storage
> economics; the equivalent Stellar documentation is linked below.

- [Stellar Storage Fees & Resource Limits](https://developers.stellar.org/docs/learn/fundamentals/fees-resource-limits-metering#storage-fees)
- [Soroban State Archival](https://developers.stellar.org/docs/learn/encyclopedia/storage/state-archival)
- [Soroban Storage Types](https://developers.stellar.org/docs/build/smart-contracts/getting-started/storing-data)
- [Stellar Fee Estimation](https://developers.stellar.org/docs/data/rpc/api-reference/methods/simulateTransaction)
