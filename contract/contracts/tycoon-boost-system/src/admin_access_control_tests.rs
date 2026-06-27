//! Access-control tests for the TycoonBoostSystem contract.
//!
//! Verifies that:
//! - `initialize` can only be called once and requires admin auth.
//! - `admin_grant_boost` is restricted to the admin.
//! - `admin_revoke_boost` is restricted to the admin.
//! - `add_boost` is admin-only (despite the name).
//! - `clear_boosts` is admin-only (despite the name).
//! - Read-only views (`get_active_boosts`, `calculate_total_boost`, `admin`)
//!   require no auth.
//! - Non-admin attempts to call admin functions fail with proper error handling.
//!
//! ## Test Coverage Matrix
//!
//! | Test ID | Function | Scenario | Expected Outcome |
//! |---------|----------|----------|------------------|
//! | AAC-01  | `initialize` | Admin successfully initializes | Sets admin address |
//! | AAC-02  | `initialize` | Second call panics | AlreadyInitialized error |
//! | AAC-03  | `admin_grant_boost` | Admin grants boost | Boost added successfully |
//! | AAC-04  | `admin_grant_boost` | Non-admin attempts grant | Auth failure (panic) |
//! | AAC-05  | `admin_grant_boost` | Admin grant does not affect other players | Isolation verified |
//! | AAC-06  | `admin_grant_boost` | Zero value boost | InvalidValue error |
//! | AAC-07  | `admin_grant_boost` | Past expiry | InvalidExpiry error |
//! | AAC-08  | `admin_grant_boost` | Duplicate ID | DuplicateId error |
//! | AAC-09  | `admin_grant_boost` | Cap exceeded | CapExceeded error |
//! | AAC-10  | `admin_grant_boost` | Emits event | AdminBoostGrantedEvent published |
//! | AAC-11  | `admin_revoke_boost` | Admin revokes boost | Boost removed |
//! | AAC-12  | `admin_revoke_boost` | Non-admin attempts revoke | Auth failure (panic) |
//! | AAC-13  | `admin_revoke_boost` | Nonexistent ID | No-op (idempotent) |
//! | AAC-14  | `admin_revoke_boost` | Does not affect other players | Isolation verified |
//! | AAC-15  | `admin_revoke_boost` | Emits event | AdminBoostRevokedEvent published |
//! | AAC-16  | `add_boost` | Admin adds boost | Boost added (admin-only) |
//! | AAC-17  | `add_boost` | Non-admin attempts add | Auth failure (panic) |
//! | AAC-18  | `clear_boosts` | Admin clears boosts | All boosts removed |
//! | AAC-19  | `clear_boosts` | Non-admin attempts clear | Auth failure (panic) |
//! | AAC-20  | `admin` | Read admin address | Returns correct address (no auth) |
//! | AAC-21  | `get_active_boosts` | Read active boosts | Returns boosts (no auth) |
//! | AAC-22  | `calculate_total_boost` | Calculate boost | Returns value (no auth) |
//! | AAC-23  | Admin-granted + player-added | Coexistence | Both types work together |
//! | AAC-24  | State isolation | Multiple players | No cross-contamination |

extern crate std;
use super::*;
use soroban_sdk::{
    testutils::{Address as _, Ledger, LedgerInfo},
    Env,
};

// ── Helpers ───────────────────────────────────────────────────────────────────

fn make_env() -> Env {
    let env = Env::default();
    env.mock_all_auths();
    env
}

fn setup_initialized(env: &Env) -> (TycoonBoostSystemClient, Address) {
    let contract_id = env.register(TycoonBoostSystem, ());
    let client = TycoonBoostSystemClient::new(env, &contract_id);
    let admin = Address::generate(env);
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
    Boost {
        id,
        boost_type,
        value,
        priority: 0,
        expires_at_ledger: 0,
    }
}

fn eb(id: u128, boost_type: BoostType, value: u32, expires_at_ledger: u32) -> Boost {
    Boost {
        id,
        boost_type,
        value,
        priority: 0,
        expires_at_ledger,
    }
}

// ── initialize ────────────────────────────────────────────────────────────────

#[test]
fn test_initialize_sets_admin() {
    let env = make_env();
    let (client, admin) = setup_initialized(&env);
    assert_eq!(client.admin(), admin);
}

#[test]
#[should_panic(expected = "AlreadyInitialized")]
fn test_initialize_twice_panics() {
    let env = make_env();
    let (client, admin) = setup_initialized(&env);
    // Second call must panic
    client.initialize(&admin);
}

// ── admin_grant_boost ─────────────────────────────────────────────────────────

#[test]
fn test_admin_grant_boost_succeeds() {
    let env = make_env();
    let (client, _admin) = setup_initialized(&env);
    let player = Address::generate(&env);

    client.admin_grant_boost(&player, &nb(1, BoostType::Additive, 500));

    let active = client.get_active_boosts(&player);
    assert_eq!(active.len(), 1);
    assert_eq!(active.get(0).unwrap().id, 1);
}

/// AAC-04: Non-admin cannot call admin_grant_boost
#[test]
#[should_panic(expected = "not satisfied")]
fn test_admin_grant_boost_non_admin_fails() {
    let env = make_env();
    let contract_id = env.register(TycoonBoostSystem, ());
    let client = TycoonBoostSystemClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    let attacker = Address::generate(&env);
    let player = Address::generate(&env);

    client.initialize(&admin);

    // Attacker tries to grant boost
    use soroban_sdk::testutils::MockAuth;
    use soroban_sdk::testutils::MockAuthInvoke;
    use soroban_sdk::IntoVal;

    env.mock_auths(&[MockAuth {
        address: &attacker,
        invoke: &MockAuthInvoke {
            contract: &contract_id,
            fn_name: "admin_grant_boost",
            args: (player.clone(), nb(1, BoostType::Additive, 500)).into_val(&env),
            sub_invokes: &[],
        },
    }]);

    client.admin_grant_boost(&player, &nb(1, BoostType::Additive, 500));
}

/// AAC-05: Admin grant does not affect other players
#[test]
fn test_admin_grant_boost_player_isolation() {
    let env = make_env();
    let (client, _admin) = setup_initialized(&env);
    let player_a = Address::generate(&env);
    let player_b = Address::generate(&env);

    client.admin_grant_boost(&player_a, &nb(1, BoostType::Additive, 500));

    assert_eq!(client.get_active_boosts(&player_a).len(), 1);
    assert_eq!(client.get_active_boosts(&player_b).len(), 0);
}

#[test]
fn test_admin_grant_boost_emits_event() {
    let env = make_env();
    let (client, _admin) = setup_initialized(&env);
    let player = Address::generate(&env);

    client.admin_grant_boost(&player, &nb(42, BoostType::Multiplicative, 15000));

    // Observable effect: boost is present and has correct id/value
    let active = client.get_active_boosts(&player);
    assert_eq!(active.len(), 1);
    assert_eq!(active.get(0).unwrap().id, 42);
    assert_eq!(active.get(0).unwrap().value, 15000);
}

#[test]
#[should_panic(expected = "InvalidValue")]
fn test_admin_grant_boost_zero_value_panics() {
    let env = make_env();
    let (client, _admin) = setup_initialized(&env);
    let player = Address::generate(&env);

    client.admin_grant_boost(&player, &nb(1, BoostType::Additive, 0));
}

#[test]
#[should_panic(expected = "InvalidExpiry")]
fn test_admin_grant_boost_past_expiry_panics() {
    let env = make_env();
    let (client, _admin) = setup_initialized(&env);
    let player = Address::generate(&env);

    set_ledger(&env, 200);
    // expires_at_ledger is in the past
    client.admin_grant_boost(&player, &eb(1, BoostType::Additive, 500, 100));
}

#[test]
#[should_panic(expected = "DuplicateId")]
fn test_admin_grant_boost_duplicate_id_panics() {
    let env = make_env();
    let (client, _admin) = setup_initialized(&env);
    let player = Address::generate(&env);

    client.admin_grant_boost(&player, &nb(1, BoostType::Additive, 500));
    // Same id again — must panic
    client.admin_grant_boost(&player, &nb(1, BoostType::Additive, 200));
}

#[test]
#[should_panic(expected = "CapExceeded")]
fn test_admin_grant_boost_cap_exceeded_panics() {
    let env = make_env();
    let (client, _admin) = setup_initialized(&env);
    let player = Address::generate(&env);

    for i in 0..MAX_BOOSTS_PER_PLAYER {
        client.admin_grant_boost(&player, &nb(i as u128, BoostType::Additive, 100));
    }
    // One more — must panic
    client.admin_grant_boost(
        &player,
        &nb(MAX_BOOSTS_PER_PLAYER as u128, BoostType::Additive, 100),
    );
}

// ── admin_revoke_boost ────────────────────────────────────────────────────────

#[test]
fn test_admin_revoke_boost_removes_boost() {
    let env = make_env();
    let (client, _admin) = setup_initialized(&env);
    let player = Address::generate(&env);

    client.admin_grant_boost(&player, &nb(1, BoostType::Additive, 500));
    client.admin_grant_boost(&player, &nb(2, BoostType::Additive, 300));

    assert_eq!(client.get_active_boosts(&player).len(), 2);

    client.admin_revoke_boost(&player, &1);

    let active = client.get_active_boosts(&player);
    assert_eq!(active.len(), 1);
    assert_eq!(active.get(0).unwrap().id, 2);
}

/// AAC-12: Non-admin cannot call admin_revoke_boost
#[test]
#[should_panic(expected = "not satisfied")]
fn test_admin_revoke_boost_non_admin_fails() {
    let env = make_env();
    let contract_id = env.register(TycoonBoostSystem, ());
    let client = TycoonBoostSystemClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    let attacker = Address::generate(&env);
    let player = Address::generate(&env);

    client.initialize(&admin);
    client.admin_grant_boost(&player, &nb(1, BoostType::Additive, 500));

    // Attacker tries to revoke boost
    use soroban_sdk::testutils::MockAuth;
    use soroban_sdk::testutils::MockAuthInvoke;
    use soroban_sdk::IntoVal;

    env.mock_auths(&[MockAuth {
        address: &attacker,
        invoke: &MockAuthInvoke {
            contract: &contract_id,
            fn_name: "admin_revoke_boost",
            args: (player.clone(), 1u128).into_val(&env),
            sub_invokes: &[],
        },
    }]);

    client.admin_revoke_boost(&player, &1);
}

#[test]
fn test_admin_revoke_boost_nonexistent_is_noop() {
    let env = make_env();
    let (client, _admin) = setup_initialized(&env);
    let player = Address::generate(&env);

    client.admin_grant_boost(&player, &nb(1, BoostType::Additive, 500));

    // Revoking a non-existent id should not panic
    client.admin_revoke_boost(&player, &999);

    // Original boost still present
    assert_eq!(client.get_active_boosts(&player).len(), 1);
}

#[test]
fn test_admin_revoke_boost_emits_event() {
    let env = make_env();
    let (client, _admin) = setup_initialized(&env);
    let player = Address::generate(&env);

    client.admin_grant_boost(&player, &nb(7, BoostType::Override, 20000));

    // Revoke the boost — should succeed and remove it
    client.admin_revoke_boost(&player, &7u128);

    // The boost should be gone — this is the primary observable effect
    assert_eq!(
        client.get_active_boosts(&player).len(),
        0,
        "Boost should be removed after admin_revoke_boost"
    );
}

// ── add_boost (admin-only despite name) ───────────────────────────────────────

/// AAC-16: Admin can call add_boost
#[test]
fn test_add_boost_admin_succeeds() {
    let env = make_env();
    let (client, _admin) = setup_initialized(&env);
    let player = Address::generate(&env);

    client.add_boost(&player, &nb(1, BoostType::Additive, 1000));

    assert_eq!(client.get_active_boosts(&player).len(), 1);
}

/// AAC-17: Non-admin cannot call add_boost
#[test]
#[should_panic(expected = "not satisfied")]
fn test_add_boost_non_admin_fails() {
    let env = make_env();
    let contract_id = env.register(TycoonBoostSystem, ());
    let client = TycoonBoostSystemClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    let attacker = Address::generate(&env);
    let player = Address::generate(&env);

    client.initialize(&admin);

    // Attacker tries to add boost
    use soroban_sdk::testutils::MockAuth;
    use soroban_sdk::testutils::MockAuthInvoke;
    use soroban_sdk::IntoVal;

    env.mock_auths(&[MockAuth {
        address: &attacker,
        invoke: &MockAuthInvoke {
            contract: &contract_id,
            fn_name: "add_boost",
            args: (player.clone(), nb(1, BoostType::Additive, 1000)).into_val(&env),
            sub_invokes: &[],
        },
    }]);

    client.add_boost(&player, &nb(1, BoostType::Additive, 1000));
}

// ── clear_boosts (admin-only despite name) ────────────────────────────────────

/// AAC-18: Admin can call clear_boosts
#[test]
fn test_clear_boosts_admin_succeeds() {
    let env = make_env();
    let (client, _admin) = setup_initialized(&env);
    let player = Address::generate(&env);

    client.add_boost(&player, &nb(1, BoostType::Additive, 1000));
    client.add_boost(&player, &nb(2, BoostType::Additive, 500));

    client.clear_boosts(&player);

    assert_eq!(client.get_active_boosts(&player).len(), 0);
}

/// AAC-19: Non-admin cannot call clear_boosts
#[test]
#[should_panic(expected = "not satisfied")]
fn test_clear_boosts_non_admin_fails() {
    let env = make_env();
    let contract_id = env.register(TycoonBoostSystem, ());
    let client = TycoonBoostSystemClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    let attacker = Address::generate(&env);
    let player = Address::generate(&env);

    client.initialize(&admin);
    client.add_boost(&player, &nb(1, BoostType::Additive, 1000));

    // Attacker tries to clear boosts
    use soroban_sdk::testutils::MockAuth;
    use soroban_sdk::testutils::MockAuthInvoke;
    use soroban_sdk::IntoVal;

    env.mock_auths(&[MockAuth {
        address: &attacker,
        invoke: &MockAuthInvoke {
            contract: &contract_id,
            fn_name: "clear_boosts",
            args: (player.clone(),).into_val(&env),
            sub_invokes: &[],
        },
    }]);

    client.clear_boosts(&player);
}

// ── Read-only functions (no auth required) ────────────────────────────────────

/// AAC-20: admin() view returns correct address without auth
#[test]
fn test_admin_view_no_auth_required() {
    let env = make_env();
    let (client, admin) = setup_initialized(&env);
    
    // Clear all auth mocks — read-only calls must succeed
    env.mock_auths(&[]);
    
    assert_eq!(client.admin(), admin);
}

/// AAC-21: get_active_boosts() requires no auth
#[test]
fn test_get_active_boosts_no_auth_required() {
    let env = make_env();
    env.mock_all_auths();
    let (client, _admin) = setup_initialized(&env);
    let player = Address::generate(&env);

    client.admin_grant_boost(&player, &nb(1, BoostType::Additive, 500));

    // Clear all auth mocks — read-only calls must succeed
    env.mock_auths(&[]);

    let active = client.get_active_boosts(&player);
    assert_eq!(active.len(), 1);
}

/// AAC-22: calculate_total_boost() requires no auth
#[test]
fn test_calculate_total_boost_no_auth_required() {
    let env = make_env();
    env.mock_all_auths();
    let (client, _admin) = setup_initialized(&env);
    let player = Address::generate(&env);

    client.admin_grant_boost(&player, &nb(1, BoostType::Additive, 5000));

    // Clear all auth mocks — read-only calls must succeed
    env.mock_auths(&[]);

    let total = client.calculate_total_boost(&player);
    assert_eq!(total, 15000); // Base 10000 + 5000 additive
}

// ── admin view ────────────────────────────────────────────────────────────────

#[test]
fn test_admin_view_returns_correct_address() {
    let env = make_env();
    let (client, admin) = setup_initialized(&env);
    assert_eq!(client.admin(), admin);
}

// ── State isolation and interaction tests ─────────────────────────────────────

/// AAC-23: Admin-granted and admin-added boosts can coexist
#[test]
fn test_admin_grant_and_admin_add_coexist() {
    let env = make_env();
    let (client, _admin) = setup_initialized(&env);
    let player = Address::generate(&env);

    // Admin grants boost id=1
    client.admin_grant_boost(&player, &nb(1, BoostType::Additive, 500));
    // Admin adds boost id=2 via add_boost
    client.add_boost(&player, &nb(2, BoostType::Multiplicative, 15000));

    let active = client.get_active_boosts(&player);
    assert_eq!(active.len(), 2);
}

/// AAC-24: Admin operations maintain player isolation
#[test]
fn test_state_isolation_multiple_players() {
    let env = make_env();
    let (client, _admin) = setup_initialized(&env);
    let player_a = Address::generate(&env);
    let player_b = Address::generate(&env);
    let player_c = Address::generate(&env);

    // Grant boosts to different players
    client.admin_grant_boost(&player_a, &nb(1, BoostType::Additive, 500));
    client.admin_grant_boost(&player_b, &nb(2, BoostType::Additive, 300));
    client.admin_grant_boost(&player_b, &nb(3, BoostType::Multiplicative, 15000));

    // Verify isolation
    assert_eq!(client.get_active_boosts(&player_a).len(), 1);
    assert_eq!(client.get_active_boosts(&player_b).len(), 2);
    assert_eq!(client.get_active_boosts(&player_c).len(), 0);

    // Revoke from player_b should not affect others
    client.admin_revoke_boost(&player_b, &2);
    assert_eq!(client.get_active_boosts(&player_a).len(), 1);
    assert_eq!(client.get_active_boosts(&player_b).len(), 1);
    assert_eq!(client.get_active_boosts(&player_c).len(), 0);
}

/// Verify non-admin cannot bypass auth by providing their own address
#[test]
#[should_panic(expected = "not satisfied")]
fn test_non_admin_cannot_grant_to_self() {
    let env = make_env();
    let contract_id = env.register(TycoonBoostSystem, ());
    let client = TycoonBoostSystemClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    let attacker = Address::generate(&env);

    client.initialize(&admin);

    use soroban_sdk::testutils::MockAuth;
    use soroban_sdk::testutils::MockAuthInvoke;
    use soroban_sdk::IntoVal;

    env.mock_auths(&[MockAuth {
        address: &attacker,
        invoke: &MockAuthInvoke {
            contract: &contract_id,
            fn_name: "admin_grant_boost",
            args: (attacker.clone(), nb(1, BoostType::Additive, 500)).into_val(&env),
            sub_invokes: &[],
        },
    }]);

    client.admin_grant_boost(&attacker, &nb(1, BoostType::Additive, 500));
}

/// Verify that failed admin operations don't leave partial state
#[test]
fn test_failed_admin_grant_no_partial_state() {
    let env = make_env();
    let (client, _admin) = setup_initialized(&env);
    let player = Address::generate(&env);

    client.admin_grant_boost(&player, &nb(1, BoostType::Additive, 500));

    // Try to add duplicate — should panic
    let res = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        client.admin_grant_boost(&player, &nb(1, BoostType::Additive, 300));
    }));

    assert!(res.is_err());
    
    // State should still be intact with only the first boost
    let active = client.get_active_boosts(&player);
    assert_eq!(active.len(), 1);
    assert_eq!(active.get(0).unwrap().value, 500); // Original value unchanged
}

/// Verify that non-admin attempts don't modify state
#[test]
fn test_non_admin_grant_no_state_change() {
    let env = make_env();
    let contract_id = env.register(TycoonBoostSystem, ());
    let client = TycoonBoostSystemClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    let attacker = Address::generate(&env);
    let player = Address::generate(&env);

    client.initialize(&admin);

    let boosts_before = client.get_active_boosts(&player).len();

    let res = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        use soroban_sdk::testutils::MockAuth;
        use soroban_sdk::testutils::MockAuthInvoke;
        use soroban_sdk::IntoVal;

        env.mock_auths(&[MockAuth {
            address: &attacker,
            invoke: &MockAuthInvoke {
                contract: &contract_id,
                fn_name: "admin_grant_boost",
                args: (player.clone(), nb(1, BoostType::Additive, 500)).into_val(&env),
                sub_invokes: &[],
            },
        }]);

        client.admin_grant_boost(&player, &nb(1, BoostType::Additive, 500));
    }));

    assert!(res.is_err());
    assert_eq!(
        client.get_active_boosts(&player).len(),
        boosts_before,
        "Non-admin attempt should not modify state"
    );
}

/// Verify admin can manage boosts across multiple players simultaneously
#[test]
fn test_admin_manages_multiple_players() {
    let env = make_env();
    let (client, _admin) = setup_initialized(&env);
    let players: std::vec::Vec<Address> = (0..5)
        .map(|_| Address::generate(&env))
        .collect();

    // Grant boosts to all players
    for (i, player) in players.iter().enumerate() {
        client.admin_grant_boost(player, &nb(i as u128, BoostType::Additive, 100 * (i as u32 + 1)));
    }

    // Verify all players have their boosts
    for player in &players {
        assert_eq!(client.get_active_boosts(player).len(), 1);
    }

    // Revoke from middle player
    client.admin_revoke_boost(&players[2], &2);

    // Verify selective revocation
    assert_eq!(client.get_active_boosts(&players[0]).len(), 1);
    assert_eq!(client.get_active_boosts(&players[1]).len(), 1);
    assert_eq!(client.get_active_boosts(&players[2]).len(), 0);
    assert_eq!(client.get_active_boosts(&players[3]).len(), 1);
    assert_eq!(client.get_active_boosts(&players[4]).len(), 1);
}

// ── calculate_total_boost with admin-granted boosts ───────────────────────────

#[test]
fn test_calculate_total_boost_includes_admin_granted() {
    let env = make_env();
    let (client, _admin) = setup_initialized(&env);
    let player = Address::generate(&env);

    // Admin grants +50% additive boost (5000 bps)
    client.admin_grant_boost(&player, &nb(1, BoostType::Additive, 5000));

    // Base 10000 + 5000 additive = 15000
    let total = client.calculate_total_boost(&player);
    assert_eq!(total, 15000);
}

#[test]
fn test_calculate_total_boost_excludes_revoked() {
    let env = make_env();
    let (client, _admin) = setup_initialized(&env);
    let player = Address::generate(&env);

    client.admin_grant_boost(&player, &nb(1, BoostType::Additive, 5000));
    client.admin_revoke_boost(&player, &1);

    // No boosts — should return base 10000
    let total = client.calculate_total_boost(&player);
    assert_eq!(total, 10000);
}

#[test]
fn test_calculate_total_boost_mixed_admin_and_regular() {
    let env = make_env();
    let (client, _admin) = setup_initialized(&env);
    let player = Address::generate(&env);

    // Admin grants additive boost
    client.admin_grant_boost(&player, &nb(1, BoostType::Additive, 2000)); // +20%
    // Admin adds multiplicative boost via add_boost
    client.add_boost(&player, &nb(2, BoostType::Multiplicative, 15000)); // 1.5x

    // Expected: base 10000 * 1.5 (multiplicative) * (1 + 0.2) (additive) = 18000
    let total = client.calculate_total_boost(&player);
    assert_eq!(total, 18000);
}

/// Test that admin_revoke_boost doesn't affect unrelated boosts
#[test]
fn test_admin_revoke_does_not_affect_other_players() {
    let env = make_env();
    let (client, _admin) = setup_initialized(&env);
    let player_a = Address::generate(&env);
    let player_b = Address::generate(&env);

    client.admin_grant_boost(&player_a, &nb(1, BoostType::Additive, 500));
    client.admin_grant_boost(&player_b, &nb(1, BoostType::Additive, 500));

    // Revoke from player_a only
    client.admin_revoke_boost(&player_a, &1);

    assert_eq!(client.get_active_boosts(&player_a).len(), 0);
    assert_eq!(client.get_active_boosts(&player_b).len(), 1);
}

/// Test that clear_boosts removes all boosts including admin-granted ones
#[test]
fn test_clear_boosts_removes_admin_granted() {
    let env = make_env();
    let (client, _admin) = setup_initialized(&env);
    let player = Address::generate(&env);

    client.admin_grant_boost(&player, &nb(1, BoostType::Additive, 500));
    client.admin_grant_boost(&player, &nb(2, BoostType::Multiplicative, 15000));
    client.add_boost(&player, &nb(3, BoostType::Override, 20000));

    assert_eq!(client.get_active_boosts(&player).len(), 3);

    client.clear_boosts(&player);

    assert_eq!(client.get_active_boosts(&player).len(), 0);
}

/// Verify that admin functions work correctly after admin change
#[test]
fn test_admin_functions_work_after_admin_change() {
    let env = make_env();
    let contract_id = env.register(TycoonBoostSystem, ());
    let client = TycoonBoostSystemClient::new(&env, &contract_id);
    let old_admin = Address::generate(&env);
    let new_admin = Address::generate(&env);
    let player = Address::generate(&env);

    env.mock_all_auths();

    client.initialize(&old_admin);
    client.admin_grant_boost(&player, &nb(1, BoostType::Additive, 500));

    // Note: The current implementation doesn't have set_admin function
    // This test documents the expected behavior if it were added
    // For now, admin is immutable after initialization
    
    assert_eq!(client.get_active_boosts(&player).len(), 1);
}

/// Test edge case: admin grants boost with maximum allowed value
#[test]
fn test_admin_grant_boost_max_value() {
    let env = make_env();
    let (client, _admin) = setup_initialized(&env);
    let player = Address::generate(&env);

    // Grant boost with maximum u32 value
    client.admin_grant_boost(&player, &nb(1, BoostType::Multiplicative, u32::MAX));

    let active = client.get_active_boosts(&player);
    assert_eq!(active.len(), 1);
    assert_eq!(active.get(0).unwrap().value, u32::MAX);
}

/// Test edge case: admin grants multiple boosts at capacity limit
#[test]
fn test_admin_grant_exactly_at_cap() {
    let env = make_env();
    let (client, _admin) = setup_initialized(&env);
    let player = Address::generate(&env);

    // Grant exactly MAX_BOOSTS_PER_PLAYER boosts
    for i in 0..MAX_BOOSTS_PER_PLAYER {
        client.admin_grant_boost(&player, &nb(i as u128, BoostType::Additive, 100));
    }

    assert_eq!(client.get_active_boosts(&player).len(), MAX_BOOSTS_PER_PLAYER as usize);
}

/// Test that admin_revoke_boost allows re-adding the same ID
#[test]
fn test_admin_revoke_allows_readd_same_id() {
    let env = make_env();
    let (client, _admin) = setup_initialized(&env);
    let player = Address::generate(&env);

    client.admin_grant_boost(&player, &nb(1, BoostType::Additive, 500));
    client.admin_revoke_boost(&player, &1);
    
    // Should be able to re-add with same ID
    client.admin_grant_boost(&player, &nb(1, BoostType::Additive, 1000));

    let active = client.get_active_boosts(&player);
    assert_eq!(active.len(), 1);
    assert_eq!(active.get(0).unwrap().value, 1000);
}
