#![cfg(test)]

use crate::{TycoonMainGame, TycoonMainGameClient};
use soroban_sdk::{
    testutils::{Address as _, Ledger},
    Address, Env, Symbol,
};

fn create_admin(env: &Env) -> Address {
    Address::generate(env)
}

fn create_user(env: &Env) -> Address {
    Address::generate(env)
}

// ============================================================
// Initialization Tests
// ============================================================

#[test]
fn test_initialize_contract() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = create_admin(&env);
    let contract_id = env.register_contract(None, TycoonMainGame);
    let client = TycoonMainGameClient::new(&env, &contract_id);
    client.initialize(&admin, &None, &0);

    assert_eq!(client.get_admin(), admin);
    assert!(!client.is_paused());
}

#[test]
#[should_panic(expected = "Contract already initialized")]
fn test_initialize_twice_panics() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = create_admin(&env);
    let contract_id = env.register_contract(None, TycoonMainGame);
    let client = TycoonMainGameClient::new(&env, &contract_id);
    client.initialize(&admin, &None, &0);
    client.initialize(&admin, &None, &0);
}

// ============================================================
// Pause Tests - Admin Authorization
// ============================================================

#[test]
fn test_admin_can_pause() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = create_admin(&env);
    let contract_id = env.register_contract(None, TycoonMainGame);
    let client = TycoonMainGameClient::new(&env, &contract_id);
    client.initialize(&admin, &None, &0);

    let reason = Symbol::new(&env, "SEC");
    client.pause(&admin, &reason, &1000);

    assert!(client.is_paused());
}

#[test]
#[should_panic(expected = "Contract is already paused")]
fn test_pause_twice_panics() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = create_admin(&env);
    let contract_id = env.register_contract(None, TycoonMainGame);
    let client = TycoonMainGameClient::new(&env, &contract_id);
    client.initialize(&admin, &None, &0);

    let reason = Symbol::new(&env, "SEC");
    client.pause(&admin, &reason, &1000);
    client.pause(&admin, &reason, &1000);
}

// ============================================================
// Unpause Tests
// ============================================================

#[test]
fn test_admin_can_unpause() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = create_admin(&env);
    let contract_id = env.register_contract(None, TycoonMainGame);
    let client = TycoonMainGameClient::new(&env, &contract_id);
    client.initialize(&admin, &None, &0);

    let reason = Symbol::new(&env, "SEC");
    client.pause(&admin, &reason, &1000);
    assert!(client.is_paused());

    client.unpause(&admin);
    assert!(!client.is_paused());
}

#[test]
#[should_panic(expected = "Contract is not paused")]
fn test_unpause_when_not_paused_panics() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = create_admin(&env);
    let contract_id = env.register_contract(None, TycoonMainGame);
    let client = TycoonMainGameClient::new(&env, &contract_id);
    client.initialize(&admin, &None, &0);

    client.unpause(&admin);
}

// ============================================================
// Unauthorized Access Tests
// ============================================================

#[test]
#[should_panic(expected = "Unauthorized")]
fn test_unauthorized_user_cannot_pause() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = create_admin(&env);
    let user = create_user(&env);
    let contract_id = env.register_contract(None, TycoonMainGame);
    let client = TycoonMainGameClient::new(&env, &contract_id);
    client.initialize(&admin, &None, &0);

    let reason = Symbol::new(&env, "SEC");
    client.pause(&user, &reason, &1000);
}

#[test]
#[should_panic(expected = "Unauthorized")]
fn test_unauthorized_user_cannot_unpause() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = create_admin(&env);
    let user = create_user(&env);
    let contract_id = env.register_contract(None, TycoonMainGame);
    let client = TycoonMainGameClient::new(&env, &contract_id);
    client.initialize(&admin, &None, &0);

    let reason = Symbol::new(&env, "SEC");
    client.pause(&admin, &reason, &1000);
    client.unpause(&user);
}

// ============================================================
// Guarded Operations Tests - Core Acceptance Criteria
// ============================================================

#[test]
#[should_panic(expected = "blocked")]
fn test_user_calls_blocked_while_paused() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = create_admin(&env);
    let user = create_user(&env);
    let contract_id = env.register_contract(None, TycoonMainGame);
    let client = TycoonMainGameClient::new(&env, &contract_id);
    client.initialize(&admin, &None, &0);

    // Admin pauses
    let reason = Symbol::new(&env, "SEC");
    client.pause(&admin, &reason, &1000);

    // User call should be blocked
    client.register_player(&user);
}

#[test]
fn test_admin_unpause_restores_functionality() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = create_admin(&env);
    let user = create_user(&env);
    let contract_id = env.register_contract(None, TycoonMainGame);
    let client = TycoonMainGameClient::new(&env, &contract_id);
    client.initialize(&admin, &None, &0);

    // Pause
    let reason = Symbol::new(&env, "SEC");
    client.pause(&admin, &reason, &1000);

    // Unpause
    client.unpause(&admin);

    // User call should now work
    client.register_player(&user);
}

// ============================================================
// Pause Expiry Tests
// ============================================================

#[test]
fn test_auto_unpause_on_expiry() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = create_admin(&env);
    let contract_id = env.register_contract(None, TycoonMainGame);
    let client = TycoonMainGameClient::new(&env, &contract_id);
    client.initialize(&admin, &None, &0);

    let reason = Symbol::new(&env, "MAINT");
    client.pause(&admin, &reason, &10);

    assert!(client.is_paused());

    env.ledger().with_mut(|li| {
        li.sequence_number += 15;
    });

    assert!(!client.is_paused());
}

// ============================================================
// Multisig Tests
// ============================================================

#[test]
fn test_multisig_signer_can_pause() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = create_admin(&env);
    let signer1 = create_user(&env);

    let contract_id = env.register_contract(None, TycoonMainGame);
    let client = TycoonMainGameClient::new(&env, &contract_id);
    client.initialize(&admin, &Some(signer1.clone()), &1);

    let reason = Symbol::new(&env, "SEC");
    client.pause(&signer1, &reason, &1000);

    assert!(client.is_paused());
}

#[test]
fn test_multisig_signer_can_unpause() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = create_admin(&env);
    let signer1 = create_user(&env);

    let contract_id = env.register_contract(None, TycoonMainGame);
    let client = TycoonMainGameClient::new(&env, &contract_id);
    client.initialize(&admin, &Some(signer1.clone()), &1);

    let reason = Symbol::new(&env, "SEC");
    client.pause(&admin, &reason, &1000);
    client.unpause(&signer1);

    assert!(!client.is_paused());
}
