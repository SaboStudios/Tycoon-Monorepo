#![cfg(test)]

use super::*;
use soroban_sdk::{
    testutils::{Address as _, Events},
    Address, Env, FromVal, IntoVal,
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

#[test]
fn test_set_backend_minter_unauthorized() {
    let env = Env::default();
    let contract_id = env.register(TycoonCollectibles, ());
    let client = TycoonCollectiblesClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let stranger = Address::generate(&env);

    client.initialize(&admin);

    // No mock_all_auths here.
    // The contract will look for Admin's signature, find none, and fail.
    let result = client.try_set_backend_minter(&stranger);
    assert!(result.is_err());
}

#[test]
fn test_protected_mint_authorized_roles() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(TycoonCollectibles, ());
    let client = TycoonCollectiblesClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let minter = Address::generate(&env);
    let user = Address::generate(&env);

    client.initialize(&admin);
    client.set_backend_minter(&minter);

    // 1. Admin can mint
    client.backend_mint(&admin, &user, &1, &100);
    assert_eq!(client.balance_of(&user, &1), 100);

    // 2. Minter can mint
    client.backend_mint(&minter, &user, &1, &50);
    assert_eq!(client.balance_of(&user, &1), 150);
}

#[test]
fn test_protected_mint_rejection() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(TycoonCollectibles, ());
    let client = TycoonCollectiblesClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let user = Address::generate(&env);
    let stranger = Address::generate(&env);

    client.initialize(&admin);

    // Stranger claims they are calling, but they aren't admin/minter
    let result = client.try_backend_mint(&stranger, &user, &1, &10);

    match result {
        Err(Ok(err)) => assert_eq!(err, CollectibleError::Unauthorized),
        _ => panic!("Should have returned CollectibleError::Unauthorized"),
    }
}

#[test]
fn test_minter_event_emission() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(TycoonCollectibles, ());
    let client = TycoonCollectiblesClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let minter = Address::generate(&env);

    client.initialize(&admin);
    client.set_backend_minter(&minter);

    let events = env.events().all();
    let last_event = events.last().unwrap();

    // Topic comparison: Convert Val to a Vec of Symbols
    let expected_topic = (
        soroban_sdk::symbol_short!("minter"),
        soroban_sdk::symbol_short!("set"),
    )
        .into_val(&env);
    assert_eq!(last_event.1, expected_topic);

    // Data comparison: Convert the Val back into an Address to compare
    let emitted_address = Address::from_val(&env, &last_event.2);
    assert_eq!(emitted_address, minter);
}
