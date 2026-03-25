#![cfg(test)]
extern crate std;
use super::*;
use soroban_sdk::{testutils::Address as _, Env};

#[test]
fn test_additive_stacking() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(TycoonBoostSystem, ());
    let client = TycoonBoostSystemClient::new(&env, &contract_id);

    let player = Address::generate(&env);

    // Add two additive boosts: +10% and +5%
    client.add_boost(
        &player,
        &Boost {
            id: 1,
            boost_type: BoostType::Additive,
            value: 1000, // +10%
            priority: 0,
        },
    );

    client.add_boost(
        &player,
        &Boost {
            id: 2,
            boost_type: BoostType::Additive,
            value: 500, // +5%
            priority: 0,
        },
    );

    // Expected: 10000 * (1 + 0.15) = 11500
    let total = client.calculate_total_boost(&player);
    assert_eq!(total, 11500);
}

#[test]
fn test_multiplicative_stacking() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(TycoonBoostSystem, ());
    let client = TycoonBoostSystemClient::new(&env, &contract_id);

    let player = Address::generate(&env);

    // Add two multiplicative boosts: 1.5x and 1.2x
    client.add_boost(
        &player,
        &Boost {
            id: 1,
            boost_type: BoostType::Multiplicative,
            value: 15000, // 1.5x
            priority: 0,
        },
    );

    client.add_boost(
        &player,
        &Boost {
            id: 2,
            boost_type: BoostType::Multiplicative,
            value: 12000, // 1.2x
            priority: 0,
        },
    );

    // Expected: 10000 * 1.5 * 1.2 = 18000
    let total = client.calculate_total_boost(&player);
    assert_eq!(total, 18000);
}

#[test]
fn test_override_highest_priority() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(TycoonBoostSystem, ());
    let client = TycoonBoostSystemClient::new(&env, &contract_id);

    let player = Address::generate(&env);

    // Add override boosts with different priorities
    client.add_boost(
        &player,
        &Boost {
            id: 1,
            boost_type: BoostType::Override,
            value: 20000, // 2x
            priority: 5,
        },
    );

    client.add_boost(
        &player,
        &Boost {
            id: 2,
            boost_type: BoostType::Override,
            value: 30000, // 3x
            priority: 10, // Higher priority
        },
    );

    // Expected: 30000 (highest priority override)
    let total = client.calculate_total_boost(&player);
    assert_eq!(total, 30000);
}

#[test]
fn test_mixed_stacking() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(TycoonBoostSystem, ());
    let client = TycoonBoostSystemClient::new(&env, &contract_id);

    let player = Address::generate(&env);

    // Multiplicative: 1.5x
    client.add_boost(
        &player,
        &Boost {
            id: 1,
            boost_type: BoostType::Multiplicative,
            value: 15000,
            priority: 0,
        },
    );

    // Additive: +10%
    client.add_boost(
        &player,
        &Boost {
            id: 2,
            boost_type: BoostType::Additive,
            value: 1000,
            priority: 0,
        },
    );

    // Expected: 10000 * 1.5 * 1.1 = 16500
    let total = client.calculate_total_boost(&player);
    assert_eq!(total, 16500);
}

#[test]
fn test_override_ignores_others() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(TycoonBoostSystem, ());
    let client = TycoonBoostSystemClient::new(&env, &contract_id);

    let player = Address::generate(&env);

    // Add various boosts
    client.add_boost(
        &player,
        &Boost {
            id: 1,
            boost_type: BoostType::Multiplicative,
            value: 20000, // 2x
            priority: 0,
        },
    );

    client.add_boost(
        &player,
        &Boost {
            id: 2,
            boost_type: BoostType::Additive,
            value: 5000, // +50%
            priority: 0,
        },
    );

    client.add_boost(
        &player,
        &Boost {
            id: 3,
            boost_type: BoostType::Override,
            value: 25000, // 2.5x
            priority: 100,
        },
    );

    // Expected: 25000 (override ignores all others)
    let total = client.calculate_total_boost(&player);
    assert_eq!(total, 25000);
}

#[test]
fn test_no_boosts() {
    let env = Env::default();
    let contract_id = env.register(TycoonBoostSystem, ());
    let client = TycoonBoostSystemClient::new(&env, &contract_id);

    let player = Address::generate(&env);

    // Expected: 10000 (base 100%)
    let total = client.calculate_total_boost(&player);
    assert_eq!(total, 10000);
}

#[test]
fn test_clear_boosts() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(TycoonBoostSystem, ());
    let client = TycoonBoostSystemClient::new(&env, &contract_id);

    let player = Address::generate(&env);

    client.add_boost(
        &player,
        &Boost {
            id: 1,
            boost_type: BoostType::Additive,
            value: 1000,
            priority: 0,
        },
    );

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

    // Add same boosts multiple times
    for _ in 0..3 {
        client.add_boost(
            &player,
            &Boost {
                id: 1,
                boost_type: BoostType::Multiplicative,
                value: 12000,
                priority: 0,
            },
        );
    }

    let result1 = client.calculate_total_boost(&player);
    let result2 = client.calculate_total_boost(&player);

    // Should be deterministic
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

    let boost1 = Boost {
        id: 1,
        boost_type: BoostType::Additive,
        value: 1000,
        priority: 0,
    };

    client.add_boost(&player, &boost1);

    let boosts = client.get_boosts(&player);
    assert_eq!(boosts.len(), 1);
    assert_eq!(boosts.get(0).unwrap(), boost1);
}
