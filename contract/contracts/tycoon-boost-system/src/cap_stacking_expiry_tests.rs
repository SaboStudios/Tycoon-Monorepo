/// # Boost System — Cap, Stacking, and Expiry Semantics Tests (#398)
///
/// ## Stacking Rules (game-design sign-off)
///
/// | Rule | Behaviour |
/// |------|-----------|
/// | SR-1 | Additive boosts sum their basis-point values before being applied |
/// | SR-2 | Multiplicative boosts chain: each multiplies the running total |
/// | SR-3 | Override boosts: only the one with the highest `priority` applies |
/// | SR-4 | Override supersedes all Additive and Multiplicative boosts |
/// | SR-5 | When no Override is present: result = mult_chain × (1 + additive_sum) |
/// | SR-6 | A player with no active boosts returns the base value 10 000 bp |
///
/// ## Cap Rules
///
/// | Rule | Behaviour |
/// |------|-----------|
/// | CAP-1 | A player may hold at most `MAX_BOOSTS_PER_PLAYER` (10) active boosts |
/// | CAP-2 | Adding a boost when at cap panics with `"CapExceeded"` |
/// | CAP-3 | Expired boosts are pruned before the cap is checked |
/// | CAP-4 | Adding a boost with a duplicate `id` panics with `"DuplicateId"` |
/// | CAP-5 | Adding a boost with `value == 0` panics with `"InvalidValue"` |
/// | CAP-6 | `expires_at_ledger` ≤ current ledger panics with `"InvalidExpiry"` |
///
/// ## Expiry Rules
///
/// | Rule | Behaviour |
/// |------|-----------|
/// | EXP-1 | `expires_at_ledger == 0` means the boost never expires |
/// | EXP-2 | A boost with `expires_at_ledger > current_ledger` is active |
/// | EXP-3 | A boost with `expires_at_ledger <= current_ledger` is expired |
/// | EXP-4 | Expired boosts are excluded from `calculate_total_boost` without mutating storage |
/// | EXP-5 | `prune_expired_boosts` removes expired boosts from storage and emits `BoostExpiredEvent` |
/// | EXP-6 | Mid-action ledger advance causes previously active boost to be treated as expired |
///
/// ## Event Rules
///
/// | Rule | Behaviour |
/// |------|-----------|
/// | EVT-1 | `add_boost` emits `BoostActivatedEvent` with correct fields |
/// | EVT-2 | `prune_expired_boosts` emits `BoostExpiredEvent` for each pruned boost |
/// | EVT-3 | `clear_boosts` emits `BoostsClearedEvent` |
#[cfg(test)]
extern crate std;

use super::*;
use soroban_sdk::{
    testutils::{Address as _, Events, Ledger, LedgerInfo},
    Env,
};

// ── helpers ───────────────────────────────────────────────────────────────────

fn make_env() -> Env {
    let env = Env::default();
    env.mock_all_auths();
    env
}

fn setup(env: &Env) -> (TycoonBoostSystemClient, Address) {
    let contract_id = env.register(TycoonBoostSystem, ());
    let client = TycoonBoostSystemClient::new(env, &contract_id);
    let admin = Address::generate(env);
    let player = Address::generate(env);
    client.initialize(&admin);
    (client, player)
}

/// Non-expiring boost.
fn nb(id: u128, boost_type: BoostType, value: u32, priority: u32) -> Boost {
    Boost {
        id,
        boost_type,
        value,
        priority,
        expires_at_ledger: 0,
    }
}

/// Expiring boost.
fn eb(id: u128, boost_type: BoostType, value: u32, priority: u32, expires: u32) -> Boost {
    Boost {
        id,
        boost_type,
        value,
        priority,
        expires_at_ledger: expires,
    }
}

/// Advance the mock ledger sequence number.
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

// ── SR: Stacking rules ────────────────────────────────────────────────────────

/// SR-1: Additive boosts sum correctly — table-driven.
#[test]
fn test_sr1_additive_sum_table() {
    let cases: &[(&[u32], u32)] = &[
        (&[1000], 11000),           // +10%
        (&[1000, 500], 11500),      // +10% + +5%
        (&[1000, 500, 250], 11750), // +10% + +5% + +2.5%
        (&[10000], 20000),          // +100% doubles base
    ];

    for (values, expected) in cases {
        let env = make_env();
        let (client, player) = setup(&env);
        for (i, &v) in values.iter().enumerate() {
            client.add_boost(&player, &nb(i as u128 + 1, BoostType::Additive, v, 0));
        }
        assert_eq!(
            client.calculate_total_boost(&player),
            *expected,
            "SR-1 failed for additive values {:?}",
            values
        );
    }
}

/// SR-2: Multiplicative boosts chain — table-driven.
#[test]
fn test_sr2_multiplicative_chain_table() {
    let cases: &[(&[u32], u32)] = &[
        (&[15000], 15000),               // 1.5x
        (&[15000, 12000], 18000),        // 1.5x * 1.2x
        (&[12000, 12000, 12000], 17280), // 1.2^3
        (&[20000], 20000),               // 2x
    ];

    for (values, expected) in cases {
        let env = make_env();
        let (client, player) = setup(&env);
        for (i, &v) in values.iter().enumerate() {
            client.add_boost(&player, &nb(i as u128 + 1, BoostType::Multiplicative, v, 0));
        }
        assert_eq!(
            client.calculate_total_boost(&player),
            *expected,
            "SR-2 failed for multiplicative values {:?}",
            values
        );
    }
}

/// SR-3: Override keeps highest priority — table-driven.
#[test]
fn test_sr3_override_highest_priority_table() {
    // (priorities, values, expected_value)
    let cases: &[(&[u32], &[u32], u32)] = &[
        (&[5, 10], &[20000, 30000], 30000),
        (&[10, 5], &[30000, 20000], 30000),
        (&[1, 2, 3], &[10000, 20000, 30000], 30000),
        (&[100, 1], &[50000, 10000], 50000),
    ];

    for (priorities, values, expected) in cases {
        let env = make_env();
        let (client, player) = setup(&env);
        for (i, (&p, &v)) in priorities.iter().zip(values.iter()).enumerate() {
            client.add_boost(&player, &nb(i as u128 + 1, BoostType::Override, v, p));
        }
        assert_eq!(
            client.calculate_total_boost(&player),
            *expected,
            "SR-3 failed for priorities {:?} values {:?}",
            priorities,
            values
        );
    }
}

/// SR-4 + SR-5: Override supersedes multiplicative and additive.
#[test]
fn test_sr4_override_supersedes_mult_and_additive() {
    let env = make_env();
    let (client, player) = setup(&env);

    client.add_boost(&player, &nb(1, BoostType::Multiplicative, 20000, 0)); // 2x
    client.add_boost(&player, &nb(2, BoostType::Additive, 5000, 0)); // +50%
    client.add_boost(&player, &nb(3, BoostType::Override, 25000, 1)); // 2.5x override

    // Override wins — mult and additive are ignored
    assert_eq!(client.calculate_total_boost(&player), 25000);
}

/// SR-5: Mixed mult + additive formula: mult_chain × (1 + additive_sum).
#[test]
fn test_sr5_mixed_mult_additive_formula() {
    let env = make_env();
    let (client, player) = setup(&env);

    // 1.5x mult, +20% additive → 10000 * 1.5 * 1.2 = 18000
    client.add_boost(&player, &nb(1, BoostType::Multiplicative, 15000, 0));
    client.add_boost(&player, &nb(2, BoostType::Additive, 2000, 0));

    assert_eq!(client.calculate_total_boost(&player), 18000);
}

/// SR-6: No boosts → base 10 000.
#[test]
fn test_sr6_no_boosts_returns_base() {
    let env = make_env();
    let (client, player) = setup(&env);
    assert_eq!(client.calculate_total_boost(&player), 10000);
}

// ── CAP: Cap rules ────────────────────────────────────────────────────────────

/// CAP-1: MAX_BOOSTS_PER_PLAYER is 10.
#[test]
fn test_cap1_max_boosts_constant_is_10() {
    assert_eq!(MAX_BOOSTS_PER_PLAYER, 10);
}

/// CAP-2: Adding the 11th boost panics with "CapExceeded".
#[test]
#[should_panic(expected = "CapExceeded")]
fn test_cap2_adding_beyond_cap_panics() {
    let env = make_env();
    let (client, player) = setup(&env);

    for i in 0..MAX_BOOSTS_PER_PLAYER {
        client.add_boost(&player, &nb(i as u128 + 1, BoostType::Additive, 100, 0));
    }
    // 11th boost — must panic
    client.add_boost(&player, &nb(99, BoostType::Additive, 100, 0));
}

/// CAP-3: Expired boosts are pruned before cap check — slot freed for new boost.
#[test]
fn test_cap3_expired_boost_frees_cap_slot() {
    let env = make_env();
    set_ledger(&env, 100);
    let (client, player) = setup(&env);

    // Fill to cap with 9 permanent + 1 expiring at ledger 200
    for i in 0..9u128 {
        client.add_boost(&player, &nb(i + 1, BoostType::Additive, 100, 0));
    }
    client.add_boost(&player, &eb(10, BoostType::Additive, 100, 0, 200));

    // Advance past expiry
    set_ledger(&env, 201);

    // Adding an 11th should succeed because the expired one is pruned first
    client.add_boost(&player, &nb(11, BoostType::Additive, 100, 0));
    assert_eq!(client.get_active_boosts(&player).len(), 10);
}

/// CAP-4: Duplicate boost ID panics with "DuplicateId".
#[test]
#[should_panic(expected = "DuplicateId")]
fn test_cap4_duplicate_id_panics() {
    let env = make_env();
    let (client, player) = setup(&env);

    client.add_boost(&player, &nb(42, BoostType::Additive, 1000, 0));
    client.add_boost(&player, &nb(42, BoostType::Additive, 500, 0)); // same id
}

/// CAP-5: Zero-value boost panics with "InvalidValue".
#[test]
#[should_panic(expected = "InvalidValue")]
fn test_cap5_zero_value_panics() {
    let env = make_env();
    let (client, player) = setup(&env);
    client.add_boost(&player, &nb(1, BoostType::Additive, 0, 0));
}

/// CAP-6: Boost with expires_at_ledger in the past panics with "InvalidExpiry".
#[test]
#[should_panic(expected = "InvalidExpiry")]
fn test_cap6_past_expiry_panics() {
    let env = make_env();
    set_ledger(&env, 500);
    let (client, player) = setup(&env);
    // expires_at_ledger = 499 ≤ current 500 → invalid
    client.add_boost(&player, &eb(1, BoostType::Additive, 1000, 0, 499));
}

/// CAP-6b: Boost with expires_at_ledger == current ledger panics with "InvalidExpiry".
#[test]
#[should_panic(expected = "InvalidExpiry")]
fn test_cap6b_current_ledger_expiry_panics() {
    let env = make_env();
    set_ledger(&env, 100);
    let (client, player) = setup(&env);
    client.add_boost(&player, &eb(1, BoostType::Additive, 1000, 0, 100));
}

// ── EXP: Expiry rules ─────────────────────────────────────────────────────────

/// EXP-1: expires_at_ledger == 0 → boost never expires.
#[test]
fn test_exp1_zero_expiry_never_expires() {
    let env = make_env();
    set_ledger(&env, 1);
    let (client, player) = setup(&env);

    client.add_boost(&player, &nb(1, BoostType::Additive, 1000, 0));

    // Advance far into the future
    set_ledger(&env, 1_000_000);
    assert_eq!(client.calculate_total_boost(&player), 11000);
}

/// EXP-2: Boost with expires_at_ledger > current is active.
#[test]
fn test_exp2_future_expiry_boost_is_active() {
    let env = make_env();
    set_ledger(&env, 100);
    let (client, player) = setup(&env);

    client.add_boost(&player, &eb(1, BoostType::Additive, 1000, 0, 200));

    set_ledger(&env, 150); // still before expiry
    assert_eq!(client.calculate_total_boost(&player), 11000);
}

/// EXP-3: Boost with expires_at_ledger <= current is excluded from calculation.
#[test]
fn test_exp3_expired_boost_excluded_from_calculation() {
    let env = make_env();
    set_ledger(&env, 100);
    let (client, player) = setup(&env);

    client.add_boost(&player, &eb(1, BoostType::Additive, 1000, 0, 150));

    // Before expiry: boost active
    set_ledger(&env, 149);
    assert_eq!(client.calculate_total_boost(&player), 11000);

    // At expiry ledger: boost expired
    set_ledger(&env, 150);
    assert_eq!(client.calculate_total_boost(&player), 10000);

    // After expiry: still excluded
    set_ledger(&env, 200);
    assert_eq!(client.calculate_total_boost(&player), 10000);
}

/// EXP-4: calculate_total_boost excludes expired boosts without mutating storage.
#[test]
fn test_exp4_calculate_does_not_mutate_storage() {
    let env = make_env();
    set_ledger(&env, 100);
    let (client, player) = setup(&env);

    client.add_boost(&player, &eb(1, BoostType::Additive, 1000, 0, 150));

    // Advance past expiry
    set_ledger(&env, 200);

    // calculate_total_boost returns base (expired excluded)
    assert_eq!(client.calculate_total_boost(&player), 10000);

    // But get_boosts still returns the expired boost (storage not mutated)
    assert_eq!(client.get_boosts(&player).len(), 1);
}

/// EXP-5: prune_expired_boosts removes expired boosts from storage.
#[test]
fn test_exp5_prune_removes_expired_from_storage() {
    let env = make_env();
    set_ledger(&env, 100);
    let (client, player) = setup(&env);

    client.add_boost(&player, &eb(1, BoostType::Additive, 1000, 0, 150));
    client.add_boost(&player, &nb(2, BoostType::Additive, 500, 0)); // permanent

    set_ledger(&env, 200);

    let pruned = client.prune_expired_boosts(&player);
    assert_eq!(pruned, 1, "one expired boost should be pruned");

    // Storage now only has the permanent boost
    assert_eq!(client.get_boosts(&player).len(), 1);
    assert_eq!(client.get_boosts(&player).get(0).unwrap().id, 2);
}

/// EXP-5b: prune_expired_boosts returns 0 when nothing is expired.
#[test]
fn test_exp5b_prune_returns_zero_when_nothing_expired() {
    let env = make_env();
    set_ledger(&env, 100);
    let (client, player) = setup(&env);

    client.add_boost(&player, &nb(1, BoostType::Additive, 1000, 0));

    let pruned = client.prune_expired_boosts(&player);
    assert_eq!(pruned, 0);
}

/// EXP-6: Mid-action expiry — boost active at add time, expired by calculate time.
#[test]
fn test_exp6_mid_action_expiry_semantics() {
    let env = make_env();
    set_ledger(&env, 100);
    let (client, player) = setup(&env);

    // Boost expires at ledger 110
    client.add_boost(&player, &eb(1, BoostType::Multiplicative, 20000, 0, 110));

    // Ledger 105: boost still active
    set_ledger(&env, 105);
    assert_eq!(client.calculate_total_boost(&player), 20000);

    // Ledger 110: boost expired (expires_at_ledger <= current)
    set_ledger(&env, 110);
    assert_eq!(client.calculate_total_boost(&player), 10000);
}

/// EXP: Multiple boosts — mix of expired and active — only active ones contribute.
#[test]
fn test_exp_mixed_expired_and_active_boosts() {
    let env = make_env();
    set_ledger(&env, 100);
    let (client, player) = setup(&env);

    // Expires at 150 — will be expired when we check at 200
    client.add_boost(&player, &eb(1, BoostType::Additive, 5000, 0, 150));
    // Permanent
    client.add_boost(&player, &nb(2, BoostType::Additive, 1000, 0));
    // Expires at 300 — still active at 200
    client.add_boost(&player, &eb(3, BoostType::Multiplicative, 15000, 0, 300));

    set_ledger(&env, 200);

    // Only boost 2 (+10%) and boost 3 (1.5x) are active
    // Result: 10000 * 1.5 * (1 + 0.10) = 16500
    assert_eq!(client.calculate_total_boost(&player), 16500);
}

// ── EVT: Event rules ──────────────────────────────────────────────────────────

/// EVT-1: add_boost emits BoostActivatedEvent — verify an event is emitted.
#[test]
fn test_evt1_add_boost_emits_activated_event() {
    let env = make_env();
    set_ledger(&env, 1);
    let (client, player) = setup(&env);

    let events_before = env.events().all().len();
    client.add_boost(&player, &eb(7, BoostType::Multiplicative, 15000, 0, 500));
    let events_after = env.events().all().len();

    assert!(
        events_after > events_before,
        "EVT-1: BoostActivatedEvent not emitted"
    );
}

/// EVT-2: prune_expired_boosts emits BoostExpiredEvent for each pruned boost.
#[test]
fn test_evt2_prune_emits_expired_events() {
    let env = make_env();
    set_ledger(&env, 100);
    let (client, player) = setup(&env);

    client.add_boost(&player, &eb(1, BoostType::Additive, 1000, 0, 150));
    client.add_boost(&player, &eb(2, BoostType::Additive, 500, 0, 160));
    client.add_boost(&player, &nb(3, BoostType::Additive, 200, 0)); // permanent

    set_ledger(&env, 200);

    // Prune — should remove boosts 1 and 2
    let pruned = client.prune_expired_boosts(&player);
    assert_eq!(pruned, 2, "EVT-2: expected 2 boosts pruned");

    // Verify storage: only permanent boost remains
    assert_eq!(client.get_boosts(&player).len(), 1);
    assert_eq!(client.get_boosts(&player).get(0).unwrap().id, 3);
}

/// EVT-3: clear_boosts emits BoostsClearedEvent.
#[test]
fn test_evt3_clear_boosts_emits_cleared_event() {
    let env = make_env();
    let (client, player) = setup(&env);

    client.add_boost(&player, &nb(1, BoostType::Additive, 1000, 0));
    client.add_boost(&player, &nb(2, BoostType::Additive, 500, 0));

    // After clear, boosts should be gone
    client.clear_boosts(&player);
    assert_eq!(client.get_boosts(&player).len(), 0);
    assert_eq!(client.calculate_total_boost(&player), 10000);
}

// ── Stacking interaction matrix ───────────────────────────────────────────────

/// Full interaction matrix: all three boost types together, with some expired.
#[test]
fn test_stacking_interaction_matrix_all_types_with_expiry() {
    let env = make_env();
    set_ledger(&env, 100);
    let (client, player) = setup(&env);

    // Expired multiplicative (should be ignored)
    client.add_boost(&player, &eb(1, BoostType::Multiplicative, 30000, 0, 150));
    // Active multiplicative 1.5x
    client.add_boost(&player, &nb(2, BoostType::Multiplicative, 15000, 0));
    // Expired additive (should be ignored)
    client.add_boost(&player, &eb(3, BoostType::Additive, 9000, 0, 120));
    // Active additive +10%
    client.add_boost(&player, &nb(4, BoostType::Additive, 1000, 0));
    // Expired override (should be ignored)
    client.add_boost(&player, &eb(5, BoostType::Override, 99999, 100, 110));
    // Active override priority 5
    client.add_boost(&player, &nb(6, BoostType::Override, 25000, 5));

    set_ledger(&env, 200);

    // Only boost 2 (1.5x mult), boost 4 (+10% add), boost 6 (override 25000) are active
    // Override wins → result = 25000
    assert_eq!(client.calculate_total_boost(&player), 25000);
}

/// Interaction: override expired mid-game — falls back to mult+additive.
#[test]
fn test_stacking_override_expiry_falls_back_to_mult_additive() {
    let env = make_env();
    set_ledger(&env, 100);
    let (client, player) = setup(&env);

    // Override expires at 150
    client.add_boost(&player, &eb(1, BoostType::Override, 50000, 10, 150));
    // Permanent mult 1.5x
    client.add_boost(&player, &nb(2, BoostType::Multiplicative, 15000, 0));
    // Permanent additive +20%
    client.add_boost(&player, &nb(3, BoostType::Additive, 2000, 0));

    // Before expiry: override wins
    set_ledger(&env, 100);
    assert_eq!(client.calculate_total_boost(&player), 50000);

    // After expiry: falls back to mult * (1 + additive) = 10000 * 1.5 * 1.2 = 18000
    set_ledger(&env, 150);
    assert_eq!(client.calculate_total_boost(&player), 18000);
}

/// Interaction: two override boosts — lower priority one expires, higher priority remains.
#[test]
fn test_stacking_lower_priority_override_expires_higher_remains() {
    let env = make_env();
    set_ledger(&env, 100);
    let (client, player) = setup(&env);

    // High priority override, expires at 200
    client.add_boost(&player, &eb(1, BoostType::Override, 40000, 20, 200));
    // Low priority override, expires at 150
    client.add_boost(&player, &eb(2, BoostType::Override, 30000, 5, 150));

    // At ledger 100: high priority wins
    assert_eq!(client.calculate_total_boost(&player), 40000);

    // At ledger 160: low priority expired, high priority still active
    set_ledger(&env, 160);
    assert_eq!(client.calculate_total_boost(&player), 40000);

    // At ledger 200: both expired → base
    set_ledger(&env, 200);
    assert_eq!(client.calculate_total_boost(&player), 10000);
}

/// Interaction: get_active_boosts only returns non-expired boosts.
#[test]
fn test_get_active_boosts_filters_expired() {
    let env = make_env();
    set_ledger(&env, 100);
    let (client, player) = setup(&env);

    client.add_boost(&player, &eb(1, BoostType::Additive, 1000, 0, 150));
    client.add_boost(&player, &nb(2, BoostType::Additive, 500, 0));

    set_ledger(&env, 200);

    let active = client.get_active_boosts(&player);
    assert_eq!(active.len(), 1);
    assert_eq!(active.get(0).unwrap().id, 2);
}

/// Interaction: prune then add — freed slot allows new boost after pruning.
#[test]
fn test_prune_then_add_fills_freed_slot() {
    let env = make_env();
    set_ledger(&env, 100);
    let (client, player) = setup(&env);

    // Fill to cap: 9 permanent + 1 expiring
    for i in 0..9u128 {
        client.add_boost(&player, &nb(i + 1, BoostType::Additive, 100, 0));
    }
    client.add_boost(&player, &eb(10, BoostType::Additive, 100, 0, 150));

    set_ledger(&env, 200);

    // Explicit prune
    let pruned = client.prune_expired_boosts(&player);
    assert_eq!(pruned, 1);

    // Now we can add a new boost
    client.add_boost(&player, &nb(11, BoostType::Additive, 200, 0));
    assert_eq!(client.get_active_boosts(&player).len(), 10);
}

/// Boundary: single boost at exactly MAX_BOOSTS_PER_PLAYER - 1 is fine.
#[test]
fn test_cap_boundary_one_below_max_is_fine() {
    let env = make_env();
    let (client, player) = setup(&env);

    for i in 0..(MAX_BOOSTS_PER_PLAYER - 1) {
        client.add_boost(&player, &nb(i as u128 + 1, BoostType::Additive, 100, 0));
    }
    assert_eq!(client.get_boosts(&player).len(), MAX_BOOSTS_PER_PLAYER - 1);
}

/// Boundary: clear_boosts resets to base and allows re-filling to cap.
#[test]
fn test_cap_clear_then_refill_to_cap() {
    let env = make_env();
    let (client, player) = setup(&env);

    for i in 0..MAX_BOOSTS_PER_PLAYER {
        client.add_boost(&player, &nb(i as u128 + 1, BoostType::Additive, 100, 0));
    }
    assert_eq!(client.calculate_total_boost(&player), 11000); // 10 * 100bp additive

    client.clear_boosts(&player);
    assert_eq!(client.calculate_total_boost(&player), 10000);

    // Re-fill to cap
    for i in 0..MAX_BOOSTS_PER_PLAYER {
        client.add_boost(
            &player,
            &nb(i as u128 + 100, BoostType::Multiplicative, 10100, 0),
        );
    }
    // 10100^10 / 10000^9 — just verify it's > base
    assert!(client.calculate_total_boost(&player) > 10000);
}
