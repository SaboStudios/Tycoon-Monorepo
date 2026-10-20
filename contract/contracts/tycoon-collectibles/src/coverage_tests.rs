//! SW-CT-020: Targeted coverage tests for tycoon-collectibles
//!
//! Covers paths not exercised by the main test.rs:
//!   - `set_fee_config` + `buy_collectible_from_shop` with fee distribution
//!     via the `stock_shop` flow (not `set_collectible_for_sale`)
//!   - `migrate` state-version transitions (idempotent re-run)
//!   - `set_backend_minter` rejection when new_minter == contract address
//!   - `token_uri` when no base URI is configured (returns empty string)
//!   - `update_collectible_prices` happy-path via `stock_shop` token
//!   - `stock_shop` + `buy_collectible_from_shop` without fee config
//!   - `is_contract_paused` / `set_pause` state transitions

use super::*;
use soroban_sdk::{
    testutils::Address as _,
    token::{StellarAssetClient, TokenClient},
    Address, Env,
};
extern crate std;

fn make_token(env: &Env, admin: &Address) -> Address {
    env.register_stellar_asset_contract_v2(admin.clone())
        .address()
}

// ── migrate ──────────────────────────────────────────────────────────────────

/// `migrate` on a freshly-initialized contract (version already 1) is a
/// no-op and must not error.
#[test]
fn test_migrate_noop_when_already_v1() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(TycoonCollectibles, ());
    let client = TycoonCollectiblesClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    client.initialize(&admin);

    client.migrate(); // must not panic
}

/// `migrate` called twice must remain idempotent.
#[test]
fn test_migrate_idempotent() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(TycoonCollectibles, ());
    let client = TycoonCollectiblesClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    client.initialize(&admin);

    client.migrate();
    client.migrate(); // second call must not panic
}

// ── set_fee_config ────────────────────────────────────────────────────────────

/// `set_fee_config` stores the config; a subsequent shop purchase routes
/// fees correctly (platform + pool + creator + residue all sum to price).
#[test]
fn test_set_fee_config_and_buy_distributes_fees() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(TycoonCollectibles, ());
    let client = TycoonCollectiblesClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    client.initialize(&admin);

    let tyc_token = make_token(&env, &admin);
    let usdc_token = make_token(&env, &admin);
    client.init_shop(&tyc_token, &usdc_token);

    let platform = Address::generate(&env);
    let pool = Address::generate(&env);

    // 10% platform, 5% creator, 5% pool → 80% residue to contract
    client.set_fee_config(&1000, &500, &500, &platform, &pool);

    // Stock a collectible: perk=1 (CashTiered), strength=1, price=1000 TYC
    let token_id = client.stock_shop(&10, &1, &1, &1000, &0);

    let buyer = Address::generate(&env);
    StellarAssetClient::new(&env, &tyc_token).mint(&buyer, &2000);

    client.buy_collectible_from_shop(&buyer, &token_id, &false);

    // Buyer received the collectible
    assert_eq!(client.balance_of(&buyer, &token_id), 1);
    // Platform received 10% of 1000 = 100
    assert_eq!(TokenClient::new(&env, &tyc_token).balance(&platform), 100);
    // Pool received 5% of 1000 = 50
    assert_eq!(TokenClient::new(&env, &tyc_token).balance(&pool), 50);
    // Buyer spent 1000 (started with 2000)
    assert_eq!(TokenClient::new(&env, &tyc_token).balance(&buyer), 1000);
}

/// `set_fee_config` with all-zero fees: entire price goes to contract as residue.
#[test]
fn test_set_fee_config_zero_fees_residue_to_contract() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(TycoonCollectibles, ());
    let client = TycoonCollectiblesClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    client.initialize(&admin);

    let tyc_token = make_token(&env, &admin);
    let usdc_token = make_token(&env, &admin);
    client.init_shop(&tyc_token, &usdc_token);

    let platform = Address::generate(&env);
    let pool = Address::generate(&env);
    client.set_fee_config(&0, &0, &0, &platform, &pool);

    // perk=3 RentBoost, strength=0 (non-tiered, no strength validation)
    let token_id = client.stock_shop(&5, &3, &0, &500, &0);

    let buyer = Address::generate(&env);
    StellarAssetClient::new(&env, &tyc_token).mint(&buyer, &1000);

    client.buy_collectible_from_shop(&buyer, &token_id, &false);

    assert_eq!(client.balance_of(&buyer, &token_id), 1);
    // Platform and pool got nothing
    assert_eq!(TokenClient::new(&env, &tyc_token).balance(&platform), 0);
    assert_eq!(TokenClient::new(&env, &tyc_token).balance(&pool), 0);
    // Buyer spent 500
    assert_eq!(TokenClient::new(&env, &tyc_token).balance(&buyer), 500);
}

// ── set_backend_minter self-address rejection ─────────────────────────────────

/// `set_backend_minter` must reject the contract's own address.
#[test]
fn test_set_backend_minter_rejects_self() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(TycoonCollectibles, ());
    let client = TycoonCollectiblesClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    client.initialize(&admin);

    // Passing the contract address itself must return Unauthorized
    let result = client.try_set_backend_minter(&contract_id);
    assert!(result.is_err());
}

// ── token_uri with no base URI ────────────────────────────────────────────────

/// `token_uri` returns an empty string when no base URI has been configured.
#[test]
fn test_token_uri_no_base_uri_returns_empty() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(TycoonCollectibles, ());
    let client = TycoonCollectiblesClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    client.initialize(&admin);

    // Mint a token so it exists (perk=1 CashTiered, strength=1)
    let token_id = client.stock_shop(&1, &1, &1, &0, &0);

    let uri = client.token_uri(&token_id);
    assert_eq!(uri.len(), 0);
}

// ── update_collectible_prices via stock_shop token ────────────────────────────

/// `update_collectible_prices` changes the price of a stocked collectible.
#[test]
fn test_update_prices_on_stocked_collectible() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(TycoonCollectibles, ());
    let client = TycoonCollectiblesClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    client.initialize(&admin);

    let tyc_token = make_token(&env, &admin);
    let usdc_token = make_token(&env, &admin);
    client.init_shop(&tyc_token, &usdc_token);

    // Stock with initial price 1000 TYC
    let token_id = client.stock_shop(&5, &1, &1, &1000, &200);

    // Update to 500 TYC / 100 USDC
    client.update_collectible_prices(&token_id, &500, &100);

    // Buy at new price
    let buyer = Address::generate(&env);
    StellarAssetClient::new(&env, &tyc_token).mint(&buyer, &1000);

    client.buy_collectible_from_shop(&buyer, &token_id, &false);

    // Buyer spent 500 (new price), not 1000
    assert_eq!(TokenClient::new(&env, &tyc_token).balance(&buyer), 500);
    assert_eq!(client.balance_of(&buyer, &token_id), 1);
}

// ── stock_shop + buy full round-trip (no fee config) ─────────────────────────

/// Full round-trip: stock_shop → buy_collectible_from_shop without fee config.
/// Verifies the "no fee config" branch transfers full price to contract.
#[test]
fn test_stock_shop_buy_no_fee_config() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(TycoonCollectibles, ());
    let client = TycoonCollectiblesClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    client.initialize(&admin);

    let tyc_token = make_token(&env, &admin);
    let usdc_token = make_token(&env, &admin);
    client.init_shop(&tyc_token, &usdc_token);

    // perk=5 ExtraTurn, strength=0 (non-tiered)
    let token_id = client.stock_shop(&3, &5, &0, &200, &0);

    let buyer = Address::generate(&env);
    StellarAssetClient::new(&env, &tyc_token).mint(&buyer, &600);

    client.buy_collectible_from_shop(&buyer, &token_id, &false);
    assert_eq!(client.balance_of(&buyer, &token_id), 1);
    assert_eq!(client.get_stock(&token_id), 2);

    // Contract received the full price
    assert_eq!(
        TokenClient::new(&env, &tyc_token).balance(&contract_id),
        200
    );
}

// ── is_contract_paused / set_pause ────────────────────────────────────────────

/// `is_contract_paused` reflects the pause state set by admin.
#[test]
fn test_is_contract_paused_reflects_state() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(TycoonCollectibles, ());
    let client = TycoonCollectiblesClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    client.initialize(&admin);

    assert!(!client.is_contract_paused());
    client.set_pause(&true);
    assert!(client.is_contract_paused());
    client.set_pause(&false);
    assert!(!client.is_contract_paused());
}
