//! SW-CT-024: Auth-rejection tests for admin-only entrypoints not covered
//! by the main test suite.
//!
//! Pattern: initialize with mock_all_auths, then clear auth mocks and call
//! the target entrypoint — the stored admin's require_auth() fires and the
//! call must fail.

use super::*;
use soroban_sdk::{testutils::Address as _, Env};
extern crate std;

/// Register + initialize the contract with mocked auth; return (env, client, contract_id).
fn setup() -> (Env, TycoonCollectiblesClient<'static>, soroban_sdk::Address) {
    let env = Env::default();
    env.mock_all_auths();
    let id = env.register(TycoonCollectibles, ());
    let client = TycoonCollectiblesClient::new(&env, &id);
    let admin = soroban_sdk::Address::generate(&env);
    client.initialize(&admin);
    (env, client, id)
}

#[test]
fn test_migrate_rejects_without_auth() {
    let (env, _, id) = setup();
    env.mock_auths(&[]);
    let c = TycoonCollectiblesClient::new(&env, &id);
    assert!(c.try_migrate().is_err());
}

#[test]
fn test_init_shop_rejects_without_auth() {
    let (env, _, id) = setup();
    env.mock_auths(&[]);
    let c = TycoonCollectiblesClient::new(&env, &id);
    let dummy = soroban_sdk::Address::generate(&env);
    assert!(c.try_init_shop(&dummy, &dummy).is_err());
}

#[test]
fn test_set_fee_config_rejects_without_auth() {
    let (env, _, id) = setup();
    env.mock_auths(&[]);
    let c = TycoonCollectiblesClient::new(&env, &id);
    let dummy = soroban_sdk::Address::generate(&env);
    assert!(c.try_set_fee_config(&0, &0, &0, &dummy, &dummy).is_err());
}

#[test]
fn test_restock_collectible_rejects_without_auth() {
    let (env, client, id) = setup();
    let token_id = client.stock_shop(&5, &1, &1, &100, &0);
    env.mock_auths(&[]);
    let c = TycoonCollectiblesClient::new(&env, &id);
    assert!(c.try_restock_collectible(&token_id, &1).is_err());
}

#[test]
fn test_update_collectible_prices_rejects_without_auth() {
    let (env, client, id) = setup();
    let token_id = client.stock_shop(&5, &1, &1, &100, &0);
    env.mock_auths(&[]);
    let c = TycoonCollectiblesClient::new(&env, &id);
    assert!(c
        .try_update_collectible_prices(&token_id, &200, &50)
        .is_err());
}

#[test]
fn test_set_collectible_for_sale_rejects_without_auth() {
    let (env, _, id) = setup();
    env.mock_auths(&[]);
    let c = TycoonCollectiblesClient::new(&env, &id);
    assert!(c.try_set_collectible_for_sale(&1, &100, &10, &5).is_err());
}

#[test]
fn test_set_pause_rejects_without_auth() {
    let (env, _, id) = setup();
    env.mock_auths(&[]);
    let c = TycoonCollectiblesClient::new(&env, &id);
    assert!(c.try_set_pause(&true).is_err());
}

#[test]
fn test_set_base_uri_rejects_without_auth() {
    let (env, _, id) = setup();
    env.mock_auths(&[]);
    let c = TycoonCollectiblesClient::new(&env, &id);
    let uri = soroban_sdk::String::from_str(&env, "https://example.com/");
    assert!(c.try_set_base_uri(&uri, &0, &false).is_err());
}

#[test]
fn test_set_token_metadata_rejects_without_auth() {
    let (env, client, id) = setup();
    let token_id = client.stock_shop(&1, &1, &1, &0, &0);
    env.mock_auths(&[]);
    let c = TycoonCollectiblesClient::new(&env, &id);
    let s = |v: &str| soroban_sdk::String::from_str(&env, v);
    assert!(c
        .try_set_token_metadata(
            &token_id,
            &s("Name"),
            &s("Desc"),
            &s("https://img"),
            &None,
            &None,
            &soroban_sdk::Vec::new(&env),
        )
        .is_err());
}
