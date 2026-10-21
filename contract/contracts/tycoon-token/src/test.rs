use super::*;
use soroban_sdk::{
    testutils::{Address as _, MockAuth, MockAuthInvoke},
    IntoVal,
};

#[test]
fn mint_rejects_non_admin_without_changing_supply() {
    let env = Env::default();
    let id = env.register(TycoonToken, ());
    let client = TycoonTokenClient::new(&env, &id);
    let admin = Address::generate(&env);
    let outsider = Address::generate(&env);
    client.initialize(&admin, &100);
    env.mock_auths(&[MockAuth {
        address: &outsider,
        invoke: &MockAuthInvoke {
            contract: &id,
            fn_name: "mint",
            args: (outsider.clone(), 10_i128).into_val(&env),
            sub_invokes: &[],
        },
    }]);
    let supply = client.total_supply();
    let balance = client.balance(&outsider);
    assert!(client.try_mint(&outsider, &10).is_err());
    assert_eq!(client.total_supply(), supply);
    assert_eq!(client.balance(&outsider), balance);
}

fn mint_amount(amount: i128) {
    let env = Env::default();
    env.mock_all_auths();
    let id = env.register(TycoonToken, ());
    let client = TycoonTokenClient::new(&env, &id);
    let admin = Address::generate(&env);
    client.initialize(&admin, &100);
    client.mint(&admin, &amount);
}

#[test]
#[should_panic(expected = "Amount must be positive")]
fn mint_rejects_zero() {
    mint_amount(0);
}

#[test]
#[should_panic(expected = "Amount must be positive")]
fn mint_rejects_negative() {
    mint_amount(-1);
}

#[test]
fn admin_mint_increases_existing_balance_and_supply() {
    let env = Env::default();
    env.mock_all_auths();
    let id = env.register(TycoonToken, ());
    let client = TycoonTokenClient::new(&env, &id);
    let admin = Address::generate(&env);
    client.initialize(&admin, &100);
    let balance = client.balance(&admin);
    let supply = client.total_supply();
    client.mint(&admin, &25);
    assert_eq!(client.balance(&admin) - balance, 25);
    assert_eq!(client.total_supply() - supply, 25);
}

#[test]
#[should_panic(expected = "Balance overflow")]
fn mint_rejects_balance_overflow() {
    let env = Env::default();
    env.mock_all_auths();
    let id = env.register(TycoonToken, ());
    let client = TycoonTokenClient::new(&env, &id);
    let admin = Address::generate(&env);
    client.initialize(&admin, &i128::MAX);
    client.mint(&admin, &1);
}

#[test]
#[should_panic(expected = "Supply overflow")]
fn mint_rejects_supply_overflow() {
    let env = Env::default();
    env.mock_all_auths();
    let id = env.register(TycoonToken, ());
    let client = TycoonTokenClient::new(&env, &id);
    let admin = Address::generate(&env);
    client.initialize(&admin, &i128::MAX);
    client.mint(&Address::generate(&env), &1);
}
