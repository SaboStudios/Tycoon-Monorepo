//! SW-CT-024: Auth-rejection tests for admin-only entrypoints not covered
//! by the main test suite.
//!
//! Pattern: initialize with mock_all_auths, then call the target entrypoint
//! on a fresh Env (no mocked auths) — the stored admin's require_auth() fires
//! and the call must fail.

use super::*;
use soroban_sdk::{testutils::Address as _, Env};
extern crate std;

/// Register + initialize the contract with mocked auth; return (client, contract_id).
fn setup(env: &Env) -> (TycoonCollectiblesClient, soroban_sdk::Address) {
    let id = env.register(TycoonCollectibles, ());
    let client = TycoonCollectiblesClient::new(env, &id);
    let admin = soroban_sdk::Address::generate(env);
    env.mock_all_auths();
    client.initialize(&admin);
    (client, id)
}

/// Call the entrypoint on a fresh env (no mocked auths) using the same contract_id.
macro_rules! no_auth_client {
    ($contract_id:expr) => {{
        let e = Env::default();
        TycoonCollectiblesClient::new(&e, &$contract_id)
    }};
}

#[test]
fn test_migrate_rejects_without_auth() {
    let env = Env::default();
    let (_, id) = setup(&env);
    assert!(no_auth_client!(id).try_migrate().is_err());
}

#[test]
fn test_init_shop_rejects_without_auth() {
    let env = Env::default();
    let (_, id) = setup(&env);
    let c = no_auth_client!(id);
    let dummy = soroban_sdk::Address::generate(&Env::default());
    assert!(c.try_init_shop(&dummy, &dummy).is_err());
}

#[test]
fn test_set_fee_config_rejects_without_auth() {
    let env = Env::default();
    let (_, id) = setup(&env);
    let c = no_auth_client!(id);
    let dummy = soroban_sdk::Address::generate(&Env::default());
    assert!(c.try_set_fee_config(&0, &0, &0, &dummy, &dummy).is_err());
}

#[test]
fn test_restock_collectible_rejects_without_auth() {
    let env = Env::default();
    let (client, id) = setup(&env);
    // Stock a token first (auth mocked)
    let token_id = client.stock_shop(&5, &1, &1, &100, &0);
    assert!(no_auth_client!(id)
        .try_restock_collectible(&token_id, &1)
        .is_err());
}

#[test]
fn test_update_collectible_prices_rejects_without_auth() {
    let env = Env::default();
    let (client, id) = setup(&env);
    let token_id = client.stock_shop(&5, &1, &1, &100, &0);
    assert!(no_auth_client!(id)
        .try_update_collectible_prices(&token_id, &200, &50)
        .is_err());
}

#[test]
fn test_set_collectible_for_sale_rejects_without_auth() {
    let env = Env::default();
    let (_, id) = setup(&env);
    assert!(no_auth_client!(id)
        .try_set_collectible_for_sale(&1, &100, &10, &5)
        .is_err());
}

#[test]
fn test_set_pause_rejects_without_auth() {
    let env = Env::default();
    let (_, id) = setup(&env);
    assert!(no_auth_client!(id).try_set_pause(&true).is_err());
}

#[test]
fn test_set_base_uri_rejects_without_auth() {
    let env = Env::default();
    let (_, id) = setup(&env);
    let c = no_auth_client!(id);
    let uri = soroban_sdk::String::from_str(&Env::default(), "https://example.com/");
    assert!(c.try_set_base_uri(&uri, &0, &false).is_err());
}

#[test]
fn test_set_token_metadata_rejects_without_auth() {
    let env = Env::default();
    let (client, id) = setup(&env);
    let token_id = client.stock_shop(&1, &1, &1, &0, &0);
    let e2 = Env::default();
    let c2 = TycoonCollectiblesClient::new(&e2, &id);
    let s = |v: &str| soroban_sdk::String::from_str(&e2, v);
    assert!(c2
        .try_set_token_metadata(
            &token_id,
            &s("Name"),
            &s("Desc"),
            &s("https://img"),
            &None,
            &None,
            &soroban_sdk::Vec::new(&e2),
        )
        .is_err());
}
