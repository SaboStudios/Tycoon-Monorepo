# Smart Contract Security Audit — CEI & Cross-Contract Call Review

**Status:** ✅ Critical issues fixed | ⚠️ Medium issues documented | 🔲 External audit pending budget approval  
**Contracts reviewed:** tycoon-game, tycoon-main-game, tycoon-reward-system, tycoon-collectibles, tycoon-token, tycoon-boost-system

---

## 1. Cross-Contract Call Inventory

| # | Contract | Function | Callee Contract | Call Type | Direction |
|---|---|---|---|---|---|
| 1 | `tycoon-game` | `withdraw_funds` | TYC / USDC token | `token::Client::transfer` | outbound |
| 2 | `tycoon-game` | `mint_registration_voucher` | `reward_system` | `env.invoke_contract` | outbound |
| 3 | `tycoon-main-game` | `leave_pending_game` | USDC token | `token::Client::transfer` | outbound |
| 4 | `tycoon-reward-system` | `redeem_voucher_from` | TYC token | `token::Client::transfer` | outbound |
| 5 | `tycoon-reward-system` | `withdraw_funds` | TYC / USDC token | `token::Client::transfer` | outbound |
| 6 | `tycoon-collectibles` | `buy_collectible_from_shop` | TYC / USDC token | `token::Client::transfer` | outbound |

> **Note on Soroban re-entrancy:** The Soroban VM does not allow a contract to call itself recursively within the same transaction. However, a malicious token contract (call #4, #6) can call back into *any other* contract, and a compromised token can manipulate state ordering. CEI is still the correct defensive pattern.

---

## 2. CEI Pattern Audit Results

### 2.1 `tycoon-reward-system::redeem_voucher_from` — 🔴 CRITICAL (FIXED)

**File:** `contract/contracts/tycoon-reward-system/src/lib.rs`

**Vulnerability:** `VoucherValue` storage was deleted *after* the external `token::transfer` call. A malicious TYC token contract could observe the voucher value still in storage during the transfer callback and use it to construct a fraudulent redemption proof or trigger downstream logic.

**CEI ordering before fix:**
```
1. Read tyc_value                    ← CHECK
2. _burn (balance zeroed)            ← EFFECT
3. token.transfer (external call)    ← INTERACTION ← VoucherValue still in storage here
4. storage.remove(VoucherValue)      ← EFFECT (too late)
```

**CEI ordering after fix:**
```
1. Read tyc_value + tyc_token        ← CHECK
2. _burn (balance zeroed)            ← EFFECT
3. storage.remove(VoucherValue)      ← EFFECT (all state cleared)
4. token.transfer (external call)    ← INTERACTION
```

**Signed off:** [ ] Tech Lead  [ ] Auditor

---

### 2.2 `tycoon-collectibles::buy_collectible_from_shop` — 🔴 CRITICAL (FIXED)

**File:** `contract/contracts/tycoon-collectibles/src/lib.rs`

**Vulnerability:** External payment `token.transfer(buyer → contract)` was called *before* `set_shop_stock` and `_safe_mint`. A malicious payment token could re-enter `buy_collectible_from_shop` while `current_stock` had not yet been decremented, allowing a buyer to purchase the same stock slot multiple times.

**CEI ordering before fix:**
```
1. Read stock, price                 ← CHECK
2. token.transfer (external call)    ← INTERACTION ← stock not yet decremented
3. _safe_mint                        ← EFFECT
4. set_shop_stock(current_stock - 1) ← EFFECT (too late)
```

**CEI ordering after fix:**
```
1. Read stock, price                 ← CHECK
2. set_shop_stock(current_stock - 1) ← EFFECT
3. _safe_mint                        ← EFFECT
4. token.transfer (external call)    ← INTERACTION
```

**Signed off:** [ ] Tech Lead  [ ] Auditor

---

### 2.3 `tycoon-main-game::leave_pending_game` — 🔴 CRITICAL (FIXED)

**File:** `contract/contracts/tycoon-main-game/src/lib.rs`

**Vulnerability:** USDC refund `token.transfer(contract → player)` was called *before* `storage::set_game`. A malicious USDC token could re-enter `leave_pending_game` while the game state still showed the player as joined and `total_staked` unreduced, enabling a double-refund.

**CEI ordering before fix:**
```
1. Validate player in game           ← CHECK
2. token.transfer refund             ← INTERACTION ← game state not yet updated
3. game.total_staked -= stake        ← EFFECT
4. game.joined_players = new_players ← EFFECT
5. storage::set_game                 ← EFFECT (too late)
```

**CEI ordering after fix:**
```
1. Validate player in game           ← CHECK
2. game.total_staked -= stake        ← EFFECT
3. game.joined_players = new_players ← EFFECT
4. storage::set_game                 ← EFFECT (committed)
5. token.transfer refund             ← INTERACTION
```

**Signed off:** [ ] Tech Lead  [ ] Auditor

---

### 2.4 `tycoon-game::withdraw_funds` — ✅ SAFE

State is read-only before the transfer (balance check only). No state is mutated after the external call. CEI is satisfied.

---

### 2.5 `tycoon-game::mint_registration_voucher` — ⚠️ MEDIUM

**File:** `contract/contracts/tycoon-game/src/lib.rs`

**Observation:** `env.invoke_contract` to `reward_system::mint_voucher` is called with no idempotency guard. If the owner calls this twice for the same player, two vouchers are minted. There is no `voucher_minted` flag in storage.

**Recommendation:** Add a `VoucherMinted(Address)` storage key and check it before invoking the reward system.

**Severity:** Medium — requires owner key compromise to exploit.  
**Status:** 🔲 Open — filed as blocker for mainnet launch.

---

### 2.6 `tycoon-reward-system::withdraw_funds` — ✅ SAFE

Balance check precedes transfer. No state mutation after external call. CEI satisfied.

---

### 2.7 `tycoon-collectibles::buy_collectible` (unrestricted mint) — 🔴 BLOCKER

**File:** `contract/contracts/tycoon-collectibles/src/lib.rs`

**Vulnerability:** `buy_collectible` calls `_safe_mint` with no payment, no price check, and no stock check. Any authenticated address can mint arbitrary amounts of any token ID for free.

```rust
pub fn buy_collectible(env, buyer, token_id, amount) {
    buyer.require_auth();
    _safe_mint(&env, &buyer, token_id, amount)  // no payment
}
```

**Recommendation:** Remove `buy_collectible` or gate it behind admin/minter authorization. Use `buy_collectible_from_shop` for all public purchases.

**Status:** 🔴 Filed as blocker — must be resolved before mainnet.

---

## 3. Callback Attack Scenarios

### Scenario A — Voucher Double-Spend (FIXED)
1. Attacker deploys a malicious ERC-20-style token registered as TYC.
2. Attacker calls `redeem_voucher_from(attacker, token_id)`.
3. During `token.transfer`, malicious token re-enters `redeem_voucher_from` with the same `token_id`.
4. **Before fix:** `VoucherValue` still in storage → second redemption succeeds.
5. **After fix:** `VoucherValue` removed before transfer → second call panics on `expect("Invalid token_id")`.

### Scenario B — Shop Stock Drain (FIXED)
1. Attacker deploys a malicious payment token.
2. Attacker calls `buy_collectible_from_shop` with 1 unit of stock remaining.
3. During `token.transfer(buyer → contract)`, malicious token re-enters `buy_collectible_from_shop`.
4. **Before fix:** `current_stock` still 1 → second purchase succeeds, stock goes to `u64::MAX` on underflow (or panics).
5. **After fix:** Stock decremented to 0 before transfer → second call returns `InsufficientStock`.

### Scenario C — Double Refund on Leave (FIXED)
1. Attacker joins a game with stake.
2. Attacker calls `leave_pending_game`.
3. During USDC `token.transfer(contract → player)`, malicious USDC re-enters `leave_pending_game`.
4. **Before fix:** Game state not yet written → player still appears joined → second refund issued.
5. **After fix:** `storage::set_game` called before transfer → player removed from `joined_players` → second call panics on `"Player is not in this game"`.

### Scenario D — Free Mint via `buy_collectible` (OPEN BLOCKER)
1. Any authenticated user calls `buy_collectible(env, self, token_id, u64::MAX)`.
2. No payment required. Unlimited tokens minted.
3. **Mitigation:** Remove or restrict the function (see §2.7).

---

## 4. State Update Ordering — Summary Checklist

| Contract | Function | State before external call? | Status |
|---|---|---|---|
| tycoon-reward-system | `redeem_voucher_from` | ✅ Yes (after fix) | Fixed |
| tycoon-collectibles | `buy_collectible_from_shop` | ✅ Yes (after fix) | Fixed |
| tycoon-main-game | `leave_pending_game` | ✅ Yes (after fix) | Fixed |
| tycoon-game | `withdraw_funds` | ✅ No state mutation | Safe |
| tycoon-game | `mint_registration_voucher` | ✅ No state after call | Safe (idempotency gap noted) |
| tycoon-reward-system | `withdraw_funds` | ✅ No state mutation | Safe |
| tycoon-collectibles | `buy_collectible` | 🔴 No payment / no guard | Blocker |

---

## 5. Blockers (Must Fix Before Mainnet)

| ID | Contract | Issue | Severity |
|---|---|---|---|
| BLK-001 | tycoon-collectibles | `buy_collectible` allows free unlimited minting | Critical |
| BLK-002 | tycoon-game | `mint_registration_voucher` has no idempotency guard | Medium |

---

## 6. External Audit

An external audit is recommended before mainnet deployment, contingent on budget approval.

**Suggested scope:**
- All contracts in `contract/contracts/`
- Focus areas: token flow, cross-contract calls, access control, integer overflow
- Recommended firms: OtterSec, Halborn, Trail of Bits (Soroban experience required)

**Estimated cost:** $15,000–$40,000 USD depending on scope and firm.

**To request budget approval:** Open a GitHub issue tagged `audit-request` with this document attached and assign to the project lead.

---

## 7. Sign-Off

| Role | Name | Date | Signature |
|---|---|---|---|
| Tech Lead | | | |
| Smart Contract Dev | | | |
| Security Reviewer | | | |
| External Auditor | | | (pending) |
