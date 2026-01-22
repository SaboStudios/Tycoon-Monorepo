#![cfg(test)]
extern crate std;
use super::*;
use soroban_sdk::{
    testutils::{Address as _, Events},
    vec, Env, IntoVal, Symbol,
};

#[test]
fn test_mint() {
    let env = Env::default();
    let contract_id = env.register_contract(None, TycoonRewardSystem);
    let client = TycoonRewardSystemClient::new(&env, &contract_id);

    let user = Address::generate(&env);
    let token_id = 1001;
    let amount = 50;

    client.test_mint(&user, &token_id, &amount);

    assert_eq!(client.get_balance(&user, &token_id), 50);
}

#[test]
fn test_burn() {
    let env = Env::default();
    let contract_id = env.register_contract(None, TycoonRewardSystem);
    let client = TycoonRewardSystemClient::new(&env, &contract_id);

    let user = Address::generate(&env);
    let token_id = 1001;
    let amount = 100;

    client.test_mint(&user, &token_id, &amount);
    client.test_burn(&user, &token_id, &50);

    assert_eq!(client.get_balance(&user, &token_id), 50);
}

#[test]
fn test_zero_balance() {
    let env = Env::default();
    let contract_id = env.register_contract(None, TycoonRewardSystem);
    let client = TycoonRewardSystemClient::new(&env, &contract_id);

    let user = Address::generate(&env);
    let token_id = 999;

    assert_eq!(client.get_balance(&user, &token_id), 0);
}

#[test]
#[should_panic(expected = "Insufficient balance")]
fn test_burn_insufficient() {
    let env = Env::default();
    let contract_id = env.register_contract(None, TycoonRewardSystem);
    let client = TycoonRewardSystemClient::new(&env, &contract_id);

    let user = Address::generate(&env);
    let token_id = 1001;

    client.test_mint(&user, &token_id, &10);
    client.test_burn(&user, &token_id, &20);
}

#[test]
#[should_panic(expected = "Balance overflow")]
fn test_overflow() {
    let env = Env::default();
    let contract_id = env.register_contract(None, TycoonRewardSystem);
    let client = TycoonRewardSystemClient::new(&env, &contract_id);

    let user = Address::generate(&env);
    let token_id = 1001;

    client.test_mint(&user, &token_id, &u64::MAX);
    client.test_mint(&user, &token_id, &1);
}

#[test]
fn test_events() {
    let env = Env::default();
    let contract_id = env.register_contract(None, TycoonRewardSystem);
    let client = TycoonRewardSystemClient::new(&env, &contract_id);

    let user = Address::generate(&env);
    let token_id = 1001;
    let amount = 50;

    client.test_mint(&user, &token_id, &amount);

    let events = env.events().all();
    let last_event = events.last().unwrap();
    // Verify event data/topics if necessary, but simply ensuring it emits is good for now.
    // In Soroban tests, events are (ContractId, (Topics...), Data)

    // (Symbol, Address, u128)
    assert_eq!(
        vec![&env, last_event],
        vec![
            &env,
            (
                contract_id.clone(),
                (symbol_short!("Mint"), user.clone(), token_id).into_val(&env),
                amount.into_val(&env)
            )
        ]
    );
}
