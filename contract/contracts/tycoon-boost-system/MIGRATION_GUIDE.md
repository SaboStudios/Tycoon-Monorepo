# Migration Guide - Deprecated Functions

**Version**: 0.2.0 → 1.0.0  
**Issue**: SW-CONTRACT-BOOST-002  
**Date**: April 22, 2026  

## Overview

This guide helps you migrate from deprecated functions to their recommended replacements. All deprecated functions will be removed in v1.0.0 (Q4 2026).

## Quick Reference

| Deprecated Function | Replacement | Effort |
|---------------------|-------------|--------|
| `get_boosts` | `get_active_boosts` | Low |
| `prune_expired_boosts` | Automatic (remove calls) | Low |

## Migration 1: `get_boosts` → `get_active_boosts`

### Why Deprecated?

`get_boosts` returns ALL boosts including expired ones, which:
- Wastes gas reading stale data
- Confuses clients (expired boosts have no effect)
- Requires manual filtering by clients

### Before (Deprecated)

```rust
// ❌ OLD WAY - Returns all boosts, including expired
let all_boosts = client.get_boosts(&player);

// Client must manually filter expired boosts
let current_ledger = env.ledger().sequence();
let mut active_boosts = Vec::new(&env);
for i in 0..all_boosts.len() {
    let boost = all_boosts.get(i).unwrap();
    if boost.expires_at_ledger == 0 || boost.expires_at_ledger > current_ledger {
        active_boosts.push_back(boost);
    }
}

// Now use active_boosts for calculations
```

### After (Recommended)

```rust
// ✅ NEW WAY - Returns only active boosts
let active_boosts = client.get_active_boosts(&player);

// Ready to use - no filtering needed!
```

### Benefits

✅ **Less gas** - Only reads active boosts  
✅ **Simpler code** - No manual filtering  
✅ **Clearer intent** - Name reflects behavior  
✅ **Fewer bugs** - Can't accidentally use expired boosts  

### Migration Steps

1. Find all calls to `get_boosts`:
   ```bash
   grep -r "get_boosts" your-project/
   ```

2. Replace with `get_active_boosts`:
   ```rust
   - let boosts = client.get_boosts(&player);
   + let boosts = client.get_active_boosts(&player);
   ```

3. Remove any manual expiry filtering code

4. Test thoroughly

### Edge Cases

#### Empty Player
```rust
// Both return empty Vec - no change needed
let boosts = client.get_active_boosts(&player); // ✅
```

#### All Boosts Expired
```rust
// get_active_boosts returns empty Vec
let boosts = client.get_active_boosts(&player);
assert_eq!(boosts.len(), 0); // ✅
```

#### Mix of Active and Expired
```rust
// get_active_boosts returns only active ones
let boosts = client.get_active_boosts(&player);
// All returned boosts are guaranteed active
```

## Migration 2: `prune_expired_boosts` → Automatic

### Why Deprecated?

Manual pruning is unnecessary because:
- `add_boost` automatically prunes expired boosts before adding new ones
- `calculate_total_boost` ignores expired boosts without mutating storage
- Adds unnecessary gas cost and complexity

### Before (Deprecated)

```rust
// ❌ OLD WAY - Manual pruning
client.prune_expired_boosts(&player);
let total = client.calculate_total_boost(&player);
```

### After (Recommended)

```rust
// ✅ NEW WAY - Just calculate, automatic pruning
let total = client.calculate_total_boost(&player);
```

### Benefits

✅ **Less gas** - No unnecessary pruning calls  
✅ **Simpler code** - One line instead of two  
✅ **Automatic** - Pruning happens when needed  
✅ **Safer** - Can't forget to prune  

### Migration Steps

1. Find all calls to `prune_expired_boosts`:
   ```bash
   grep -r "prune_expired_boosts" your-project/
   ```

2. Remove the calls:
   ```rust
   - client.prune_expired_boosts(&player);
     let total = client.calculate_total_boost(&player);
   ```

3. Test that calculations still work correctly

### When Pruning Happens Automatically

| Operation | Auto-Prunes? | Notes |
|-----------|--------------|-------|
| `add_boost` | ✅ Yes | Before checking cap/duplicate |
| `calculate_total_boost` | ❌ No | Ignores expired, doesn't mutate |
| `get_active_boosts` | ❌ No | Filters expired, doesn't mutate |
| `clear_boosts` | N/A | Removes all boosts |

### Storage Cleanup

If you want to clean up storage (remove expired boosts from storage):
- Just call `add_boost` with a new boost - it will auto-prune
- Or call `clear_boosts` to remove all boosts

```rust
// Storage cleanup happens automatically on next add_boost
client.add_boost(&player, &new_boost); // Auto-prunes expired first
```

## Testing Your Migration

### Unit Tests

```rust
#[test]
fn test_migration_get_active_boosts() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(TycoonBoostSystem, ());
    let client = TycoonBoostSystemClient::new(&env, &contract_id);
    let player = Address::generate(&env);

    // Add mix of active and expired boosts
    env.ledger().with_mut(|li| li.sequence_number = 100);
    client.add_boost(&player, &Boost {
        id: 1,
        boost_type: BoostType::Additive,
        value: 1000,
        priority: 0,
        expires_at_ledger: 0, // Never expires
    });
    client.add_boost(&player, &Boost {
        id: 2,
        boost_type: BoostType::Additive,
        value: 500,
        priority: 0,
        expires_at_ledger: 150, // Expires at 150
    });

    env.ledger().with_mut(|li| li.sequence_number = 200);

    // ✅ NEW WAY - Only active boosts
    let active = client.get_active_boosts(&player);
    assert_eq!(active.len(), 1);
    assert_eq!(active.get(0).unwrap().id, 1);
}

#[test]
fn test_migration_automatic_pruning() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(TycoonBoostSystem, ());
    let client = TycoonBoostSystemClient::new(&env, &contract_id);
    let player = Address::generate(&env);

    env.ledger().with_mut(|li| li.sequence_number = 100);
    client.add_boost(&player, &Boost {
        id: 1,
        boost_type: BoostType::Additive,
        value: 1000,
        priority: 0,
        expires_at_ledger: 0,
    });

    env.ledger().with_mut(|li| li.sequence_number = 200);

    // ✅ NEW WAY - No manual pruning needed
    let total = client.calculate_total_boost(&player);
    assert_eq!(total, 11000); // 10000 + 1000
}
```

### Integration Tests

```rust
#[test]
fn test_migration_in_game_flow() {
    // Setup game environment
    let env = Env::default();
    env.mock_all_auths();
    let boost_contract = env.register(TycoonBoostSystem, ());
    let boost_client = TycoonBoostSystemClient::new(&env, &boost_contract);
    let player = Address::generate(&env);

    // Player gets a temporary boost
    boost_client.add_boost(&player, &Boost {
        id: 1,
        boost_type: BoostType::Multiplicative,
        value: 15000, // 1.5x
        priority: 0,
        expires_at_ledger: env.ledger().sequence() + 100,
    });

    // Calculate rewards with boost
    let base_reward = 1000;
    let boost_multiplier = boost_client.calculate_total_boost(&player);
    let boosted_reward = (base_reward as u64 * boost_multiplier as u64 / 10000) as u32;
    assert_eq!(boosted_reward, 1500); // 1000 * 1.5

    // Time passes, boost expires
    env.ledger().with_mut(|li| li.sequence_number += 101);

    // ✅ NEW WAY - Just calculate, expired boost ignored automatically
    let boost_multiplier = boost_client.calculate_total_boost(&player);
    let normal_reward = (base_reward as u64 * boost_multiplier as u64 / 10000) as u32;
    assert_eq!(normal_reward, 1000); // Back to base
}
```

## Deprecation Timeline

| Date | Phase | Action |
|------|-------|--------|
| **April 22, 2026** | Deprecation | Functions marked deprecated, events added |
| **May 2026** | Notification | Email to known integrators |
| **June-Aug 2026** | Grace Period | Monitor usage, support migrations |
| **Sept 2026** | Final Warning | Last call for migrations |
| **Q4 2026** | Removal | Functions removed in v1.0.0 |

## Monitoring Your Migration

### Check for Deprecation Events

```rust
// In your tests or monitoring
let events = env.events().all();
let deprecation_events: Vec<_> = events
    .iter()
    .filter(|e| {
        // Check if it's a DeprecatedFunctionCalledEvent
        matches!(e.1, DeprecatedFunctionCalledEvent { .. })
    })
    .collect();

if !deprecation_events.is_empty() {
    println!("⚠️ Warning: {} deprecated function calls detected", 
             deprecation_events.len());
}
```

### Testnet Monitoring

Deploy to testnet and monitor for deprecation events:
```bash
# Check contract events
stellar contract events --id <contract-id> --network testnet

# Look for DeprecatedFunctionCalledEvent
```

## Common Pitfalls

### ❌ Pitfall 1: Forgetting to Update Tests

```rust
// ❌ BAD - Test still uses deprecated function
#[test]
fn test_boosts() {
    let boosts = client.get_boosts(&player); // Deprecated!
    assert_eq!(boosts.len(), 2);
}

// ✅ GOOD - Test uses recommended function
#[test]
fn test_boosts() {
    let boosts = client.get_active_boosts(&player);
    assert_eq!(boosts.len(), 2);
}
```

### ❌ Pitfall 2: Unnecessary Manual Filtering

```rust
// ❌ BAD - Manual filtering after get_active_boosts
let active = client.get_active_boosts(&player);
let filtered = active.iter().filter(|b| b.expires_at_ledger > current_ledger);

// ✅ GOOD - get_active_boosts already filters
let active = client.get_active_boosts(&player);
// Use directly - already filtered!
```

### ❌ Pitfall 3: Calling prune_expired_boosts "Just in Case"

```rust
// ❌ BAD - Unnecessary pruning
client.prune_expired_boosts(&player); // Wastes gas!
let total = client.calculate_total_boost(&player);

// ✅ GOOD - Trust automatic pruning
let total = client.calculate_total_boost(&player);
```

## Need Help?

### Resources
- [Contract README](./README.md) - Full API documentation
- [DEPRECATION_PLAN.md](./DEPRECATION_PLAN.md) - Detailed deprecation strategy
- [Test Examples](./src/deprecation_tests.rs) - Migration test patterns

### Support
- GitHub Issues: Tag with `migration-help`
- Discord: #contract-support channel
- Email: dev-support@tycoon.game

### FAQ

**Q: Do I need to migrate immediately?**  
A: No, deprecated functions will work until v1.0.0 (Q4 2026). However, migrating early is recommended.

**Q: Will my contract break if I don't migrate?**  
A: Not until v1.0.0. But you'll see deprecation warnings and events.

**Q: Can I still use deprecated functions in tests?**  
A: Yes, but add `#[allow(deprecated)]` to suppress warnings.

**Q: What if I need all boosts including expired ones?**  
A: This is rarely needed. If you have a specific use case, please contact us.

**Q: How do I know if my migration is complete?**  
A: Run your tests and check for deprecation events. Zero events = complete migration.

## Checklist

Use this checklist to track your migration:

- [ ] Search codebase for `get_boosts` calls
- [ ] Replace all `get_boosts` with `get_active_boosts`
- [ ] Remove manual expiry filtering code
- [ ] Search codebase for `prune_expired_boosts` calls
- [ ] Remove all `prune_expired_boosts` calls
- [ ] Update unit tests
- [ ] Update integration tests
- [ ] Run full test suite
- [ ] Deploy to testnet
- [ ] Monitor for deprecation events
- [ ] Verify zero deprecation events
- [ ] Update documentation
- [ ] Deploy to mainnet

---

**Last Updated**: April 22, 2026  
**Version**: 0.2.0  
**Status**: Active Migration Period
