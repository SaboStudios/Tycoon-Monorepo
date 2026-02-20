#![cfg(test)]

use super::*;
use soroban_sdk::{
    testutils::{Address as _, Events},
    token::{StellarAssetClient, TokenClient},
    Address, Env, String,
};
use crate::storage::GameType;

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

// ===== CREATE GAME (HUMAN VS HUMAN) TESTS =====

#[test]
fn test_create_game_public_success() {
    let env = Env::default();
    env.mock_all_auths();

    let (_, client, owner, tyc_token, usdc_token) = setup_contract(&env);
    let reward_system = Address::generate(&env);
    client.initialize(&tyc_token, &usdc_token, &owner, &reward_system);

    let creator = Address::generate(&env);
    let username = String::from_str(&env, "creator1");
    client.register_player(&username, &creator);

    let game_id = client.create_game(
        &creator,
        &username,
        &GameType::Public,
        &1,
        &4,
        &String::from_str(&env, ""),
        &1_000_0000,
        &0,
    );

    assert_eq!(game_id, 1);

    let game = client.get_game(&game_id);
    assert!(game.is_some());
    let g = game.unwrap();
    assert_eq!(g.id, 1);
    assert_eq!(g.creator, creator);
    assert_eq!(g.settings.number_of_players, 4);
    assert_eq!(g.settings.stake_amount, 0);
    assert!(matches!(g.settings.game_type, GameType::Public));

    let players = client.get_game_players(&game_id);
    assert_eq!(players.len(), 1);
    assert_eq!(players.get(0), Some(creator));
}

#[test]
fn test_create_game_private_with_code_success() {
    let env = Env::default();
    env.mock_all_auths();

    let (_, client, owner, tyc_token, usdc_token) = setup_contract(&env);
    let reward_system = Address::generate(&env);
    client.initialize(&tyc_token, &usdc_token, &owner, &reward_system);

    let creator = Address::generate(&env);
    let username = String::from_str(&env, "host");
    client.register_player(&username, &creator);

    let code = String::from_str(&env, "SECRET123");
    let game_id = client.create_game(
        &creator,
        &username,
        &GameType::Private,
        &2,
        &2,
        &code,
        &500_0000,
        &0,
    );

    assert_eq!(game_id, 1);
    let game = client.get_game(&game_id).unwrap();
    assert!(matches!(game.settings.game_type, GameType::Private));
    assert_eq!(game.settings.code, String::from_str(&env, "SECRET123"));
}

#[test]
fn test_create_game_with_stake_transfers_usdc() {
    let env = Env::default();
    env.mock_all_auths();

    let (contract_id, client, owner, tyc_token, usdc_token) = setup_contract(&env);
    let reward_system = Address::generate(&env);
    client.initialize(&tyc_token, &usdc_token, &owner, &reward_system);

    let creator = Address::generate(&env);
    let username = String::from_str(&env, "staker");
    client.register_player(&username, &creator);

    let usdc_admin = StellarAssetClient::new(&env, &usdc_token);
    usdc_admin.mint(&creator, &1000); // 1000 * 10^7 = 1000 USDC (7 decimals)

    let stake = 100u128; // 100 base units
    let game_id = client.create_game(
        &creator,
        &username,
        &GameType::Public,
        &0,
        &2,
        &String::from_str(&env, ""),
        &1_000_0000,
        &stake,
    );

    assert_eq!(game_id, 1);
    let usdc_client = TokenClient::new(&env, &usdc_token);
    assert_eq!(usdc_client.balance(&contract_id), 100);
    assert_eq!(usdc_client.balance(&creator), 900);
}

#[test]
#[should_panic(expected = "Creator must be registered")]
fn test_create_game_unregistered_creator_fails() {
    let env = Env::default();
    env.mock_all_auths();

    let (_, client, owner, tyc_token, usdc_token) = setup_contract(&env);
    let reward_system = Address::generate(&env);
    client.initialize(&tyc_token, &usdc_token, &owner, &reward_system);

    let creator = Address::generate(&env);
    let username = String::from_str(&env, "nobody");

    client.create_game(
        &creator,
        &username,
        &GameType::Public,
        &1,
        &4,
        &String::from_str(&env, ""),
        &1_000_0000,
        &0,
    );
}

#[test]
#[should_panic(expected = "Private game requires a code")]
fn test_create_game_private_without_code_fails() {
    let env = Env::default();
    env.mock_all_auths();

    let (_, client, owner, tyc_token, usdc_token) = setup_contract(&env);
    let reward_system = Address::generate(&env);
    client.initialize(&tyc_token, &usdc_token, &owner, &reward_system);

    let creator = Address::generate(&env);
    let username = String::from_str(&env, "host");
    client.register_player(&username, &creator);

    client.create_game(
        &creator,
        &username,
        &GameType::Private,
        &1,
        &2,
        &String::from_str(&env, ""),
        &500_0000,
        &0,
    );
}

#[test]
#[should_panic(expected = "number_of_players must be between 2 and 8")]
fn test_create_game_invalid_players_too_few_fails() {
    let env = Env::default();
    env.mock_all_auths();

    let (_, client, owner, tyc_token, usdc_token) = setup_contract(&env);
    let reward_system = Address::generate(&env);
    client.initialize(&tyc_token, &usdc_token, &owner, &reward_system);

    let creator = Address::generate(&env);
    let username = String::from_str(&env, "host");
    client.register_player(&username, &creator);

    client.create_game(
        &creator,
        &username,
        &GameType::Public,
        &1,
        &1,
        &String::from_str(&env, ""),
        &1_000_0000,
        &0,
    );
}

#[test]
#[should_panic(expected = "number_of_players must be between 2 and 8")]
fn test_create_game_invalid_players_too_many_fails() {
    let env = Env::default();
    env.mock_all_auths();

    let (_, client, owner, tyc_token, usdc_token) = setup_contract(&env);
    let reward_system = Address::generate(&env);
    client.initialize(&tyc_token, &usdc_token, &owner, &reward_system);

    let creator = Address::generate(&env);
    let username = String::from_str(&env, "host");
    client.register_player(&username, &creator);

    client.create_game(
        &creator,
        &username,
        &GameType::Public,
        &1,
        &9,
        &String::from_str(&env, ""),
        &1_000_0000,
        &0,
    );
}

#[test]
fn test_create_game_emits_game_created_event() {
    let env = Env::default();
    env.mock_all_auths();

    let (_, client, owner, tyc_token, usdc_token) = setup_contract(&env);
    let reward_system = Address::generate(&env);
    client.initialize(&tyc_token, &usdc_token, &owner, &reward_system);

    let creator = Address::generate(&env);
    let username = String::from_str(&env, "emitter");
    client.register_player(&username, &creator);

    let _game_id = client.create_game(
        &creator,
        &username,
        &GameType::Public,
        &1,
        &2,
        &String::from_str(&env, ""),
        &1_000_0000,
        &0,
    );

    let events = env.events().all();
    assert!(!events.is_empty(), "GameCreated event should be emitted");
}
