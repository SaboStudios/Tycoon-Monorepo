# Quick Start Guide - Boost System

## Installation

The boost system is located at:
```
contract/contracts/tycoon-boost-system/
```

## Building

```bash
cd contract/contracts/tycoon-boost-system
make build
```

## Testing

```bash
make test
```

Expected output:
```
running 9 tests
test test_additive_stacking ... ok
test test_multiplicative_stacking ... ok
test test_override_highest_priority ... ok
test test_mixed_stacking ... ok
test test_override_ignores_others ... ok
test test_no_boosts ... ok
test test_clear_boosts ... ok
test test_deterministic_outcome ... ok
test test_get_boosts ... ok

test result: ok. 9 passed; 0 failed
```

## Basic Usage

### 1. Add a Boost
```rust
use tycoon_boost_system::{Boost, BoostType};

// Add a multiplicative boost (property upgrade)
client.add_boost(&player, &Boost {
    id: 1,
    boost_type: BoostType::Multiplicative,
    value: 15000, // 1.5x
    priority: 0,
});
```

### 2. Calculate Total
```rust
let total_boost = client.calculate_total_boost(&player);
// Returns basis points (10000 = 100%)
```

### 3. Apply to Rewards
```rust
let base_reward = 1000;
let boosted_reward = (base_reward * total_boost) / 10000;
```

## Boost Types Quick Reference

| Type | Stacking | Example | Use Case |
|------|----------|---------|----------|
| Additive | Sum | +10% + +5% = +15% | Events, bonuses |
| Multiplicative | Multiply | 1.5x * 1.2x = 1.8x | Upgrades, perks |
| Override | Priority | P10 wins over P5 | VIP, special status |

## Common Patterns

### Property Upgrades
```rust
// Each property adds multiplicative boost
for property in player_properties {
    client.add_boost(&player, &Boost {
        id: property.id,
        boost_type: BoostType::Multiplicative,
        value: property.boost_value,
        priority: 0,
    });
}
```

### Temporary Events
```rust
// Event bonuses stack additively
client.add_boost(&player, &Boost {
    id: event_id,
    boost_type: BoostType::Additive,
    value: event_bonus,
    priority: 0,
});
```

### VIP Status
```rust
// VIP overrides all other boosts
client.add_boost(&player, &Boost {
    id: vip_id,
    boost_type: BoostType::Override,
    value: vip_multiplier,
    priority: vip_tier, // Higher tier = higher priority
});
```

## Verification

Run the verification script:
```bash
./verify.sh
```

This checks:
- ✓ File structure
- ✓ Contract syntax
- ✓ Test presence
- ✓ Test count

## Integration with Existing Contracts

### With Reward System
```rust
// Calculate boosted rewards
let base_reward = reward_system.calculate_base_reward(&player);
let boost_multiplier = boost_system.calculate_total_boost(&player);
let final_reward = (base_reward * boost_multiplier) / 10000;
```

### With Collectibles
```rust
// Collectibles can provide boosts
if collectible.has_boost() {
    boost_system.add_boost(&player, &Boost {
        id: collectible.id,
        boost_type: BoostType::Multiplicative,
        value: collectible.boost_value,
        priority: 0,
    });
}
```

## Troubleshooting

### Build Issues
- Ensure Stellar CLI is installed: `stellar --version`
- Ensure Rust is installed: `cargo --version`
- Run `cargo clean` and rebuild

### Test Failures
- Check test output for specific failures
- Verify basis point calculations (10000 = 100%)
- Ensure deterministic test data

## Documentation

- `README.md` - Overview and rules
- `EXAMPLES.md` - Integration examples
- `IMPLEMENTATION.md` - Complete implementation details
- `src/lib.rs` - Inline code documentation

## Support

For issues or questions:
1. Check EXAMPLES.md for usage patterns
2. Review test cases in src/test.rs
3. See IMPLEMENTATION.md for detailed specs
