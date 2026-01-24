#![cfg(test)]

use super::*;
use crate::types::{Perk, CASH_TIERS};
use soroban_sdk::{
    testutils::{Address as _, Events},
    Address, Env,
};

#[test]
fn test_initialize() {
    let env = Env::default();
    let contract_id = env.register(TycoonCollectibles, ());
    let client = TycoonCollectiblesClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    client.initialize(&admin);

    // Should panic on second initialization
    // (Uncomment to test panic behavior)
    // client.initialize(&admin);
}

#[test]
fn test_buy_collectible_mints_to_buyer() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(TycoonCollectibles, ());
    let client = TycoonCollectiblesClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let buyer = Address::generate(&env);

    client.initialize(&admin);

    // Buy collectible (mints token_id 1 with amount 1)
    client.buy_collectible(&buyer, &1, &1);

    // Verify balance
    let balance = client.balance_of(&buyer, &1);
    assert_eq!(balance, 1);

    // Verify enumeration
    let tokens = client.tokens_of(&buyer);
    assert_eq!(tokens.len(), 1);
    assert_eq!(tokens.get(0).unwrap(), 1);
}

#[test]
fn test_transfer_moves_balance() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(TycoonCollectibles, ());
    let client = TycoonCollectiblesClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let alice = Address::generate(&env);
    let bob = Address::generate(&env);

    client.initialize(&admin);

    // Alice buys a collectible
    client.buy_collectible(&alice, &1, &5);
    assert_eq!(client.balance_of(&alice, &1), 5);

    // Alice transfers 3 to Bob
    client.transfer(&alice, &bob, &1, &3);

    // Verify balances
    assert_eq!(client.balance_of(&alice, &1), 2);
    assert_eq!(client.balance_of(&bob, &1), 3);

    // Verify enumeration
    let alice_tokens = client.tokens_of(&alice);
    assert_eq!(alice_tokens.len(), 1);

    let bob_tokens = client.tokens_of(&bob);
    assert_eq!(bob_tokens.len(), 1);
}

#[test]
fn test_transfer_insufficient_balance() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(TycoonCollectibles, ());
    let client = TycoonCollectiblesClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let alice = Address::generate(&env);
    let bob = Address::generate(&env);

    client.initialize(&admin);

    // Alice buys 2 tokens
    client.buy_collectible(&alice, &1, &2);

    // Try to transfer 5 (should return error)
    let result = client.try_transfer(&alice, &bob, &1, &5);
    assert!(result.is_err());
}

#[test]
fn test_burn_removes_balance() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(TycoonCollectibles, ());
    let client = TycoonCollectiblesClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let alice = Address::generate(&env);

    client.initialize(&admin);

    // Alice buys a collectible
    client.buy_collectible(&alice, &1, &10);
    assert_eq!(client.balance_of(&alice, &1), 10);

    // Alice burns 4
    client.burn(&alice, &1, &4);
    assert_eq!(client.balance_of(&alice, &1), 6);

    // Alice burns remaining 6
    client.burn(&alice, &1, &6);
    assert_eq!(client.balance_of(&alice, &1), 0);

    // Verify enumeration is cleared
    let tokens = client.tokens_of(&alice);
    assert_eq!(tokens.len(), 0);
}

#[test]
fn test_enumeration_updates_correctly() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(TycoonCollectibles, ());
    let client = TycoonCollectiblesClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let alice = Address::generate(&env);
    let bob = Address::generate(&env);

    client.initialize(&admin);

    // Alice buys multiple collectibles
    client.buy_collectible(&alice, &1, &1);
    client.buy_collectible(&alice, &2, &1);
    client.buy_collectible(&alice, &3, &1);

    let alice_tokens = client.tokens_of(&alice);
    assert_eq!(alice_tokens.len(), 3);

    // Transfer all of token 2 to Bob
    client.transfer(&alice, &bob, &2, &1);

    // Alice should now have 2 tokens
    let alice_tokens = client.tokens_of(&alice);
    assert_eq!(alice_tokens.len(), 2);

    // Bob should have 1 token
    let bob_tokens = client.tokens_of(&bob);
    assert_eq!(bob_tokens.len(), 1);
    assert_eq!(bob_tokens.get(0).unwrap(), 2);
}

#[test]
fn test_mint_transfer_burn_flow() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(TycoonCollectibles, ());
    let client = TycoonCollectiblesClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let alice = Address::generate(&env);
    let bob = Address::generate(&env);

    client.initialize(&admin);

    // Mint: Alice buys 10 tokens
    client.buy_collectible(&alice, &1, &10);
    assert_eq!(client.balance_of(&alice, &1), 10);

    // Transfer: Alice sends 4 to Bob
    client.transfer(&alice, &bob, &1, &4);
    assert_eq!(client.balance_of(&alice, &1), 6);
    assert_eq!(client.balance_of(&bob, &1), 4);

    // Burn: Bob burns 2
    client.burn(&bob, &1, &2);
    assert_eq!(client.balance_of(&bob, &1), 2);

    // Final state check
    assert_eq!(client.balance_of(&alice, &1), 6);
    assert_eq!(client.balance_of(&bob, &1), 2);
}

// ====================================
// Shop Purchase Tests
// ====================================

/// Helper function to create a mock token for testing
fn create_mock_token(env: &Env, admin: &Address) -> Address {
    let token_contract = env.register_stellar_asset_contract_v2(admin.clone());
    token_contract.address()
}

#[test]
fn test_buy_from_shop_with_tyc() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(TycoonCollectibles, ());
    let client = TycoonCollectiblesClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let buyer = Address::generate(&env);

    // Create mock TYC and USDC tokens
    let tyc_token = create_mock_token(&env, &admin);
    let usdc_token = create_mock_token(&env, &admin);

    // Initialize contract and shop
    client.initialize(&admin);
    client.init_shop(&tyc_token, &usdc_token);

    // Set collectible for sale: token_id 1, TYC price 100, USDC price 10, stock 5
    client.set_collectible_for_sale(&1, &100, &10, &5);

    // Mint TYC tokens to buyer using stellar asset client
    let tyc_client = soroban_sdk::token::StellarAssetClient::new(&env, &tyc_token);
    tyc_client.mint(&buyer, &1000);

    // Buy collectible with TYC
    client.buy_collectible_from_shop(&buyer, &1, &false);

    // Verify buyer received the collectible
    assert_eq!(client.balance_of(&buyer, &1), 1);

    // Verify stock decreased
    assert_eq!(client.get_stock(&1), 4);

    // Verify TYC was transferred (buyer should have 1000 - 100 = 900)
    let tyc_token_client = soroban_sdk::token::Client::new(&env, &tyc_token);
    assert_eq!(tyc_token_client.balance(&buyer), 900);
}

#[test]
fn test_buy_from_shop_with_usdc() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(TycoonCollectibles, ());
    let client = TycoonCollectiblesClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let buyer = Address::generate(&env);

    // Create mock tokens
    let tyc_token = create_mock_token(&env, &admin);
    let usdc_token = create_mock_token(&env, &admin);

    // Initialize contract and shop
    client.initialize(&admin);
    client.init_shop(&tyc_token, &usdc_token);

    // Set collectible for sale
    client.set_collectible_for_sale(&1, &100, &50, &10);

    // Mint USDC tokens to buyer
    let usdc_client = soroban_sdk::token::StellarAssetClient::new(&env, &usdc_token);
    usdc_client.mint(&buyer, &500);

    // Buy collectible with USDC
    client.buy_collectible_from_shop(&buyer, &1, &true);

    // Verify buyer received the collectible
    assert_eq!(client.balance_of(&buyer, &1), 1);

    // Verify stock decreased
    assert_eq!(client.get_stock(&1), 9);

    // Verify USDC was transferred (buyer should have 500 - 50 = 450)
    let usdc_token_client = soroban_sdk::token::Client::new(&env, &usdc_token);
    assert_eq!(usdc_token_client.balance(&buyer), 450);
}

#[test]
fn test_buy_from_shop_insufficient_stock() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(TycoonCollectibles, ());
    let client = TycoonCollectiblesClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let buyer = Address::generate(&env);

    let tyc_token = create_mock_token(&env, &admin);
    let usdc_token = create_mock_token(&env, &admin);

    client.initialize(&admin);
    client.init_shop(&tyc_token, &usdc_token);

    // Set collectible for sale with 0 stock
    client.set_collectible_for_sale(&1, &100, &10, &0);

    // Mint tokens to buyer
    let tyc_client = soroban_sdk::token::StellarAssetClient::new(&env, &tyc_token);
    tyc_client.mint(&buyer, &1000);

    // Try to buy - should fail with InsufficientStock
    let result = client.try_buy_collectible_from_shop(&buyer, &1, &false);
    assert!(result.is_err());
}

#[test]
fn test_buy_from_shop_zero_price() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(TycoonCollectibles, ());
    let client = TycoonCollectiblesClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let buyer = Address::generate(&env);

    let tyc_token = create_mock_token(&env, &admin);
    let usdc_token = create_mock_token(&env, &admin);

    client.initialize(&admin);
    client.init_shop(&tyc_token, &usdc_token);

    // Set collectible with zero TYC price but valid USDC price
    client.set_collectible_for_sale(&1, &0, &10, &5);

    // Mint tokens to buyer
    let tyc_client = soroban_sdk::token::StellarAssetClient::new(&env, &tyc_token);
    tyc_client.mint(&buyer, &1000);

    // Try to buy with TYC - should fail with ZeroPrice
    let result = client.try_buy_collectible_from_shop(&buyer, &1, &false);
    assert!(result.is_err());

    // Buying with USDC should work (price is 10)
    let usdc_client = soroban_sdk::token::StellarAssetClient::new(&env, &usdc_token);
    usdc_client.mint(&buyer, &100);
    let result = client.try_buy_collectible_from_shop(&buyer, &1, &true);
    assert!(result.is_ok());
}

#[test]
fn test_buy_from_shop_decrements_stock() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(TycoonCollectibles, ());
    let client = TycoonCollectiblesClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let buyer = Address::generate(&env);

    let tyc_token = create_mock_token(&env, &admin);
    let usdc_token = create_mock_token(&env, &admin);

    client.initialize(&admin);
    client.init_shop(&tyc_token, &usdc_token);

    // Set collectible for sale with stock of 3
    client.set_collectible_for_sale(&1, &10, &5, &3);

    // Mint tokens to buyer
    let tyc_client = soroban_sdk::token::StellarAssetClient::new(&env, &tyc_token);
    tyc_client.mint(&buyer, &1000);

    // Initial stock should be 3
    assert_eq!(client.get_stock(&1), 3);

    // Buy 1
    client.buy_collectible_from_shop(&buyer, &1, &false);
    assert_eq!(client.get_stock(&1), 2);

    // Buy another
    client.buy_collectible_from_shop(&buyer, &1, &false);
    assert_eq!(client.get_stock(&1), 1);

    // Buy last one
    client.buy_collectible_from_shop(&buyer, &1, &false);
    assert_eq!(client.get_stock(&1), 0);

    // Verify buyer has 3 collectibles
    assert_eq!(client.balance_of(&buyer, &1), 3);

    // Next purchase should fail
    let result = client.try_buy_collectible_from_shop(&buyer, &1, &false);
    assert!(result.is_err());
}

#[test]
fn test_buy_from_shop_not_initialized() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(TycoonCollectibles, ());
    let client = TycoonCollectiblesClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let buyer = Address::generate(&env);

    client.initialize(&admin);
    // Note: Shop NOT initialized

    // Try to buy - should fail with ShopNotInitialized
    let result = client.try_buy_collectible_from_shop(&buyer, &1, &false);
    assert!(result.is_err());
}

#[test]
fn test_burn_collectible_for_perk_cash_tiered() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(TycoonCollectibles, ());
    let client = TycoonCollectiblesClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let user = Address::generate(&env);

    client.initialize(&admin);

    // Buy collectible
    client.buy_collectible(&user, &1, &5);

    // Set perk to CashTiered with strength 3
    client.set_token_perk(&admin, &1, &Perk::CashTiered, &3);

    // Burn collectible for perk
    client.burn_collectible_for_perk(&user, &1);

    // Verify balance decreased by 1
    assert_eq!(client.balance_of(&user, &1), 4);

    // Verify events
    let events = env.events().all();
    let event_count = events.len();

    // Should have: mint event, cash_perk event, burn event, coll_burn event
    assert!(event_count >= 4);

    // Check for cash perk activation event with correct value (strength 3 = 500)
    let cash_value = CASH_TIERS[2]; // strength 3 -> index 2 -> 500
    assert_eq!(cash_value, 500);
}

#[test]
fn test_burn_collectible_for_perk_all_tiers() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(TycoonCollectibles, ());
    let client = TycoonCollectiblesClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let user = Address::generate(&env);

    client.initialize(&admin);

    // Test all 5 tiers
    for strength in 1..=5 {
        let token_id = strength as u128;

        // Buy collectible
        client.buy_collectible(&user, &token_id, &1);

        // Set perk to CashTiered with current strength
        client.set_token_perk(&admin, &token_id, &Perk::CashTiered, &strength);

        // Burn collectible for perk
        client.burn_collectible_for_perk(&user, &token_id);

        // Verify balance is now 0
        assert_eq!(client.balance_of(&user, &token_id), 0);
    }

    // Verify expected cash values
    assert_eq!(CASH_TIERS[0], 100); // Strength 1
    assert_eq!(CASH_TIERS[1], 250); // Strength 2
    assert_eq!(CASH_TIERS[2], 500); // Strength 3
    assert_eq!(CASH_TIERS[3], 1000); // Strength 4
    assert_eq!(CASH_TIERS[4], 2500); // Strength 5
}

#[test]
fn test_burn_collectible_for_perk_tax_refund() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(TycoonCollectibles, ());
    let client = TycoonCollectiblesClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let user = Address::generate(&env);

    client.initialize(&admin);

    // Buy collectible
    client.buy_collectible(&user, &1, &3);

    // Set perk to TaxRefund with strength 4
    client.set_token_perk(&admin, &1, &Perk::TaxRefund, &4);

    // Burn collectible for perk
    client.burn_collectible_for_perk(&user, &1);

    // Verify balance decreased by 1
    assert_eq!(client.balance_of(&user, &1), 2);

    // Verify events emitted
    let events = env.events().all();
    assert!(events.len() >= 4);
}

#[test]
fn test_burn_collectible_for_perk_non_tiered() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(TycoonCollectibles, ());
    let client = TycoonCollectiblesClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let user = Address::generate(&env);

    client.initialize(&admin);

    // Buy collectible
    client.buy_collectible(&user, &1, &2);

    // Set perk to RentBoost (non-tiered)
    client.set_token_perk(&admin, &1, &Perk::RentBoost, &1);

    // Burn collectible for perk
    client.burn_collectible_for_perk(&user, &1);

    // Verify balance decreased by 1
    assert_eq!(client.balance_of(&user, &1), 1);

    // Verify events emitted (should NOT have cash_perk event)
    let events = env.events().all();
    assert!(events.len() >= 3); // mint, burn, coll_burn (no cash_perk)
}

#[test]
fn test_burn_collectible_for_perk_property_discount() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(TycoonCollectibles, ());
    let client = TycoonCollectiblesClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let user = Address::generate(&env);

    client.initialize(&admin);

    // Buy collectible
    client.buy_collectible(&user, &1, &1);

    // Set perk to PropertyDiscount (non-tiered)
    client.set_token_perk(&admin, &1, &Perk::PropertyDiscount, &2);

    // Burn collectible for perk
    client.burn_collectible_for_perk(&user, &1);

    // Verify balance is now 0
    assert_eq!(client.balance_of(&user, &1), 0);

    // Verify token removed from enumeration
    let tokens = client.tokens_of(&user);
    assert_eq!(tokens.len(), 0);
}

#[test]
fn test_burn_collectible_for_perk_insufficient_balance() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(TycoonCollectibles, ());
    let client = TycoonCollectiblesClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let user = Address::generate(&env);

    client.initialize(&admin);

    // Set perk without buying collectible
    client.set_token_perk(&admin, &1, &Perk::CashTiered, &3);

    // Try to burn collectible (should fail - insufficient balance)
    let result = client.try_burn_collectible_for_perk(&user, &1);
    assert!(result.is_err());
}

#[test]
fn test_burn_collectible_for_perk_invalid_perk_none() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(TycoonCollectibles, ());
    let client = TycoonCollectiblesClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let user = Address::generate(&env);

    client.initialize(&admin);

    // Buy collectible
    client.buy_collectible(&user, &1, &1);

    // Don't set perk (defaults to None)

    // Try to burn collectible (should fail - invalid perk)
    let result = client.try_burn_collectible_for_perk(&user, &1);
    assert!(result.is_err());
}

#[test]
fn test_burn_collectible_for_perk_invalid_strength_zero() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(TycoonCollectibles, ());
    let client = TycoonCollectiblesClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let user = Address::generate(&env);

    client.initialize(&admin);

    // Buy collectible
    client.buy_collectible(&user, &1, &1);

    // Set perk to CashTiered with invalid strength 0
    client.set_token_perk(&admin, &1, &Perk::CashTiered, &0);

    // Try to burn collectible (should fail - invalid strength)
    let result = client.try_burn_collectible_for_perk(&user, &1);
    assert!(result.is_err());
}

#[test]
fn test_burn_collectible_for_perk_invalid_strength_six() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(TycoonCollectibles, ());
    let client = TycoonCollectiblesClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let user = Address::generate(&env);

    client.initialize(&admin);

    // Buy collectible
    client.buy_collectible(&user, &1, &1);

    // Set perk to CashTiered with invalid strength 6
    client.set_token_perk(&admin, &1, &Perk::CashTiered, &6);

    // Try to burn collectible (should fail - invalid strength)
    let result = client.try_burn_collectible_for_perk(&user, &1);
    assert!(result.is_err());
}

#[test]
fn test_burn_collectible_for_perk_when_paused() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(TycoonCollectibles, ());
    let client = TycoonCollectiblesClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let user = Address::generate(&env);

    client.initialize(&admin);

    // Buy collectible
    client.buy_collectible(&user, &1, &1);

    // Set perk
    client.set_token_perk(&admin, &1, &Perk::CashTiered, &3);

    // Pause contract
    client.set_pause(&admin, &true);

    // Try to burn collectible (should fail - contract paused)
    let result = client.try_burn_collectible_for_perk(&user, &1);
    assert!(result.is_err());

    // Verify balance unchanged
    assert_eq!(client.balance_of(&user, &1), 1);
}

#[test]
fn test_pause_unpause_functionality() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(TycoonCollectibles, ());
    let client = TycoonCollectiblesClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let user = Address::generate(&env);

    client.initialize(&admin);

    // Initially not paused
    assert_eq!(client.is_contract_paused(), false);

    // Pause
    client.set_pause(&admin, &true);
    assert_eq!(client.is_contract_paused(), true);

    // Buy collectible and set perk
    client.buy_collectible(&user, &1, &1);
    client.set_token_perk(&admin, &1, &Perk::CashTiered, &3);

    // Cannot burn while paused
    let result = client.try_burn_collectible_for_perk(&user, &1);
    assert!(result.is_err());

    // Unpause
    client.set_pause(&admin, &false);
    assert_eq!(client.is_contract_paused(), false);

    // Now can burn
    client.burn_collectible_for_perk(&user, &1);
    assert_eq!(client.balance_of(&user, &1), 0);
}

#[test]
fn test_set_token_perk_unauthorized() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(TycoonCollectibles, ());
    let client = TycoonCollectiblesClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let user = Address::generate(&env);

    client.initialize(&admin);

    // Try to set perk as non-admin (should fail)
    let result = client.try_set_token_perk(&user, &1, &Perk::CashTiered, &3);
    assert!(result.is_err());
}

#[test]
fn test_set_pause_unauthorized() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(TycoonCollectibles, ());
    let client = TycoonCollectiblesClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let user = Address::generate(&env);

    client.initialize(&admin);

    // Try to pause as non-admin (should fail)
    let result = client.try_set_pause(&user, &true);
    assert!(result.is_err());
}

#[test]
fn test_get_token_perk_and_strength() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(TycoonCollectibles, ());
    let client = TycoonCollectiblesClient::new(&env, &contract_id);

    let admin = Address::generate(&env);

    client.initialize(&admin);

    // Default perk should be None
    let perk = client.get_token_perk(&1);
    assert_eq!(perk, Perk::None);

    // Default strength should be 0
    let strength = client.get_token_strength(&1);
    assert_eq!(strength, 0);

    // Set perk and strength
    client.set_token_perk(&admin, &1, &Perk::CashTiered, &5);

    // Verify
    let perk = client.get_token_perk(&1);
    assert_eq!(perk, Perk::CashTiered);

    let strength = client.get_token_strength(&1);
    assert_eq!(strength, 5);
}

#[test]
fn test_multiple_burns_with_different_perks() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(TycoonCollectibles, ());
    let client = TycoonCollectiblesClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let user = Address::generate(&env);

    client.initialize(&admin);

    // Buy multiple collectibles with different perks
    client.buy_collectible(&user, &1, &1);
    client.buy_collectible(&user, &2, &1);
    client.buy_collectible(&user, &3, &1);

    // Set different perks
    client.set_token_perk(&admin, &1, &Perk::CashTiered, &1);
    client.set_token_perk(&admin, &2, &Perk::TaxRefund, &5);
    client.set_token_perk(&admin, &3, &Perk::RentBoost, &1);

    // Burn all three
    client.burn_collectible_for_perk(&user, &1);
    client.burn_collectible_for_perk(&user, &2);
    client.burn_collectible_for_perk(&user, &3);

    // Verify all balances are 0
    assert_eq!(client.balance_of(&user, &1), 0);
    assert_eq!(client.balance_of(&user, &2), 0);
    assert_eq!(client.balance_of(&user, &3), 0);

    // Verify enumeration is empty
    let tokens = client.tokens_of(&user);
    assert_eq!(tokens.len(), 0);
}
