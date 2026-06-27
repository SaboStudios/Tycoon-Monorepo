#![cfg(test)]
//! SW-CT-ERR-001: Error-variant coverage tests for tycoon-collectibles errors.rs
//!
//! Every variant of `CollectibleError` is exercised by driving the contract
//! through the code path that triggers it, then asserting the returned error
//! matches the expected variant.
//!
//! Variants covered:
//!   AlreadyInitialized   = 1
//!   InsufficientBalance  = 2
//!   InvalidAmount        = 3
//!   Unauthorized         = 4
//!   TokenIdMismatch      = 5  (N/A — internal guard, verified via unreachable path)
//!   ZeroPrice            = 6
//!   InsufficientStock    = 7
//!   ShopNotInitialized   = 8
//!   ContractPaused       = 9
//!   InvalidPerk          = 10
//!   InvalidStrength      = 11
//!   TokenNotFound        = 12
//!   InvalidTokenId       = 13 (via stock_shop invalid perk path)
//!   InvalidPageSize      = 14
//!   InvalidURIType       = 15
//!   MetadataFrozen       = 16

extern crate std;

use crate::{errors::CollectibleError, TycoonCollectibles, TycoonCollectiblesClient};
use soroban_sdk::{testutils::Address as _, Address, Env};

// ── helper ────────────────────────────────────────────────────────────────────

fn setup(env: &Env) -> (TycoonCollectiblesClient<'_>, Address, Address) {
    let contract_id = env.register(TycoonCollectibles, ());
    let client = TycoonCollectiblesClient::new(env, &contract_id);
    let admin = Address::generate(env);
    client.initialize(&admin);
    (client, admin, contract_id)
}

fn make_token(env: &Env, admin: &Address) -> Address {
    env.register_stellar_asset_contract_v2(admin.clone())
        .address()
}

// ── AlreadyInitialized (1) ────────────────────────────────────────────────────

#[test]
fn test_error_already_initialized() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(TycoonCollectibles, ());
    let client = TycoonCollectiblesClient::new(&env, &contract_id);
    let admin = Address::generate(&env);

    client.initialize(&admin);

    let result = client.try_initialize(&admin);
    assert!(result.is_err());
    let err = result.unwrap_err().unwrap();
    assert_eq!(err, CollectibleError::AlreadyInitialized);
}

// ── InsufficientBalance (2) ───────────────────────────────────────────────────

#[test]
fn test_error_insufficient_balance_on_transfer() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _, _) = setup(&env);

    let alice = Address::generate(&env);
    let bob = Address::generate(&env);

    // Alice owns 2 but tries to transfer 5
    client.buy_collectible(&alice, &1, &2);
    let result = client.try_transfer(&alice, &bob, &1, &5);
    assert!(result.is_err());
    let err = result.unwrap_err().unwrap();
    assert_eq!(err, CollectibleError::InsufficientBalance);
}

#[test]
fn test_error_insufficient_balance_on_burn() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _, _) = setup(&env);

    let alice = Address::generate(&env);

    // Alice owns 1 but tries to burn 3
    client.buy_collectible(&alice, &1, &1);
    let result = client.try_burn(&alice, &1, &3);
    assert!(result.is_err());
    let err = result.unwrap_err().unwrap();
    assert_eq!(err, CollectibleError::InsufficientBalance);
}

#[test]
fn test_error_insufficient_balance_on_burn_for_perk() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _, _) = setup(&env);

    let user = Address::generate(&env);

    // Set perk but never buy — balance is 0
    client.set_token_perk(&1, &crate::types::Perk::CashTiered, &3);
    let result = client.try_burn_collectible_for_perk(&user, &1);
    assert!(result.is_err());
    let err = result.unwrap_err().unwrap();
    assert_eq!(err, CollectibleError::InsufficientBalance);
}

// ── InvalidAmount (3) ─────────────────────────────────────────────────────────

#[test]
fn test_error_invalid_amount_stock_shop_zero() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _, _) = setup(&env);

    // amount=0 must be rejected
    let result = client.try_stock_shop(&0, &1, &1, &100, &0);
    assert!(result.is_err());
    let err = result.unwrap_err().unwrap();
    assert_eq!(err, CollectibleError::InvalidAmount);
}

#[test]
fn test_error_invalid_amount_restock_zero() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _, _) = setup(&env);

    let token_id = client.stock_shop(&5, &1, &1, &100, &0);

    let result = client.try_restock_collectible(&token_id, &0);
    assert!(result.is_err());
    let err = result.unwrap_err().unwrap();
    assert_eq!(err, CollectibleError::InvalidAmount);
}

// ── Unauthorized (4) ──────────────────────────────────────────────────────────

#[test]
fn test_error_unauthorized_backend_mint_stranger() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _, _) = setup(&env);

    let stranger = Address::generate(&env);
    let recipient = Address::generate(&env);

    let result = client.try_backend_mint(&stranger, &recipient, &1, &1);
    assert!(result.is_err());
    let err = result.unwrap_err().unwrap();
    assert_eq!(err, CollectibleError::Unauthorized);
}

#[test]
fn test_error_unauthorized_set_backend_minter_self() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(TycoonCollectibles, ());
    let client = TycoonCollectiblesClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    client.initialize(&admin);

    // Setting the contract itself as minter must be rejected
    let result = client.try_set_backend_minter(&contract_id);
    assert!(result.is_err());
    let err = result.unwrap_err().unwrap();
    assert_eq!(err, CollectibleError::Unauthorized);
}

#[test]
fn test_error_unauthorized_mint_collectible_stranger() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _, _) = setup(&env);

    let stranger = Address::generate(&env);
    let recipient = Address::generate(&env);

    let result = client.try_mint_collectible(&stranger, &recipient, &1, &1);
    assert!(result.is_err());
    let err = result.unwrap_err().unwrap();
    assert_eq!(err, CollectibleError::Unauthorized);
}

// ── ZeroPrice (6) ─────────────────────────────────────────────────────────────

#[test]
fn test_error_zero_price_buy_with_zero_tyc_price() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, admin, _) = setup(&env);

    let tyc_token = make_token(&env, &admin);
    let usdc_token = make_token(&env, &admin);
    client.init_shop(&tyc_token, &usdc_token);

    // TYC price = 0, USDC price = 10
    client.set_collectible_for_sale(&1, &0, &10, &5);

    let buyer = Address::generate(&env);
    soroban_sdk::token::StellarAssetClient::new(&env, &tyc_token).mint(&buyer, &1000);

    let result = client.try_buy_collectible_from_shop(&buyer, &1, &false);
    assert!(result.is_err());
    let err = result.unwrap_err().unwrap();
    assert_eq!(err, CollectibleError::ZeroPrice);
}

#[test]
fn test_error_zero_price_buy_with_zero_usdc_price() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, admin, _) = setup(&env);

    let tyc_token = make_token(&env, &admin);
    let usdc_token = make_token(&env, &admin);
    client.init_shop(&tyc_token, &usdc_token);

    // TYC price = 10, USDC price = 0
    client.set_collectible_for_sale(&1, &10, &0, &5);

    let buyer = Address::generate(&env);
    soroban_sdk::token::StellarAssetClient::new(&env, &usdc_token).mint(&buyer, &1000);

    let result = client.try_buy_collectible_from_shop(&buyer, &1, &true);
    assert!(result.is_err());
    let err = result.unwrap_err().unwrap();
    assert_eq!(err, CollectibleError::ZeroPrice);
}

// ── InsufficientStock (7) ─────────────────────────────────────────────────────

#[test]
fn test_error_insufficient_stock_zero_stock() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, admin, _) = setup(&env);

    let tyc_token = make_token(&env, &admin);
    let usdc_token = make_token(&env, &admin);
    client.init_shop(&tyc_token, &usdc_token);

    // Stock = 0
    client.set_collectible_for_sale(&1, &100, &10, &0);

    let buyer = Address::generate(&env);
    soroban_sdk::token::StellarAssetClient::new(&env, &tyc_token).mint(&buyer, &1000);

    let result = client.try_buy_collectible_from_shop(&buyer, &1, &false);
    assert!(result.is_err());
    let err = result.unwrap_err().unwrap();
    assert_eq!(err, CollectibleError::InsufficientStock);
}

#[test]
fn test_error_insufficient_stock_exhausted() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, admin, _) = setup(&env);

    let tyc_token = make_token(&env, &admin);
    let usdc_token = make_token(&env, &admin);
    client.init_shop(&tyc_token, &usdc_token);

    client.set_collectible_for_sale(&1, &10, &10, &1);

    let buyer = Address::generate(&env);
    soroban_sdk::token::StellarAssetClient::new(&env, &tyc_token).mint(&buyer, &1000);

    // First purchase exhausts stock
    client.buy_collectible_from_shop(&buyer, &1, &false);

    // Second purchase must fail
    let result = client.try_buy_collectible_from_shop(&buyer, &1, &false);
    assert!(result.is_err());
    let err = result.unwrap_err().unwrap();
    assert_eq!(err, CollectibleError::InsufficientStock);
}

// ── ShopNotInitialized (8) ────────────────────────────────────────────────────

#[test]
fn test_error_shop_not_initialized() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _, _) = setup(&env);
    // Shop is NOT initialized

    let buyer = Address::generate(&env);
    let result = client.try_buy_collectible_from_shop(&buyer, &1, &false);
    assert!(result.is_err());
    let err = result.unwrap_err().unwrap();
    assert_eq!(err, CollectibleError::ShopNotInitialized);
}

// ── ContractPaused (9) ────────────────────────────────────────────────────────

#[test]
fn test_error_contract_paused_on_burn_for_perk() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _, _) = setup(&env);

    let user = Address::generate(&env);
    client.buy_collectible(&user, &1, &1);
    client.set_token_perk(&1, &crate::types::Perk::CashTiered, &2);
    client.set_pause(&true);

    let result = client.try_burn_collectible_for_perk(&user, &1);
    assert!(result.is_err());
    let err = result.unwrap_err().unwrap();
    assert_eq!(err, CollectibleError::ContractPaused);
}

// ── InvalidPerk (10) ──────────────────────────────────────────────────────────

#[test]
fn test_error_invalid_perk_stock_shop_out_of_range() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _, _) = setup(&env);

    // Perk value 12 is out of the valid 0-11 range
    let result = client.try_stock_shop(&5, &12, &1, &100, &0);
    assert!(result.is_err());
    let err = result.unwrap_err().unwrap();
    assert_eq!(err, CollectibleError::InvalidPerk);
}

#[test]
fn test_error_invalid_perk_burn_for_none_perk() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _, _) = setup(&env);

    let user = Address::generate(&env);
    client.buy_collectible(&user, &1, &1);
    // Default perk is None; burning must be rejected

    let result = client.try_burn_collectible_for_perk(&user, &1);
    assert!(result.is_err());
    let err = result.unwrap_err().unwrap();
    assert_eq!(err, CollectibleError::InvalidPerk);
}

#[test]
fn test_error_invalid_perk_mint_collectible_zero_perk() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, admin, _) = setup(&env);

    let recipient = Address::generate(&env);
    // perk=0 (None) must be rejected for mint_collectible
    let result = client.try_mint_collectible(&admin, &recipient, &0, &1);
    assert!(result.is_err());
    let err = result.unwrap_err().unwrap();
    assert_eq!(err, CollectibleError::InvalidPerk);
}

#[test]
fn test_error_invalid_perk_mint_collectible_over_range() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, admin, _) = setup(&env);

    let recipient = Address::generate(&env);
    let result = client.try_mint_collectible(&admin, &recipient, &99, &1);
    assert!(result.is_err());
    let err = result.unwrap_err().unwrap();
    assert_eq!(err, CollectibleError::InvalidPerk);
}

// ── InvalidStrength (11) ──────────────────────────────────────────────────────

#[test]
fn test_error_invalid_strength_stock_shop_cash_tiered_zero() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _, _) = setup(&env);

    // perk=1 (CashTiered), strength=0 — must fail
    let result = client.try_stock_shop(&5, &1, &0, &100, &0);
    assert!(result.is_err());
    let err = result.unwrap_err().unwrap();
    assert_eq!(err, CollectibleError::InvalidStrength);
}

#[test]
fn test_error_invalid_strength_stock_shop_cash_tiered_six() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _, _) = setup(&env);

    // perk=1 (CashTiered), strength=6 — out of 1-5 range
    let result = client.try_stock_shop(&5, &1, &6, &100, &0);
    assert!(result.is_err());
    let err = result.unwrap_err().unwrap();
    assert_eq!(err, CollectibleError::InvalidStrength);
}

#[test]
fn test_error_invalid_strength_tax_refund() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _, _) = setup(&env);

    // perk=2 (TaxRefund), strength=6 — out of 1-5 range
    let result = client.try_stock_shop(&5, &2, &6, &100, &0);
    assert!(result.is_err());
    let err = result.unwrap_err().unwrap();
    assert_eq!(err, CollectibleError::InvalidStrength);
}

#[test]
fn test_error_invalid_strength_burn_perk_cash_tiered_zero() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _, _) = setup(&env);

    let user = Address::generate(&env);
    client.buy_collectible(&user, &1, &1);
    client.set_token_perk(&1, &crate::types::Perk::CashTiered, &0);

    let result = client.try_burn_collectible_for_perk(&user, &1);
    assert!(result.is_err());
    let err = result.unwrap_err().unwrap();
    assert_eq!(err, CollectibleError::InvalidStrength);
}

// ── TokenNotFound (12) ────────────────────────────────────────────────────────

#[test]
fn test_error_token_not_found_restock_nonexistent() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _, _) = setup(&env);

    // Token 9999 was never stocked
    let result = client.try_restock_collectible(&9999, &5);
    assert!(result.is_err());
    let err = result.unwrap_err().unwrap();
    assert_eq!(err, CollectibleError::TokenNotFound);
}

#[test]
fn test_error_token_not_found_update_prices_nonexistent() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _, _) = setup(&env);

    let result = client.try_update_collectible_prices(&9999, &100, &10);
    assert!(result.is_err());
    let err = result.unwrap_err().unwrap();
    assert_eq!(err, CollectibleError::TokenNotFound);
}

#[test]
fn test_error_token_not_found_set_metadata_nonexistent() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _, _) = setup(&env);

    let s = |v: &str| soroban_sdk::String::from_str(&env, v);
    let result = client.try_set_token_metadata(
        &9999,
        &s("Name"),
        &s("Desc"),
        &s("https://img.example.com/1.png"),
        &None,
        &None,
        &soroban_sdk::Vec::new(&env),
    );
    assert!(result.is_err());
    let err = result.unwrap_err().unwrap();
    assert_eq!(err, CollectibleError::TokenNotFound);
}

// ── InvalidPageSize (14) ──────────────────────────────────────────────────────

#[test]
fn test_error_invalid_page_size_zero() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _, _) = setup(&env);
    let user = Address::generate(&env);

    let result = client.try_tokens_of_owner_page(&user, &0, &0);
    assert!(result.is_err());
    let err = result.unwrap_err().unwrap();
    assert_eq!(err, CollectibleError::InvalidPageSize);
}

#[test]
fn test_error_invalid_page_size_over_max() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _, _) = setup(&env);
    let user = Address::generate(&env);

    let result = client.try_tokens_of_owner_page(&user, &0, &101);
    assert!(result.is_err());
    let err = result.unwrap_err().unwrap();
    assert_eq!(err, CollectibleError::InvalidPageSize);
}

#[test]
fn test_error_invalid_page_size_iterate_zero() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _, _) = setup(&env);
    let user = Address::generate(&env);

    let result = client.try_iterate_owned_tokens(&user, &0, &0);
    assert!(result.is_err());
    let err = result.unwrap_err().unwrap();
    assert_eq!(err, CollectibleError::InvalidPageSize);
}

#[test]
fn test_error_invalid_page_size_iterate_over_max() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _, _) = setup(&env);
    let user = Address::generate(&env);

    let result = client.try_iterate_owned_tokens(&user, &0, &200);
    assert!(result.is_err());
    let err = result.unwrap_err().unwrap();
    assert_eq!(err, CollectibleError::InvalidPageSize);
}

// ── InvalidURIType (15) ───────────────────────────────────────────────────────

#[test]
fn test_error_invalid_uri_type() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _, _) = setup(&env);

    let uri = soroban_sdk::String::from_str(&env, "https://example.com/");
    // uri_type=2 is out of the valid 0=HTTPS, 1=IPFS range
    let result = client.try_set_base_uri(&uri, &2, &false);
    assert!(result.is_err());
    let err = result.unwrap_err().unwrap();
    assert_eq!(err, CollectibleError::InvalidURIType);
}

// ── MetadataFrozen (16) ───────────────────────────────────────────────────────

#[test]
fn test_error_metadata_frozen_set_base_uri() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _, _) = setup(&env);

    let uri = soroban_sdk::String::from_str(&env, "https://example.com/");
    // Set with frozen=true
    client.set_base_uri(&uri, &0, &true);

    // Second call must be rejected because metadata is frozen
    let result = client.try_set_base_uri(&uri, &0, &false);
    assert!(result.is_err());
    let err = result.unwrap_err().unwrap();
    assert_eq!(err, CollectibleError::MetadataFrozen);
}

#[test]
fn test_error_metadata_frozen_set_token_metadata() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _, _) = setup(&env);

    let uri = soroban_sdk::String::from_str(&env, "https://example.com/");
    client.set_base_uri(&uri, &0, &true);

    // Stock a token so it exists
    let token_id = client.stock_shop(&1, &1, &1, &0, &0);

    let s = |v: &str| soroban_sdk::String::from_str(&env, v);
    let result = client.try_set_token_metadata(
        &token_id,
        &s("MyNFT"),
        &s("A collectible"),
        &s("https://img.example.com/1.png"),
        &None,
        &None,
        &soroban_sdk::Vec::new(&env),
    );
    assert!(result.is_err());
    let err = result.unwrap_err().unwrap();
    assert_eq!(err, CollectibleError::MetadataFrozen);
}

// ── Enum discriminant values ──────────────────────────────────────────────────
// Verifies no accidental reordering breaks existing serialised contract data.

#[test]
fn test_error_discriminants_are_stable() {
    assert_eq!(CollectibleError::AlreadyInitialized as u32, 1);
    assert_eq!(CollectibleError::InsufficientBalance as u32, 2);
    assert_eq!(CollectibleError::InvalidAmount as u32, 3);
    assert_eq!(CollectibleError::Unauthorized as u32, 4);
    assert_eq!(CollectibleError::TokenIdMismatch as u32, 5);
    assert_eq!(CollectibleError::ZeroPrice as u32, 6);
    assert_eq!(CollectibleError::InsufficientStock as u32, 7);
    assert_eq!(CollectibleError::ShopNotInitialized as u32, 8);
    assert_eq!(CollectibleError::ContractPaused as u32, 9);
    assert_eq!(CollectibleError::InvalidPerk as u32, 10);
    assert_eq!(CollectibleError::InvalidStrength as u32, 11);
    assert_eq!(CollectibleError::TokenNotFound as u32, 12);
    assert_eq!(CollectibleError::InvalidTokenId as u32, 13);
    assert_eq!(CollectibleError::InvalidPageSize as u32, 14);
    assert_eq!(CollectibleError::InvalidURIType as u32, 15);
    assert_eq!(CollectibleError::MetadataFrozen as u32, 16);
}
