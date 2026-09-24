# Tycoon Boost System

## Overview
Smart contract implementing boost stacking rules, per-player caps, expiry semantics,
and event emissions for the Tycoon game.

---

## Boost Types

### 1. Additive Boosts
- **Stacking**: Values add together before being applied to the base
- **Example**: +10% + +5% = +15% → result = 10 000 × 1.15 = 11 500 bp
- **Use Case**: Temporary buffs, event bonuses

### 2. Multiplicative Boosts
- **Stacking**: Each boost multiplies the running total in order
- **Example**: 1.5× × 1.2× = 1.8× → result = 18 000 bp
- **Use Case**: Property upgrades, permanent bonuses

### 3. Override Boosts
- **Stacking**: Only the boost with the highest `priority` value applies
- **Example**: Priority 10 (3×) overrides Priority 5 (2×) → result = 30 000 bp
- **Use Case**: Special events, VIP status

---

## Stacking Rules (game-design sign-off)

| Rule | Behaviour |
|------|-----------|
| SR-1 | Additive boosts sum their basis-point values before being applied |
| SR-2 | Multiplicative boosts chain: each multiplies the running total |
| SR-3 | Override boosts: only the one with the highest `priority` applies |
| SR-4 | Override supersedes all Additive and Multiplicative boosts |
| SR-5 | When no Override is present: `result = mult_chain × (1 + additive_sum)` |
| SR-6 | A player with no active boosts returns the base value 10 000 bp |

**Formula:**
```
If any Override boost is active:
  Result = Override.value  (highest priority wins)

Else:
  Result = Base(10000) × (Mult₁ × Mult₂ × … / 10000^(n-1)) × (1 + Add₁ + Add₂ + …) / 10000
```

---

## Cap Rules

| Rule | Behaviour |
|------|-----------|
| CAP-1 | A player may hold at most `MAX_BOOSTS_PER_PLAYER` (10) active boosts |
| CAP-2 | Adding a boost when at cap panics with `"CapExceeded"` |
| CAP-3 | Expired boosts are pruned before the cap is checked — freeing slots automatically |
| CAP-4 | Adding a boost with a duplicate `id` panics with `"DuplicateId"` |
| CAP-5 | Adding a boost with `value == 0` panics with `"InvalidValue"` |
| CAP-6 | Adding a boost whose `expires_at_ledger` is non-zero and ≤ current ledger panics with `"InvalidExpiry"` |

---

## Expiry Rules

| Rule | Behaviour |
|------|-----------|
| EXP-1 | `expires_at_ledger == 0` means the boost never expires |
| EXP-2 | A boost with `expires_at_ledger > current_ledger` is active |
| EXP-3 | A boost with `expires_at_ledger <= current_ledger` is expired and excluded from calculation |
| EXP-4 | `calculate_total_boost` excludes expired boosts without mutating storage |
| EXP-5 | `prune_expired_boosts` removes expired boosts from storage and emits `BoostExpiredEvent` for each |
| EXP-6 | Mid-action ledger advance: if the ledger crosses a boost's expiry between add and calculate, the boost is treated as expired at calculate time |

---

## Error Codes

| Code | Trigger |
|------|---------|
| `CapExceeded`   | Player already holds `MAX_BOOSTS_PER_PLAYER` active boosts |
| `DuplicateId`   | A boost with the same `id` is already active for this player |
| `InvalidValue`  | `boost.value` is 0 |
| `InvalidExpiry` | `boost.expires_at_ledger` is non-zero and ≤ current ledger |

---

## Events

| Event | Emitted when |
|-------|-------------|
| `BoostActivatedEvent` | A boost is successfully added via `add_boost` |
| `BoostExpiredEvent`   | An expired boost is removed by `prune_expired_boosts` |
| `BoostsClearedEvent`  | All boosts are cleared via `clear_boosts` |

---

## Values
All values are in basis points (10 000 = 100 %)

| Value | Meaning |
|-------|---------|
| 10 000 | 1.0× (100 % — no boost) |
| 15 000 | 1.5× (150 %) |
| 1 000  | +10 % additive |
| 500    | +5 % additive |

---

## API

```rust
add_boost(player: Address, boost: Boost)
calculate_total_boost(player: Address) -> u32
prune_expired_boosts(player: Address) -> u32
clear_boosts(player: Address)
get_boosts(player: Address) -> Vec<Boost>
get_active_boosts(player: Address) -> Vec<Boost>
```

---

## Deterministic Outcomes
- Same input always produces the same output
- Order of boost application does not matter within the same type
- Priority resolves conflicts for Override type
- Expired boosts are consistently excluded based on ledger sequence number

---

## Testing

```bash
cargo test --package tycoon-boost-system
```

Tests are split across two modules:
- `src/test.rs` — core stacking behaviour (9 tests)
- `src/cap_stacking_expiry_tests.rs` — cap, stacking matrix, expiry, and event tests (31 tests)
