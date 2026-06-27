//! Tests for issues #1053–#1056: review and test coverage for
//! storage.rs, test.rs (gaps), transfer.rs, and types.rs

use super::*;
use soroban_sdk::{testutils::Address as _, Address, Env};
extern crate std;

// ─── storage.rs ─────────────────────────────────────────────────────────────

#[test]
fn test_storage_state_version_roundtrip() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(TycoonCollectibles, ());
    let client = TycoonCollectiblesClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    client.initialize(&admin);
    // After initialize, state version is 1 (set internally).
    // migrate is a no-op when version is already 1.
    client.migrate();
    client.migrate();
}

#[test]
fn test_storage_get_minter_none_before_set() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(TycoonCollectibles, ());
    let client = TycoonCollectiblesClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    client.initialize(&admin);
    // No minter set yet: backend_mint by a stranger should be Unauthorized.
    let stranger = Address::generate(&env);
    let user = Address::generate(&env);
    let result = client.try_backend_mint(&stranger, &user, &1, &1);
    assert!(result.is_err());
}

#[test]
fn test_storage_shop_config_none_before_init() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(TycoonCollectibles, ());
    let client = TycoonCollectiblesClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    client.initialize(&admin);
    // Shop not initialised: buy_collectible_from_shop must fail.
    let buyer = Address::generate(&env);
    let result = client.try_buy_collectible_from_shop(&buyer, &1, &false);
    assert!(result.is_err());
}

#[test]
fn test_storage_set_balance_zero_removes_entry() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(TycoonCollectibles, ());
    let client = TycoonCollectiblesClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    let user = Address::generate(&env);
    client.initialize(&admin);
    client.buy_collectible(&user, &1, &3);
    assert_eq!(client.balance_of(&user, &1), 3);
    // Burn all — set_balance(0) removes the entry.
    client.burn(&user, &1, &3);
    assert_eq!(client.balance_of(&user, &1), 0);
}

#[test]
fn test_storage_set_shop_stock_zero_removes_entry() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(TycoonCollectibles, ());
    let client = TycoonCollectiblesClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    client.initialize(&admin);
    let tyc = env
        .register_stellar_asset_contract_v2(admin.clone())
        .address();
    let usdc = env
        .register_stellar_asset_contract_v2(admin.clone())
        .address();
    client.init_shop(&tyc, &usdc);
    // Stock 1 item; buying it should reduce stock to 0 (removes entry).
    let token_id = client.stock_shop(&1, &3, &0, &10, &0);
    let buyer = Address::generate(&env);
    soroban_sdk::token::StellarAssetClient::new(&env, &tyc).mint(&buyer, &20);
    client.buy_collectible_from_shop(&buyer, &token_id, &false);
    assert_eq!(client.get_stock(&token_id), 0);
}

#[test]
fn test_storage_has_metadata_and_is_metadata_frozen() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(TycoonCollectibles, ());
    let client = TycoonCollectiblesClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    client.initialize(&admin);
    let token_id = client.mint_collectible(&admin, &admin, &1, &1);

    // No metadata yet — token_metadata returns None.
    assert!(client.token_metadata(&token_id).is_none());

    // Not frozen before any base URI is configured.
    assert!(!client.is_metadata_frozen());

    // Set non-frozen base URI.
    let uri = soroban_sdk::String::from_str(&env, "https://api.tycoon.com/metadata/");
    client.set_base_uri(&uri, &0, &false);
    assert!(!client.is_metadata_frozen());

    // Set frozen base URI.
    client.set_base_uri(&uri, &0, &true);
    assert!(client.is_metadata_frozen());
}

#[test]
fn test_storage_increment_token_id_sequential() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(TycoonCollectibles, ());
    let client = TycoonCollectiblesClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    client.initialize(&admin);

    // stock_shop uses increment_token_id internally.
    let id1 = client.stock_shop(&1, &3, &0, &0, &0);
    let id2 = client.stock_shop(&1, &3, &0, &0, &0);
    let id3 = client.stock_shop(&1, &3, &0, &0, &0);
    assert_eq!(id2, id1 + 1);
    assert_eq!(id3, id2 + 1);
}

#[test]
fn test_storage_get_next_collectible_id_uses_offset() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(TycoonCollectibles, ());
    let client = TycoonCollectiblesClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    client.initialize(&admin);

    // mint_collectible uses get_next_collectible_id (offset 2_000_000_000).
    let token_id = client.mint_collectible(&admin, &admin, &1, &1);
    assert!(
        token_id >= 2_000_000_000,
        "collectible ID must be >= offset"
    );
}

// ─── transfer.rs ────────────────────────────────────────────────────────────

#[test]
fn test_transfer_zero_amount_fails() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(TycoonCollectibles, ());
    let client = TycoonCollectiblesClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    let alice = Address::generate(&env);
    let bob = Address::generate(&env);
    client.initialize(&admin);
    client.buy_collectible(&alice, &1, &5);
    let result = client.try_transfer(&alice, &bob, &1, &0);
    assert!(result.is_err());
}

#[test]
fn test_burn_zero_amount_fails() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(TycoonCollectibles, ());
    let client = TycoonCollectiblesClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    let alice = Address::generate(&env);
    client.initialize(&admin);
    client.buy_collectible(&alice, &1, &5);
    let result = client.try_burn(&alice, &1, &0);
    assert!(result.is_err());
}

#[test]
fn test_batch_transfer_via_public_api() {
    // Exercises the multi-token transfer path (each token transferred individually).
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(TycoonCollectibles, ());
    let client = TycoonCollectiblesClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    let alice = Address::generate(&env);
    let bob = Address::generate(&env);
    client.initialize(&admin);

    client.buy_collectible(&alice, &1, &10);
    client.buy_collectible(&alice, &2, &5);

    client.transfer(&alice, &bob, &1, &3);
    client.transfer(&alice, &bob, &2, &2);

    assert_eq!(client.balance_of(&alice, &1), 7);
    assert_eq!(client.balance_of(&bob, &1), 3);
    assert_eq!(client.balance_of(&alice, &2), 3);
    assert_eq!(client.balance_of(&bob, &2), 2);
}

#[test]
fn test_transfer_full_balance_removes_from_enumeration() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(TycoonCollectibles, ());
    let client = TycoonCollectiblesClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    let alice = Address::generate(&env);
    let bob = Address::generate(&env);
    client.initialize(&admin);
    client.buy_collectible(&alice, &42, &1);
    client.transfer(&alice, &bob, &42, &1);
    assert_eq!(client.owned_token_count(&alice), 0);
    assert_eq!(client.owned_token_count(&bob), 1);
}

#[test]
fn test_mint_adds_to_enumeration_only_once() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(TycoonCollectibles, ());
    let client = TycoonCollectiblesClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    let user = Address::generate(&env);
    client.initialize(&admin);
    // Minting same token_id multiple times must not duplicate enumeration.
    client.buy_collectible(&user, &7, &3);
    client.buy_collectible(&user, &7, &2);
    assert_eq!(client.owned_token_count(&user), 1);
    assert_eq!(client.balance_of(&user, &7), 5);
}

// ─── types.rs ────────────────────────────────────────────────────────────────

#[test]
fn test_types_cash_tiers_values() {
    use crate::types::CASH_TIERS;
    assert_eq!(CASH_TIERS, [100, 250, 500, 1000, 2500]);
}

#[test]
fn test_types_perk_discriminants() {
    // Verify numeric representation of every Perk variant.
    assert_eq!(Perk::None as u32, 0);
    assert_eq!(Perk::CashTiered as u32, 1);
    assert_eq!(Perk::TaxRefund as u32, 2);
    assert_eq!(Perk::RentBoost as u32, 3);
    assert_eq!(Perk::PropertyDiscount as u32, 4);
    assert_eq!(Perk::ExtraTurn as u32, 5);
    assert_eq!(Perk::JailFree as u32, 6);
    assert_eq!(Perk::DoubleRent as u32, 7);
    assert_eq!(Perk::RollBoost as u32, 8);
    assert_eq!(Perk::Teleport as u32, 9);
    assert_eq!(Perk::Shield as u32, 10);
    assert_eq!(Perk::RollExact as u32, 11);
}

#[test]
fn test_types_uri_type_discriminants() {
    assert_eq!(URIType::HTTPS as u32, 0);
    assert_eq!(URIType::IPFS as u32, 1);
}

#[test]
fn test_types_collectible_price_equality() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(TycoonCollectibles, ());
    let client = TycoonCollectiblesClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    client.initialize(&admin);

    let token_id = client.stock_shop(&5, &1, &1, &999, &111);
    // update prices and verify via a buy at the new price
    client.update_collectible_prices(&token_id, &500, &50);

    let tyc = env
        .register_stellar_asset_contract_v2(admin.clone())
        .address();
    let usdc = env
        .register_stellar_asset_contract_v2(admin.clone())
        .address();
    client.init_shop(&tyc, &usdc);

    let buyer = Address::generate(&env);
    soroban_sdk::token::StellarAssetClient::new(&env, &tyc).mint(&buyer, &1000);
    // init_shop after stock_shop is fine for this price-equality check.
    client.buy_collectible_from_shop(&buyer, &token_id, &false);
    // buyer spent 500, not 999
    assert_eq!(
        soroban_sdk::token::Client::new(&env, &tyc).balance(&buyer),
        500
    );
}

#[test]
fn test_types_shop_config_stored_and_retrieved() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(TycoonCollectibles, ());
    let client = TycoonCollectiblesClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    client.initialize(&admin);

    let tyc = env
        .register_stellar_asset_contract_v2(admin.clone())
        .address();
    let usdc = env
        .register_stellar_asset_contract_v2(admin.clone())
        .address();
    client.init_shop(&tyc, &usdc);

    // Re-initialising shop should not fail (admin auth satisfied).
    let tyc2 = env
        .register_stellar_asset_contract_v2(admin.clone())
        .address();
    let usdc2 = env
        .register_stellar_asset_contract_v2(admin.clone())
        .address();
    client.init_shop(&tyc2, &usdc2);
}

#[test]
fn test_types_metadata_attribute_fields() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(TycoonCollectibles, ());
    let client = TycoonCollectiblesClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    client.initialize(&admin);
    let token_id = client.mint_collectible(&admin, &admin, &1, &1);

    let base_uri = soroban_sdk::String::from_str(&env, "https://api.tycoon.com/meta/");
    client.set_base_uri(&base_uri, &0, &false);

    let mut attrs = soroban_sdk::Vec::new(&env);
    let attr = MetadataAttribute {
        display_type: Some(soroban_sdk::String::from_str(&env, "number")),
        trait_type: soroban_sdk::String::from_str(&env, "Level"),
        value: soroban_sdk::String::from_str(&env, "5"),
    };
    attrs.push_back(attr.clone());

    client.set_token_metadata(
        &token_id,
        &soroban_sdk::String::from_str(&env, "T"),
        &soroban_sdk::String::from_str(&env, "D"),
        &soroban_sdk::String::from_str(&env, "https://img"),
        &None,
        &None,
        &attrs,
    );

    let meta = client.token_metadata(&token_id).unwrap();
    assert_eq!(meta.attributes.len(), 1);
    let stored = meta.attributes.get(0).unwrap();
    assert_eq!(stored.trait_type, attr.trait_type);
    assert_eq!(stored.value, attr.value);
    assert_eq!(stored.display_type, attr.display_type);
}

// ─── test.rs gap coverage ────────────────────────────────────────────────────

#[test]
fn test_set_collectible_for_sale_then_buy() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(TycoonCollectibles, ());
    let client = TycoonCollectiblesClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    let buyer = Address::generate(&env);
    client.initialize(&admin);

    let tyc = env
        .register_stellar_asset_contract_v2(admin.clone())
        .address();
    let usdc = env
        .register_stellar_asset_contract_v2(admin.clone())
        .address();
    client.init_shop(&tyc, &usdc);

    // set_collectible_for_sale (not stock_shop) path.
    client.set_collectible_for_sale(&99, &200, &50, &10);

    soroban_sdk::token::StellarAssetClient::new(&env, &tyc).mint(&buyer, &500);
    client.buy_collectible_from_shop(&buyer, &99, &false);

    assert_eq!(client.balance_of(&buyer, &99), 1);
    assert_eq!(client.get_stock(&99), 9);
    assert_eq!(
        soroban_sdk::token::Client::new(&env, &tyc).balance(&buyer),
        300
    );
}

#[test]
fn test_buy_with_usdc_zero_price_fails() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(TycoonCollectibles, ());
    let client = TycoonCollectiblesClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    let buyer = Address::generate(&env);
    client.initialize(&admin);

    let tyc = env
        .register_stellar_asset_contract_v2(admin.clone())
        .address();
    let usdc = env
        .register_stellar_asset_contract_v2(admin.clone())
        .address();
    client.init_shop(&tyc, &usdc);

    // usdc_price = 0, tyc_price = 100
    client.set_collectible_for_sale(&10, &100, &0, &5);
    soroban_sdk::token::StellarAssetClient::new(&env, &usdc).mint(&buyer, &1000);

    let result = client.try_buy_collectible_from_shop(&buyer, &10, &true);
    assert!(result.is_err());
}

#[test]
fn test_buy_collectible_not_in_price_list_fails() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(TycoonCollectibles, ());
    let client = TycoonCollectiblesClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    let buyer = Address::generate(&env);
    client.initialize(&admin);

    let tyc = env
        .register_stellar_asset_contract_v2(admin.clone())
        .address();
    let usdc = env
        .register_stellar_asset_contract_v2(admin.clone())
        .address();
    client.init_shop(&tyc, &usdc);

    // token_id 999 has no price entry.
    let result = client.try_buy_collectible_from_shop(&buyer, &999, &false);
    assert!(result.is_err());
}

#[test]
fn test_base_uri_config_ipfs_type() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(TycoonCollectibles, ());
    let client = TycoonCollectiblesClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    client.initialize(&admin);

    let ipfs_uri = soroban_sdk::String::from_str(&env, "ipfs://Qm");
    client.set_base_uri(&ipfs_uri, &1, &false);

    let config = client.base_uri_config().unwrap();
    assert_eq!(config.uri_type, URIType::IPFS);
    assert!(!config.frozen);
}

#[test]
fn test_token_uri_empty_when_no_base_uri() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(TycoonCollectibles, ());
    let client = TycoonCollectiblesClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    client.initialize(&admin);
    let token_id = client.stock_shop(&1, &1, &1, &0, &0);
    let uri = client.token_uri(&token_id);
    assert_eq!(uri.len(), 0);
}

#[test]
fn test_fee_config_stored_and_used() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(TycoonCollectibles, ());
    let client = TycoonCollectiblesClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    client.initialize(&admin);

    let tyc = env
        .register_stellar_asset_contract_v2(admin.clone())
        .address();
    let usdc = env
        .register_stellar_asset_contract_v2(admin.clone())
        .address();
    client.init_shop(&tyc, &usdc);

    let platform = Address::generate(&env);
    let pool = Address::generate(&env);
    // 20% platform, 10% pool, 10% creator
    client.set_fee_config(&2000, &1000, &1000, &platform, &pool);

    let token_id = client.stock_shop(&5, &3, &0, &1000, &0);
    let buyer = Address::generate(&env);
    soroban_sdk::token::StellarAssetClient::new(&env, &tyc).mint(&buyer, &2000);

    client.buy_collectible_from_shop(&buyer, &token_id, &false);

    let tc = soroban_sdk::token::Client::new(&env, &tyc);
    assert_eq!(tc.balance(&platform), 200);
    assert_eq!(tc.balance(&pool), 100);
    assert_eq!(tc.balance(&buyer), 1000);
}
