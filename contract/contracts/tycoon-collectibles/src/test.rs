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

#[test]
fn test_owned_token_count() {
    let env = Env::default();
    env.mock_all_auths();
    
    let contract_id = env.register(TycoonCollectibles, ());
    let client = TycoonCollectiblesClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let alice = Address::generate(&env);
    
    client.initialize(&admin);
    
    // Initially no tokens
    assert_eq!(client.owned_token_count(&alice), 0);
    
    // Buy 3 different tokens
    client.buy_collectible(&alice, &1, &5);
    client.buy_collectible(&alice, &2, &3);
    client.buy_collectible(&alice, &3, &1);
    
    // Should have 3 unique tokens
    assert_eq!(client.owned_token_count(&alice), 3);
    
    // Burn one completely
    client.burn(&alice, &2, &3);
    assert_eq!(client.owned_token_count(&alice), 2);
}

#[test]
fn test_token_of_owner_by_index() {
    let env = Env::default();
    env.mock_all_auths();
    
    let contract_id = env.register(TycoonCollectibles, ());
    let client = TycoonCollectiblesClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let alice = Address::generate(&env);
    
    client.initialize(&admin);
    
    // Buy tokens in order: 10, 20, 30
    client.buy_collectible(&alice, &10, &1);
    client.buy_collectible(&alice, &20, &1);
    client.buy_collectible(&alice, &30, &1);
    
    // Check indexing
    assert_eq!(client.token_of_owner_by_index(&alice, &0), 10);
    assert_eq!(client.token_of_owner_by_index(&alice, &1), 20);
    assert_eq!(client.token_of_owner_by_index(&alice, &2), 30);
}

#[test]
fn test_enumeration_swap_remove_behavior() {
    let env = Env::default();
    env.mock_all_auths();
    
    let contract_id = env.register(TycoonCollectibles, ());
    let client = TycoonCollectiblesClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let alice = Address::generate(&env);
    
    client.initialize(&admin);
    
    // Buy tokens: 100, 200, 300, 400
    client.buy_collectible(&alice, &100, &1);
    client.buy_collectible(&alice, &200, &1);
    client.buy_collectible(&alice, &300, &1);
    client.buy_collectible(&alice, &400, &1);
    
    assert_eq!(client.owned_token_count(&alice), 4);
    
    // Burn token at index 1 (token 200)
    // This should swap last element (400) to index 1
    client.burn(&alice, &200, &1);
    
    assert_eq!(client.owned_token_count(&alice), 3);
    
    // After swap-remove: [100, 400, 300]
    let token0 = client.token_of_owner_by_index(&alice, &0);
    let token1 = client.token_of_owner_by_index(&alice, &1);
    let token2 = client.token_of_owner_by_index(&alice, &2);
    
    // Verify no duplicates and correct tokens remain
    assert!(token0 == 100 || token0 == 400 || token0 == 300);
    assert!(token1 == 100 || token1 == 400 || token1 == 300);
    assert!(token2 == 100 || token2 == 400 || token2 == 300);
    
    // Verify 200 is gone
    let tokens = client.tokens_of(&alice);
    assert!(!tokens.contains(&200));
    assert!(tokens.contains(&100));
    assert!(tokens.contains(&300));
    assert!(tokens.contains(&400));
}

#[test]
fn test_complex_ownership_scenario() {
    let env = Env::default();
    env.mock_all_auths();
    
    let contract_id = env.register(TycoonCollectibles, ());
    let client = TycoonCollectiblesClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let alice = Address::generate(&env);
    let bob = Address::generate(&env);
    let charlie = Address::generate(&env);
    
    client.initialize(&admin);
    
    // Complex scenario: multiple mints, transfers, burns
    
    // Alice buys tokens 1, 2, 3, 4, 5
    for i in 1..=5 {
        client.buy_collectible(&alice, &i, &10);
    }
    assert_eq!(client.owned_token_count(&alice), 5);
    
    // Alice transfers token 2 to Bob (partial)
    client.transfer(&alice, &bob, &2, &5);
    assert_eq!(client.owned_token_count(&alice), 5); // Still owns token 2
    assert_eq!(client.owned_token_count(&bob), 1);
    
    // Alice transfers remaining token 2 to Bob
    client.transfer(&alice, &bob, &2, &5);
    assert_eq!(client.owned_token_count(&alice), 4); // Lost token 2
    assert_eq!(client.owned_token_count(&bob), 1); // Still has token 2
    
    // Bob transfers token 2 to Charlie
    client.transfer(&bob, &charlie, &2, &10);
    assert_eq!(client.owned_token_count(&bob), 0);
    assert_eq!(client.owned_token_count(&charlie), 1);
    
    // Alice burns token 4 completely
    client.burn(&alice, &4, &10);
    assert_eq!(client.owned_token_count(&alice), 3);
    
    // Verify final state
    let alice_tokens = client.tokens_of(&alice);
    assert_eq!(alice_tokens.len(), 3);
    assert!(!alice_tokens.contains(&2));
    assert!(!alice_tokens.contains(&4));
    
    let charlie_tokens = client.tokens_of(&charlie);
    assert_eq!(charlie_tokens.len(), 1);
    assert_eq!(charlie_tokens.get(0).unwrap(), 2);
}

#[test]
fn test_no_duplicate_entries() {
    let env = Env::default();
    env.mock_all_auths();
    
    let contract_id = env.register(TycoonCollectibles, ());
    let client = TycoonCollectiblesClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let alice = Address::generate(&env);
    
    client.initialize(&admin);
    
    // Buy same token multiple times (increasing balance)
    client.buy_collectible(&alice, &1, &5);
    client.buy_collectible(&alice, &1, &3);
    client.buy_collectible(&alice, &1, &2);
    
    // Should only appear once in enumeration
    let tokens = client.tokens_of(&alice);
    assert_eq!(tokens.len(), 1);
    assert_eq!(tokens.get(0).unwrap(), 1);
    assert_eq!(client.owned_token_count(&alice), 1);
    
    // Balance should be cumulative
    assert_eq!(client.balance_of(&alice, &1), 10);
}

#[test]
fn test_enumeration_after_complete_burn() {
    let env = Env::default();
    env.mock_all_auths();
    
    let contract_id = env.register(TycoonCollectibles, ());
    let client = TycoonCollectiblesClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let alice = Address::generate(&env);
    
    client.initialize(&admin);
    
    // Buy 5 tokens
    client.buy_collectible(&alice, &1, &10);
    client.buy_collectible(&alice, &2, &10);
    client.buy_collectible(&alice, &3, &10);
    client.buy_collectible(&alice, &4, &10);
    client.buy_collectible(&alice, &5, &10);
    
    assert_eq!(client.owned_token_count(&alice), 5);
    
    // Burn all tokens completely
    client.burn(&alice, &1, &10);
    client.burn(&alice, &2, &10);
    client.burn(&alice, &3, &10);
    client.burn(&alice, &4, &10);
    client.burn(&alice, &5, &10);
    
    // Should have no tokens
    assert_eq!(client.owned_token_count(&alice), 0);
    let tokens = client.tokens_of(&alice);
    assert_eq!(tokens.len(), 0);
}

#[test]
fn test_partial_transfers_maintain_enumeration() {
    let env = Env::default();
    env.mock_all_auths();
    
    let contract_id = env.register(TycoonCollectibles, ());
    let client = TycoonCollectiblesClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let alice = Address::generate(&env);
    let bob = Address::generate(&env);
    
    client.initialize(&admin);
    
    // Alice buys 100 of token 1
    client.buy_collectible(&alice, &1, &100);
    assert_eq!(client.owned_token_count(&alice), 1);
    
    // Alice transfers 30 to Bob (still has 70)
    client.transfer(&alice, &bob, &1, &30);
    
    // Both should have the token in enumeration
    assert_eq!(client.owned_token_count(&alice), 1);
    assert_eq!(client.owned_token_count(&bob), 1);
    
    // Alice transfers another 40 (still has 30)
    client.transfer(&alice, &bob, &1, &40);
    assert_eq!(client.owned_token_count(&alice), 1);
    assert_eq!(client.owned_token_count(&bob), 1);
    
    // Alice transfers final 30 (now has 0)
    client.transfer(&alice, &bob, &1, &30);
    assert_eq!(client.owned_token_count(&alice), 0);
    assert_eq!(client.owned_token_count(&bob), 1);
}

