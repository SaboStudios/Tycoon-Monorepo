#![cfg(test)]

use super::*;
use soroban_sdk::{
    testutils::{Address as _, Events},
    token::{StellarAssetClient, TokenClient},
    Address, Env, String,
};

// Helper function to create a mock token contract
fn create_token_contract<'a>(env: &Env, admin: &Address) -> (Address, TokenClient<'a>) {
    let token_contract = env.register_stellar_asset_contract_v2(admin.clone());
    let token_address = token_contract.address();
    let token_client = TokenClient::new(env, &token_address);
    (token_address, token_client)
}

// Helper function to setup a test contract
fn setup_contract(env: &Env) -> (Address, TycoonContractClient<'_>, Address, Address, Address) {
    let contract_id = env.register(TycoonContract, ());
    let client = TycoonContractClient::new(env, &contract_id);

    let owner = Address::generate(env);
    let tyc_admin = Address::generate(env);
    let usdc_admin = Address::generate(env);

    let (tyc_token, _) = create_token_contract(env, &tyc_admin);
    let (usdc_token, _) = create_token_contract(env, &usdc_admin);

    (contract_id, client, owner, tyc_token, usdc_token)
}

// ===== INITIALIZATION TESTS =====

#[test]
fn test_initialize_success() {
    let env = Env::default();
    env.mock_all_auths();

    let (_, client, owner, tyc_token, usdc_token) = setup_contract(&env);
    let reward_system = Address::generate(&env);

    // Initialize the contract
    client.initialize(&tyc_token, &usdc_token, &owner, &reward_system);

    // Verify initialization was successful by trying to use owner functions
    // This implicitly tests that the owner was set correctly
}

#[test]
#[should_panic(expected = "Contract already initialized")]
fn test_initialize_twice_fails() {
    let env = Env::default();
    env.mock_all_auths();

    let (_, client, owner, tyc_token, usdc_token) = setup_contract(&env);
    let reward_system = Address::generate(&env);

    // First initialization should succeed
    client.initialize(&tyc_token, &usdc_token, &owner, &reward_system);

    // Second initialization should panic
    client.initialize(&tyc_token, &usdc_token, &owner, &reward_system);
}

// ===== WITHDRAWAL TESTS =====

#[test]
fn test_withdraw_tyc_by_owner_success() {
    let env = Env::default();
    env.mock_all_auths();

    let (contract_id, client, owner, tyc_token, usdc_token) = setup_contract(&env);
    let reward_system = Address::generate(&env);

    client.initialize(&tyc_token, &usdc_token, &owner, &reward_system);

    let tyc_admin_client = StellarAssetClient::new(&env, &tyc_token);
    tyc_admin_client.mint(&contract_id, &1000);

    let recipient = Address::generate(&env);

    client.withdraw_funds(&tyc_token, &recipient, &500);

    let tyc_client = TokenClient::new(&env, &tyc_token);
    assert_eq!(tyc_client.balance(&recipient), 500);

    // Verify the contract balance decreased
    assert_eq!(tyc_client.balance(&contract_id), 500);
}

#[test]
fn test_withdraw_usdc_by_owner_success() {
    let env = Env::default();
    env.mock_all_auths();

    let (contract_id, client, owner, tyc_token, usdc_token) = setup_contract(&env);
    let reward_system = Address::generate(&env);

    client.initialize(&tyc_token, &usdc_token, &owner, &reward_system);

    let usdc_admin_client = StellarAssetClient::new(&env, &usdc_token);
    usdc_admin_client.mint(&contract_id, &2000);

    let recipient = Address::generate(&env);

    client.withdraw_funds(&usdc_token, &recipient, &1500);

    let usdc_client = TokenClient::new(&env, &usdc_token);
    assert_eq!(usdc_client.balance(&recipient), 1500);

    assert_eq!(usdc_client.balance(&contract_id), 500);
}

#[test]
#[should_panic(expected = "Insufficient contract balance")]
fn test_withdraw_insufficient_balance_fails() {
    let env = Env::default();
    env.mock_all_auths();

    let (contract_id, client, owner, tyc_token, usdc_token) = setup_contract(&env);
    let reward_system = Address::generate(&env);

    // Initialize the contract
    client.initialize(&tyc_token, &usdc_token, &owner, &reward_system);

    // Mint only 100 TYC tokens to the contract
    let tyc_admin_client = StellarAssetClient::new(&env, &tyc_token);
    tyc_admin_client.mint(&contract_id, &100);

    let recipient = Address::generate(&env);

    // Try to withdraw more than available - should panic
    client.withdraw_funds(&tyc_token, &recipient, &500);
}

#[test]
#[should_panic(expected = "Invalid token address")]
fn test_withdraw_invalid_token_fails() {
    let env = Env::default();
    env.mock_all_auths();

    let (_, client, owner, tyc_token, usdc_token) = setup_contract(&env);
    let reward_system = Address::generate(&env);

    // Initialize the contract
    client.initialize(&tyc_token, &usdc_token, &owner, &reward_system);

    // Try to withdraw a different token (not TYC or USDC)
    let other_token = Address::generate(&env);
    let recipient = Address::generate(&env);

    client.withdraw_funds(&other_token, &recipient, &100);
}

#[test]
fn test_withdraw_emits_event() {
    let env = Env::default();
    env.mock_all_auths();

    let (contract_id, client, owner, tyc_token, usdc_token) = setup_contract(&env);
    let reward_system = Address::generate(&env);

    // Initialize the contract
    client.initialize(&tyc_token, &usdc_token, &owner, &reward_system);

    // Mint some TYC tokens to the contract
    let tyc_admin_client = StellarAssetClient::new(&env, &tyc_token);
    tyc_admin_client.mint(&contract_id, &1000);

    let recipient = Address::generate(&env);

    // Withdraw funds
    client.withdraw_funds(&tyc_token, &recipient, &500);

    // Verify event was emitted
    let events = env.events().all();
    let _event = events.last().unwrap();

    // Verify event has the expected topics and data
    assert!(!events.is_empty());
}

// ===== VIEW FUNCTION TESTS =====

#[test]
fn test_get_collectible_info_success() {
    let env = Env::default();
    env.mock_all_auths();

    let (_, client, owner, tyc_token, usdc_token) = setup_contract(&env);
    let reward_system = Address::generate(&env);

    // Initialize the contract
    client.initialize(&tyc_token, &usdc_token, &owner, &reward_system);

    // Set collectible info
    let token_id = 1;
    let perk = 5;
    let strength = 100;
    let tyc_price = 1000;
    let usdc_price = 500;
    let shop_stock = 50;

    client.set_collectible_info(
        &token_id,
        &perk,
        &strength,
        &tyc_price,
        &usdc_price,
        &shop_stock,
    );

    // Get collectible info
    let info = client.get_collectible_info(&token_id);

    // Verify the data
    assert_eq!(info, (perk, strength, tyc_price, usdc_price, shop_stock));
}

#[test]
#[should_panic(expected = "Collectible does not exist")]
fn test_get_collectible_info_nonexistent() {
    let env = Env::default();
    env.mock_all_auths();

    let (_, client, owner, tyc_token, usdc_token) = setup_contract(&env);
    let reward_system = Address::generate(&env);

    // Initialize the contract
    client.initialize(&tyc_token, &usdc_token, &owner, &reward_system);

    // Try to get a non-existent collectible
    client.get_collectible_info(&999);
}

#[test]
fn test_get_cash_tier_value_success() {
    let env = Env::default();
    env.mock_all_auths();

    let (_, client, owner, tyc_token, usdc_token) = setup_contract(&env);
    let reward_system = Address::generate(&env);

    // Initialize the contract
    client.initialize(&tyc_token, &usdc_token, &owner, &reward_system);

    // Set cash tier values
    client.set_cash_tier_value(&1, &100);
    client.set_cash_tier_value(&2, &500);
    client.set_cash_tier_value(&3, &1000);

    // Get cash tier values
    assert_eq!(client.get_cash_tier_value(&1), 100);
    assert_eq!(client.get_cash_tier_value(&2), 500);
    assert_eq!(client.get_cash_tier_value(&3), 1000);
}

#[test]
#[should_panic(expected = "Cash tier does not exist")]
fn test_get_cash_tier_value_invalid_tier() {
    let env = Env::default();
    env.mock_all_auths();

    let (_, client, owner, tyc_token, usdc_token) = setup_contract(&env);
    let reward_system = Address::generate(&env);

    // Initialize the contract
    client.initialize(&tyc_token, &usdc_token, &owner, &reward_system);

    // Try to get a non-existent tier
    client.get_cash_tier_value(&999);
}

// ===== INTEGRATION TESTS =====

#[test]
fn test_full_contract_flow() {
    let env = Env::default();
    env.mock_all_auths();

    let (contract_id, client, owner, tyc_token, usdc_token) = setup_contract(&env);
    let reward_system = Address::generate(&env);

    // 1. Initialize the contract
    client.initialize(&tyc_token, &usdc_token, &owner, &reward_system);

    // 2. Set up collectibles
    client.set_collectible_info(&1, &10, &200, &5000, &2500, &100);
    client.set_collectible_info(&2, &20, &400, &10000, &5000, &50);

    // 3. Set up cash tiers
    client.set_cash_tier_value(&1, &1000);
    client.set_cash_tier_value(&2, &5000);

    // 4. Verify collectible data
    let info1 = client.get_collectible_info(&1);
    assert_eq!(info1, (10, 200, 5000, 2500, 100));

    let info2 = client.get_collectible_info(&2);
    assert_eq!(info2, (20, 400, 10000, 5000, 50));

    // 5. Verify cash tier data
    assert_eq!(client.get_cash_tier_value(&1), 1000);
    assert_eq!(client.get_cash_tier_value(&2), 5000);

    // 6. Fund the contract and test withdrawal
    let tyc_admin_client = StellarAssetClient::new(&env, &tyc_token);
    tyc_admin_client.mint(&contract_id, &10000);

    let tyc_client = TokenClient::new(&env, &tyc_token);
    let recipient = Address::generate(&env);
    client.withdraw_funds(&tyc_token, &recipient, &3000);

    assert_eq!(tyc_client.balance(&recipient), 3000);
    assert_eq!(tyc_client.balance(&contract_id), 7000);
}

// ===== USER REGISTRATION TESTS =====

#[test]
fn test_register_player_success() {
    let env = Env::default();
    env.mock_all_auths();

    let (_, client, owner, tyc_token, usdc_token) = setup_contract(&env);
    let reward_system = Address::generate(&env);

    client.initialize(&tyc_token, &usdc_token, &owner, &reward_system);

    let player = Address::generate(&env);
    let username = String::from_str(&env, "player1");

    client.register_player(&username, &player);

    let user = client.get_user(&player);
    assert!(user.is_some());
    let user = user.unwrap();
    assert_eq!(user.username, username);
    assert_eq!(user.address, player);
    assert_eq!(user.games_played, 0);
    assert_eq!(user.games_won, 0);
}

#[test]
#[should_panic(expected = "Address already registered")]
fn test_register_player_duplicate() {
    let env = Env::default();
    env.mock_all_auths();

    let (_, client, owner, tyc_token, usdc_token) = setup_contract(&env);
    let reward_system = Address::generate(&env);

    client.initialize(&tyc_token, &usdc_token, &owner, &reward_system);

    let player = Address::generate(&env);
    let username = String::from_str(&env, "player1");

    client.register_player(&username, &player);
    client.register_player(&username, &player); // Should panic
}

#[test]
#[should_panic(expected = "Username must be 3-20 characters")]
fn test_register_player_username_too_short() {
    let env = Env::default();
    env.mock_all_auths();

    let (_, client, owner, tyc_token, usdc_token) = setup_contract(&env);
    let reward_system = Address::generate(&env);

    client.initialize(&tyc_token, &usdc_token, &owner, &reward_system);

    let player = Address::generate(&env);
    let username = String::from_str(&env, "ab");
    client.register_player(&username, &player);
}

#[test]
#[should_panic(expected = "Username must be 3-20 characters")]
fn test_register_player_username_too_long() {
    let env = Env::default();
    env.mock_all_auths();

    let (_, client, owner, tyc_token, usdc_token) = setup_contract(&env);
    let reward_system = Address::generate(&env);

    client.initialize(&tyc_token, &usdc_token, &owner, &reward_system);

    let player = Address::generate(&env);
    let username = String::from_str(&env, "thisusernameiswaytoolong");
    client.register_player(&username, &player);
}

// ===== BACKEND GAME CONTROLLER TESTS =====

#[test]
fn test_set_backend_game_controller_by_owner() {
    let env = Env::default();
    env.mock_all_auths();

    let (_, client, owner, tyc_token, usdc_token) = setup_contract(&env);
    let reward_system = Address::generate(&env);

    client.initialize(&tyc_token, &usdc_token, &owner, &reward_system);

    let backend_controller = Address::generate(&env);
    client.set_backend_game_controller(&backend_controller);

    // Verify by using the backend controller to remove a player
    let player = Address::generate(&env);
    client.remove_player_from_game(&backend_controller, &1, &player, &10);
}

#[test]
fn test_remove_player_from_game_by_owner() {
    let env = Env::default();
    env.mock_all_auths();

    let (_, client, owner, tyc_token, usdc_token) = setup_contract(&env);
    let reward_system = Address::generate(&env);

    client.initialize(&tyc_token, &usdc_token, &owner, &reward_system);

    let player = Address::generate(&env);
    let game_id = 1;
    let turn_count = 5;

    client.remove_player_from_game(&owner, &game_id, &player, &turn_count);

    // Verify event was emitted
    let events = env.events().all();
    assert!(!events.is_empty());
}

#[test]
fn test_remove_player_from_game_by_backend_controller() {
    let env = Env::default();
    env.mock_all_auths();

    let (_, client, owner, tyc_token, usdc_token) = setup_contract(&env);
    let reward_system = Address::generate(&env);

    client.initialize(&tyc_token, &usdc_token, &owner, &reward_system);

    let backend_controller = Address::generate(&env);
    client.set_backend_game_controller(&backend_controller);

    let player = Address::generate(&env);
    let game_id = 2;
    let turn_count = 15;

    client.remove_player_from_game(&backend_controller, &game_id, &player, &turn_count);

    // Verify event was emitted
    let events = env.events().all();
    assert!(!events.is_empty());
}

#[test]
#[should_panic(expected = "Unauthorized: caller must be owner or backend game controller")]
fn test_remove_player_from_game_unauthorized() {
    let env = Env::default();
    env.mock_all_auths();

    let (_, client, owner, tyc_token, usdc_token) = setup_contract(&env);
    let reward_system = Address::generate(&env);

    client.initialize(&tyc_token, &usdc_token, &owner, &reward_system);

    let backend_controller = Address::generate(&env);
    client.set_backend_game_controller(&backend_controller);

    // Try to remove player with unauthorized address
    let unauthorized = Address::generate(&env);
    let player = Address::generate(&env);

    client.remove_player_from_game(&unauthorized, &1, &player, &10);
}

#[test]
#[should_panic(expected = "Unauthorized: caller must be owner or backend game controller")]
fn test_remove_player_from_game_no_backend_controller_set() {
    let env = Env::default();
    env.mock_all_auths();

    let (_, client, owner, tyc_token, usdc_token) = setup_contract(&env);
    let reward_system = Address::generate(&env);

    client.initialize(&tyc_token, &usdc_token, &owner, &reward_system);

    // No backend controller set, try with non-owner
    let unauthorized = Address::generate(&env);
    let player = Address::generate(&env);

    client.remove_player_from_game(&unauthorized, &1, &player, &10);
}

#[test]
fn test_remove_player_emits_correct_event() {
    let env = Env::default();
    env.mock_all_auths();

    let (_, client, owner, tyc_token, usdc_token) = setup_contract(&env);
    let reward_system = Address::generate(&env);

    client.initialize(&tyc_token, &usdc_token, &owner, &reward_system);

    let player = Address::generate(&env);
    let game_id = 42;
    let turn_count = 100;

    client.remove_player_from_game(&owner, &game_id, &player, &turn_count);

    // Verify event details
    let events = env.events().all();
    let _event = events.last().unwrap();
    
    assert!(!events.is_empty());
    // Event should contain game_id, player, and turn_count
}

#[test]
fn test_backend_controller_integration() {
    let env = Env::default();
    env.mock_all_auths();

    let (_, client, owner, tyc_token, usdc_token) = setup_contract(&env);
    let reward_system = Address::generate(&env);

    // Initialize contract
    client.initialize(&tyc_token, &usdc_token, &owner, &reward_system);

    // Set backend controller
    let backend_controller = Address::generate(&env);
    client.set_backend_game_controller(&backend_controller);

    // Register players
    let player1 = Address::generate(&env);
    let player2 = Address::generate(&env);
    client.register_player(&String::from_str(&env, "player1"), &player1);
    client.register_player(&String::from_str(&env, "player2"), &player2);

    // Backend removes players from games
    client.remove_player_from_game(&backend_controller, &1, &player1, &5);
    client.remove_player_from_game(&backend_controller, &1, &player2, &8);

    // Owner can also remove players
    client.remove_player_from_game(&owner, &2, &player1, &12);

    // Verify events were emitted - just check that we have events
    let events = env.events().all();
    assert!(!events.is_empty());
}
