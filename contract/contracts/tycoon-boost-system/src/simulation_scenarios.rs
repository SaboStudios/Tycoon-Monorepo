//! SW-CT-027: Simulation scenarios — tycoon-boost-system
//!
//! Realistic game-session scenarios exercising the boost system end-to-end.
//! Each scenario is self-contained with its own Env.
//!
//! | ID     | Scenario |
//! |--------|----------|
//! | SIM-01 | New player receives admin-granted boost; total reflects it |
//! | SIM-02 | Player boost expires mid-session; total falls back to base |
//! | SIM-03 | Admin revokes boost mid-session; total falls back to base |
//! | SIM-04 | Player fills cap, one expires, new boost fits in freed slot |
//! | SIM-05 | Multiple players are isolated; one player's boosts don't affect another |
//! | SIM-06 | Mixed boost types across a full game round produce correct total |
//! | SIM-07 | Admin clears all boosts at end of season; all players reset to base |

#![cfg(test)]
extern crate std;
use super::*;
use soroban_sdk::{
    testutils::{Address as _, Ledger, LedgerInfo},
    Address, Env,
};

fn setup(env: &Env) -> (TycoonBoostSystemClient, Address) {
    let id = env.register(TycoonBoostSystem, ());
    let client = TycoonBoostSystemClient::new(env, &id);
    let admin = Address::generate(env);
    env.mock_all_auths();
    client.initialize(&admin);
    (client, admin)
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

fn nb(id: u128, boost_type: BoostType, value: u32) -> Boost {
    Boost { id, boost_type, value, priority: 0, expires_at_ledger: 0 }
}

fn eb(id: u128, boost_type: BoostType, value: u32, expires: u32) -> Boost {
    Boost { id, boost_type, value, priority: 0, expires_at_ledger: expires }
}

// ── SIM-01 ────────────────────────────────────────────────────────────────────

/// New player receives an admin-granted boost; calculate_total_boost reflects it.
#[test]
fn sim_01_new_player_receives_admin_boost() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _) = setup(&env);
    let player = Address::generate(&env);

    assert_eq!(client.calculate_total_boost(&player), 10000); // base

    client.admin_grant_boost(&player, &nb(1, BoostType::Additive, 2000)); // +20%

    assert_eq!(client.calculate_total_boost(&player), 12000);
}

// ── SIM-02 ────────────────────────────────────────────────────────────────────

/// Boost expires mid-session; total falls back to base at next ledger.
#[test]
fn sim_02_boost_expires_mid_session() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _) = setup(&env);
    let player = Address::generate(&env);

    set_ledger(&env, 100);
    client.admin_grant_boost(&player, &eb(1, BoostType::Additive, 3000, 110)); // expires at 110

    set_ledger(&env, 105);
    assert_eq!(client.calculate_total_boost(&player), 13000); // still active

    set_ledger(&env, 110);
    assert_eq!(client.calculate_total_boost(&player), 10000); // expired
}

// ── SIM-03 ────────────────────────────────────────────────────────────────────

/// Admin revokes a boost mid-session; total falls back to base immediately.
#[test]
fn sim_03_admin_revokes_boost_mid_session() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _) = setup(&env);
    let player = Address::generate(&env);

    client.admin_grant_boost(&player, &nb(1, BoostType::Multiplicative, 15000)); // 1.5x
    assert_eq!(client.calculate_total_boost(&player), 15000);

    client.admin_revoke_boost(&player, &1u128);
    assert_eq!(client.calculate_total_boost(&player), 10000);
}

// ── SIM-04 ────────────────────────────────────────────────────────────────────

/// Player fills cap; one boost expires; new boost fits in the freed slot.
#[test]
fn sim_04_cap_freed_by_expiry_allows_new_boost() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _) = setup(&env);
    let player = Address::generate(&env);

    set_ledger(&env, 50);
    // Fill cap: 9 permanent + 1 expiring at ledger 60
    for i in 0..9u128 {
        client.add_boost(&player, &nb(i, BoostType::Additive, 100));
    }
    client.add_boost(&player, &eb(9, BoostType::Additive, 100, 60));
    assert_eq!(client.get_active_boosts(&player).len(), 10);

    // Advance past expiry — slot freed
    set_ledger(&env, 61);
    // Adding a new boost triggers prune; cap slot is now free
    client.add_boost(&player, &nb(10, BoostType::Additive, 500));
    assert_eq!(client.get_active_boosts(&player).len(), 10); // still 10 (9 perm + 1 new)
}

// ── SIM-05 ────────────────────────────────────────────────────────────────────

/// Multiple players are isolated; boosts on one don't affect another.
#[test]
fn sim_05_multi_player_isolation() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _) = setup(&env);
    let alice = Address::generate(&env);
    let bob = Address::generate(&env);

    client.admin_grant_boost(&alice, &nb(1, BoostType::Additive, 5000));
    client.admin_grant_boost(&bob, &nb(1, BoostType::Multiplicative, 20000));

    assert_eq!(client.calculate_total_boost(&alice), 15000); // base + 50%
    assert_eq!(client.calculate_total_boost(&bob), 20000);   // 2x

    client.admin_revoke_boost(&alice, &1u128);
    assert_eq!(client.calculate_total_boost(&alice), 10000); // reset
    assert_eq!(client.calculate_total_boost(&bob), 20000);   // unchanged
}

// ── SIM-06 ────────────────────────────────────────────────────────────────────

/// Mixed boost types across a full game round produce the correct combined total.
/// Formula: multiplicative_chain × (1 + additive_sum) — override absent.
#[test]
fn sim_06_mixed_boost_full_round() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _) = setup(&env);
    let player = Address::generate(&env);

    // 1.5x multiplicative (15000 bps)
    client.add_boost(&player, &nb(1, BoostType::Multiplicative, 15000));
    // +20% additive (2000 bps)
    client.add_boost(&player, &nb(2, BoostType::Additive, 2000));
    // +10% additive (1000 bps)
    client.add_boost(&player, &nb(3, BoostType::Additive, 1000));

    // Expected: 10000 * 1.5 * (1 + 0.30) = 15000 * 1.30 = 19500
    assert_eq!(client.calculate_total_boost(&player), 19500);
}

// ── SIM-07 ────────────────────────────────────────────────────────────────────

/// End-of-season: admin clears all boosts for every player; all return to base.
#[test]
fn sim_07_end_of_season_clear_all_players() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _) = setup(&env);

    let players: Vec<Address> = (0..4).map(|_| Address::generate(&env)).collect();

    for (i, p) in players.iter().enumerate() {
        client.admin_grant_boost(p, &nb(1, BoostType::Additive, (i as u32 + 1) * 1000));
    }

    // Verify all have boosts
    for p in &players {
        assert!(client.calculate_total_boost(p) > 10000);
    }

    // End-of-season clear
    for p in &players {
        client.clear_boosts(p);
    }

    // All back to base
    for p in &players {
        assert_eq!(client.calculate_total_boost(p), 10000);
    }
}
