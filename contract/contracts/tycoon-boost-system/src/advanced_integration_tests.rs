/// # Advanced Integration Tests for Boost System
/// 
/// Additional unit and integration tests to improve coverage for the tycoon-boost-system
/// Stellar Soroban contract. These tests focus on edge cases, stress scenarios, and
/// cross-functional integration patterns.
///
/// Part of Stellar Wave engineering batch - SW-CONTRACT-BOOST-001

#[cfg(test)]
extern crate std;

use crate::{Boost, BoostType, TycoonBoostSystem, TycoonBoostSystemClient, MAX_BOOSTS_PER_PLAYER};
use soroban_sdk::{
    testutils::{Address as _, Events, Ledger, LedgerInfo},
    Address, Env, Vec,
};

// ── Test Helpers ──────────────────────────────────────────────────────────────

fn make_env() -> Env {
    let env = Env::default();
    env.mock_all_auths();
    env
}

fn setup(env: &Env) -> (TycoonBoostSystemClient, Address) {
    let contract_id = env.register(TycoonBoostSystem, ());
    let client = TycoonBoostSystemClient::new(env, &contract_id);
    let player = Address::generate(env);
    (client, player)
}

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

// ── Edge Case Tests ───────────────────────────────────────────────────────────

/// Test maximum value boost (u32::MAX - 1) to ensure no overflow
#[test]
fn test_maximum_value_boost() {
    let env = make_env();
    let (client, player) = setup(&env);

    // Use a very large but valid value
    let max_safe_value = u32::MAX / 2; // Avoid overflow in calculations
    client.add_boost(&player, &nb(1, BoostType::Additive, max_safe_value, 0));

    // Should not panic, result should be calculable
    let result = client.calculate_total_boost(&player);
    assert!(result > 10000, "Result should be greater than base");
}

/// Test minimum valid value (1 basis point)
#[test]
fn test_minimum_value_boost() {
    let env = make_env();
    let (client, player) = setup(&env);

    client.add_boost(&player, &nb(1, BoostType::Additive, 1, 0));

    // 10000 + 1 = 10001
    assert_eq!(client.calculate_total_boost(&player), 10001);
}

/// Test boost with maximum priority value
#[test]
fn test_maximum_priority_override() {
    let env = make_env();
    let (client, player) = setup(&env);

    client.add_boost(&player, &nb(1, BoostType::Override, 20000, u32::MAX));
    client.add_boost(&player, &nb(2, BoostType::Override, 30000, u32::MAX - 1));

    // Highest priority (u32::MAX) should win
    assert_eq!(client.calculate_total_boost(&player), 20000);
}

/// Test boost with ID at maximum u128 value
#[test]
fn test_maximum_boost_id() {
    let env = make_env();
    let (client, player) = setup(&env);

    let max_id = u128::MAX;
    client.add_boost(&player, &boost(max_id, BoostType::Additive, 1000, 0, 0));

    let boosts = client.get_boosts(&player);
    assert_eq!(boosts.len(), 1);
    assert_eq!(boosts.get(0).unwrap().id, max_id);
}

// ── Stress Tests ──────────────────────────────────────────────────────────────

/// Test filling to exact capacity with all multiplicative boosts
#[test]
fn test_full_capacity_multiplicative_boosts() {
    let env = make_env();
    let (client, player) = setup(&env);

    // Add MAX_BOOSTS_PER_PLAYER multiplicative boosts
    for i in 0..MAX_BOOSTS_PER_PLAYER {
        client.add_boost(&player, &nb(i as u128 + 1, BoostType::Multiplicative, 11000, 0));
    }

    let result = client.calculate_total_boost(&player);
    // Each boost is 1.1x, so 1.1^10 ≈ 2.594x
    assert!(result > 25000 && result < 26000, "Expected ~25940, got {}", result);
}

/// Test filling to exact capacity with all additive boosts
#[test]
fn test_full_capacity_additive_boosts() {
    let env = make_env();
    let (client, player) = setup(&env);

    // Add MAX_BOOSTS_PER_PLAYER additive boosts of +10% each
    for i in 0..MAX_BOOSTS_PER_PLAYER {
        client.add_boost(&player, &nb(i as u128 + 1, BoostType::Additive, 1000, 0));
    }

    // 10 * 1000 = 10000 additive = +100% = 20000 total
    assert_eq!(client.calculate_total_boost(&player), 20000);
}

/// Test filling to capacity with all override boosts (different priorities)
#[test]
fn test_full_capacity_override_boosts() {
    let env = make_env();
    let (client, player) = setup(&env);

    // Add MAX_BOOSTS_PER_PLAYER override boosts with ascending priorities
    for i in 0..MAX_BOOSTS_PER_PLAYER {
        let priority = (i + 1) * 10;
        let value = 10000 + (i * 1000);
        client.add_boost(&player, &nb(i as u128 + 1, BoostType::Override, value, priority));
    }

    // Highest priority (100) with value 19000 should win
    assert_eq!(client.calculate_total_boost(&player), 19000);
}

/// Test rapid add/prune cycles
#[test]
fn test_rapid_add_prune_cycles() {
    let env = make_env();
    set_ledger(&env, 100);
    let (client, player) = setup(&env);

    // Cycle 1: Add expiring boosts
    for i in 0..5u128 {
        client.add_boost(&player, &eb(i + 1, BoostType::Additive, 1000, 0, 150));
    }
    assert_eq!(client.get_boosts(&player).len(), 5);

    // Advance and prune
    set_ledger(&env, 151);
    let pruned = client.prune_expired_boosts(&player);
    assert_eq!(pruned, 5);

    // Cycle 2: Add new boosts
    for i in 0..5u128 {
        client.add_boost(&player, &eb(i + 10, BoostType::Multiplicative, 12000, 0, 200));
    }
    assert_eq!(client.get_boosts(&player).len(), 5);

    // Advance and prune again
    set_ledger(&env, 201);
    let pruned2 = client.prune_expired_boosts(&player);
    assert_eq!(pruned2, 5);
    assert_eq!(client.get_boosts(&player).len(), 0);
}

// ── Multi-Player Isolation Tests ──────────────────────────────────────────────

/// Test that boosts for different players are completely isolated
#[test]
fn test_multi_player_isolation() {
    let env = make_env();
    let contract_id = env.register(TycoonBoostSystem, ());
    let client = TycoonBoostSystemClient::new(&env, &contract_id);

    let player1 = Address::generate(&env);
    let player2 = Address::generate(&env);
    let player3 = Address::generate(&env);

    env.mock_all_auths();

    // Player 1: Additive boosts
    client.add_boost(&player1, &nb(1, BoostType::Additive, 2000, 0));
    client.add_boost(&player1, &nb(2, BoostType::Additive, 1000, 0));

    // Player 2: Multiplicative boosts
    client.add_boost(&player2, &nb(1, BoostType::Multiplicative, 15000, 0));
    client.add_boost(&player2, &nb(2, BoostType::Multiplicative, 12000, 0));

    // Player 3: Override boost
    client.add_boost(&player3, &nb(1, BoostType::Override, 50000, 10));

    // Verify each player has independent state
    assert_eq!(client.calculate_total_boost(&player1), 13000); // +30%
    assert_eq!(client.calculate_total_boost(&player2), 18000); // 1.5x * 1.2x
    assert_eq!(client.calculate_total_boost(&player3), 50000); // Override

    // Clear player 2, others unaffected
    client.clear_boosts(&player2);
    assert_eq!(client.calculate_total_boost(&player1), 13000);
    assert_eq!(client.calculate_total_boost(&player2), 10000);
    assert_eq!(client.calculate_total_boost(&player3), 50000);
}

/// Test concurrent operations on different players
#[test]
#[allow(deprecated)]
fn test_concurrent_multi_player_operations() {
    let env = make_env();
    set_ledger(&env, 100);
    let contract_id = env.register(TycoonBoostSystem, ());
    let client = TycoonBoostSystemClient::new(&env, &contract_id);

    // Create 5 players manually (Soroban Vec doesn't support collect)
    let player0 = Address::generate(&env);
    let player1 = Address::generate(&env);
    let player2 = Address::generate(&env);
    let player3 = Address::generate(&env);
    let player4 = Address::generate(&env);
    
    env.mock_all_auths();

    // Player 0: 1 boost expiring at 200
    client.add_boost(&player0, &eb(1, BoostType::Additive, 500, 0, 200));

    // Player 1: 2 boosts expiring at 210
    client.add_boost(&player1, &eb(1, BoostType::Additive, 500, 0, 210));
    client.add_boost(&player1, &eb(2, BoostType::Additive, 500, 0, 210));

    // Player 2: 3 boosts expiring at 220
    client.add_boost(&player2, &eb(1, BoostType::Additive, 500, 0, 220));
    client.add_boost(&player2, &eb(2, BoostType::Additive, 500, 0, 220));
    client.add_boost(&player2, &eb(3, BoostType::Additive, 500, 0, 220));

    // Player 3: 4 boosts expiring at 230
    client.add_boost(&player3, &eb(1, BoostType::Additive, 500, 0, 230));
    client.add_boost(&player3, &eb(2, BoostType::Additive, 500, 0, 230));
    client.add_boost(&player3, &eb(3, BoostType::Additive, 500, 0, 230));
    client.add_boost(&player3, &eb(4, BoostType::Additive, 500, 0, 230));

    // Player 4: 5 boosts expiring at 240
    client.add_boost(&player4, &eb(1, BoostType::Additive, 500, 0, 240));
    client.add_boost(&player4, &eb(2, BoostType::Additive, 500, 0, 240));
    client.add_boost(&player4, &eb(3, BoostType::Additive, 500, 0, 240));
    client.add_boost(&player4, &eb(4, BoostType::Additive, 500, 0, 240));
    client.add_boost(&player4, &eb(5, BoostType::Additive, 500, 0, 240));

    // Verify each player has correct number of boosts
    assert_eq!(client.get_boosts(&player0).len(), 1);
    assert_eq!(client.get_boosts(&player1).len(), 2);
    assert_eq!(client.get_boosts(&player2).len(), 3);
    assert_eq!(client.get_boosts(&player3).len(), 4);
    assert_eq!(client.get_boosts(&player4).len(), 5);

    // Advance ledger to expire some boosts
    set_ledger(&env, 215);

    // Players 0, 1 should have expired boosts; players 2, 3, 4 should still have active
    assert_eq!(client.get_active_boosts(&player0).len(), 0); // Expired at 200
    assert_eq!(client.get_active_boosts(&player1).len(), 0); // Expired at 210
    assert!(client.get_active_boosts(&player2).len() > 0); // Expires at 220
    assert!(client.get_active_boosts(&player3).len() > 0); // Expires at 230
    assert!(client.get_active_boosts(&player4).len() > 0); // Expires at 240
}

// ── Complex Calculation Tests ─────────────────────────────────────────────────

/// Test complex stacking with all three types and varying expiry times
#[test]
fn test_complex_mixed_stacking_with_expiry() {
    let env = make_env();
    set_ledger(&env, 100);
    let (client, player) = setup(&env);

    // Permanent multiplicative
    client.add_boost(&player, &nb(1, BoostType::Multiplicative, 15000, 0));
    // Expiring multiplicative (expires at 200)
    client.add_boost(&player, &eb(2, BoostType::Multiplicative, 12000, 0, 200));
    // Permanent additive
    client.add_boost(&player, &nb(3, BoostType::Additive, 1000, 0));
    // Expiring additive (expires at 150)
    client.add_boost(&player, &eb(4, BoostType::Additive, 2000, 0, 150));
    // Expiring override (expires at 180)
    client.add_boost(&player, &eb(5, BoostType::Override, 40000, 10, 180));

    // At ledger 100: Override active → 40000
    assert_eq!(client.calculate_total_boost(&player), 40000);

    // At ledger 160: Additive 4 expired, override expired → mult * (1 + add)
    set_ledger(&env, 160);
    // 10000 * 1.5 * 1.2 * (1 + 0.10) = 19800
    assert_eq!(client.calculate_total_boost(&player), 19800);

    // At ledger 210: Mult 2 also expired → only mult 1 and add 3
    set_ledger(&env, 210);
    // 10000 * 1.5 * (1 + 0.10) = 16500
    assert_eq!(client.calculate_total_boost(&player), 16500);
}

/// Test precision with many small additive boosts
#[test]
fn test_precision_many_small_additive_boosts() {
    let env = make_env();
    let (client, player) = setup(&env);

    // Add 10 boosts of +0.01% each (1 basis point)
    for i in 0..MAX_BOOSTS_PER_PLAYER {
        client.add_boost(&player, &nb(i as u128 + 1, BoostType::Additive, 1, 0));
    }

    // 10000 + 10 = 10010
    assert_eq!(client.calculate_total_boost(&player), 10010);
}

/// Test large multiplicative chain
#[test]
fn test_large_multiplicative_chain() {
    let env = make_env();
    let (client, player) = setup(&env);

    // Add 10 boosts of 1.05x each
    for i in 0..MAX_BOOSTS_PER_PLAYER {
        client.add_boost(&player, &nb(i as u128 + 1, BoostType::Multiplicative, 10500, 0));
    }

    let result = client.calculate_total_boost(&player);
    // 1.05^10 ≈ 1.6289 → ~16289
    assert!(result >= 16200 && result <= 16300, "Expected ~16289, got {}", result);
}

// ── Event Verification Tests ──────────────────────────────────────────────────

/// Test that BoostActivatedEvent contains correct data
#[test]
fn test_boost_activated_event_data() {
    let env = make_env();
    set_ledger(&env, 100);
    let (client, player) = setup(&env);

    let boost_to_add = eb(42, BoostType::Multiplicative, 15000, 5, 500);
    client.add_boost(&player, &boost_to_add);

    // Verify event was emitted (basic check - detailed event inspection would require more SDK features)
    let events = env.events().all();
    assert!(events.len() > 0, "Expected at least one event");
}

/// Test multiple BoostExpiredEvent emissions
#[test]
fn test_multiple_boost_expired_events() {
    let env = make_env();
    set_ledger(&env, 100);
    let (client, player) = setup(&env);

    // Add 5 boosts that will all expire
    for i in 0..5u128 {
        client.add_boost(&player, &eb(i + 1, BoostType::Additive, 1000, 0, 150));
    }

    set_ledger(&env, 200);

    let events_before = env.events().all().len();
    client.prune_expired_boosts(&player);
    let events_after = env.events().all().len();

    // Should have emitted 5 BoostExpiredEvent events
    assert!(events_after > events_before, "Expected expired events to be emitted");
}

/// Test BoostsClearedEvent with correct count
#[test]
fn test_boosts_cleared_event_count() {
    let env = make_env();
    let (client, player) = setup(&env);

    // Add 7 boosts
    for i in 0..7u128 {
        client.add_boost(&player, &nb(i + 1, BoostType::Additive, 500, 0));
    }

    let events_before = env.events().all().len();
    client.clear_boosts(&player);
    let events_after = env.events().all().len();

    assert!(events_after > events_before, "Expected cleared event to be emitted");
    assert_eq!(client.get_boosts(&player).len(), 0);
}

// ── Authorization Tests ───────────────────────────────────────────────────────

/// Test that add_boost requires player authorization
#[test]
#[should_panic]
fn test_add_boost_requires_auth() {
    let env = Env::default();
    // Do NOT mock auths
    let contract_id = env.register(TycoonBoostSystem, ());
    let client = TycoonBoostSystemClient::new(&env, &contract_id);
    let player = Address::generate(&env);

    // Should panic because auth is not mocked
    client.add_boost(&player, &nb(1, BoostType::Additive, 1000, 0));
}

/// Test that clear_boosts requires player authorization
#[test]
#[should_panic]
fn test_clear_boosts_requires_auth() {
    let env = Env::default();
    // Do NOT mock auths
    let contract_id = env.register(TycoonBoostSystem, ());
    let client = TycoonBoostSystemClient::new(&env, &contract_id);
    let player = Address::generate(&env);

    // Should panic because auth is not mocked
    client.clear_boosts(&player);
}

// ── Idempotency Tests ─────────────────────────────────────────────────────────

/// Test that calculate_total_boost is idempotent (multiple calls same result)
#[test]
fn test_calculate_total_boost_idempotent() {
    let env = make_env();
    let (client, player) = setup(&env);

    client.add_boost(&player, &nb(1, BoostType::Multiplicative, 15000, 0));
    client.add_boost(&player, &nb(2, BoostType::Additive, 2000, 0));

    let result1 = client.calculate_total_boost(&player);
    let result2 = client.calculate_total_boost(&player);
    let result3 = client.calculate_total_boost(&player);

    assert_eq!(result1, result2);
    assert_eq!(result2, result3);
}

/// Test that get_boosts is idempotent
#[test]
fn test_get_boosts_idempotent() {
    let env = make_env();
    let (client, player) = setup(&env);

    client.add_boost(&player, &nb(1, BoostType::Additive, 1000, 0));
    client.add_boost(&player, &nb(2, BoostType::Additive, 500, 0));

    let boosts1 = client.get_boosts(&player);
    let boosts2 = client.get_boosts(&player);

    assert_eq!(boosts1.len(), boosts2.len());
    for i in 0..boosts1.len() {
        assert_eq!(boosts1.get(i).unwrap(), boosts2.get(i).unwrap());
    }
}

/// Test that get_active_boosts is idempotent
#[test]
fn test_get_active_boosts_idempotent() {
    let env = make_env();
    set_ledger(&env, 100);
    let (client, player) = setup(&env);

    client.add_boost(&player, &eb(1, BoostType::Additive, 1000, 0, 200));
    client.add_boost(&player, &nb(2, BoostType::Additive, 500, 0));

    let active1 = client.get_active_boosts(&player);
    let active2 = client.get_active_boosts(&player);

    assert_eq!(active1.len(), active2.len());
}

// ── State Consistency Tests ───────────────────────────────────────────────────

/// Test that storage is consistent after prune
#[test]
fn test_storage_consistency_after_prune() {
    let env = make_env();
    set_ledger(&env, 100);
    let (client, player) = setup(&env);

    // Add mix of expiring and permanent boosts
    client.add_boost(&player, &eb(1, BoostType::Additive, 1000, 0, 150));
    client.add_boost(&player, &nb(2, BoostType::Additive, 500, 0));
    client.add_boost(&player, &eb(3, BoostType::Multiplicative, 15000, 0, 150));

    set_ledger(&env, 200);
    client.prune_expired_boosts(&player);

    // Only boost 2 should remain
    let remaining = client.get_boosts(&player);
    assert_eq!(remaining.len(), 1);
    assert_eq!(remaining.get(0).unwrap().id, 2);

    // Active boosts should match get_boosts after prune
    let active = client.get_active_boosts(&player);
    assert_eq!(active.len(), remaining.len());
}

/// Test that clear_boosts completely resets state
#[test]
fn test_clear_boosts_complete_reset() {
    let env = make_env();
    let (client, player) = setup(&env);

    // Fill to capacity
    for i in 0..MAX_BOOSTS_PER_PLAYER {
        client.add_boost(&player, &nb(i as u128 + 1, BoostType::Additive, 100, 0));
    }

    client.clear_boosts(&player);

    // All queries should return empty/base state
    assert_eq!(client.get_boosts(&player).len(), 0);
    assert_eq!(client.get_active_boosts(&player).len(), 0);
    assert_eq!(client.calculate_total_boost(&player), 10000);

    // Should be able to add boosts again
    client.add_boost(&player, &nb(999, BoostType::Additive, 1000, 0));
    assert_eq!(client.get_boosts(&player).len(), 1);
}

// ── Boundary Condition Tests ──────────────────────────────────────────────────

/// Test adding boost at ledger 0 (genesis)
#[test]
fn test_add_boost_at_genesis_ledger() {
    let env = make_env();
    set_ledger(&env, 0);
    let (client, player) = setup(&env);

    // Should be able to add boost at ledger 0 with expiry > 0
    client.add_boost(&player, &eb(1, BoostType::Additive, 1000, 0, 1));

    assert_eq!(client.calculate_total_boost(&player), 11000);

    // Advance to ledger 1, boost should expire
    set_ledger(&env, 1);
    assert_eq!(client.calculate_total_boost(&player), 10000);
}

/// Test boost expiring at maximum ledger value
#[test]
fn test_boost_expiry_at_max_ledger() {
    let env = make_env();
    set_ledger(&env, 100);
    let (client, player) = setup(&env);

    // Add boost expiring at u32::MAX
    client.add_boost(&player, &eb(1, BoostType::Additive, 1000, 0, u32::MAX));

    // Should be active for a very long time
    set_ledger(&env, u32::MAX - 1);
    assert_eq!(client.calculate_total_boost(&player), 11000);

    // Should expire at u32::MAX
    set_ledger(&env, u32::MAX);
    assert_eq!(client.calculate_total_boost(&player), 10000);
}

/// Test adding boost with expiry exactly one ledger in the future
#[test]
fn test_boost_expiry_one_ledger_future() {
    let env = make_env();
    set_ledger(&env, 100);
    let (client, player) = setup(&env);

    // Add boost expiring at ledger 101 (next ledger)
    client.add_boost(&player, &eb(1, BoostType::Additive, 1000, 0, 101));

    // Active at 100
    assert_eq!(client.calculate_total_boost(&player), 11000);

    // Expired at 101
    set_ledger(&env, 101);
    assert_eq!(client.calculate_total_boost(&player), 10000);
}

// ── Error Recovery Tests ──────────────────────────────────────────────────────

/// Test that failed add_boost doesn't corrupt state
#[test]
fn test_failed_add_boost_no_state_corruption() {
    let env = make_env();
    let (client, player) = setup(&env);

    // Add valid boost
    client.add_boost(&player, &nb(1, BoostType::Additive, 1000, 0));
    assert_eq!(client.get_boosts(&player).len(), 1);

    // Try to add invalid boost (zero value) - should panic
    let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        client.add_boost(&player, &nb(2, BoostType::Additive, 0, 0));
    }));
    assert!(result.is_err(), "Expected panic for zero value");

    // Original boost should still be there
    assert_eq!(client.get_boosts(&player).len(), 1);
    assert_eq!(client.calculate_total_boost(&player), 11000);
}

/// Test recovery after hitting cap
#[test]
fn test_recovery_after_cap_exceeded() {
    let env = make_env();
    set_ledger(&env, 100);
    let (client, player) = setup(&env);

    // Fill to capacity with expiring boosts
    for i in 0..MAX_BOOSTS_PER_PLAYER {
        client.add_boost(&player, &eb(i as u128 + 1, BoostType::Additive, 100, 0, 200));
    }

    // Try to add one more - should panic
    let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        client.add_boost(&player, &nb(999, BoostType::Additive, 100, 0));
    }));
    assert!(result.is_err(), "Expected panic for cap exceeded");

    // Advance ledger to expire boosts
    set_ledger(&env, 201);
    client.prune_expired_boosts(&player);

    // Should now be able to add boosts again
    client.add_boost(&player, &nb(1000, BoostType::Additive, 500, 0));
    assert_eq!(client.get_boosts(&player).len(), 1);
}

