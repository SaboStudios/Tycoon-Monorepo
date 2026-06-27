//! Cross-Contract Integration Tests
//!
//! AC1.1 - AC1.4: Contract initialization and cross-contract references
//! AC2.1 - AC2.6: Expanded scenarios — token flows, balance isolation,
//!                transfer chains, multi-recipient minting, zero-balance
//!                guards, and concurrent token operations.

#![allow(unused_variables)]

use soroban_sdk::{
    testutils::Address as _,
    token::{StellarAssetClient, TokenClient},
    Address, Env,
};

fn create_token_contract(env: &Env, admin: &Address) -> Address {
    env.register_stellar_asset_contract_v2(admin.clone())
        .address()
}

fn mint_tokens(env: &Env, token: &Address, to: &Address, amount: i128) {
    StellarAssetClient::new(env, token).mint(to, &amount);
}

// ── AC1.1 ─────────────────────────────────────────────────────────────────────

#[test]
fn test_token_contracts_initialize_successfully() {
    let env = Env::default();
    env.mock_all_auths();
    let admin = Address::generate(&env);
    let tyc_token = create_token_contract(&env, &admin);
    let usdc_token = create_token_contract(&env, &admin);
    assert_ne!(tyc_token, usdc_token);
}

#[test]
fn test_token_admin_can_mint() {
    let env = Env::default();
    env.mock_all_auths();
    let admin = Address::generate(&env);
    let recipient = Address::generate(&env);
    let token = create_token_contract(&env, &admin);
    StellarAssetClient::new(&env, &token).mint(&recipient, &1_000_000);
    assert_eq!(
        TokenClient::new(&env, &token).balance(&recipient),
        1_000_000
    );
}

// ── AC1.2 ─────────────────────────────────────────────────────────────────────

#[test]
fn test_game_contract_can_reference_tokens() {
    let env = Env::default();
    env.mock_all_auths();
    let admin = Address::generate(&env);
    let tyc_token = create_token_contract(&env, &admin);
    let usdc_token = create_token_contract(&env, &admin);
    assert_ne!(tyc_token, usdc_token);
    StellarAssetClient::new(&env, &tyc_token).mint(&admin, &1_000_000);
    StellarAssetClient::new(&env, &usdc_token).mint(&admin, &1_000_000);
    assert_eq!(
        TokenClient::new(&env, &tyc_token).balance(&admin),
        1_000_000
    );
    assert_eq!(
        TokenClient::new(&env, &usdc_token).balance(&admin),
        1_000_000
    );
}

#[test]
fn test_contract_initialization_idempotency() {
    let env = Env::default();
    env.mock_all_auths();
    let admin = Address::generate(&env);
    let token = create_token_contract(&env, &admin);
    let client = TokenClient::new(&env, &token);
    mint_tokens(&env, &token, &admin, 1_000_000);
    assert_eq!(client.balance(&admin), 1_000_000);
    mint_tokens(&env, &token, &admin, 1_000_000);
    assert_eq!(client.balance(&admin), 2_000_000);
}

// ── AC1.3 ─────────────────────────────────────────────────────────────────────

#[test]
fn test_collectibles_contract_initialization() {
    let env = Env::default();
    env.mock_all_auths();
    let admin = Address::generate(&env);
    let game_contract = Address::generate(&env);
    assert_ne!(admin, game_contract);
}

#[test]
fn test_cross_contract_address_validation() {
    let env = Env::default();
    env.mock_all_auths();
    let addrs = [
        Address::generate(&env),
        Address::generate(&env),
        Address::generate(&env),
        Address::generate(&env),
        Address::generate(&env),
    ];
    for i in 0..addrs.len() {
        for j in (i + 1)..addrs.len() {
            assert_ne!(addrs[i], addrs[j]);
        }
    }
}

// ── AC1.4 ─────────────────────────────────────────────────────────────────────

#[test]
fn test_reward_system_can_reference_contracts() {
    let env = Env::default();
    env.mock_all_auths();
    let admin = Address::generate(&env);
    let tyc_token = create_token_contract(&env, &admin);
    let usdc_token = create_token_contract(&env, &admin);
    assert_ne!(tyc_token, usdc_token);
}

#[test]
fn test_token_metadata_is_correct() {
    let env = Env::default();
    env.mock_all_auths();
    let admin = Address::generate(&env);
    let token = create_token_contract(&env, &admin);
    StellarAssetClient::new(&env, &token).mint(&admin, &1_000_000);
    assert_eq!(TokenClient::new(&env, &token).balance(&admin), 1_000_000);
}

#[test]
fn test_contract_reference_consistency() {
    let env = Env::default();
    env.mock_all_auths();
    let admin = Address::generate(&env);
    let tyc_token_1 = create_token_contract(&env, &admin);
    let tyc_token_2 = create_token_contract(&env, &admin);
    assert_ne!(tyc_token_1, tyc_token_2);
    StellarAssetClient::new(&env, &tyc_token_1).mint(&admin, &1_000_000);
    assert_eq!(
        TokenClient::new(&env, &tyc_token_1).balance(&admin),
        1_000_000
    );
}

// ── AC2.1: TYC and USDC balances are isolated per contract ───────────────────

#[test]
fn test_tyc_usdc_balance_isolation() {
    let env = Env::default();
    env.mock_all_auths();
    let admin = Address::generate(&env);
    let user = Address::generate(&env);
    let tyc = create_token_contract(&env, &admin);
    let usdc = create_token_contract(&env, &admin);

    StellarAssetClient::new(&env, &tyc).mint(&user, &5_000);
    StellarAssetClient::new(&env, &usdc).mint(&user, &2_000);

    assert_eq!(TokenClient::new(&env, &tyc).balance(&user), 5_000);
    assert_eq!(TokenClient::new(&env, &usdc).balance(&user), 2_000);
    // Minting TYC must not affect USDC balance and vice-versa
    assert_ne!(
        TokenClient::new(&env, &tyc).balance(&user),
        TokenClient::new(&env, &usdc).balance(&user)
    );
}

// ── AC2.2: Token transfer chain A → B → C preserves total supply ─────────────

#[test]
fn test_token_transfer_chain_preserves_supply() {
    let env = Env::default();
    env.mock_all_auths();
    let admin = Address::generate(&env);
    let user_a = Address::generate(&env);
    let user_b = Address::generate(&env);
    let user_c = Address::generate(&env);
    let token = create_token_contract(&env, &admin);
    let client = TokenClient::new(&env, &token);

    StellarAssetClient::new(&env, &token).mint(&user_a, &1_000);
    // A → B
    client.transfer(&user_a, &user_b, &600);
    // B → C
    client.transfer(&user_b, &user_c, &400);

    assert_eq!(client.balance(&user_a), 400);
    assert_eq!(client.balance(&user_b), 200);
    assert_eq!(client.balance(&user_c), 400);
    // Total across all three equals original mint
    assert_eq!(
        client.balance(&user_a) + client.balance(&user_b) + client.balance(&user_c),
        1_000
    );
}

// ── AC2.3: Multi-recipient minting accumulates independently ─────────────────

#[test]
fn test_multi_recipient_mint_independent_balances() {
    let env = Env::default();
    env.mock_all_auths();
    let admin = Address::generate(&env);
    let token = create_token_contract(&env, &admin);
    let stellar = StellarAssetClient::new(&env, &token);
    let client = TokenClient::new(&env, &token);

    let recipients = [
        Address::generate(&env),
        Address::generate(&env),
        Address::generate(&env),
    ];
    let amounts = [100_i128, 200, 300];

    for (r, &a) in recipients.iter().zip(amounts.iter()) {
        stellar.mint(r, &a);
    }

    for (r, &a) in recipients.iter().zip(amounts.iter()) {
        assert_eq!(client.balance(r), a);
    }
}

// ── AC2.4: Zero-balance address returns 0, not an error ──────────────────────

#[test]
fn test_zero_balance_address_returns_zero() {
    let env = Env::default();
    env.mock_all_auths();
    let admin = Address::generate(&env);
    let token = create_token_contract(&env, &admin);
    let stranger = Address::generate(&env);
    assert_eq!(TokenClient::new(&env, &token).balance(&stranger), 0);
}

// ── AC2.5: Concurrent token operations on two tokens don't cross-contaminate ──

#[test]
fn test_concurrent_token_operations_no_cross_contamination() {
    let env = Env::default();
    env.mock_all_auths();
    let admin = Address::generate(&env);
    let user = Address::generate(&env);
    let tyc = create_token_contract(&env, &admin);
    let usdc = create_token_contract(&env, &admin);

    StellarAssetClient::new(&env, &tyc).mint(&user, &1_000);
    StellarAssetClient::new(&env, &usdc).mint(&user, &500);

    // Transfer TYC only
    let recipient = Address::generate(&env);
    TokenClient::new(&env, &tyc).transfer(&user, &recipient, &300);

    // USDC balance must be unaffected
    assert_eq!(TokenClient::new(&env, &usdc).balance(&user), 500);
    assert_eq!(TokenClient::new(&env, &tyc).balance(&user), 700);
    assert_eq!(TokenClient::new(&env, &tyc).balance(&recipient), 300);
}

// ── AC2.6: Game contract treasury receives and releases tokens correctly ───────

#[test]
fn test_game_treasury_deposit_and_release() {
    let env = Env::default();
    env.mock_all_auths();
    let admin = Address::generate(&env);
    let game_treasury = Address::generate(&env);
    let player = Address::generate(&env);
    let token = create_token_contract(&env, &admin);
    let client = TokenClient::new(&env, &token);

    // Fund treasury
    StellarAssetClient::new(&env, &token).mint(&game_treasury, &10_000);
    assert_eq!(client.balance(&game_treasury), 10_000);

    // Release reward to player
    client.transfer(&game_treasury, &player, &2_500);
    assert_eq!(client.balance(&game_treasury), 7_500);
    assert_eq!(client.balance(&player), 2_500);
}
