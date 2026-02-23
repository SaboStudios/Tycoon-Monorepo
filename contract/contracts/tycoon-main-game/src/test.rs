#![cfg(test)]

use super::*;
use soroban_sdk::{testutils::Address as _, Address, Env};

// -----------------------------------------------------------------------
// Test helpers
// -----------------------------------------------------------------------

/// Registers and initializes a fresh contract, returning the client,
/// owner address, and reward system address.
fn setup_contract(env: &Env) -> (TycoonMainGameClient<'_>, Address, Address) {
    let contract_id = env.register(TycoonMainGame, ());
    let client = TycoonMainGameClient::new(env, &contract_id);

    let owner = Address::generate(env);
    let reward_system = Address::generate(env);

    (client, owner, reward_system)
}

// -----------------------------------------------------------------------
// initialize() tests
// -----------------------------------------------------------------------

#[test]
fn test_initialize_success() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, owner, reward_system) = setup_contract(&env);

    client.initialize(&owner, &reward_system);

    // Verify stored values are retrievable
    assert_eq!(client.get_owner(), owner);
    assert_eq!(client.get_reward_system(), reward_system);
}

#[test]
fn test_initialize_stores_owner() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, owner, reward_system) = setup_contract(&env);
    client.initialize(&owner, &reward_system);

    assert_eq!(client.get_owner(), owner);
}

#[test]
fn test_initialize_stores_reward_system() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, owner, reward_system) = setup_contract(&env);
    client.initialize(&owner, &reward_system);

    assert_eq!(client.get_reward_system(), reward_system);
}

#[test]
#[should_panic(expected = "Contract already initialized")]
fn test_initialize_twice_panics() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, owner, reward_system) = setup_contract(&env);

    client.initialize(&owner, &reward_system);
    // Second call must panic
    client.initialize(&owner, &reward_system);
}

#[test]
fn test_initialize_with_different_owner_and_reward_system() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, _, _) = setup_contract(&env);

    let custom_owner = Address::generate(&env);
    let custom_reward = Address::generate(&env);

    client.initialize(&custom_owner, &custom_reward);

    assert_eq!(client.get_owner(), custom_owner);
    assert_eq!(client.get_reward_system(), custom_reward);
}

// -----------------------------------------------------------------------
// register_player() stub tests
// -----------------------------------------------------------------------

#[test]
fn test_register_player_stub_does_not_panic() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, owner, reward_system) = setup_contract(&env);
    client.initialize(&owner, &reward_system);

    // Stub must be callable without panicking
    client.register_player();
}

#[test]
fn test_register_player_stub_can_be_called_multiple_times() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, owner, reward_system) = setup_contract(&env);
    client.initialize(&owner, &reward_system);

    // Multiple calls should all succeed for now (stub has no duplicate guard yet)
    client.register_player();
    client.register_player();
}

// -----------------------------------------------------------------------
// is_registered() tests
// -----------------------------------------------------------------------

#[test]
fn test_is_registered_returns_false_for_unregistered_address() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, owner, reward_system) = setup_contract(&env);
    client.initialize(&owner, &reward_system);

    let unknown = Address::generate(&env);
    assert!(!client.is_registered(&unknown));
}

// -----------------------------------------------------------------------
// get_owner / get_reward_system before init (panic) tests
// -----------------------------------------------------------------------

#[test]
#[should_panic(expected = "Owner not set")]
fn test_get_owner_before_initialize_panics() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(TycoonMainGame, ());
    let client = TycoonMainGameClient::new(&env, &contract_id);

    client.get_owner();
}

#[test]
#[should_panic(expected = "Reward system not set")]
fn test_get_reward_system_before_initialize_panics() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(TycoonMainGame, ());
    let client = TycoonMainGameClient::new(&env, &contract_id);

    client.get_reward_system();
}
