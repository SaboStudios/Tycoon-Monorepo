# Boost System Integration Examples

## Example 1: Property Upgrade Boosts (Multiplicative)

```rust
// Player owns 3 properties with upgrades
// Property 1: +20% boost (12000 basis points)
// Property 2: +30% boost (13000 basis points)
// Property 3: +10% boost (11000 basis points)

client.add_boost(&player, &Boost {
    id: 1,
    boost_type: BoostType::Multiplicative,
    value: 12000,
    priority: 0,
});

client.add_boost(&player, &Boost {
    id: 2,
    boost_type: BoostType::Multiplicative,
    value: 13000,
    priority: 0,
});

client.add_boost(&player, &Boost {
    id: 3,
    boost_type: BoostType::Multiplicative,
    value: 11000,
    priority: 0,
});

// Result: 10000 * 1.2 * 1.3 * 1.1 = 17160 (71.6% total boost)
let total = client.calculate_total_boost(&player);
```

## Example 2: Event Bonuses (Additive)

```rust
// Weekend event: +15%
// Community chest: +5%
// Chance card: +10%

client.add_boost(&player, &Boost {
    id: 101,
    boost_type: BoostType::Additive,
    value: 1500,
    priority: 0,
});

client.add_boost(&player, &Boost {
    id: 102,
    boost_type: BoostType::Additive,
    value: 500,
    priority: 0,
});

client.add_boost(&player, &Boost {
    id: 103,
    boost_type: BoostType::Additive,
    value: 1000,
    priority: 0,
});

// Result: 10000 * (1 + 0.30) = 13000 (30% total boost)
let total = client.calculate_total_boost(&player);
```

## Example 3: VIP Status (Override)

```rust
// Player has various boosts but VIP status overrides all
// Regular boosts: 2x from properties
// VIP Diamond status: 5x (priority 100)

client.add_boost(&player, &Boost {
    id: 1,
    boost_type: BoostType::Multiplicative,
    value: 20000,
    priority: 0,
});

client.add_boost(&player, &Boost {
    id: 999,
    boost_type: BoostType::Override,
    value: 50000, // 5x
    priority: 100,
});

// Result: 50000 (VIP overrides everything)
let total = client.calculate_total_boost(&player);
```

## Example 4: Combined Strategy

```rust
// Realistic game scenario:
// - Base property multiplier: 1.5x
// - Property upgrades: 1.2x
// - Event bonus: +20%
// - Daily login: +5%

client.add_boost(&player, &Boost {
    id: 1,
    boost_type: BoostType::Multiplicative,
    value: 15000,
    priority: 0,
});

client.add_boost(&player, &Boost {
    id: 2,
    boost_type: BoostType::Multiplicative,
    value: 12000,
    priority: 0,
});

client.add_boost(&player, &Boost {
    id: 3,
    boost_type: BoostType::Additive,
    value: 2000,
    priority: 0,
});

client.add_boost(&player, &Boost {
    id: 4,
    boost_type: BoostType::Additive,
    value: 500,
    priority: 0,
});

// Result: 10000 * 1.5 * 1.2 * 1.25 = 22500 (125% total boost)
let total = client.calculate_total_boost(&player);
```

## Conflict Resolution Rules

### Priority System
1. **Override Type**: Highest priority value wins
2. **Same Priority**: First added wins (deterministic)
3. **No Override**: Multiplicative and Additive stack

### Calculation Order
```
IF any Override boost exists:
    RETURN highest_priority_override.value
ELSE:
    multiplicative_result = base * mult₁ * mult₂ * ... * multₙ
    additive_sum = add₁ + add₂ + ... + addₙ
    RETURN multiplicative_result * (1 + additive_sum)
```

## Testing Scenarios Covered

✓ Additive stacking (test_additive_stacking)
✓ Multiplicative stacking (test_multiplicative_stacking)
✓ Override with priority (test_override_highest_priority)
✓ Mixed boost types (test_mixed_stacking)
✓ Override ignores others (test_override_ignores_others)
✓ No boosts baseline (test_no_boosts)
✓ Clear boosts (test_clear_boosts)
✓ Deterministic outcomes (test_deterministic_outcome)
✓ Get boosts query (test_get_boosts)
