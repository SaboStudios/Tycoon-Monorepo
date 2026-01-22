#![cfg(test)]

use super::*;
use soroban_sdk::{testutils::Address as _, Address, Env};

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
