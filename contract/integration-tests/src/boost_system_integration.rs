#![cfg(test)]
//! # Boost System Cross-Contract Integration Tests
//!
//! Integration tests for the tycoon-boost-system contract interacting with other
//! contracts in the Tycoon ecosystem (game, token, reward system).
//!
//! Part of Stellar Wave engineering batch - SW-CONTRACT-BOOST-001

extern crate std;

use crate::fixture::{TestFixture, TestFixtureConfig};
use soroban_sdk::{
    testutils::{Address as _, Ledger, LedgerInfo},
    Address, Env,
};

// Re-export boost types for convenience
use tycoon_boost_system::{Boost, BoostType, TycoonBoostSystemClient};

// ── Test Helpers ──────────────────────────────────────────────────────────────

fn set_ledger(env: &Env, seq: u32) {
    env.ledger().set(LedgerInfo {
        sequence_number: seq,
        timestamp: seq as u64 * 5,
        protocol_version: 23,
        network_id: Default::default(),
        base_reserve: 10,
        min_temp_entry_ttl: 1,
        min_persistent_entry_ttl: 1,
        max_entry_ttl: 100_000,
    });
}

fn boost(id: u128, boost_type: BoostType, value: u32, priority: u32, expires: u32) -> Boost {
    Boost { id, boost_type, value, priority, expires_at_ledger: expires }
}

fn nb(id: u128, boost_type: BoostType, value: u32, priority: u32) -> Boost {
    boost(id, boost_type, value, priority, 0)
}

fn eb(id: u128, boost_type: BoostType, value: u32, priority: u32, expires: u32) -> Boost {
    boost(id, boost_type, value, priority, expires)
}

// ── Basic Integration Tests ───────────────────────────────────────────────────

/// Test that boost system can be deployed and initialized alongside other contracts
#[test]
fn test_boost_system_deployment_with_ecosystem() {
    let env = Env::default();
    env.mock_all_auths();

    let config = TestFixtureConfig::default();
    let fixture = TestFixture::new_with_config(&env, config);

    // Verify boost system is deployed
    let boost_client = TycoonBoostSystemClient::new(&env, &fixture.boost_system_id);

    // Create a test player
    let player = Address::generate(&env);

    // Add a boost
    boost_client.add_boost(&player, &nb(1, BoostType::Additive, 1000, 0));

    // Verify boost was added
    assert_eq!(boost_client.calculate_total_boost(&player), 11000);
}

/// Test boost system with multiple players in the ecosystem
#[test]
fn test_boost_system_multi_player_ecosystem() {
    let env = Env::default();
    env.mock_all_auths();

    let config = TestFixtureConfig::default();
    let fixture = TestFixture::new_with_config(&env, config);

    let boost_client = TycoonBoostSystemClient::new(&env, &fixture.boost_system_id);

    // Create multiple players
    let player1 = Address::generate(&env);
    let player2 = Address::generate(&env);
    let player3 = Address::generate(&env);

    // Each player gets different boosts
    boost_client.add_boost(&player1, &nb(1, BoostType::Additive, 1000, 0));
    boost_client.add_boost(&player2, &nb(1, BoostType::Multiplicative, 15000, 0));
    boost_client.add_boost(&player3, &nb(1, BoostType::Override, 25000, 10));

    // Verify independent state
    assert_eq!(boost_client.calculate_total_boost(&player1), 11000);
    assert_eq!(boost_client.calculate_total_boost(&player2), 15000);
    assert_eq!(boost_client.calculate_total_boost(&player3), 25000);
}

// ── Game Integration Scenarios ────────────────────────────────────────────────

/// Test boost application during game property acquisition
#[test]
fn test_boost_with_property_acquisition() {
    let env = Env::default();
    env.mock_all_auths();
    set_ledger(&env, 100);

    let config = TestFixtureConfig::default();
    let fixture = TestFixture::new_with_config(&env, config);

    let boost_client = TycoonBoostSystemClient::new(&env, &fixture.boost_system_id);
    let player = Address::generate(&env);

    // Simulate player acquiring properties and getting boosts
    // Property 1: +20% boost
    boost_client.add_boost(&player, &nb(1, BoostType::Multiplicative, 12000, 0));

    // Property 2: +30% boost
    boost_client.add_boost(&player, &nb(2, BoostType::Multiplicative, 13000, 0));

    // Verify combined boost effect
    // 10000 * 1.2 * 1.3 = 15600
    assert_eq!(boost_client.calculate_total_boost(&player), 15600);
}

/// Test boost expiry during game progression
#[test]
fn test_boost_expiry_during_game_progression() {
    let env = Env::default();
    env.mock_all_auths();
    set_ledger(&env, 100);

    let config = TestFixtureConfig::default();
    let fixture = TestFixture::new_with_config(&env, config);

    let boost_client = TycoonBoostSystemClient::new(&env, &fixture.boost_system_id);
    let player = Address::generate(&env);

    // Permanent property boost
    boost_client.add_boost(&player, &nb(1, BoostType::Multiplicative, 15000, 0));

    // Temporary event boost (expires at ledger 200)
    boost_client.add_boost(&player, &eb(2, BoostType::Additive, 2000, 0, 200));

    // At ledger 150: both active
    set_ledger(&env, 150);
    // 10000 * 1.5 * (1 + 0.20) = 18000
    assert_eq!(boost_client.calculate_total_boost(&player), 18000);

    // At ledger 200: event boost expired
    set_ledger(&env, 200);
    // 10000 * 1.5 = 15000
    assert_eq!(boost_client.calculate_total_boost(&player), 15000);
}

/// Test boost system with game events (chance, community chest)
#[test]
fn test_boost_with_game_events() {
    let env = Env::default();
    env.mock_all_auths();
    set_ledger(&env, 100);

    let config = TestFixtureConfig::default();
    let fixture = TestFixture::new_with_config(&env, config);

    let boost_client = TycoonBoostSystemClient::new(&env, &fixture.boost_system_id);
    let player = Address::generate(&env);

    // Base property boost
    boost_client.add_boost(&player, &nb(1, BoostType::Multiplicative, 12000, 0));

    // Chance card: temporary +15% boost (expires in 50 ledgers)
    boost_client.add_boost(&player, &eb(2, BoostType::Additive, 1500, 0, 150));

    // Community chest: temporary +10% boost (expires in 100 ledgers)
    boost_client.add_boost(&player, &eb(3, BoostType::Additive, 1000, 0, 200));

    // Combined effect: 10000 * 1.2 * (1 + 0.25) = 15000
    assert_eq!(boost_client.calculate_total_boost(&player), 15000);

    // After first boost expires
    set_ledger(&env, 151);
    // 10000 * 1.2 * (1 + 0.10) = 13200
    assert_eq!(boost_client.calculate_total_boost(&player), 13200);
}

// ── Token/Reward Integration Scenarios ────────────────────────────────────────

/// Test boost affecting reward calculations
#[test]
fn test_boost_affecting_rewards() {
    let env = Env::default();
    env.mock_all_auths();

    let config = TestFixtureConfig::default();
    let fixture = TestFixture::new_with_config(&env, config);

    let boost_client = TycoonBoostSystemClient::new(&env, &fixture.boost_system_id);
    let player = Address::generate(&env);

    // Player has a 50% boost
    boost_client.add_boost(&player, &nb(1, BoostType::Additive, 5000, 0));

    // Calculate boosted reward
    let base_reward = 10000u32;
    let boost_multiplier = boost_client.calculate_total_boost(&player);
    let boosted_reward = (base_reward as u64 * boost_multiplier as u64 / 10000) as u32;

    // 10000 * 1.5 = 15000
    assert_eq!(boosted_reward, 15000);
}

/// Test VIP status override affecting all rewards
#[test]
fn test_vip_override_boost_for_rewards() {
    let env = Env::default();
    env.mock_all_auths();

    let config = TestFixtureConfig::default();
    let fixture = TestFixture::new_with_config(&env, config);

    let boost_client = TycoonBoostSystemClient::new(&env, &fixture.boost_system_id);
    let player = Address::generate(&env);

    // Player has various property boosts
    boost_client.add_boost(&player, &nb(1, BoostType::Multiplicative, 15000, 0));
    boost_client.add_boost(&player, &nb(2, BoostType::Additive, 2000, 0));

    // VIP Diamond status: 5x override
    boost_client.add_boost(&player, &nb(3, BoostType::Override, 50000, 100));

    // VIP override should apply
    assert_eq!(boost_client.calculate_total_boost(&player), 50000);

    // Calculate reward with VIP boost
    let base_reward = 10000u32;
    let boost_multiplier = boost_client.calculate_total_boost(&player);
    let boosted_reward = (base_reward as u64 * boost_multiplier as u64 / 10000) as u32;

    // 10000 * 5 = 50000
    assert_eq!(boosted_reward, 50000);
}

/// Test boost system with token minting scenarios
#[test]
fn test_boost_with_token_operations() {
    let env = Env::default();
    env.mock_all_auths();

    let config = TestFixtureConfig::default();
    let fixture = TestFixture::new_with_config(&env, config);

    let boost_client = TycoonBoostSystemClient::new(&env, &fixture.boost_system_id);
    let player = Address::generate(&env);

    // Player earns tokens with boost
    boost_client.add_boost(&player, &nb(1, BoostType::Multiplicative, 20000, 0));

    // Base token earn: 1000 tokens
    let base_tokens = 1000i128;
    let boost_multiplier = boost_client.calculate_total_boost(&player);
    let boosted_tokens = base_tokens * boost_multiplier as i128 / 10000;

    // 1000 * 2 = 2000 tokens
    assert_eq!(boosted_tokens, 2000);
}

// ── Stress and Performance Tests ──────────────────────────────────────────────

/// Test boost system performance with many players
#[test]
fn test_boost_system_many_players_performance() {
    let env = Env::default();
    env.mock_all_auths();

    let config = TestFixtureConfig::default();
    let fixture = TestFixture::new_with_config(&env, config);

    let boost_client = TycoonBoostSystemClient::new(&env, &fixture.boost_system_id);

    // Create 20 players
    let players: std::vec::Vec<Address> = (0..20).map(|_| Address::generate(&env)).collect();

    // Each player gets 5 boosts
    for player in &players {
        for i in 0..5u128 {
            boost_client.add_boost(
                player,
                &nb(i + 1, BoostType::Additive, 500, 0),
            );
        }
    }

    // Verify all players have correct boosts
    for player in &players {
        assert_eq!(boost_client.get_boosts(player).len(), 5);
        // 10000 + (5 * 500) = 12500
        assert_eq!(boost_client.calculate_total_boost(player), 12500);
    }
}

/// Test boost system with rapid state changes
#[test]
fn test_boost_system_rapid_state_changes() {
    let env = Env::default();
    env.mock_all_auths();
    set_ledger(&env, 100);

    let config = TestFixtureConfig::default();
    let fixture = TestFixture::new_with_config(&env, config);

    let boost_client = TycoonBoostSystemClient::new(&env, &fixture.boost_system_id);
    let player = Address::generate(&env);

    // Rapid add/clear cycles
    for cycle in 0..5 {
        // Add boosts
        for i in 0..5u128 {
            let id = (cycle * 10) + i + 1;
            boost_client.add_boost(&player, &nb(id, BoostType::Additive, 1000, 0));
        }

        // Verify
        assert_eq!(boost_client.get_boosts(&player).len(), 5);

        // Clear
        boost_client.clear_boosts(&player);
        assert_eq!(boost_client.get_boosts(&player).len(), 0);
    }
}

/// Test boost system with mixed expiry patterns across players
#[test]
fn test_boost_system_mixed_expiry_patterns() {
    let env = Env::default();
    env.mock_all_auths();
    set_ledger(&env, 100);

    let config = TestFixtureConfig::default();
    let fixture = TestFixture::new_with_config(&env, config);

    let boost_client = TycoonBoostSystemClient::new(&env, &fixture.boost_system_id);

    let player1 = Address::generate(&env);
    let player2 = Address::generate(&env);
    let player3 = Address::generate(&env);

    // Player 1: All permanent boosts
    for i in 0..3u128 {
        boost_client.add_boost(&player1, &nb(i + 1, BoostType::Additive, 1000, 0));
    }

    // Player 2: All expiring boosts
    for i in 0..3u128 {
        boost_client.add_boost(&player2, &eb(i + 1, BoostType::Additive, 1000, 0, 200));
    }

    // Player 3: Mix of permanent and expiring
    boost_client.add_boost(&player3, &nb(1, BoostType::Additive, 1000, 0));
    boost_client.add_boost(&player3, &eb(2, BoostType::Additive, 1000, 0, 200));

    // At ledger 150: all active
    set_ledger(&env, 150);
    assert_eq!(boost_client.calculate_total_boost(&player1), 13000);
    assert_eq!(boost_client.calculate_total_boost(&player2), 13000);
    assert_eq!(boost_client.calculate_total_boost(&player3), 12000);

    // At ledger 200: player 2's boosts expired
    set_ledger(&env, 200);
    assert_eq!(boost_client.calculate_total_boost(&player1), 13000);
    assert_eq!(boost_client.calculate_total_boost(&player2), 10000);
    assert_eq!(boost_client.calculate_total_boost(&player3), 11000);
}

// ── Edge Case Integration Tests ───────────────────────────────────────────────

/// Test boost system behavior at ledger boundaries
#[test]
fn test_boost_system_ledger_boundary_integration() {
    let env = Env::default();
    env.mock_all_auths();
    set_ledger(&env, 0);

    let config = TestFixtureConfig::default();
    let fixture = TestFixture::new_with_config(&env, config);

    let boost_client = TycoonBoostSystemClient::new(&env, &fixture.boost_system_id);
    let player = Address::generate(&env);

    // Add boost at genesis
    boost_client.add_boost(&player, &eb(1, BoostType::Additive, 1000, 0, 1));

    // Active at ledger 0
    assert_eq!(boost_client.calculate_total_boost(&player), 11000);

    // Expired at ledger 1
    set_ledger(&env, 1);
    assert_eq!(boost_client.calculate_total_boost(&player), 10000);
}

/// Test boost system with maximum capacity across multiple players
#[test]
fn test_boost_system_max_capacity_multi_player() {
    let env = Env::default();
    env.mock_all_auths();

    let config = TestFixtureConfig::default();
    let fixture = TestFixture::new_with_config(&env, config);

    let boost_client = TycoonBoostSystemClient::new(&env, &fixture.boost_system_id);

    let player1 = Address::generate(&env);
    let player2 = Address::generate(&env);

    // Both players fill to capacity
    for i in 0..10u128 {
        boost_client.add_boost(&player1, &nb(i + 1, BoostType::Additive, 100, 0));
        boost_client.add_boost(&player2, &nb(i + 1, BoostType::Multiplicative, 10100, 0));
    }

    // Verify both at capacity
    assert_eq!(boost_client.get_boosts(&player1).len(), 10);
    assert_eq!(boost_client.get_boosts(&player2).len(), 10);

    // Verify independent calculations
    assert_eq!(boost_client.calculate_total_boost(&player1), 11000); // +10%
    assert!(boost_client.calculate_total_boost(&player2) > 10000); // 1.01^10
}

/// Test boost system recovery after errors
#[test]
fn test_boost_system_error_recovery_integration() {
    let env = Env::default();
    env.mock_all_auths();

    let config = TestFixtureConfig::default();
    let fixture = TestFixture::new_with_config(&env, config);

    let boost_client = TycoonBoostSystemClient::new(&env, &fixture.boost_system_id);
    let player = Address::generate(&env);

    // Add valid boost
    boost_client.add_boost(&player, &nb(1, BoostType::Additive, 1000, 0));

    // Try to add invalid boost (should panic)
    let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        boost_client.add_boost(&player, &nb(2, BoostType::Additive, 0, 0));
    }));
    assert!(result.is_err());

    // System should still be functional
    assert_eq!(boost_client.get_boosts(&player).len(), 1);
    assert_eq!(boost_client.calculate_total_boost(&player), 11000);

    // Should be able to add more boosts
    boost_client.add_boost(&player, &nb(3, BoostType::Additive, 500, 0));
    assert_eq!(boost_client.get_boosts(&player).len(), 2);
    assert_eq!(boost_client.calculate_total_boost(&player), 11500);
}

// ── Determinism and Consistency Tests ─────────────────────────────────────────

/// Test that boost calculations are deterministic across contract calls
#[test]
fn test_boost_determinism_across_calls() {
    let env = Env::default();
    env.mock_all_auths();

    let config = TestFixtureConfig::default();
    let fixture = TestFixture::new_with_config(&env, config);

    let boost_client = TycoonBoostSystemClient::new(&env, &fixture.boost_system_id);
    let player = Address::generate(&env);

    // Add complex boost configuration
    boost_client.add_boost(&player, &nb(1, BoostType::Multiplicative, 15000, 0));
    boost_client.add_boost(&player, &nb(2, BoostType::Multiplicative, 12000, 0));
    boost_client.add_boost(&player, &nb(3, BoostType::Additive, 2000, 0));
    boost_client.add_boost(&player, &nb(4, BoostType::Additive, 1000, 0));

    // Calculate multiple times
    let results: std::vec::Vec<u32> = (0..10)
        .map(|_| boost_client.calculate_total_boost(&player))
        .collect();

    // All results should be identical
    for result in &results {
        assert_eq!(*result, results[0]);
    }
}

/// Test boost system state consistency after multiple operations
#[test]
fn test_boost_state_consistency_integration() {
    let env = Env::default();
    env.mock_all_auths();
    set_ledger(&env, 100);

    let config = TestFixtureConfig::default();
    let fixture = TestFixture::new_with_config(&env, config);

    let boost_client = TycoonBoostSystemClient::new(&env, &fixture.boost_system_id);
    let player = Address::generate(&env);

    // Add boosts
    boost_client.add_boost(&player, &nb(1, BoostType::Additive, 1000, 0));
    boost_client.add_boost(&player, &eb(2, BoostType::Additive, 500, 0, 200));

    // Query state multiple ways
    let all_boosts = boost_client.get_boosts(&player);
    let active_boosts = boost_client.get_active_boosts(&player);
    let total = boost_client.calculate_total_boost(&player);

    // Verify consistency
    assert_eq!(all_boosts.len(), 2);
    assert_eq!(active_boosts.len(), 2);
    assert_eq!(total, 11500);

    // Advance ledger
    set_ledger(&env, 201);

    // Re-query
    let all_boosts_after = boost_client.get_boosts(&player);
    let active_boosts_after = boost_client.get_active_boosts(&player);
    let total_after = boost_client.calculate_total_boost(&player);

    // Verify consistency after expiry
    assert_eq!(all_boosts_after.len(), 2); // Storage not mutated
    assert_eq!(active_boosts_after.len(), 1); // Only permanent boost active
    assert_eq!(total_after, 11000); // Only permanent boost counted
}

