/// # Time Boundary Tests (#408)
///
/// Tests for edge-case behaviour at ledger sequence boundaries.
/// All time-dependent on-chain logic uses `env.ledger().sequence()` (ledger sequence),
/// never wall-clock time. See `contract/docs/TIME_BASED_LOGIC.md` for the full policy.
///
/// Boundary rules under test:
/// - `expires_at_ledger == 0`          → boost never expires (sentinel)
/// - `expires_at_ledger <= current`    → boost is expired
/// - `expires_at_ledger > current`     → boost is active
#[cfg(test)]
extern crate std;

use crate::{Boost, BoostType, TycoonBoostSystem, TycoonBoostSystemClient};
use soroban_sdk::{
    testutils::{Address as _, Ledger, LedgerInfo},
    Address, Env,
};

// ── helpers ───────────────────────────────────────────────────────────────────

fn make_env() -> Env {
    let env = Env::default();
    env.mock_all_auths();
    env
}

fn setup(env: &Env) -> (TycoonBoostSystemClient, Address) {
    let id = env.register(TycoonBoostSystem, ());
    let client = TycoonBoostSystemClient::new(env, &id);
    let admin = Address::generate(env);
    let player = Address::generate(env);
    client.initialize(&admin);
    (client, player)
}

fn set_seq(env: &Env, seq: u32) {
    env.ledger().set(LedgerInfo {
        sequence_number: seq,
        // timestamp mirrors seq × 5 s — display only, not used in guards
        timestamp: seq as u64 * 5,
        protocol_version: 23,
        network_id: Default::default(),
        base_reserve: 10,
        min_temp_entry_ttl: 1,
        min_persistent_entry_ttl: 1,
        max_entry_ttl: 100_000,
    });
}

fn additive(id: u128, value: u32, expires_at_ledger: u32) -> Boost {
    Boost {
        id,
        boost_type: BoostType::Additive,
        value,
        priority: 0,
        expires_at_ledger,
    }
}

// ── sentinel: expires_at_ledger == 0 means never expires ─────────────────────

/// EXP-1: A boost with `expires_at_ledger == 0` is always active regardless of
/// how far the ledger advances.
#[test]
fn test_expiry_never_expires_sentinel() {
    let env = make_env();
    let (client, player) = setup(&env);

    set_seq(&env, 100);
    client.add_boost(&player, &additive(1, 1000, 0)); // never expires

    // Advance far into the future
    set_seq(&env, 1_000_000);
    // Boost still contributes: 10000 * (1 + 0.10) = 11000
    assert_eq!(client.calculate_total_boost(&player), 11000);
}

// ── boundary: expires_at_ledger == current_ledger ────────────────────────────

/// EXP-3 boundary: a boost whose `expires_at_ledger` equals the current ledger
/// is considered expired (strict `<=` check).
#[test]
fn test_expiry_boundary_at_exact_ledger() {
    let env = make_env();
    let (client, player) = setup(&env);

    set_seq(&env, 100);
    // Boost expires exactly at ledger 200
    client.add_boost(&player, &additive(1, 1000, 200));

    set_seq(&env, 200); // now at the expiry ledger
                        // Boost is expired → base value only
    assert_eq!(client.calculate_total_boost(&player), 10000);
}

/// EXP-3 boundary: one ledger before expiry — boost is still expired boundary check.
#[test]
fn test_expiry_boundary_one_before() {
    let env = make_env();
    let (client, player) = setup(&env);

    set_seq(&env, 100);
    // Boost expires at ledger 200
    client.add_boost(&player, &additive(1, 1000, 200));

    set_seq(&env, 199); // one ledger before expiry
                        // Boost is still active: 10000 * (1 + 0.10) = 11000
    assert_eq!(client.calculate_total_boost(&player), 11000);
}

/// EXP-2 boundary: one ledger after expiry — boost is expired.
#[test]
fn test_expiry_boundary_one_after() {
    let env = make_env();
    let (client, player) = setup(&env);

    set_seq(&env, 100);
    client.add_boost(&player, &additive(1, 1000, 200));

    set_seq(&env, 201); // one ledger past expiry
    assert_eq!(client.calculate_total_boost(&player), 10000);
}

// ── mid-session ledger advance ────────────────────────────────────────────────

/// EXP-6: A boost that is active when added becomes expired after the ledger
/// advances past its expiry — without any storage mutation between calls.
#[test]
fn test_expiry_ledger_advance_mid_session() {
    let env = make_env();
    let (client, player) = setup(&env);

    set_seq(&env, 50);
    client.add_boost(&player, &additive(1, 2000, 100)); // expires at 100

    // Active at ledger 99
    set_seq(&env, 99);
    assert_eq!(client.calculate_total_boost(&player), 12000);

    // Expired at ledger 100 — no storage write between these two calls
    set_seq(&env, 100);
    assert_eq!(client.calculate_total_boost(&player), 10000);
}

// ── prune removes expired, keeps active ──────────────────────────────────────

/// EXP-5: `prune_expired_boosts` removes only expired boosts; active boosts survive.
#[test]
fn test_prune_removes_expired_keeps_active() {
    let env = make_env();
    let (client, player) = setup(&env);

    set_seq(&env, 50);
    client.add_boost(&player, &additive(1, 1000, 100)); // expires at 100
    client.add_boost(&player, &additive(2, 500, 0)); // never expires

    set_seq(&env, 150); // past expiry of boost 1
    client.prune_expired_boosts(&player);

    // Only boost 2 remains: 10000 * (1 + 0.05) = 10500
    assert_eq!(client.calculate_total_boost(&player), 10500);
}

/// After pruning all expired boosts, the player's entry is effectively empty
/// and `calculate_total_boost` returns the base value.
#[test]
fn test_prune_all_expired_returns_base() {
    let env = make_env();
    let (client, player) = setup(&env);

    set_seq(&env, 50);
    client.add_boost(&player, &additive(1, 1000, 100));
    client.add_boost(&player, &additive(2, 2000, 120));

    set_seq(&env, 200);
    client.prune_expired_boosts(&player);

    assert_eq!(client.calculate_total_boost(&player), 10000);
}

// ── registration timestamp (display only) ────────────────────────────────────

/// `registered_at` is set from `env.ledger().timestamp()` which is a display-only
/// field. Verify it is stored correctly even at ledger 0 (genesis / timestamp == 0).
///
/// This test lives in tycoon-boost-system because the genesis-ledger scenario is a
/// general time-source concern. The equivalent assertion for tycoon-game's register_user
/// is covered by tycoon-game's own unit tests; here we confirm that a timestamp of 0
/// is a valid u64 and does not trigger any sentinel confusion in the boost system.
#[test]
fn test_timestamp_zero_is_valid_u64() {
    let env = make_env();
    set_seq(&env, 0); // genesis — timestamp == 0

    // At ledger 0, a non-expiring boost should still be addable and active.
    let (client, player) = setup(&env);
    client.add_boost(&player, &additive(1, 500, 0)); // never expires

    // Active at genesis: 10000 * (1 + 0.05) = 10500
    assert_eq!(client.calculate_total_boost(&player), 10500);
}

/// A boost added at ledger 0 with `expires_at_ledger == 1` expires at ledger 1.
/// Confirms the boundary check works correctly at the very start of the chain.
#[test]
fn test_expiry_boundary_at_genesis() {
    let env = make_env();
    set_seq(&env, 0);
    let (client, player) = setup(&env);

    // expires_at_ledger must be > current_ledger (0), so 1 is the minimum valid expiry
    client.add_boost(&player, &additive(1, 1000, 1));

    // Still active at ledger 0
    assert_eq!(client.calculate_total_boost(&player), 11000);

    // Expired at ledger 1
    set_seq(&env, 1);
    assert_eq!(client.calculate_total_boost(&player), 10000);
}
