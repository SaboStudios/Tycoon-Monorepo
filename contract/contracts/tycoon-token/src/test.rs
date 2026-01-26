#![cfg(test)]
use super::*;
use soroban_sdk::{testutils::Address as _, Env};

const INITIAL_SUPPLY: i128 = 1_000_000_000_000_000_000_000_000_000; // 1e9 * 10^18

#[test]
fn test_initialization() {
    let e = Env::default();
    e.mock_all_auths();

    let contract_id = e.register_contract(None, TycoonToken);
    let client = TycoonTokenClient::new(&e, &contract_id);
    let admin = Address::generate(&e);

    client.initialize(&admin, &INITIAL_SUPPLY);

    assert_eq!(client.name(), String::from_str(&e, "Tycoon"));
    assert_eq!(client.symbol(), String::from_str(&e, "TYC"));
    assert_eq!(client.decimals(), 18);
    assert_eq!(client.balance(&admin), INITIAL_SUPPLY);
    assert_eq!(client.total_supply(), INITIAL_SUPPLY);
    assert_eq!(client.admin(), admin);
}

#[test]
#[should_panic(expected = "Already initialized")]
fn test_cannot_reinitialize() {
    let e = Env::default();
    e.mock_all_auths();

    let contract_id = e.register_contract(None, TycoonToken);
    let client = TycoonTokenClient::new(&e, &contract_id);
    let admin = Address::generate(&e);

    client.initialize(&admin, &INITIAL_SUPPLY);
    client.initialize(&admin, &INITIAL_SUPPLY);
}

#[test]
fn test_admin_can_mint() {
    let e = Env::default();
    e.mock_all_auths();

    let contract_id = e.register_contract(None, TycoonToken);
    let client = TycoonTokenClient::new(&e, &contract_id);
    let admin = Address::generate(&e);
    let user = Address::generate(&e);

    client.initialize(&admin, &INITIAL_SUPPLY);

    let mint_amount: i128 = 1_000_000_000_000_000_000_000;
    client.mint(&user, &mint_amount);

    assert_eq!(client.balance(&user), mint_amount);
    assert_eq!(client.total_supply(), INITIAL_SUPPLY + mint_amount);
}

#[test]
#[should_panic(expected = "Amount must be positive")]
fn test_cannot_mint_zero() {
    let e = Env::default();
    e.mock_all_auths();

    let contract_id = e.register_contract(None, TycoonToken);
    let client = TycoonTokenClient::new(&e, &contract_id);
    let admin = Address::generate(&e);
    let user = Address::generate(&e);

    client.initialize(&admin, &INITIAL_SUPPLY);
    client.mint(&user, &0);
}

#[test]
fn test_transfer() {
    let e = Env::default();
    e.mock_all_auths();

    let contract_id = e.register_contract(None, TycoonToken);
    let client = TycoonTokenClient::new(&e, &contract_id);
    let admin = Address::generate(&e);
    let user = Address::generate(&e);

    client.initialize(&admin, &INITIAL_SUPPLY);

    let amount: i128 = 500_000_000_000_000_000_000_000_000;
    client.transfer(&admin, &user, &amount);

    assert_eq!(client.balance(&admin), INITIAL_SUPPLY - amount);
    assert_eq!(client.balance(&user), amount);
}

#[test]
#[should_panic(expected = "Insufficient balance")]
fn test_transfer_insufficient_balance() {
    let e = Env::default();
    e.mock_all_auths();

    let contract_id = e.register_contract(None, TycoonToken);
    let client = TycoonTokenClient::new(&e, &contract_id);
    let admin = Address::generate(&e);
    let user = Address::generate(&e);

    client.initialize(&admin, &INITIAL_SUPPLY);
    client.transfer(&admin, &user, &(INITIAL_SUPPLY + 1));
}

#[test]
fn test_approve_and_transfer_from() {
    let e = Env::default();
    e.mock_all_auths();

    let contract_id = e.register_contract(None, TycoonToken);
    let client = TycoonTokenClient::new(&e, &contract_id);
    let admin = Address::generate(&e);
    let spender = Address::generate(&e);
    let recipient = Address::generate(&e);

    client.initialize(&admin, &INITIAL_SUPPLY);

    let allowance: i128 = 100_000_000_000_000_000_000_000_000;
    let transfer: i128 = 50_000_000_000_000_000_000_000_000;

    client.approve(&admin, &spender, &allowance, &0);
    assert_eq!(client.allowance(&admin, &spender), allowance);

    client.transfer_from(&spender, &admin, &recipient, &transfer);

    assert_eq!(client.balance(&admin), INITIAL_SUPPLY - transfer);
    assert_eq!(client.balance(&recipient), transfer);
    assert_eq!(client.allowance(&admin, &spender), allowance - transfer);
}

#[test]
#[should_panic(expected = "Insufficient allowance")]
fn test_transfer_from_insufficient_allowance() {
    let e = Env::default();
    e.mock_all_auths();

    let contract_id = e.register_contract(None, TycoonToken);
    let client = TycoonTokenClient::new(&e, &contract_id);
    let admin = Address::generate(&e);
    let spender = Address::generate(&e);
    let recipient = Address::generate(&e);

    client.initialize(&admin, &INITIAL_SUPPLY);

    let allowance: i128 = 100_000_000_000_000_000_000_000_000;
    client.approve(&admin, &spender, &allowance, &0);
    client.transfer_from(&spender, &admin, &recipient, &(allowance + 1));
}

#[test]
fn test_burn() {
    let e = Env::default();
    e.mock_all_auths();

    let contract_id = e.register_contract(None, TycoonToken);
    let client = TycoonTokenClient::new(&e, &contract_id);
    let admin = Address::generate(&e);

    client.initialize(&admin, &INITIAL_SUPPLY);

    let burn_amount: i128 = 100_000_000_000_000_000_000_000_000;
    client.burn(&admin, &burn_amount);

    assert_eq!(client.balance(&admin), INITIAL_SUPPLY - burn_amount);
    assert_eq!(client.total_supply(), INITIAL_SUPPLY - burn_amount);
}

#[test]
#[should_panic(expected = "Insufficient balance")]
fn test_burn_insufficient_balance() {
    let e = Env::default();
    e.mock_all_auths();

    let contract_id = e.register_contract(None, TycoonToken);
    let client = TycoonTokenClient::new(&e, &contract_id);
    let admin = Address::generate(&e);

    client.initialize(&admin, &INITIAL_SUPPLY);
    client.burn(&admin, &(INITIAL_SUPPLY + 1));
}

#[test]
fn test_burn_from() {
    let e = Env::default();
    e.mock_all_auths();

    let contract_id = e.register_contract(None, TycoonToken);
    let client = TycoonTokenClient::new(&e, &contract_id);
    let admin = Address::generate(&e);
    let spender = Address::generate(&e);

    client.initialize(&admin, &INITIAL_SUPPLY);

    let allowance: i128 = 100_000_000_000_000_000_000_000_000;
    let burn_amount: i128 = 50_000_000_000_000_000_000_000_000;

    client.approve(&admin, &spender, &allowance, &0);
    client.burn_from(&spender, &admin, &burn_amount);

    assert_eq!(client.balance(&admin), INITIAL_SUPPLY - burn_amount);
    assert_eq!(client.total_supply(), INITIAL_SUPPLY - burn_amount);
    assert_eq!(client.allowance(&admin, &spender), allowance - burn_amount);
}

#[test]
#[should_panic(expected = "Insufficient allowance")]
fn test_burn_from_insufficient_allowance() {
    let e = Env::default();
    e.mock_all_auths();

    let contract_id = e.register_contract(None, TycoonToken);
    let client = TycoonTokenClient::new(&e, &contract_id);
    let admin = Address::generate(&e);
    let spender = Address::generate(&e);

    client.initialize(&admin, &INITIAL_SUPPLY);

    let allowance: i128 = 100_000_000_000_000_000_000_000_000;
    client.approve(&admin, &spender, &allowance, &0);
    client.burn_from(&spender, &admin, &(allowance + 1));
}

#[test]
fn test_set_admin() {
    let e = Env::default();
    e.mock_all_auths();

    let contract_id = e.register_contract(None, TycoonToken);
    let client = TycoonTokenClient::new(&e, &contract_id);
    let admin = Address::generate(&e);
    let new_admin = Address::generate(&e);

    client.initialize(&admin, &INITIAL_SUPPLY);
    client.set_admin(&new_admin);

    assert_eq!(client.admin(), new_admin);
}

#[test]
fn test_new_admin_can_mint() {
    let e = Env::default();
    e.mock_all_auths();

    let contract_id = e.register_contract(None, TycoonToken);
    let client = TycoonTokenClient::new(&e, &contract_id);
    let admin = Address::generate(&e);
    let new_admin = Address::generate(&e);
    let user = Address::generate(&e);

    client.initialize(&admin, &INITIAL_SUPPLY);
    client.set_admin(&new_admin);

    let mint_amount: i128 = 1_000_000_000_000_000_000_000;
    client.mint(&user, &mint_amount);

    assert_eq!(client.balance(&user), mint_amount);
}
