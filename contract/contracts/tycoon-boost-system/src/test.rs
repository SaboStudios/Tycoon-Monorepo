#![cfg(test)]
extern crate std;
use super::*;
use soroban_sdk::{testutils::Address as _, Env};

// Helper: build a non-expiring boost
fn boost(id: u128, boost_type: BoostType, value: u32, priority: u32) -> Boost {
    Boost { id, boost_type, value, priority, expires_at_ledger: 0 }
}

#[test]
fn test_additive_stacking() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(TycoonBoostSystem, ());
    let client = TycoonBoostSystemClient::new(&env, &contract_id);

    let player = Address::generate(&env);

    client.add_boost(&player, &boost(1, BoostType::Additive, 1000, 0)); // +10%
    client.add_boost(&player, &boost(2, BoostType::Additive, 500, 0));  // +5%

    // Expected: 10000 * (1 + 0.15) = 11500
    assert_eq!(client.calculate_total_boost(&player), 11500);
}

#[test]
fn test_multiplicative_stacking() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(TycoonBoostSystem, ());
    let client = TycoonBoostSystemClient::new(&env, &contract_id);

    let player = Address::generate(&env);

    client.add_boost(&player, &boost(1, BoostType::Multiplicative, 15000, 0)); // 1.5x
    client.add_boost(&player, &boost(2, BoostType::Multiplicative, 12000, 0)); // 1.2x

    // Expected: 10000 * 1.5 * 1.2 = 18000
    assert_eq!(client.calculate_total_boost(&player), 18000);
}

#[test]
fn test_override_highest_priority() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(TycoonBoostSystem, ());
    let client = TycoonBoostSystemClient::new(&env, &contract_id);

    let player = Address::generate(&env);

    client.add_boost(&player, &boost(1, BoostType::Override, 20000, 5));  // 2x, priority 5
    client.add_boost(&player, &boost(2, BoostType::Override, 30000, 10)); // 3x, priority 10

    // Expected: 30000 (highest priority override)
    assert_eq!(client.calculate_total_boost(&player), 30000);
}

#[test]
fn test_mixed_stacking() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(TycoonBoostSystem, ());
    let client = TycoonBoostSystemClient::new(&env, &contract_id);

    let player = Address::generate(&env);

    client.add_boost(&player, &boost(1, BoostType::Multiplicative, 15000, 0)); // 1.5x
    client.add_boost(&player, &boost(2, BoostType::Additive, 1000, 0));        // +10%

    // Expected: 10000 * 1.5 * 1.1 = 16500
    assert_eq!(client.calculate_total_boost(&player), 16500);
}

#[test]
fn test_override_ignores_others() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(TycoonBoostSystem, ());
    let client = TycoonBoostSystemClient::new(&env, &contract_id);

    let player = Address::generate(&env);

    client.add_boost(&player, &boost(1, BoostType::Multiplicative, 20000, 0)); // 2x
    client.add_boost(&player, &boost(2, BoostType::Additive, 5000, 0));        // +50%
    client.add_boost(&player, &boost(3, BoostType::Override, 25000, 100));     // 2.5x override

    // Expected: 25000 (override ignores all others)
    assert_eq!(client.calculate_total_boost(&player), 25000);
}

#[test]
fn test_no_boosts() {
    let env = Env::default();
    let contract_id = env.register(TycoonBoostSystem, ());
    let client = TycoonBoostSystemClient::new(&env, &contract_id);

    let player = Address::generate(&env);

    // Expected: 10000 (base 100%)
    assert_eq!(client.calculate_total_boost(&player), 10000);
}

#[test]
fn test_clear_boosts() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(TycoonBoostSystem, ());
    let client = TycoonBoostSystemClient::new(&env, &contract_id);

    let player = Address::generate(&env);

    client.add_boost(&player, &boost(1, BoostType::Additive, 1000, 0));
    assert_eq!(client.calculate_total_boost(&player), 11000);

    client.clear_boosts(&player);
    assert_eq!(client.calculate_total_boost(&player), 10000);
}

#[test]
fn test_deterministic_outcome() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(TycoonBoostSystem, ());
    let client = TycoonBoostSystemClient::new(&env, &contract_id);

    let player = Address::generate(&env);

    for i in 0..3u128 {
        client.add_boost(&player, &boost(i + 1, BoostType::Multiplicative, 12000, 0));
    }

    let result1 = client.calculate_total_boost(&player);
    let result2 = client.calculate_total_boost(&player);

    assert_eq!(result1, result2);
    // 10000 * 1.2 * 1.2 * 1.2 = 17280
    assert_eq!(result1, 17280);
}

#[test]
fn test_get_boosts() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(TycoonBoostSystem, ());
    let client = TycoonBoostSystemClient::new(&env, &contract_id);

    let player = Address::generate(&env);
    let b = boost(1, BoostType::Additive, 1000, 0);
    client.add_boost(&player, &b);

    let boosts = client.get_boosts(&player);
    assert_eq!(boosts.len(), 1);
    assert_eq!(boosts.get(0).unwrap(), b);
}
