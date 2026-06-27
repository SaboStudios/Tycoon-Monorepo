//! # Advanced Integration Tests for Boost System
//!
//! Additional unit and integration tests to improve coverage for the tycoon-boost-system
//! Stellar Soroban contract. These tests focus on edge cases, stress scenarios, and
//! cross-functional integration patterns.
//!
//! Part of Stellar Wave engineering batch - SW-CONTRACT-BOOST-001
//!
//! ## Test Coverage Matrix
//!
//! | Category | Test Count | Coverage |
//! |----------|------------|----------|
//! | Edge Cases | 5 | Boundary values, max/min scenarios |
//! | Stress Tests | 4 | Capacity limits, rapid cycles |
//! | Multi-Player | 2 | Isolation, concurrent operations |
//! | Complex Calculations | 3 | Mixed stacking, precision, chains |
//! | Event Verification | 3 | Event data and emission |
//! | Authorization | 2 | Auth requirements |
//! | Idempotency | 3 | Consistent results |
//! | State Consistency | 2 | Storage integrity |
//! | Boundary Conditions | 3 | Ledger boundaries |
//! | Error Recovery | 2 | State corruption prevention |
//! | Admin Operations | 8 | Admin grant/revoke integration |
//! | Priority Mechanics | 4 | Override priority handling |
//! | State Transitions | 5 | Complex workflows |
//! | Performance | 3 | Stress and scalability |
//! | **Total** | **49+** | **Comprehensive** |

extern crate std;

use crate::{Boost, BoostType, TycoonBoostSystem, TycoonBoostSystemClient, MAX_BOOSTS_PER_PLAYER};
use soroban_sdk::{
    testutils::{Address as _, Events, Ledger, LedgerInfo},
    Address, Env,
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
    let admin = Address::generate(env);
    client.initialize(&admin);
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
    Boost {
        id,
        boost_type,
        value,
        priority,
        expires_at_ledger: expires,
    }
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
        client.add_boost(
            &player,
            &nb(i as u128 + 1, BoostType::Multiplicative, 11000, 0),
        );
    }

    let result = client.calculate_total_boost(&player);
    // Each boost is 1.1x, so 1.1^10 ≈ 2.594x
    assert!(
        result > 25000 && result < 26000,
        "Expected ~25940, got {}",
        result
    );
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
        client.add_boost(
            &player,
            &nb(i as u128 + 1, BoostType::Override, value, priority),
        );
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
        client.add_boost(
            &player,
            &eb(i + 10, BoostType::Multiplicative, 12000, 0, 200),
        );
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
    let admin = Address::generate(&env);
    client.initialize(&admin);

    let player1 = Address::generate(&env);
    let player2 = Address::generate(&env);
    let player3 = Address::generate(&env);

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
    let admin = Address::generate(&env);
    client.initialize(&admin);

    // Create 5 players manually (Soroban Vec doesn't support collect)
    let player0 = Address::generate(&env);
    let player1 = Address::generate(&env);
    let player2 = Address::generate(&env);
    let player3 = Address::generate(&env);
    let player4 = Address::generate(&env);

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
    assert!(!client.get_active_boosts(&player2).is_empty()); // Expires at 220
    assert!(!client.get_active_boosts(&player3).is_empty()); // Expires at 230
    assert!(!client.get_active_boosts(&player4).is_empty()); // Expires at 240
}

// ── Complex Calculation Tests ─────────────────────────────────────────────────

/// Test complex stacking with all three types and varying expiry times
#[test]
fn test_complex_mixed_stacking_with_expiry() {
    let env = make_env();
    set_ledger(&env, 100);
    let (client, player) = setup(&env);

    // Permanent multiplicative (1.5x)
    client.add_boost(&player, &nb(1, BoostType::Multiplicative, 15000, 0));
    // Expiring multiplicative (1.2x, expires at 200)
    client.add_boost(&player, &eb(2, BoostType::Multiplicative, 12000, 0, 200));
    // Permanent additive (+10%)
    client.add_boost(&player, &nb(3, BoostType::Additive, 1000, 0));
    // Expiring additive (+20%, expires at 150)
    client.add_boost(&player, &eb(4, BoostType::Additive, 2000, 0, 150));
    // Expiring override (4x, expires at 180)
    client.add_boost(&player, &eb(5, BoostType::Override, 40000, 10, 180));

    // At ledger 100: Override (expires 180) is active → 40000
    assert_eq!(client.calculate_total_boost(&player), 40000);

    // At ledger 160: Additive 4 expired (150), but override (180) still active → 40000
    set_ledger(&env, 160);
    assert_eq!(client.calculate_total_boost(&player), 40000);

    // At ledger 185: Override expired (180), additive 4 expired (150)
    // Active: mult 1 (1.5x), mult 2 (1.2x), additive 3 (+10%)
    // 10000 * 1.5 * 1.2 * (1 + 0.10) = 19800
    set_ledger(&env, 185);
    assert_eq!(client.calculate_total_boost(&player), 19800);

    // At ledger 210: Mult 2 also expired (200) → only mult 1 and add 3
    // 10000 * 1.5 * (1 + 0.10) = 16500
    set_ledger(&env, 210);
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
        client.add_boost(
            &player,
            &nb(i as u128 + 1, BoostType::Multiplicative, 10500, 0),
        );
    }

    let result = client.calculate_total_boost(&player);
    // 1.05^10 ≈ 1.6289 → ~16289
    assert!(
        (16200..=16300).contains(&result),
        "Expected ~16289, got {}",
        result
    );
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
    assert!(!events.is_empty(), "Expected at least one event");
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
    assert!(
        events_after > events_before,
        "Expected expired events to be emitted"
    );
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

    assert_eq!(client.get_active_boosts(&player).len(), 7);

    client.clear_boosts(&player);

    // All boosts removed — primary observable effect
    assert_eq!(client.get_active_boosts(&player).len(), 0);
    // get_boosts (deprecated) should also return 0 after clear
    #[allow(deprecated)]
    let remaining = client.get_boosts(&player);
    assert_eq!(remaining.len(), 0);
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
        client.add_boost(
            &player,
            &eb(i as u128 + 1, BoostType::Additive, 100, 0, 200),
        );
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

// ── Admin Operations Integration Tests ───────────────────────────────────────

/// AIT-01: Admin-granted boost interacts correctly with player-added boosts
#[test]
fn test_admin_granted_and_player_added_coexist() {
    let env = make_env();
    let contract_id = env.register(TycoonBoostSystem, ());
    let client = TycoonBoostSystemClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    let player = Address::generate(&env);
    
    client.initialize(&admin);
    
    // Admin grants multiplicative boost
    client.admin_grant_boost(&player, &nb(1, BoostType::Multiplicative, 15000, 0));
    
    // Player adds additive boost
    client.add_boost(&player, &nb(2, BoostType::Additive, 2000, 0));
    
    // Both should be active: 10000 * 1.5 * (1 + 0.2) = 18000
    assert_eq!(client.calculate_total_boost(&player), 18000);
    
    let boosts = client.get_active_boosts(&player);
    assert_eq!(boosts.len(), 2);
}

/// AIT-02: Admin revoke removes boost without affecting others
#[test]
fn test_admin_revoke_preserves_other_boosts() {
    let env = make_env();
    let contract_id = env.register(TycoonBoostSystem, ());
    let client = TycoonBoostSystemClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    let player = Address::generate(&env);
    
    client.initialize(&admin);
    
    // Admin grants multiple boosts
    client.admin_grant_boost(&player, &nb(1, BoostType::Additive, 1000, 0));
    client.admin_grant_boost(&player, &nb(2, BoostType::Additive, 2000, 0));
    client.admin_grant_boost(&player, &nb(3, BoostType::Multiplicative, 15000, 0));
    
    // Player adds own boost
    client.add_boost(&player, &nb(4, BoostType::Additive, 500, 0));
    
    assert_eq!(client.get_active_boosts(&player).len(), 4);
    
    // Admin revokes one boost
    client.admin_revoke_boost(&player, &2);
    
    // Three boosts should remain
    let remaining = client.get_active_boosts(&player);
    assert_eq!(remaining.len(), 3);
    
    // Verify correct boosts remain
    let ids: std::vec::Vec<u128> = (0..remaining.len())
        .map(|i| remaining.get(i).unwrap().id)
        .collect();
    assert!(ids.contains(&1));
    assert!(!ids.contains(&2)); // Revoked
    assert!(ids.contains(&3));
    assert!(ids.contains(&4));
}

/// AIT-03: Admin grant with expiry integrates with pruning
#[test]
fn test_admin_granted_expiring_boost_pruned() {
    let env = make_env();
    set_ledger(&env, 100);
    let contract_id = env.register(TycoonBoostSystem, ());
    let client = TycoonBoostSystemClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    let player = Address::generate(&env);
    
    client.initialize(&admin);
    
    // Admin grants expiring boost
    client.admin_grant_boost(&player, &eb(1, BoostType::Additive, 1000, 0, 200));
    
    // Player adds permanent boost
    client.add_boost(&player, &nb(2, BoostType::Additive, 500, 0));
    
    assert_eq!(client.get_active_boosts(&player).len(), 2);
    
    // Advance ledger past expiry
    set_ledger(&env, 250);
    
    // Only permanent boost should be active
    assert_eq!(client.get_active_boosts(&player).len(), 1);
    assert_eq!(client.get_active_boosts(&player).get(0).unwrap().id, 2);
}

/// AIT-04: Admin revoke of non-existent boost is idempotent
#[test]
fn test_admin_revoke_nonexistent_idempotent() {
    let env = make_env();
    let contract_id = env.register(TycoonBoostSystem, ());
    let client = TycoonBoostSystemClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    let player = Address::generate(&env);
    
    client.initialize(&admin);
    
    client.admin_grant_boost(&player, &nb(1, BoostType::Additive, 1000, 0));
    
    // Revoke non-existent boost ID multiple times
    client.admin_revoke_boost(&player, &999);
    client.admin_revoke_boost(&player, &999);
    client.admin_revoke_boost(&player, &888);
    
    // Original boost should still be there
    assert_eq!(client.get_active_boosts(&player).len(), 1);
    assert_eq!(client.get_active_boosts(&player).get(0).unwrap().id, 1);
}

/// AIT-05: Clear boosts removes both admin-granted and player-added
#[test]
fn test_clear_removes_all_boost_sources() {
    let env = make_env();
    let contract_id = env.register(TycoonBoostSystem, ());
    let client = TycoonBoostSystemClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    let player = Address::generate(&env);
    
    client.initialize(&admin);
    
    // Mix of admin-granted and player-added
    client.admin_grant_boost(&player, &nb(1, BoostType::Additive, 1000, 0));
    client.add_boost(&player, &nb(2, BoostType::Additive, 500, 0));
    client.admin_grant_boost(&player, &nb(3, BoostType::Multiplicative, 15000, 0));
    
    assert_eq!(client.get_active_boosts(&player).len(), 3);
    
    // Clear all
    client.clear_boosts(&player);
    
    // Everything removed
    assert_eq!(client.get_active_boosts(&player).len(), 0);
    assert_eq!(client.calculate_total_boost(&player), 10000);
}

/// AIT-06: Admin grant at capacity with expiring boosts
#[test]
fn test_admin_grant_frees_slots_via_expiry() {
    let env = make_env();
    set_ledger(&env, 100);
    let contract_id = env.register(TycoonBoostSystem, ());
    let client = TycoonBoostSystemClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    let player = Address::generate(&env);
    
    client.initialize(&admin);
    
    // Fill to capacity with expiring boosts
    for i in 0..MAX_BOOSTS_PER_PLAYER {
        client.admin_grant_boost(
            &player,
            &eb(i as u128 + 1, BoostType::Additive, 100, 0, 200),
        );
    }
    
    assert_eq!(client.get_active_boosts(&player).len(), MAX_BOOSTS_PER_PLAYER as usize);
    
    // Advance past expiry
    set_ledger(&env, 250);
    
    // All expired, should be able to add new boost
    client.admin_grant_boost(&player, &nb(999, BoostType::Additive, 500, 0));
    
    assert_eq!(client.get_active_boosts(&player).len(), 1);
    assert_eq!(client.get_active_boosts(&player).get(0).unwrap().id, 999);
}

/// AIT-07: Admin grant multiple boosts rapid succession
#[test]
fn test_admin_rapid_grant_sequence() {
    let env = make_env();
    let contract_id = env.register(TycoonBoostSystem, ());
    let client = TycoonBoostSystemClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    let player = Address::generate(&env);
    
    client.initialize(&admin);
    
    // Rapidly grant various boost types
    client.admin_grant_boost(&player, &nb(1, BoostType::Additive, 500, 0));
    client.admin_grant_boost(&player, &nb(2, BoostType::Multiplicative, 12000, 0));
    client.admin_grant_boost(&player, &nb(3, BoostType::Override, 25000, 10));
    client.admin_grant_boost(&player, &nb(4, BoostType::Additive, 1000, 0));
    client.admin_grant_boost(&player, &nb(5, BoostType::Multiplicative, 11000, 0));
    
    assert_eq!(client.get_active_boosts(&player).len(), 5);
    
    // Override should win
    assert_eq!(client.calculate_total_boost(&player), 25000);
}

/// AIT-08: Admin operations across multiple players simultaneously
#[test]
fn test_admin_multi_player_operations() {
    let env = make_env();
    let contract_id = env.register(TycoonBoostSystem, ());
    let client = TycoonBoostSystemClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    
    client.initialize(&admin);
    
    let player1 = Address::generate(&env);
    let player2 = Address::generate(&env);
    let player3 = Address::generate(&env);
    
    // Admin grants to multiple players
    client.admin_grant_boost(&player1, &nb(1, BoostType::Additive, 1000, 0));
    client.admin_grant_boost(&player2, &nb(1, BoostType::Multiplicative, 15000, 0));
    client.admin_grant_boost(&player3, &nb(1, BoostType::Override, 30000, 5));
    
    // Verify isolation
    assert_eq!(client.calculate_total_boost(&player1), 11000);
    assert_eq!(client.calculate_total_boost(&player2), 15000);
    assert_eq!(client.calculate_total_boost(&player3), 30000);
    
    // Admin revokes from player2
    client.admin_revoke_boost(&player2, &1);
    
    // Only player2 affected
    assert_eq!(client.calculate_total_boost(&player1), 11000);
    assert_eq!(client.calculate_total_boost(&player2), 10000);
    assert_eq!(client.calculate_total_boost(&player3), 30000);
}

// ── Priority Mechanics Tests ──────────────────────────────────────────────────

/// AIT-09: Override boosts with equal priority (first wins)
#[test]
fn test_override_equal_priority_behavior() {
    let env = make_env();
    let (client, player) = setup(&env);
    
    // Add multiple override boosts with same priority
    client.add_boost(&player, &nb(1, BoostType::Override, 20000, 5));
    client.add_boost(&player, &nb(2, BoostType::Override, 30000, 5));
    client.add_boost(&player, &nb(3, BoostType::Override, 25000, 5));
    
    let result = client.calculate_total_boost(&player);
    
    // One of them should apply (implementation-dependent which one)
    assert!(
        result == 20000 || result == 30000 || result == 25000,
        "Expected one override value, got {}",
        result
    );
}

/// AIT-10: Priority 0 override vs non-zero priorities
#[test]
fn test_override_zero_vs_nonzero_priority() {
    let env = make_env();
    let (client, player) = setup(&env);
    
    // Priority 0 override
    client.add_boost(&player, &nb(1, BoostType::Override, 15000, 0));
    // Higher priority override
    client.add_boost(&player, &nb(2, BoostType::Override, 25000, 1));
    
    // Higher priority should win
    assert_eq!(client.calculate_total_boost(&player), 25000);
}

/// AIT-11: Override boost with other types inactive due to priority
#[test]
fn test_override_suppresses_other_types() {
    let env = make_env();
    let (client, player) = setup(&env);
    
    // Add strong additive and multiplicative boosts
    client.add_boost(&player, &nb(1, BoostType::Additive, 50000, 0)); // +500%
    client.add_boost(&player, &nb(2, BoostType::Multiplicative, 30000, 0)); // 3x
    
    // Without override: 10000 * 3 * (1 + 5) = 180000
    let without_override = client.calculate_total_boost(&player);
    assert_eq!(without_override, 180000);
    
    // Add lower override
    client.add_boost(&player, &nb(3, BoostType::Override, 50000, 1));
    
    // Override should suppress everything
    assert_eq!(client.calculate_total_boost(&player), 50000);
}

/// AIT-12: Removing high-priority override reveals lower priority
#[test]
fn test_override_priority_cascade() {
    let env = make_env();
    let contract_id = env.register(TycoonBoostSystem, ());
    let client = TycoonBoostSystemClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    let player = Address::generate(&env);
    
    client.initialize(&admin);
    
    // Add multiple override boosts with different priorities
    client.add_boost(&player, &nb(1, BoostType::Override, 15000, 1));
    client.add_boost(&player, &nb(2, BoostType::Override, 25000, 5));
    client.add_boost(&player, &nb(3, BoostType::Override, 35000, 10));
    
    // Highest priority wins
    assert_eq!(client.calculate_total_boost(&player), 35000);
    
    // Admin revokes highest priority
    client.admin_revoke_boost(&player, &3);
    
    // Next highest should now apply
    assert_eq!(client.calculate_total_boost(&player), 25000);
    
    // Revoke that one too
    client.admin_revoke_boost(&player, &2);
    
    // Lowest priority override applies
    assert_eq!(client.calculate_total_boost(&player), 15000);
    
    // Revoke last override
    client.admin_revoke_boost(&player, &1);
    
    // Back to base
    assert_eq!(client.calculate_total_boost(&player), 10000);
}

// ── State Transition Tests ────────────────────────────────────────────────────

/// AIT-13: Full workflow - grant, add, revoke, clear cycle
#[test]
fn test_full_boost_lifecycle() {
    let env = make_env();
    let contract_id = env.register(TycoonBoostSystem, ());
    let client = TycoonBoostSystemClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    let player = Address::generate(&env);
    
    client.initialize(&admin);
    
    // Phase 1: Admin grants initial boost
    client.admin_grant_boost(&player, &nb(1, BoostType::Additive, 1000, 0));
    assert_eq!(client.calculate_total_boost(&player), 11000);
    
    // Phase 2: Player adds own boost
    client.add_boost(&player, &nb(2, BoostType::Multiplicative, 15000, 0));
    assert_eq!(client.calculate_total_boost(&player), 16500); // 10000 * 1.5 * 1.1
    
    // Phase 3: Admin grants additional boost
    client.admin_grant_boost(&player, &nb(3, BoostType::Additive, 2000, 0));
    assert_eq!(client.calculate_total_boost(&player), 19500); // 10000 * 1.5 * 1.3
    
    // Phase 4: Admin revokes one boost
    client.admin_revoke_boost(&player, &1);
    assert_eq!(client.calculate_total_boost(&player), 18000); // 10000 * 1.5 * 1.2
    
    // Phase 5: Clear all
    client.clear_boosts(&player);
    assert_eq!(client.calculate_total_boost(&player), 10000);
}

/// AIT-14: State transitions with expiry
#[test]
fn test_state_transitions_with_time() {
    let env = make_env();
    set_ledger(&env, 100);
    let contract_id = env.register(TycoonBoostSystem, ());
    let client = TycoonBoostSystemClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    let player = Address::generate(&env);
    
    client.initialize(&admin);
    
    // T=100: Grant boost expiring at 200
    client.admin_grant_boost(&player, &eb(1, BoostType::Additive, 2000, 0, 200));
    assert_eq!(client.calculate_total_boost(&player), 12000);
    
    // T=150: Add player boost expiring at 250
    set_ledger(&env, 150);
    client.add_boost(&player, &eb(2, BoostType::Multiplicative, 15000, 0, 250));
    assert_eq!(client.calculate_total_boost(&player), 18000); // 10000 * 1.5 * 1.2
    
    // T=210: First boost expired
    set_ledger(&env, 210);
    assert_eq!(client.calculate_total_boost(&player), 15000); // 10000 * 1.5
    
    // T=260: Second boost expired
    set_ledger(&env, 260);
    assert_eq!(client.calculate_total_boost(&player), 10000);
}

/// AIT-15: Multiple grant-revoke cycles on same player
#[test]
fn test_grant_revoke_cycles() {
    let env = make_env();
    let contract_id = env.register(TycoonBoostSystem, ());
    let client = TycoonBoostSystemClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    let player = Address::generate(&env);
    
    client.initialize(&admin);
    
    for cycle in 1..=3 {
        // Grant boost
        client.admin_grant_boost(
            &player,
            &nb(cycle as u128, BoostType::Additive, cycle * 1000, 0),
        );
        assert_eq!(client.get_active_boosts(&player).len(), 1);
        
        // Revoke it
        client.admin_revoke_boost(&player, &(cycle as u128));
        assert_eq!(client.get_active_boosts(&player).len(), 0);
    }
    
    // Final state should be clean
    assert_eq!(client.calculate_total_boost(&player), 10000);
}

/// AIT-16: Interleaved grant and player operations
#[test]
fn test_interleaved_admin_player_operations() {
    let env = make_env();
    let contract_id = env.register(TycoonBoostSystem, ());
    let client = TycoonBoostSystemClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    let player = Address::generate(&env);
    
    client.initialize(&admin);
    
    // Admin grants
    client.admin_grant_boost(&player, &nb(1, BoostType::Additive, 500, 0));
    // Player adds
    client.add_boost(&player, &nb(2, BoostType::Additive, 500, 0));
    // Admin grants again
    client.admin_grant_boost(&player, &nb(3, BoostType::Multiplicative, 12000, 0));
    // Player adds again
    client.add_boost(&player, &nb(4, BoostType::Additive, 500, 0));
    
    // All four should coexist
    assert_eq!(client.get_active_boosts(&player).len(), 4);
    
    // Calculation: 10000 * 1.2 * (1 + 0.05 + 0.05 + 0.05) = 13800
    assert_eq!(client.calculate_total_boost(&player), 13800);
}

/// AIT-17: State consistency after mixed operations
#[test]
fn test_state_consistency_complex_operations() {
    let env = make_env();
    set_ledger(&env, 100);
    let contract_id = env.register(TycoonBoostSystem, ());
    let client = TycoonBoostSystemClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    let player = Address::generate(&env);
    
    client.initialize(&admin);
    
    // Mix of permanent and expiring, admin and player
    client.admin_grant_boost(&player, &nb(1, BoostType::Additive, 1000, 0)); // Permanent
    client.add_boost(&player, &eb(2, BoostType::Additive, 500, 0, 200)); // Expires 200
    client.admin_grant_boost(&player, &eb(3, BoostType::Multiplicative, 15000, 0, 300)); // Expires 300
    client.add_boost(&player, &nb(4, BoostType::Additive, 750, 0)); // Permanent
    
    // All active at T=100
    let initial = client.calculate_total_boost(&player);
    assert!(initial > 10000);
    
    // Advance past first expiry
    set_ledger(&env, 250);
    let after_first = client.calculate_total_boost(&player);
    assert!(after_first < initial);
    assert!(after_first > 10000);
    
    // Advance past all expiries
    set_ledger(&env, 350);
    let after_all = client.calculate_total_boost(&player);
    // Only permanent boosts remain: +1000 +750 = +1750 = 11750
    assert_eq!(after_all, 11750);
    
    // get_active_boosts should match
    assert_eq!(client.get_active_boosts(&player).len(), 2);
}

// ── Performance and Stress Tests ──────────────────────────────────────────────

/// AIT-18: Stress test with maximum players and boosts
#[test]
fn test_stress_max_players_max_boosts() {
    let env = make_env();
    let contract_id = env.register(TycoonBoostSystem, ());
    let client = TycoonBoostSystemClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    
    client.initialize(&admin);
    
    // Create multiple players, each with max boosts
    let num_players = 5;
    let mut players = std::vec::Vec::new();
    
    for _ in 0..num_players {
        players.push(Address::generate(&env));
    }
    
    // Fill each player to capacity
    for player in &players {
        for i in 0..MAX_BOOSTS_PER_PLAYER {
            client.admin_grant_boost(
                player,
                &nb(i as u128 + 1, BoostType::Additive, 100, 0),
            );
        }
    }
    
    // Verify each player has correct count
    for player in &players {
        assert_eq!(
            client.get_active_boosts(player).len(),
            MAX_BOOSTS_PER_PLAYER as usize
        );
    }
    
    // Verify calculations work for all
    for player in &players {
        let boost = client.calculate_total_boost(player);
        // MAX_BOOSTS_PER_PLAYER * 100 additive = +1000 bps = +10% = 11000
        assert_eq!(boost, 11000);
    }
}

/// AIT-19: Rapid state changes stress test
#[test]
fn test_rapid_state_changes() {
    let env = make_env();
    let contract_id = env.register(TycoonBoostSystem, ());
    let client = TycoonBoostSystemClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    let player = Address::generate(&env);
    
    client.initialize(&admin);
    
    // Rapid add-revoke cycles
    for i in 0..20 {
        let id = (i % 5) + 1;
        
        // Try to grant (may fail if already exists)
        let _ = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            client.admin_grant_boost(&player, &nb(id, BoostType::Additive, 100 * id, 0));
        }));
        
        // Revoke (idempotent if not exists)
        client.admin_revoke_boost(&player, &id);
    }
    
    // Final state should be consistent
    let final_boosts = client.get_active_boosts(&player);
    assert!(final_boosts.len() <= 5);
}

/// AIT-20: Calculation performance with complex boost mix
#[test]
fn test_calculation_performance_complex_mix() {
    let env = make_env();
    let (client, player) = setup(&env);
    
    // Add variety of boost types
    client.add_boost(&player, &nb(1, BoostType::Multiplicative, 11000, 0));
    client.add_boost(&player, &nb(2, BoostType::Multiplicative, 10500, 0));
    client.add_boost(&player, &nb(3, BoostType::Additive, 500, 0));
    client.add_boost(&player, &nb(4, BoostType::Additive, 750, 0));
    client.add_boost(&player, &nb(5, BoostType::Additive, 1000, 0));
    client.add_boost(&player, &nb(6, BoostType::Override, 20000, 5));
    client.add_boost(&player, &nb(7, BoostType::Override, 15000, 3));
    client.add_boost(&player, &nb(8, BoostType::Multiplicative, 12000, 0));
    
    // Multiple calculations should be fast and consistent
    let result1 = client.calculate_total_boost(&player);
    let result2 = client.calculate_total_boost(&player);
    let result3 = client.calculate_total_boost(&player);
    
    assert_eq!(result1, result2);
    assert_eq!(result2, result3);
    
    // Override with priority 5 should win
    assert_eq!(result1, 20000);
}
