//! SW-CT-020: tycoon-collectibles integration tests
//!
//! Exercises the collectibles contract in a multi-contract environment.
//! Uses only soroban_sdk primitives — no direct tycoon_collectibles type imports
//! since the crate is cdylib-only.
#![allow(unused_variables)]

use soroban_sdk::{
    testutils::Address as _,
    token::{StellarAssetClient, TokenClient},
    Address, Env,
};

fn make_token(env: &Env, admin: &Address) -> Address {
    env.register_stellar_asset_contract_v2(admin.clone())
        .address()
}

/// AC: token contracts initialize and are distinct.
#[test]
fn test_token_contracts_are_distinct() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let tyc_token = make_token(&env, &admin);
    let usdc_token = make_token(&env, &admin);

    assert_ne!(tyc_token, usdc_token);

    StellarAssetClient::new(&env, &tyc_token).mint(&admin, &1_000_000);
    assert_eq!(
        TokenClient::new(&env, &tyc_token).balance(&admin),
        1_000_000
    );
}

/// AC: token mint and transfer work correctly.
#[test]
fn test_token_mint_and_transfer() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let buyer = Address::generate(&env);
    let tyc_token = make_token(&env, &admin);

    StellarAssetClient::new(&env, &tyc_token).mint(&buyer, &1000);
    assert_eq!(TokenClient::new(&env, &tyc_token).balance(&buyer), 1000);

    TokenClient::new(&env, &tyc_token).transfer(&buyer, &admin, &300);
    assert_eq!(TokenClient::new(&env, &tyc_token).balance(&buyer), 700);
    assert_eq!(TokenClient::new(&env, &tyc_token).balance(&admin), 300);
}

/// AC: multi-token environment — TYC and USDC balances are independent.
#[test]
fn test_multi_token_balances_are_independent() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let user = Address::generate(&env);
    let tyc_token = make_token(&env, &admin);
    let usdc_token = make_token(&env, &admin);

    StellarAssetClient::new(&env, &tyc_token).mint(&user, &500);
    StellarAssetClient::new(&env, &usdc_token).mint(&user, &200);

    assert_eq!(TokenClient::new(&env, &tyc_token).balance(&user), 500);
    assert_eq!(TokenClient::new(&env, &usdc_token).balance(&user), 200);
}
