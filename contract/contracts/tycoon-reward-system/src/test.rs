#![cfg(test)]
extern crate std;
use super::*;
use soroban_sdk::{
    testutils::{Address as _, Events},
    token, Env,
};

#[test]
fn test_simple_event() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(TycoonRewardSystem, ());
    let client = TycoonRewardSystemClient::new(&env, &contract_id);

    let user = Address::generate(&env);
    client.test_mint(&user, &123, &10); // Uses _mint which emits "Mint"

    let events = env.events().all();
    std::println!("Simple test events: {}", events.len());
}

#[test]
fn test_voucher_flow() {
    let env = Env::default();
    env.mock_all_auths();

    // 1. Setup
    let admin = Address::generate(&env);
    let user = Address::generate(&env);

    // Register TYC Token
    let tyc_token_admin = Address::generate(&env);
    let tyc_token_id = env
        .register_stellar_asset_contract_v2(tyc_token_admin.clone())
        .address();
    let tyc_token = token::Client::new(&env, &tyc_token_id);

    // Register Reward System
    let contract_id = env.register(TycoonRewardSystem, ());
    let client = TycoonRewardSystemClient::new(&env, &contract_id);

    // Initialize
    client.initialize(&admin, &tyc_token_id);

    // Fund the Reward System Contract with TYC
    let contract_address = contract_id.clone();

    // Mint TYC to Reward Contract
    token::StellarAssetClient::new(&env, &tyc_token_id).mint(&contract_address, &10000);

    // 2. Mint Voucher
    let tyc_value = 500u128;
    let token_id = client.mint_voucher(&user, &tyc_value);

    // Verify Voucher Minted
    assert_eq!(client.get_balance(&user, &token_id), 1);

    // Debug: Check events after mint
    let events_after_mint = env.events().all();
    std::println!("Events after mint: {}", events_after_mint.len());

    // 3. Redeem Voucher
    // User redeems
    client.redeem_voucher_from(&user, &token_id);

    // 4. Verify Redemption
    // User should have 500 TYC
    assert_eq!(tyc_token.balance(&user), 500);

    // Contract should have 9500 TYC
    assert_eq!(tyc_token.balance(&contract_address), 9500);

    // Voucher burned
    assert_eq!(client.get_balance(&user, &token_id), 0);

    // Verify Redeem Event
    let events = env.events().all();
    std::println!("Total events: {}", events.len());

    // 5. Try to redeem again (should fail)
    // We expect panic because balance is 0 and storage is gone
    let res = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        client.redeem_voucher_from(&user, &token_id);
    }));
    assert!(res.is_err());
}
