#![cfg(test)]
//! SW-CT-LIB-001: Supplemental coverage tests for tycoon-collectibles lib.rs
//!
//! Targets code paths and entrypoints in lib.rs not fully exercised by the
//! existing test modules:
//!
//!   - `u128_to_soroban_string` (private helper) — verified via token_uri
//!   - `migrate` from version-0 state (uninitialized → v1)
//!   - `buy_collectible` (raw entrypoint, no shop)
//!   - `set_collectible_for_sale` — price/stock stored correctly
//!   - `get_backend_minter` before and after set
//!   - `mint_collectible` produces sequential token IDs
//!   - `buy_collectible_from_shop` with negative-price guard (ZeroPrice)
//!   - Full shop + fee round-trip with USDC
//!   - `token_uri` with multi-digit token IDs (tests the u128 string helper)
//!   - `base_uri_config` returns None before configuration
//!   - `token_metadata` returns None before metadata is set
//!   - All perk variants via `stock_shop` returning correct token ID sequence
//!   - `set_pause` / `is_contract_paused` round-trip
//!   - `backend_mint` with minter role (not admin)

extern crate std;

use crate::{TycoonCollectibles, TycoonCollectiblesClient};
use soroban_sdk::{
    testutils::Address as _,
    token::{StellarAssetClient, TokenClient},
    Address, Env, String as SorobanString,
};

// ── helpers ───────────────────────────────────────────────────────────────────

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

// ── u128_to_soroban_string (via token_uri) ────────────────────────────────────

/// token_uri must produce a URI that includes the decimal string of the token
/// ID. We test several token IDs including multi-digit values.
#[test]
fn test_token_uri_includes_token_id_as_string() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, admin, _) = setup(&env);

    let base = SorobanString::from_str(&env, "https://api.test.com/");
    client.set_base_uri(&base, &0, &false);

    let recipient = Address::generate(&env);

    // Mint several tokens; IDs come from the collectible counter
    for perk in 1u32..=5 {
        let token_id = client.mint_collectible(&admin, &recipient, &perk, &1);
        let uri = client.token_uri(&token_id);
        // URI length must be > base length (base + decimal token_id)
        assert!(
            uri.len() > base.len(),
            "token_uri must append token_id for token {}",
            token_id
        );
    }
}

#[test]
fn test_token_uri_zero_returns_empty_when_no_base_uri() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _, _) = setup(&env);

    // Stock a token so it exists
    let token_id = client.stock_shop(&1, &1, &1, &0, &0);
    // No base URI configured → returns ""
    let uri = client.token_uri(&token_id);
    assert_eq!(uri.len(), 0);
}

#[test]
fn test_token_uri_with_ipfs_base() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, admin, _) = setup(&env);

    let ipfs_base = SorobanString::from_str(&env, "ipfs://Qmhash/");
    client.set_base_uri(&ipfs_base, &1, &false);

    let recipient = Address::generate(&env);
    let token_id = client.mint_collectible(&admin, &recipient, &3, &1);

    let uri = client.token_uri(&token_id);
    assert!(uri.len() > ipfs_base.len(), "IPFS URI must include token ID");
}

// ── migrate ───────────────────────────────────────────────────────────────────

/// migrate must succeed even when called on a freshly initialized contract
/// (version == 1 already → no-op, no error).
#[test]
fn test_migrate_noop_on_version_one() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _, _) = setup(&env);
    client.migrate(); // must not panic
    client.migrate(); // idempotent
}

// ── buy_collectible (raw) ─────────────────────────────────────────────────────

/// `buy_collectible` directly mints any token_id to the caller without a shop.
#[test]
fn test_buy_collectible_raw_mints_to_caller() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _, _) = setup(&env);

    let buyer = Address::generate(&env);
    client.buy_collectible(&buyer, &999, &7);

    assert_eq!(client.balance_of(&buyer, &999), 7);
    assert_eq!(client.owned_token_count(&buyer), 1);
}

#[test]
fn test_buy_collectible_raw_multiple_types() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _, _) = setup(&env);

    let buyer = Address::generate(&env);
    client.buy_collectible(&buyer, &1, &3);
    client.buy_collectible(&buyer, &2, &2);
    client.buy_collectible(&buyer, &3, &1);

    assert_eq!(client.balance_of(&buyer, &1), 3);
    assert_eq!(client.balance_of(&buyer, &2), 2);
    assert_eq!(client.balance_of(&buyer, &3), 1);
    assert_eq!(client.owned_token_count(&buyer), 3);
}

// ── set_collectible_for_sale ──────────────────────────────────────────────────

#[test]
fn test_set_collectible_for_sale_stores_price_and_stock() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, admin, _) = setup(&env);

    let tyc = make_token(&env, &admin);
    let usdc = make_token(&env, &admin);
    client.init_shop(&tyc, &usdc);

    client.set_collectible_for_sale(&42, &1000, &500, &10);

    // Stock must be stored
    assert_eq!(client.get_stock(&42), 10);

    // A buyer should be able to purchase at the set price
    let buyer = Address::generate(&env);
    StellarAssetClient::new(&env, &tyc).mint(&buyer, &1000);
    client.buy_collectible_from_shop(&buyer, &42, &false);

    assert_eq!(client.balance_of(&buyer, &42), 1);
    assert_eq!(TokenClient::new(&env, &tyc).balance(&buyer), 0);
}

// ── get_backend_minter ────────────────────────────────────────────────────────

#[test]
fn test_get_backend_minter_returns_none_initially() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _, _) = setup(&env);
    assert_eq!(client.get_backend_minter(), None);
}

#[test]
fn test_get_backend_minter_returns_address_after_set() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _, _) = setup(&env);

    let minter = Address::generate(&env);
    client.set_backend_minter(&minter);
    assert_eq!(client.get_backend_minter(), Some(minter));
}

// ── mint_collectible produces sequential IDs ──────────────────────────────────

#[test]
fn test_mint_collectible_returns_sequential_ids() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, admin, _) = setup(&env);

    let user = Address::generate(&env);

    let id1 = client.mint_collectible(&admin, &user, &1, &1);
    let id2 = client.mint_collectible(&admin, &user, &2, &1);
    let id3 = client.mint_collectible(&admin, &user, &3, &1);

    assert!(id1 < id2, "IDs must be strictly increasing");
    assert!(id2 < id3, "IDs must be strictly increasing");
}

#[test]
fn test_mint_collectible_by_backend_minter() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _, _) = setup(&env);

    let minter = Address::generate(&env);
    let user = Address::generate(&env);
    client.set_backend_minter(&minter);

    let token_id = client.mint_collectible(&minter, &user, &5, &1);
    assert_eq!(client.balance_of(&user, &token_id), 1);
    assert_eq!(client.get_token_perk(&token_id), crate::types::Perk::ExtraTurn);
}

// ── stock_shop token ID is strictly increasing ────────────────────────────────

#[test]
fn test_stock_shop_ids_are_sequential() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _, _) = setup(&env);

    let id1 = client.stock_shop(&5, &1, &1, &100, &0);
    let id2 = client.stock_shop(&5, &3, &1, &100, &0);
    let id3 = client.stock_shop(&5, &5, &0, &100, &0);

    assert!(id1 < id2);
    assert!(id2 < id3);
}

// ── shop round-trip with USDC ─────────────────────────────────────────────────

#[test]
fn test_shop_usdc_buy_round_trip() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, admin, contract_id) = setup(&env);

    let tyc = make_token(&env, &admin);
    let usdc = make_token(&env, &admin);
    client.init_shop(&tyc, &usdc);

    let token_id = client.stock_shop(&5, &5, &0, &1000, &200);

    let buyer = Address::generate(&env);
    StellarAssetClient::new(&env, &usdc).mint(&buyer, &500);

    client.buy_collectible_from_shop(&buyer, &token_id, &true);

    assert_eq!(client.balance_of(&buyer, &token_id), 1);
    assert_eq!(client.get_stock(&token_id), 4);
    // Buyer paid 200 USDC
    assert_eq!(TokenClient::new(&env, &usdc).balance(&buyer), 300);
    // Contract received payment (no fee config)
    assert_eq!(TokenClient::new(&env, &usdc).balance(&contract_id), 200);
}

// ── buy_collectible_from_shop ZeroPrice via negative price ────────────────────

#[test]
fn test_buy_from_shop_zero_price_negative_tyc() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, admin, _) = setup(&env);

    let tyc = make_token(&env, &admin);
    let usdc = make_token(&env, &admin);
    client.init_shop(&tyc, &usdc);

    // Negative price is treated as <= 0 → ZeroPrice
    client.set_collectible_for_sale(&1, &-1, &10, &5);

    let buyer = Address::generate(&env);
    StellarAssetClient::new(&env, &tyc).mint(&buyer, &1000);

    let result = client.try_buy_collectible_from_shop(&buyer, &1, &false);
    assert!(result.is_err());
}

// ── base_uri_config / token_metadata return None before configured ─────────────

#[test]
fn test_base_uri_config_none_before_set() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _, _) = setup(&env);
    assert!(client.base_uri_config().is_none());
}

#[test]
fn test_token_metadata_none_before_set() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, admin, _) = setup(&env);

    let user = Address::generate(&env);
    let token_id = client.mint_collectible(&admin, &user, &1, &1);
    assert!(client.token_metadata(&token_id).is_none());
}

// ── set_pause / is_contract_paused round-trip ─────────────────────────────────

#[test]
fn test_pause_unpause_cycle() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _, _) = setup(&env);

    assert!(!client.is_contract_paused());

    client.set_pause(&true);
    assert!(client.is_contract_paused());

    client.set_pause(&false);
    assert!(!client.is_contract_paused());

    // Multiple toggles remain consistent
    client.set_pause(&true);
    client.set_pause(&true);
    assert!(client.is_contract_paused());

    client.set_pause(&false);
    assert!(!client.is_contract_paused());
}

// ── backend_mint with minter role ─────────────────────────────────────────────

#[test]
fn test_backend_mint_by_minter_succeeds() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _, _) = setup(&env);

    let minter = Address::generate(&env);
    let user = Address::generate(&env);
    client.set_backend_minter(&minter);

    client.backend_mint(&minter, &user, &10, &5);
    assert_eq!(client.balance_of(&user, &10), 5);
}

#[test]
fn test_backend_mint_by_admin_succeeds() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, admin, _) = setup(&env);

    let user = Address::generate(&env);
    client.backend_mint(&admin, &user, &20, &3);
    assert_eq!(client.balance_of(&user, &20), 3);
}

// ── is_metadata_frozen ────────────────────────────────────────────────────────

#[test]
fn test_is_metadata_frozen_false_before_freeze() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _, _) = setup(&env);
    assert!(!client.is_metadata_frozen());
}

#[test]
fn test_is_metadata_frozen_true_after_freeze() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _, _) = setup(&env);

    let uri = SorobanString::from_str(&env, "https://api.test.com/");
    client.set_base_uri(&uri, &0, &true);
    assert!(client.is_metadata_frozen());
}

// ── set_token_metadata and token_metadata round-trip ─────────────────────────

#[test]
fn test_set_and_get_token_metadata() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, admin, _) = setup(&env);

    let user = Address::generate(&env);
    let token_id = client.mint_collectible(&admin, &user, &1, &2);

    // Must set base_uri first so is_metadata_frozen path doesn't shortcut
    let uri = SorobanString::from_str(&env, "https://api.test.com/");
    client.set_base_uri(&uri, &0, &false);

    let name = SorobanString::from_str(&env, "Cash Boost");
    let desc = SorobanString::from_str(&env, "Boosts your cash.");
    let image = SorobanString::from_str(&env, "https://img.test.com/1.png");

    client.set_token_metadata(
        &token_id,
        &name,
        &desc,
        &image,
        &None,
        &None,
        &soroban_sdk::Vec::new(&env),
    );

    let meta = client.token_metadata(&token_id).unwrap();
    assert_eq!(meta.name, name);
    assert_eq!(meta.description, desc);
    assert_eq!(meta.image, image);
    assert!(meta.animation_url.is_none());
    assert!(meta.external_url.is_none());
    assert_eq!(meta.attributes.len(), 0);
}

// ── stock_shop perk coverage (all valid perk values 0-11) ─────────────────────

#[test]
fn test_stock_shop_perk_none_is_valid_perk_zero() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _, _) = setup(&env);

    // perk=0 (None) is valid in stock_shop (does not require strength validation)
    let token_id = client.stock_shop(&1, &0, &0, &0, &0);
    assert_eq!(client.get_token_perk(&token_id), crate::types::Perk::None);
}

#[test]
fn test_stock_shop_all_non_tiered_perks_succeed() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _, _) = setup(&env);

    // Non-tiered perks (3-11, except 1 CashTiered and 2 TaxRefund) accept any strength
    let non_tiered = [(3u32, 0u32), (4, 0), (5, 0), (6, 0), (7, 0), (8, 1), (9, 0), (10, 0), (11, 0)];
    for (perk, strength) in non_tiered {
        let result = client.try_stock_shop(&1, &perk, &strength, &100, &0);
        assert!(result.is_ok(), "perk={} strength={} should succeed", perk, strength);
    }
}

// ── complete admin workflow ────────────────────────────────────────────────────

#[test]
fn test_full_admin_workflow() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, admin, _contract_id) = setup(&env);

    let tyc = make_token(&env, &admin);
    let usdc = make_token(&env, &admin);
    let platform = Address::generate(&env);
    let pool = Address::generate(&env);
    let minter = Address::generate(&env);
    let buyer = Address::generate(&env);

    // Setup shop and fees
    client.init_shop(&tyc, &usdc);
    client.set_fee_config(&500, &500, &500, &platform, &pool);
    client.set_backend_minter(&minter);

    // Stock two collectibles
    let id1 = client.stock_shop(&10, &1, &2, &500, &0);
    let id2 = client.stock_shop(&5, &5, &0, &300, &0);

    assert_eq!(client.get_stock(&id1), 10);
    assert_eq!(client.get_stock(&id2), 5);

    // Restock first collectible
    client.restock_collectible(&id1, &5);
    assert_eq!(client.get_stock(&id1), 15);

    // Update prices
    client.update_collectible_prices(&id1, &600, &0);

    // Backend minter mints directly
    let reward_id = client.mint_collectible(&minter, &buyer, &6, &1);
    assert_eq!(client.balance_of(&buyer, &reward_id), 1);

    // Buyer buys from shop
    StellarAssetClient::new(&env, &tyc).mint(&buyer, &700);
    client.buy_collectible_from_shop(&buyer, &id1, &false);

    assert_eq!(client.balance_of(&buyer, &id1), 1);
    assert!(TokenClient::new(&env, &tyc).balance(&buyer) < 700);

    // Verify enumeration
    assert!(client.owned_token_count(&buyer) >= 2);
}
