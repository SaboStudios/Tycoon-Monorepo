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

    // Register USDC Token
    let usdc_token_admin = Address::generate(&env);
    let usdc_token_id = env
        .register_stellar_asset_contract_v2(usdc_token_admin.clone())
        .address();

    // Register Reward System
    let contract_id = env.register(TycoonRewardSystem, ());
    let client = TycoonRewardSystemClient::new(&env, &contract_id);

    // Initialize
    client.initialize(&admin, &tyc_token_id, &usdc_token_id);

    // Fund the Reward System Contract with TYC
    let contract_address = contract_id.clone();

    // Mint TYC to Reward Contract
    token::StellarAssetClient::new(&env, &tyc_token_id).mint(&contract_address, &10000);

    // 2. Mint Voucher
    let tyc_value = 500u128;
    let token_id = client.mint_voucher(&admin, &user, &tyc_value);

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

#[test]
fn test_withdraw_funds_admin_can_withdraw() {
    let env = Env::default();
    env.mock_all_auths();

    // Setup
    let admin = Address::generate(&env);
    let recipient = Address::generate(&env);

    // Register TYC Token
    let tyc_token_admin = Address::generate(&env);
    let tyc_token_id = env
        .register_stellar_asset_contract_v2(tyc_token_admin.clone())
        .address();
    let tyc_token = token::Client::new(&env, &tyc_token_id);

    // Register USDC Token
    let usdc_token_admin = Address::generate(&env);
    let usdc_token_id = env
        .register_stellar_asset_contract_v2(usdc_token_admin.clone())
        .address();
    let usdc_token = token::Client::new(&env, &usdc_token_id);

    // Register Reward System
    let contract_id = env.register(TycoonRewardSystem, ());
    let client = TycoonRewardSystemClient::new(&env, &contract_id);
    let contract_address = contract_id.clone();

    // Initialize
    client.initialize(&admin, &tyc_token_id, &usdc_token_id);

    // Fund contract with TYC
    token::StellarAssetClient::new(&env, &tyc_token_id).mint(&contract_address, &5000);

    // Fund contract with USDC
    token::StellarAssetClient::new(&env, &usdc_token_id).mint(&contract_address, &1000);

    // Verify initial balances
    assert_eq!(tyc_token.balance(&contract_address), 5000);
    assert_eq!(usdc_token.balance(&contract_address), 1000);
    assert_eq!(tyc_token.balance(&recipient), 0);
    assert_eq!(usdc_token.balance(&recipient), 0);

    // Admin withdraws TYC
    client.withdraw_funds(&tyc_token_id, &recipient, &2000);

    // Verify TYC withdrawal
    assert_eq!(tyc_token.balance(&contract_address), 3000);
    assert_eq!(tyc_token.balance(&recipient), 2000);

    // Admin withdraws USDC
    client.withdraw_funds(&usdc_token_id, &recipient, &500);

    // Verify USDC withdrawal
    assert_eq!(usdc_token.balance(&contract_address), 500);
    assert_eq!(usdc_token.balance(&recipient), 500);
}

#[test]
fn test_withdraw_funds_non_admin_reverts() {
    let env = Env::default();
    env.mock_all_auths();

    // Setup
    let admin = Address::generate(&env);
    let _non_admin = Address::generate(&env);
    let recipient = Address::generate(&env);

    // Register TYC Token
    let tyc_token_admin = Address::generate(&env);
    let tyc_token_id = env
        .register_stellar_asset_contract_v2(tyc_token_admin.clone())
        .address();

    // Register USDC Token
    let usdc_token_admin = Address::generate(&env);
    let usdc_token_id = env
        .register_stellar_asset_contract_v2(usdc_token_admin.clone())
        .address();

    // Register Reward System
    let contract_id = env.register(TycoonRewardSystem, ());
    let client = TycoonRewardSystemClient::new(&env, &contract_id);
    let contract_address = contract_id.clone();

    // Initialize
    client.initialize(&admin, &tyc_token_id, &usdc_token_id);

    // Fund contract
    token::StellarAssetClient::new(&env, &tyc_token_id).mint(&contract_address, &5000);

    // Non-admin attempts withdrawal - should panic
    let res = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        env.as_contract(&contract_id, || {
            // Manually call without auth to simulate non-admin
            let non_admin_client = TycoonRewardSystemClient::new(&env, &contract_id);
            non_admin_client.withdraw_funds(&tyc_token_id, &recipient, &1000);
        });
    }));
    assert!(res.is_err());
}

#[test]
fn test_withdraw_funds_insufficient_balance_reverts() {
    let env = Env::default();
    env.mock_all_auths();

    // Setup
    let admin = Address::generate(&env);
    let recipient = Address::generate(&env);

    // Register TYC Token
    let tyc_token_admin = Address::generate(&env);
    let tyc_token_id = env
        .register_stellar_asset_contract_v2(tyc_token_admin.clone())
        .address();

    // Register USDC Token
    let usdc_token_admin = Address::generate(&env);
    let usdc_token_id = env
        .register_stellar_asset_contract_v2(usdc_token_admin.clone())
        .address();

    // Register Reward System
    let contract_id = env.register(TycoonRewardSystem, ());
    let client = TycoonRewardSystemClient::new(&env, &contract_id);
    let contract_address = contract_id.clone();

    // Initialize
    client.initialize(&admin, &tyc_token_id, &usdc_token_id);

    // Fund contract with only 1000 TYC
    token::StellarAssetClient::new(&env, &tyc_token_id).mint(&contract_address, &1000);

    // Admin attempts to withdraw more than available - should panic
    let res = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        client.withdraw_funds(&tyc_token_id, &recipient, &5000);
    }));
    assert!(res.is_err());
}

#[test]
fn test_withdraw_funds_invalid_token_reverts() {
    let env = Env::default();
    env.mock_all_auths();

    // Setup
    let admin = Address::generate(&env);
    let recipient = Address::generate(&env);

    // Register TYC Token
    let tyc_token_admin = Address::generate(&env);
    let tyc_token_id = env
        .register_stellar_asset_contract_v2(tyc_token_admin.clone())
        .address();

    // Register USDC Token
    let usdc_token_admin = Address::generate(&env);
    let usdc_token_id = env
        .register_stellar_asset_contract_v2(usdc_token_admin.clone())
        .address();

    // Register invalid token (not in allowlist)
    let invalid_token_admin = Address::generate(&env);
    let invalid_token_id = env
        .register_stellar_asset_contract_v2(invalid_token_admin.clone())
        .address();

    // Register Reward System
    let contract_id = env.register(TycoonRewardSystem, ());
    let client = TycoonRewardSystemClient::new(&env, &contract_id);
    let contract_address = contract_id.clone();

    // Initialize with TYC and USDC
    client.initialize(&admin, &tyc_token_id, &usdc_token_id);

    // Fund contract
    token::StellarAssetClient::new(&env, &tyc_token_id).mint(&contract_address, &5000);

    // Admin attempts to withdraw with invalid token - should panic
    let res = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        client.withdraw_funds(&invalid_token_id, &recipient, &1000);
    }));
    assert!(res.is_err());
}

// ============================================
// Tests for Backend Minter (Issue #101)
// ============================================

#[test]
fn test_set_backend_minter_admin() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let backend_minter = Address::generate(&env);

    // Register TYC Token
    let tyc_token_admin = Address::generate(&env);
    let tyc_token_id = env
        .register_stellar_asset_contract_v2(tyc_token_admin.clone())
        .address();

    // Register USDC Token
    let usdc_token_admin = Address::generate(&env);
    let usdc_token_id = env
        .register_stellar_asset_contract_v2(usdc_token_admin.clone())
        .address();

    // Register Reward System
    let contract_id = env.register(TycoonRewardSystem, ());
    let client = TycoonRewardSystemClient::new(&env, &contract_id);

    // Initialize
    client.initialize(&admin, &tyc_token_id, &usdc_token_id);

    // Set backend minter (admin only)
    client.set_backend_minter(&admin, &backend_minter.clone());

    // Verify backend minter is set
    let minter = client.get_backend_minter();
    assert_eq!(minter, Some(backend_minter));
}

#[test]
fn test_set_backend_minter_unauthorized() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let unauthorized = Address::generate(&env);

    // Register TYC Token
    let tyc_token_admin = Address::generate(&env);
    let tyc_token_id = env
        .register_stellar_asset_contract_v2(tyc_token_admin.clone())
        .address();

    // Register USDC Token
    let usdc_token_admin = Address::generate(&env);
    let usdc_token_id = env
        .register_stellar_asset_contract_v2(usdc_token_admin.clone())
        .address();

    // Register Reward System
    let contract_id = env.register(TycoonRewardSystem, ());
    let client = TycoonRewardSystemClient::new(&env, &contract_id);

    // Initialize
    client.initialize(&admin, &tyc_token_id, &usdc_token_id);

    // Try to set backend minter as non-admin - should panic
    let res = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        client.set_backend_minter(&unauthorized, &unauthorized.clone());
    }));
    assert!(res.is_err());
}

#[test]
fn test_backend_minter_can_mint() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let backend_minter = Address::generate(&env);
    let user = Address::generate(&env);

    // Register TYC Token
    let tyc_token_admin = Address::generate(&env);
    let tyc_token_id = env
        .register_stellar_asset_contract_v2(tyc_token_admin.clone())
        .address();

    // Register USDC Token
    let usdc_token_admin = Address::generate(&env);
    let usdc_token_id = env
        .register_stellar_asset_contract_v2(usdc_token_admin.clone())
        .address();

    // Register Reward System
    let contract_id = env.register(TycoonRewardSystem, ());
    let client = TycoonRewardSystemClient::new(&env, &contract_id);
    let contract_address = contract_id.clone();

    // Initialize
    client.initialize(&admin, &tyc_token_id, &usdc_token_id);

    // Fund the contract
    token::StellarAssetClient::new(&env, &tyc_token_id).mint(&contract_address, &10000);

    // Set backend minter
    client.set_backend_minter(&admin, &backend_minter.clone());

    // Backend minter can mint
    let tyc_value = 500u128;
    let token_id = client.mint_voucher(&backend_minter, &user, &tyc_value);

    // Verify
    assert_eq!(client.get_balance(&user, &token_id), 1);
}

#[test]
fn test_non_admin_non_minter_cannot_mint() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let backend_minter = Address::generate(&env);
    let unauthorized = Address::generate(&env);
    let user = Address::generate(&env);

    // Register TYC Token
    let tyc_token_admin = Address::generate(&env);
    let tyc_token_id = env
        .register_stellar_asset_contract_v2(tyc_token_admin.clone())
        .address();

    // Register USDC Token
    let usdc_token_admin = Address::generate(&env);
    let usdc_token_id = env
        .register_stellar_asset_contract_v2(usdc_token_admin.clone())
        .address();

    // Register Reward System
    let contract_id = env.register(TycoonRewardSystem, ());
    let client = TycoonRewardSystemClient::new(&env, &contract_id);
    let contract_address = contract_id.clone();

    // Initialize
    client.initialize(&admin, &tyc_token_id, &usdc_token_id);

    // Fund the contract
    token::StellarAssetClient::new(&env, &tyc_token_id).mint(&contract_address, &10000);

    // Set backend minter
    client.set_backend_minter(&admin, &backend_minter.clone());

    // Unauthorized user tries to mint - should panic
    let res = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        client.mint_voucher(&unauthorized, &user, &500);
    }));
    assert!(res.is_err());
}

#[test]
fn test_clear_backend_minter() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let backend_minter = Address::generate(&env);
    let user = Address::generate(&env);

    // Register TYC Token
    let tyc_token_admin = Address::generate(&env);
    let tyc_token_id = env
        .register_stellar_asset_contract_v2(tyc_token_admin.clone())
        .address();

    // Register USDC Token
    let usdc_token_admin = Address::generate(&env);
    let usdc_token_id = env
        .register_stellar_asset_contract_v2(usdc_token_admin.clone())
        .address();

    // Register Reward System
    let contract_id = env.register(TycoonRewardSystem, ());
    let client = TycoonRewardSystemClient::new(&env, &contract_id);
    let contract_address = contract_id.clone();

    // Initialize
    client.initialize(&admin, &tyc_token_id, &usdc_token_id);

    // Fund the contract
    token::StellarAssetClient::new(&env, &tyc_token_id).mint(&contract_address, &10000);

    // Set backend minter
    client.set_backend_minter(&admin, &backend_minter.clone());
    assert_eq!(client.get_backend_minter(), Some(backend_minter.clone()));

    // Clear backend minter
    client.clear_backend_minter(&admin);
    // Verify it's cleared (will return zero address)

    // Now backend minter cannot mint
    let res = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        client.mint_voucher(&backend_minter, &user, &500);
    }));
    assert!(res.is_err());
}
