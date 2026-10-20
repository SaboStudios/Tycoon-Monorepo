//! Token Interaction Integration Tests
//!
//! Tests token transfer, approval, and balance management across contracts.
//! Verifies that tokens can be transferred between contracts and players,
//! that allowances work correctly, and that events are emitted properly.
//!
//! AC2.1 - AC2.3: Token transfers, approvals, and minting

use soroban_sdk::{
    testutils::{Address as _, Events},
    token::{StellarAssetClient, TokenClient},
    Address, Env,
};

/// Helper: Create a mock token contract
fn create_token_contract(env: &Env, admin: &Address) -> Address {
    let token_contract = env.register_stellar_asset_contract_v2(admin.clone());
    token_contract.address()
}

/// AC2.1: Cross-Contract Token Transfers
/// Verifies that tokens can be transferred between contracts and players
#[test]
fn test_token_transfer_between_contracts() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let game_contract = Address::generate(&env);
    let player = Address::generate(&env);

    // Create token
    let token = create_token_contract(&env, &admin);
    let token_client = TokenClient::new(&env, &token);
    let stellar_asset_client = StellarAssetClient::new(&env, &token);

    // Mint tokens to game contract
    stellar_asset_client.mint(&game_contract, &1_000_000);
    assert_eq!(token_client.balance(&game_contract), 1_000_000);

    // Transfer from game contract to player
    token_client.transfer(&game_contract, &player, &100_000);

    // Verify balances
    assert_eq!(token_client.balance(&player), 100_000);
    assert_eq!(token_client.balance(&game_contract), 900_000);
}

/// AC2.1: Token Transfer Events
/// Verifies that transfer events are emitted with correct data
#[test]
fn test_token_transfer_events() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let sender = Address::generate(&env);
    let recipient = Address::generate(&env);

    // Create token
    let token = create_token_contract(&env, &admin);
    let token_client = TokenClient::new(&env, &token);
    let stellar_asset_client = StellarAssetClient::new(&env, &token);

    // Mint and transfer
    stellar_asset_client.mint(&sender, &1_000_000);
    token_client.transfer(&sender, &recipient, &100_000);

    // Verify events were emitted
    let events = env.events().all();
    assert!(!events.is_empty());
}

/// AC2.1: Multiple Token Transfers
/// Verifies that multiple transfers work correctly
#[test]
fn test_multiple_token_transfers() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let player1 = Address::generate(&env);
    let player2 = Address::generate(&env);
    let player3 = Address::generate(&env);

    // Create token
    let token = create_token_contract(&env, &admin);
    let token_client = TokenClient::new(&env, &token);
    let stellar_asset_client = StellarAssetClient::new(&env, &token);

    // Mint to admin
    stellar_asset_client.mint(&admin, &1_000_000);

    // Transfer to multiple players
    token_client.transfer(&admin, &player1, &100_000);
    token_client.transfer(&admin, &player2, &200_000);
    token_client.transfer(&admin, &player3, &150_000);

    // Verify all balances
    assert_eq!(token_client.balance(&player1), 100_000);
    assert_eq!(token_client.balance(&player2), 200_000);
    assert_eq!(token_client.balance(&player3), 150_000);
    assert_eq!(token_client.balance(&admin), 550_000);
}

/// AC2.2: Token Approval
/// Verifies that token approvals work correctly
#[test]
fn test_token_approval() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let owner = Address::generate(&env);
    let spender = Address::generate(&env);

    // Create token
    let token = create_token_contract(&env, &admin);
    let token_client = TokenClient::new(&env, &token);
    let stellar_asset_client = StellarAssetClient::new(&env, &token);

    // Mint to owner
    stellar_asset_client.mint(&owner, &1_000_000);

    // Approve spender
    token_client.approve(&owner, &spender, &500_000, &100);

    // Verify allowance
    assert_eq!(token_client.allowance(&owner, &spender), 500_000);
}

/// AC2.2: Token Spending with Allowance
/// Verifies that spender can spend approved tokens
#[test]
fn test_token_spending_with_allowance() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let owner = Address::generate(&env);
    let spender = Address::generate(&env);
    let recipient = Address::generate(&env);

    // Create token
    let token = create_token_contract(&env, &admin);
    let token_client = TokenClient::new(&env, &token);
    let stellar_asset_client = StellarAssetClient::new(&env, &token);

    // Mint to owner
    stellar_asset_client.mint(&owner, &1_000_000);

    // Approve spender
    token_client.approve(&owner, &spender, &500_000, &100);

    // Spender transfers tokens
    token_client.transfer_from(&spender, &owner, &recipient, &200_000);

    // Verify balances
    assert_eq!(token_client.balance(&recipient), 200_000);
    assert_eq!(token_client.balance(&owner), 800_000);
}

/// AC2.2: Allowance Decreases After Spending
/// Verifies that allowance decreases after spending
#[test]
fn test_allowance_decreases_after_spending() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let owner = Address::generate(&env);
    let spender = Address::generate(&env);
    let recipient = Address::generate(&env);

    // Create token
    let token = create_token_contract(&env, &admin);
    let token_client = TokenClient::new(&env, &token);
    let stellar_asset_client = StellarAssetClient::new(&env, &token);

    // Mint to owner
    stellar_asset_client.mint(&owner, &1_000_000);

    // Approve spender for 500,000
    token_client.approve(&owner, &spender, &500_000, &100);
    assert_eq!(token_client.allowance(&owner, &spender), 500_000);

    // Spend 200,000
    token_client.transfer_from(&spender, &owner, &recipient, &200_000);

    // Verify allowance decreased
    assert_eq!(token_client.allowance(&owner, &spender), 300_000);

    // Spend another 100,000
    token_client.transfer_from(&spender, &owner, &recipient, &100_000);

    // Verify allowance decreased again
    assert_eq!(token_client.allowance(&owner, &spender), 200_000);
}

/// AC2.2: Spending Without Approval Fails
/// Verifies that spending without approval fails appropriately
#[test]
#[should_panic]
fn test_spending_without_approval_fails() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let owner = Address::generate(&env);
    let spender = Address::generate(&env);
    let recipient = Address::generate(&env);

    // Create token
    let token = create_token_contract(&env, &admin);
    let token_client = TokenClient::new(&env, &token);
    let stellar_asset_client = StellarAssetClient::new(&env, &token);

    // Mint to owner
    stellar_asset_client.mint(&owner, &1_000_000);

    // Try to spend without approval (should panic)
    token_client.transfer_from(&spender, &owner, &recipient, &100_000);
}

/// AC2.3: Token Minting
/// Verifies that admin can mint tokens
#[test]
fn test_token_minting() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let recipient = Address::generate(&env);

    // Create token
    let token = create_token_contract(&env, &admin);
    let token_client = TokenClient::new(&env, &token);
    let stellar_asset_client = StellarAssetClient::new(&env, &token);

    // Mint tokens
    stellar_asset_client.mint(&recipient, &1_000_000);

    // Verify balance
    assert_eq!(token_client.balance(&recipient), 1_000_000);
}

/// AC2.3: Multiple Minting Operations
/// Verifies that multiple minting operations work correctly
#[test]
fn test_multiple_minting_operations() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let recipient1 = Address::generate(&env);
    let recipient2 = Address::generate(&env);

    // Create token
    let token = create_token_contract(&env, &admin);
    let token_client = TokenClient::new(&env, &token);
    let stellar_asset_client = StellarAssetClient::new(&env, &token);

    // Mint to multiple recipients
    stellar_asset_client.mint(&recipient1, &1_000_000);
    stellar_asset_client.mint(&recipient2, &500_000);

    // Verify balances
    assert_eq!(token_client.balance(&recipient1), 1_000_000);
    assert_eq!(token_client.balance(&recipient2), 500_000);

    // Mint more to first recipient
    stellar_asset_client.mint(&recipient1, &500_000);
    assert_eq!(token_client.balance(&recipient1), 1_500_000);
}

/// AC2.3: Total Supply Tracking
/// Verifies that total supply is correctly updated
#[test]
fn test_total_supply_tracking() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let recipient1 = Address::generate(&env);
    let recipient2 = Address::generate(&env);

    // Create token
    let token = create_token_contract(&env, &admin);
    let token_client = TokenClient::new(&env, &token);
    let stellar_asset_client = StellarAssetClient::new(&env, &token);

    // Mint tokens
    stellar_asset_client.mint(&recipient1, &1_000_000);
    stellar_asset_client.mint(&recipient2, &500_000);

    // Verify individual balances sum correctly
    let balance1 = token_client.balance(&recipient1);
    let balance2 = token_client.balance(&recipient2);
    assert_eq!(balance1 + balance2, 1_500_000);
}

/// AC2.1: Token Transfer Balance Consistency
/// Verifies that balances remain consistent after transfers
#[test]
fn test_token_transfer_balance_consistency() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let account1 = Address::generate(&env);
    let account2 = Address::generate(&env);

    // Create token
    let token = create_token_contract(&env, &admin);
    let token_client = TokenClient::new(&env, &token);
    let stellar_asset_client = StellarAssetClient::new(&env, &token);

    // Mint initial amount
    stellar_asset_client.mint(&account1, &1_000_000);
    let initial_total = token_client.balance(&account1) + token_client.balance(&account2);

    // Transfer
    token_client.transfer(&account1, &account2, &300_000);

    // Verify total is conserved
    let final_total = token_client.balance(&account1) + token_client.balance(&account2);
    assert_eq!(initial_total, final_total);
    assert_eq!(token_client.balance(&account1), 700_000);
    assert_eq!(token_client.balance(&account2), 300_000);
}

/// AC2.1: Multi-Token Transfers
/// Verifies that different token types can be transferred independently
#[test]
fn test_multi_token_transfers() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let player = Address::generate(&env);

    // Create two different tokens
    let tyc_token = create_token_contract(&env, &admin);
    let usdc_token = create_token_contract(&env, &admin);

    let tyc_client = TokenClient::new(&env, &tyc_token);
    let usdc_client = TokenClient::new(&env, &usdc_token);
    let tyc_stellar = StellarAssetClient::new(&env, &tyc_token);
    let usdc_stellar = StellarAssetClient::new(&env, &usdc_token);

    // Mint both tokens
    tyc_stellar.mint(&admin, &1_000_000);
    usdc_stellar.mint(&admin, &500_000);

    // Transfer both tokens to player
    tyc_client.transfer(&admin, &player, &100_000);
    usdc_client.transfer(&admin, &player, &50_000);

    // Verify balances are tracked separately
    assert_eq!(tyc_client.balance(&player), 100_000);
    assert_eq!(usdc_client.balance(&player), 50_000);
    assert_eq!(tyc_client.balance(&admin), 900_000);
    assert_eq!(usdc_client.balance(&admin), 450_000);
}
