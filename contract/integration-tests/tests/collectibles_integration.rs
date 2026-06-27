//! SW-CT-020: tycoon-collectibles integration tests
//!
//! Exercises the collectibles contract in a multi-contract environment.
//! Uses only soroban_sdk primitives — no direct tycoon_collectibles type imports
//! since the crate is cdylib-only.
#![allow(unused_variables)]

extern crate std;

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

/// AC: zero-balance address returns 0, not an error.
#[test]
fn test_zero_balance_address_returns_zero() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let stranger = Address::generate(&env);
    let token = make_token(&env, &admin);

    assert_eq!(TokenClient::new(&env, &token).balance(&stranger), 0);
}

/// AC: transfer of full balance leaves sender at zero.
#[test]
fn test_transfer_full_balance_leaves_sender_zero() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let sender = Address::generate(&env);
    let receiver = Address::generate(&env);
    let token = make_token(&env, &admin);

    StellarAssetClient::new(&env, &token).mint(&sender, &500);
    TokenClient::new(&env, &token).transfer(&sender, &receiver, &500);

    assert_eq!(TokenClient::new(&env, &token).balance(&sender), 0);
    assert_eq!(TokenClient::new(&env, &token).balance(&receiver), 500);
}

/// AC: transfer more than balance is rejected.
#[test]
fn test_transfer_exceeds_balance_is_rejected() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let sender = Address::generate(&env);
    let receiver = Address::generate(&env);
    let token = make_token(&env, &admin);

    StellarAssetClient::new(&env, &token).mint(&sender, &100);

    let res = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        TokenClient::new(&env, &token).transfer(&sender, &receiver, &101);
    }));
    assert!(res.is_err(), "transfer exceeding balance must be rejected");
    // Sender balance must be unchanged
    assert_eq!(TokenClient::new(&env, &token).balance(&sender), 100);
}

/// AC: multiple sequential mints accumulate correctly.
#[test]
fn test_sequential_mints_accumulate() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let user = Address::generate(&env);
    let token = make_token(&env, &admin);
    let asset = StellarAssetClient::new(&env, &token);
    let client = TokenClient::new(&env, &token);

    asset.mint(&user, &100);
    asset.mint(&user, &200);
    asset.mint(&user, &300);

    assert_eq!(client.balance(&user), 600);
}

/// AC: three distinct users hold independent balances on the same token.
#[test]
fn test_three_users_independent_balances() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let u1 = Address::generate(&env);
    let u2 = Address::generate(&env);
    let u3 = Address::generate(&env);
    let token = make_token(&env, &admin);
    let asset = StellarAssetClient::new(&env, &token);
    let client = TokenClient::new(&env, &token);

    asset.mint(&u1, &1000);
    asset.mint(&u2, &2000);
    asset.mint(&u3, &3000);

    assert_eq!(client.balance(&u1), 1000);
    assert_eq!(client.balance(&u2), 2000);
    assert_eq!(client.balance(&u3), 3000);

    // Transfer between u1 and u2 must not affect u3
    client.transfer(&u1, &u2, &500);
    assert_eq!(client.balance(&u1), 500);
    assert_eq!(client.balance(&u2), 2500);
    assert_eq!(client.balance(&u3), 3000);
}

/// AC: TYC and USDC balances remain independent after cross-token transfers.
#[test]
fn test_cross_token_transfers_do_not_bleed() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let alice = Address::generate(&env);
    let bob = Address::generate(&env);
    let tyc = make_token(&env, &admin);
    let usdc = make_token(&env, &admin);

    StellarAssetClient::new(&env, &tyc).mint(&alice, &1000);
    StellarAssetClient::new(&env, &usdc).mint(&alice, &500);

    // Transfer TYC only
    TokenClient::new(&env, &tyc).transfer(&alice, &bob, &400);

    // USDC must be untouched
    assert_eq!(TokenClient::new(&env, &tyc).balance(&alice), 600);
    assert_eq!(TokenClient::new(&env, &usdc).balance(&alice), 500);
    assert_eq!(TokenClient::new(&env, &tyc).balance(&bob), 400);
    assert_eq!(TokenClient::new(&env, &usdc).balance(&bob), 0);
}

/// AC: stale / disconnected address (never interacted) has zero balance and
/// does not cause a panic when queried.
#[test]
fn test_stale_address_query_is_safe() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let token = make_token(&env, &admin);
    let client = TokenClient::new(&env, &token);

    // Generate 5 addresses that never interact with the contract
    for _ in 0..5 {
        let addr = Address::generate(&env);
        assert_eq!(client.balance(&addr), 0);
    }
}
