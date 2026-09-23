# Storage Economics & State Bloat

> **Why this exists:** game state on-chain accumulates **recurring rent**. Soroban storage is not a
> free database — every byte kept alive costs XLM forever, and the rate itself grows as the
> network's total on-chain state grows. Teams that design a game like a classic web app and push
> per-user state into contracts get surprised at settlement time. This document is the playbook:
> what each key costs, what belongs on-chain at all, and how to keep rent predictable.

**Applies to:** the Tycoon workspace's pinned **Soroban SDK v23** (Protocol 23, mainnet since
September 2025). Mainnet has moved past v23 since then (state archival enabled under Protocol 24,
mainnet at Protocol 27 as of July 2026), so the minimum-TTL numbers below changed **dramatically** —
see [Network drift — P23 vs today's mainnet](#network-drift--p23-vs-todays-mainnet). Always
re-verify live network parameters before relying on any figure here.

---

## TL;DR — the rent surprise

| Fact | Number |
|---|---|
| Persistent / instance storage rent rate (P23, at ~1 GB network state) | ≈ **0.0072 stroops per byte per ledger** (temp = half) |
| Annual rent, persistent storage | ≈ **0.0046 XLM per byte** ≈ **4.7 XLM per KB per year** |
| One `User(Address)` entry (~150 B) | ≈ **0.68 XLM / year** |
| Per Tycoon user (tycoon-game `User` + `Registered`, ~208 B) | ≈ **0.95 XLM / year** |
| 10 000 users, tycoon-game profile state only | ≈ **9 500 XLM / year** |
| 25 collectibles held by one user (tycoon-collectibles) | ≈ **23 XLM / year** |
| Rent on write, new persistent entry (P23 min TTL, 150 B) | ≈ 0.0004 XLM |
| Rent on write, same entry on today's mainnet (120-day min TTL) | ≈ **0.23 XLM** (≈ 500× more) |

Rent is charged when an entry is created, grown, restored, or its TTL extended — and it accrues on
every ledger the entry stays alive. It never goes away unless the key is removed.

---

## Storage primer (Soroban v23 / Protocol 23)

| Tier | Lives in | Rent | On TTL expiry | Right for |
|---|---|---|---|---|
| `instance()` | the contract instance's single ledger entry | full rate, whole entry | archived (restorable) | small, global, contract-lifetime config |
| `persistent()` | its own entry per key | full rate per entry | archived (restorable) | data that must never be lost (balances, ownership) |
| `temporary()` | its own entry per key | **half** rate per entry | **deleted forever** | data with a natural deadline, safely regenerable |

Mechanics that bite newcomers (see [Stellar storage strategies](https://developers.stellar.org/docs/build/guides/storage/storage-strategies)):

- **Serialized ledger key ≤ 250 B**, entire serialized entry ≤ 64 KiB.
- **Nothing extends a TTL automatically.** The host never bumps a TTL on access — on any tier.
  Every extension is an explicit `extend_ttl()` / `ExtendFootprintTTLOp`. (The old comment in
  `contracts/tycoon-lib/src/storage_rent.rs` claiming instance entries are "automatically renewed by
  the host" is **outdated** and must not be relied on.)
- **Anyone can extend any entry's TTL.** Expiry is never a security boundary; deadlines belong in
  the value, checked in code.
- **Instance storage is one entry**: all instance data is loaded on every invocation, shares one
  TTL with the contract instance, and writes serialize against each other.
- **P23 auto-restore:** an archived persistent/instance key that the RPC simulation adds to the
  transaction's restore list is restored automatically before the contract runs — but restoration
  charges rent (the entry comes back at the minimum persistent TTL). Temporary entries can never be
  restored.

---

## Fee & rent model (Soroban v23 / Protocol 23)

All fees are in **stroops** (1 XLM = 10 000 000 stroops). Source: [CAP-66 (P23 rent & fee changes)](https://github.com/stellar/stellar-protocol/blob/master/core/cap-0066.md) and [CAP-46-12 (state archival)](https://github.com/stellar/stellar-protocol/blob/master/core/cap-0046-12.md).

**Write fee** (flat since P23):

```
write_fee = ceil(write_bytes × feeWrite1KB / 1024)      # feeWrite1KB = 3 500 stroops
```

**Rent fee** — cost to keep `S` bytes alive for `L` ledgers:

```
rent_fee = round_up(S × L × rent_fee_per_1kb(state) / denominator)

denominator:  persistent & instance = 1 215
              temporary            = 2 430   (temp rents at exactly half)

rent_fee_per_1kb(state) — dynamic, grows with the network's live Soroban state:
  floor   = 1 000 stroops/KB
  at ~1 GB (P23 launch) ≈ 9 000 stroops/KB
  at 2 GB              ≈ 18 000 stroops/KB
  at 3 GB (target)     ≈ 27 000 stroops/KB
```

**Worked rate (P23, ~1 GB network state):**

```
persistent, per byte per ledger = 9 000 / (1024 × 1 215)   ≈ 0.00723 stroops/B/ledger
persistent, per KB per year     = 0.00723 × 1024 × 6 307 200 ledgers/yr ≈ 4.7 XLM
temporary is half of the above.
```

Assumptions: 5-second ledger close → ~6.31 M ledgers/year; P23 launch state ≈ 1 GB
(`rent_fee_per_1kb ≈ 9 000`). These are **illustrative points on a dynamic curve**, not constants.

**TTL parameters:**

| Parameter | P23 (project pinned) | Today's mainnet (Jul 2026) |
|---|---|---|
| Min persistent/instance TTL | 4 096 ledgers (~5.7 h) | **2 073 600 ledgers (~120 days)** |
| Min temporary TTL | 4 096 ledgers | 17 280 ledgers (~1 day) |
| Max TTL | — | 3 110 400 ledgers (~180 days) |

---

## Network drift — P23 vs today's mainnet

The workspace pins Soroban v23, but mainnet did not stand still:

- **Protocol 24 (Oct 2025)** enabled the state-archival feature and raised minimum TTLs
  (`minPersistentTtl = 2 073 600`, `minTemporaryTtl = 17 280` per the Stellar network config).
- Mainnet is at **Protocol 27** as of July 2026; rent rates continue to rise with on-chain state.

**The practical consequence:** on today's mainnet, **every new persistent entry pays ~120 days of
rent upfront**, and every expired key costs that again to restore. A 150-byte `User` entry that cost
~0.0004 XLM to create under P23's 4 096-ledger minimum costs **~0.23 XLM upfront today** (plus the
same again at every 120-day renewal). Budgets sized against P23 numbers will be off by ~2 orders of
magnitude on write, and the recurring rate is likely higher than the 9 000 stroops/KB used here.

**Always verify live parameters** before deploying — the canonical source is the network config:
`stellar network settings --network mainnet`, the [Stellar Lab resource table](https://lab.stellar.org/),
or the `ConfigSetting` ledger entries via RPC. Re-run the arithmetic below with the current
`rentFee1KBSorobanStateSize*`, `persistentRentRateDenominator`, `feeWrite1KB`, and `minPersistentTTL`.

---

## Per-key rent sketch

Sizes below are the pre-cleanup estimates (restored from git history, `#410`). Rent is
computed at the P23 illustrative rate (persistent ≈ 0.0046 XLM/byte/year; temp half). The
"on write (today)" column uses today's 2 073 600-ledger minimum persistent TTL.

### tycoon-game

| Key | Tier | Approx. size | Rent / year | On write (today) | Notes |
|---|---|---|---|---|---|
| `Owner`, `TycToken`, `UsdcToken`, `RewardSystem`, `BackendGameController` | instance | ~57 B each | shared (see instance line) | — | part of the single instance entry |
| `IsInitialized`, `StateVersion` | instance | ~1–4 B | shared | — | |
| **Contract instance entry (all of the above)** | instance | ~0.5 KB | ≈ **2.3 XLM/yr** | ≈ 0.8 XLM | one TTL for everything |
| `User(Address)` | persistent | ~150 B | ≈ **0.68 XLM/yr** | ≈ 0.23 XLM | per registered user |
| `Registered(Address)` | persistent | ~58 B | ≈ 0.27 XLM/yr | ≈ 0.09 XLM | per registered user |
| `Collectible(u128)` | persistent | ~40 B | ≈ 0.18 XLM/yr | ≈ 0.06 XLM | per collectible type |
| `CashTier(u32)` | persistent | ~20 B | ≈ 0.09 XLM/yr | ≈ 0.03 XLM | per tier (max 5) |
| `VoucherMinted(Address)` | persistent → **temporary** | ~58 B | 0.13 XLM/yr (temp) | — | one-shot redemption flag; move to temporary |

**Per-user footprint (tycoon-game):** `User` + `Registered` ≈ 208 B → **~0.95 XLM/year**, and
~0.32 XLM upfront per new user on today's mainnet. At 10k users that is ~9 500 XLM/year of rent
for profile data alone — see [What belongs on-chain vs backend](#what-belongs-on-chain-vs-backend).

`User` struct breakdown (from `contracts/tycoon-game/src/storage.rs`):
```
id: u64            →  8 B
username: String   → ~32 B (variable; average 20 chars)
address: Address   → 57 B
registered_at: u64 →  8 B
games_played: u32  →  4 B
games_won: u32     →  4 B
─────────────────────────
Total              ~113 B + key overhead (~35 B) ≈ 150 B
```

### tycoon-collectibles

| Key | Tier | Approx. size | Rent / year | Notes |
|---|---|---|---|---|
| `ADMIN`, `MINTER` | instance | ~57 B | shared | |
| `SHOP_CFG`, `BASE_URI` | instance | ~114–150 B | shared | |
| `BAL(owner, token_id)` | persistent | ~90 B | ≈ 0.41 XLM/yr | per owner × token type |
| `TIDX(owner, token_id)` | persistent | ~90 B | ≈ 0.41 XLM/yr | per owner × token type |
| `OWNED(owner)` | persistent | 57 + 16×N B | see below | Vec of token IDs |
| `PERK(token_id)`, `STRENGTH(token_id)` | persistent | ~20 B | ≈ 0.09 XLM/yr | per token type |
| `META(token_id)` | persistent | ~400 B | ≈ 1.8 XLM/yr | per token type |
| `PRICE(token_id)` | persistent | ~32 B | ≈ 0.15 XLM/yr | per token type |
| `STOCK(token_id)` | persistent | ~8 B | ≈ 0.04 XLM/yr | per token type |

**Per-user footprint (tycoon-collectibles):**

| Items held | `BAL` + `TIDX` + `OWNED` | Total size | Rent / year |
|---|---|---|---|
| 1 | 90 + 90 + 73 | ~253 B | ≈ **1.15 XLM** |
| 5 | 450 + 450 + 137 | ~1 037 B | ≈ 4.7 XLM |
| 10 | 900 + 900 + 217 | ~2 017 B | ≈ 9.2 XLM |
| 25 | 2 250 + 2 250 + 457 | ~4 957 B | ≈ 22.6 XLM |
| 50 | 4 500 + 4 500 + 857 | ~9 857 B | ≈ 45.0 XLM |

`OWNED` vec size = 57 B (key overhead) + 16 B × N (u128 per token ID). The 50-item "soft limit"
from the original doc is **not affordable as persistent rent** (~45 XLM/user/year); see [Product implications](#product-implications--recommended-limits).

### tycoon-boost-system

| Key | Tier | Approx. size | Rent / year | Notes |
|---|---|---|---|---|
| `PlayerBoosts(Address)` | persistent | 57 + 36×N B | see below | Vec of Boost structs (N ≤ 10) |

`Boost` struct (id u128, boost_type enum, value u32, priority u32, expires_at_ledger u32) ≈ 36 B
including enum tag. (The original doc's "60×N" was a typo — the worked values use 36 B.)

| Boosts held | Entry size | Rent / year |
|---|---|---|
| 1 | ~93 B | ≈ 0.42 XLM |
| 5 | ~237 B | ≈ 1.08 XLM |
| 10 (max) | ~417 B | ≈ 1.90 XLM |

Boosts are time-bounded (`expires_at_ledger`). If a lost boost is acceptable (or re-issuable),
temporary storage halves this cost; keep persistent if a paid boost must survive restores.

### tycoon-main-game (pause/admin state)

All keys are instance/persistent admin entries; no per-user keys. Bounded by signer count.

| Key | Approx. size | Rent / year |
|---|---|---|
| `Admin` | ~57 B | instance (shared) |
| `PauseConfig` | ~57 + 57×S B | small |
| `Paused`, `PausedBy`, `PausedAt`, `PauseExpiry`, `PauseReason` | ~80 B total | ≈ 0.4 XLM/yr while paused |

S = multisig signer count. This contract is negligible — a good model for other admin state.

---

## What belongs on-chain vs backend

The Tycoon monorepo has a NestJS backend + shop microservice on PostgreSQL — that is the right
home for most game state. Soroban should hold **only economic facts that must be provable without
the backend**: token balances, ownership, prices, and claims. Rule of thumb:

> If state is read/written at gameplay speed, is per-user profile data, or only needs to be true
> while our backend is alive → **Postgres**. If a third party must be able to verify it without
> trusting our server, or it settles token/NFT value → **on-chain** (persistent). If it has a
> deadline and loss is acceptable → **temporary** (cheapest).

| State | Where | Why |
|---|---|---|
| `tycoon-token` balances | on-chain, persistent | trustless value transfer; canonical balance |
| NFT ownership (`BAL`, `OWNED`, `TIDX`) | on-chain, persistent | user property; must survive backend outages |
| Shop prices & stock (gate token purchases) | on-chain, persistent | single source of truth for settlement |
| Reward/achievement claims | on-chain, persistent (or temp if one-shot) | provable against the reward system |
| Purchases / idempotency keys | `shop-api` Postgres | settlement is backend-owned (see ADR-001) |
| **User profile** (`User(Address)`: username, registered_at, games_played/won) | **backend Postgres** | mutable profile + stats, no settlement value; biggest single rent line item |
| `Registered(Address)` flag | backend, or temp on-chain | existence check does not need permanent storage |
| Rooms, lobbies, live match state, dice/turns | backend (realtime gateway) | high-frequency, no trustless value |
| Leaderboards, match history, telemetry | backend | read-heavy analytics, never on-chain |
| Voucher redemption flags | temporary on-chain (or backend) | one-shot; permanent storage is wasted rent |
| Boosts | persistent on-chain (paid) / temp (cosmetic) | only if token-backed or tradeable |

**The trap this repo almost walked into:** `tycoon-game`'s `User(Address)` + `Registered(Address)`
are ~208 B per user with no settlement value — that is ~0.95 XLM/user/year of rent (plus ~0.32 XLM
upfront per new user on today's mainnet) to store what Postgres already stores. When the contract
is restored, the migration path is: keep on-chain only what gameplay settlement needs
(collectible ownership, shop stock, token balances), and move the profile struct off-chain.

---

## Product implications — recommended limits

Rent changes the cost model for unbounded per-user structures. `OWNED` in tycoon-collectibles is
the primary one.

| Limit | Rationale (rent-aware) |
|---|---|
| **Soft limit: 10 items/user** | ~9.2 XLM/yr/user at P23 rates; 25 items is ~23 XLM/yr and hard to justify for a casual game |
| **Hard limit: 25 items/user** | beyond this, a single `get_owned_tokens` read also strains per-tx read budgets |
| **Boost cap: 10/user** | already enforced via `MAX_BOOSTS_PER_PLAYER`; ≈ 1.9 XLM/yr/user |
| **Zero-value keys never written** | absent key == default; never store zeros/`false` (see refund patterns) |

Enforce a configurable `max_items_per_user` in tycoon-collectibles and reject mints that exceed it.
Revisit limits whenever the network's rent parameters change — rent is dynamic and has already
moved ~2 orders of magnitude since P23.

---

## Refund patterns for removed keys

Soroban does **not refund** rent when a key is removed — but removal stops future accrual and frees
the ledger entry. The contracts implement correct removal patterns (from the pre-cleanup source):

### tycoon-collectibles — balance zeroing
```rust
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
pub fn unpause(env: &Env) {
    env.storage().persistent().set(&DataKey::Paused, &false);
    env.storage().persistent().remove(&DataKey::PausedBy);
    env.storage().persistent().remove(&DataKey::PausedAt);
    env.storage().persistent().remove(&DataKey::PauseExpiry);
    env.storage().persistent().remove(&DataKey::PauseReason);
}
```

| Scenario | Action |
|---|---|
| User transfers all collectibles | `OWNED` vec empty → key removed by `set_owned_tokens_vec` |
| Boost expires | filter `PlayerBoosts` and re-set (or remove if empty) |
| Account deletion | remove `User(addr)` + `Registered(addr)` in tycoon-game |
| Collectible type retired | remove `META`, `PRICE`, `STOCK`, `PERK`, `STRENGTH` for that `token_id` |

There is no automatic archival today; a future admin batch-removal function would reclaim ledger
space (and stop the associated rent).

---

## TTL governance

Because nothing extends TTLs automatically (see primer), every persistent/instance entry needs an
explicit extension policy. The pre-cleanup `tycoon-lib/src/storage_rent.rs` constants are the right
shape — keep them, with current values in mind (17 280 ledgers = 1 day at 5-s close):

| Constant | Value | Meaning |
|---|---|---|
| `LEDGERS_PER_DAY` | 17 280 | ~1 day |
| `INSTANCE_BUMP_LEDGERS` / `PERSISTENT_BUMP_LEDGERS` | 518 400 | ~30 days |
| `INSTANCE_BUMP_THRESHOLD` / `PERSISTENT_BUMP_THRESHOLD` | 259 200 | bump when < ~15 days remain |
| `TEMP_BUMP_LEDGERS` | 17 280 | ~1 day |

Pattern (bump-on-access): call `extend_ttl(THRESHOLD, BUMP)` on the exact keys a function touches;
extension is a no-op above the threshold, so active data self-renews and idle data eventually
archives instead of being paid for forever. For data that must survive total inactivity, run an
off-chain keeper issuing `ExtendFootprintTTLOp` — or accept the restore cost.

---

## Restore hooks — tycoon-game storage link

> 🔄 **Restore hook:** `contracts/tycoon-game/` was removed in the cleanup batch (along with the
> other contract crates). The tycoon-game estimates above are preserved from the pre-cleanup
> source (`contracts/tycoon-game/src/storage.rs`, `DataKey` enum, `User` struct).
> **When the contract is restored, replace this callout with a relative link to
> `../contracts/tycoon-game/src/storage.rs`** and re-verify the per-key sizes against the restored
> code (they drift as the schema changes). The same applies to the other contract sections —
> re-check sizes against each restored crate's `src/storage.rs`.

---

## References

- [Stellar fees, resource limits & metering](https://developers.stellar.org/docs/learn/fundamentals/fees-resource-limits-metering) — fee model overview
- [State archival (storage tiers, TTL, restore)](https://developers.stellar.org/docs/learn/fundamentals/contract-development/storage/state-archival)
- [Storage strategies in production contracts](https://developers.stellar.org/docs/build/guides/storage/storage-strategies) — protocol-snapshot of current limits and TTL values
- [CAP-66: Soroban in-memory read resource (P23 rent & fee changes)](https://github.com/stellar/stellar-protocol/blob/master/core/cap-0066.md) — formula and P23 parameter values
- [CAP-46-12: Soroban state archival interface](https://github.com/stellar/stellar-protocol/blob/master/core/cap-0046-12.md) — rent fee definition
- [Protocol 23 upgrade guide](https://stellar.org/blog/developers/protocol-23-upgrade-guide) — mainnet timeline (Sep 2025)
- [Protocol 24 upgrade guide](https://stellar.org/blog/developers/protocol-24-upgrade-guide) — state-archival enablement, no XDR changes
- [Stellar Lab — network parameters](https://lab.stellar.org/) — live resource limits & rent config (verify before relying on this document's numbers)
- [StellarExpert protocol history](https://stellar.expert/explorer/public/protocol-history) — historical parameter changes
