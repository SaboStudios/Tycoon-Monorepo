//! SW-CT-020: tycoon-collectibles integration tests
//!
//! Exercises the collectibles contract in a multi-contract environment:
//!   - Initialization alongside token contracts
//!   - Full shop workflow: stock → buy (TYC / USDC)
//!   - Fee distribution with a configured FeeConfig
//!   - Mint-transfer-burn lifecycle
//!   - Pause guard prevents perk activation

use soroban_sdk::{
    testutils::Address as _,
    token::{StellarAssetClient, TokenClient},
    Address, Env,
};
use tycoon_collectibles::TycoonCollectiblesClient;

fn register_collectibles(env: &Env) -> Address {
    env.register(tycoon_collectibles::TycoonCollectibles, ())
}

fn make_token(env: &Env, admin: &Address) -> Address {
    env.register_stellar_asset_contract_v2(admin.clone())
        .address()
}

/// AC: collectibles contract initializes alongside token contracts.
#[test]
fn test_collectibles_initializes_with_token_contracts() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let tyc_token = make_token(&env, &admin);
    let usdc_token = make_token(&env, &admin);

    let collectibles_id = register_collectibles(&env);
    let collectibles = TycoonCollectiblesClient::new(&env, &collectibles_id);

    collectibles.initialize(&admin);
    collectibles.init_shop(&tyc_token, &usdc_token);

    // Verify tokens are distinct and functional
    assert_ne!(tyc_token, usdc_token);
    StellarAssetClient::new(&env, &tyc_token).mint(&admin, &1_000_000);
    assert_eq!(TokenClient::new(&env, &tyc_token).balance(&admin), 1_000_000);
}

/// AC: full shop workflow — stock_shop → buy with TYC.
#[test]
fn test_shop_workflow_stock_and_buy_tyc() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let buyer = Address::generate(&env);
    let tyc_token = make_token(&env, &admin);
    let usdc_token = make_token(&env, &admin);

    let collectibles_id = register_collectibles(&env);
    let collectibles = TycoonCollectiblesClient::new(&env, &collectibles_id);

    collectibles.initialize(&admin);
    collectibles.init_shop(&tyc_token, &usdc_token);

    // Stock 5 units of perk=1 (CashTiered), strength=2, price=300 TYC
    let token_id = collectibles.stock_shop(&5, &1, &2, &300, &0);
    assert_eq!(collectibles.get_stock(&token_id), 5);

    StellarAssetClient::new(&env, &tyc_token).mint(&buyer, &1000);
    collectibles.buy_collectible_from_shop(&buyer, &token_id, &false);

    assert_eq!(collectibles.balance_of(&buyer, &token_id), 1);
    assert_eq!(collectibles.get_stock(&token_id), 4);
    assert_eq!(TokenClient::new(&env, &tyc_token).balance(&buyer), 700);
}

/// AC: full shop workflow — stock_shop → buy with USDC.
#[test]
fn test_shop_workflow_stock_and_buy_usdc() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let buyer = Address::generate(&env);
    let tyc_token = make_token(&env, &admin);
    let usdc_token = make_token(&env, &admin);

    let collectibles_id = register_collectibles(&env);
    let collectibles = TycoonCollectiblesClient::new(&env, &collectibles_id);

    collectibles.initialize(&admin);
    collectibles.init_shop(&tyc_token, &usdc_token);

    let token_id = collectibles.stock_shop(&10, &3, &0, &0, &50); // perk=3 RentBoost

    StellarAssetClient::new(&env, &usdc_token).mint(&buyer, &200);
    collectibles.buy_collectible_from_shop(&buyer, &token_id, &true);

    assert_eq!(collectibles.balance_of(&buyer, &token_id), 1);
    assert_eq!(collectibles.get_stock(&token_id), 9);
    assert_eq!(TokenClient::new(&env, &usdc_token).balance(&buyer), 150);
}

/// AC: fee distribution — platform and pool receive correct shares.
#[test]
fn test_fee_distribution_on_shop_purchase() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let buyer = Address::generate(&env);
    let platform = Address::generate(&env);
    let pool = Address::generate(&env);
    let tyc_token = make_token(&env, &admin);
    let usdc_token = make_token(&env, &admin);

    let collectibles_id = register_collectibles(&env);
    let collectibles = TycoonCollectiblesClient::new(&env, &collectibles_id);

    collectibles.initialize(&admin);
    collectibles.init_shop(&tyc_token, &usdc_token);
    // 20% platform, 10% creator, 10% pool
    collectibles.set_fee_config(&2000, &1000, &1000, &platform, &pool);

    let token_id = collectibles.stock_shop(&5, &1, &1, &1000, &0);

    StellarAssetClient::new(&env, &tyc_token).mint(&buyer, &2000);
    collectibles.buy_collectible_from_shop(&buyer, &token_id, &false);

    assert_eq!(collectibles.balance_of(&buyer, &token_id), 1);
    // platform: 20% of 1000 = 200
    assert_eq!(TokenClient::new(&env, &tyc_token).balance(&platform), 200);
    // pool: 10% of 1000 = 100
    assert_eq!(TokenClient::new(&env, &tyc_token).balance(&pool), 100);
    // buyer spent 1000
    assert_eq!(TokenClient::new(&env, &tyc_token).balance(&buyer), 1000);
}

/// AC: mint-transfer-burn lifecycle.
#[test]
fn test_mint_transfer_burn_lifecycle() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let alice = Address::generate(&env);
    let bob = Address::generate(&env);

    let collectibles_id = register_collectibles(&env);
    let collectibles = TycoonCollectiblesClient::new(&env, &collectibles_id);

    collectibles.initialize(&admin);

    // Mint via buy_collectible (no shop required)
    collectibles.buy_collectible(&alice, &42, &10);
    assert_eq!(collectibles.balance_of(&alice, &42), 10);

    // Transfer 4 to Bob
    collectibles.transfer(&alice, &bob, &42, &4);
    assert_eq!(collectibles.balance_of(&alice, &42), 6);
    assert_eq!(collectibles.balance_of(&bob, &42), 4);

    // Bob burns 2
    collectibles.burn(&bob, &42, &2);
    assert_eq!(collectibles.balance_of(&bob, &42), 2);

    // Alice burns remaining 6
    collectibles.burn(&alice, &42, &6);
    assert_eq!(collectibles.balance_of(&alice, &42), 0);
    assert_eq!(collectibles.tokens_of(&alice).len(), 0);
}

/// AC: pause guard prevents perk activation.
#[test]
fn test_pause_prevents_perk_burn() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let user = Address::generate(&env);

    let collectibles_id = register_collectibles(&env);
    let collectibles = TycoonCollectiblesClient::new(&env, &collectibles_id);

    collectibles.initialize(&admin);

    // Give user a CashTiered perk token
    let token_id = 1u128;
    collectibles.buy_collectible(&user, &token_id, &1);
    collectibles.set_token_perk(&token_id, &tycoon_collectibles::Perk::CashTiered, &1);

    // Pause the contract
    collectibles.set_pause(&true);

    // Burning for perk must fail while paused
    let result = collectibles.try_burn_collectible_for_perk(&user, &token_id);
    assert!(result.is_err());

    // Unpause and retry — should succeed
    collectibles.set_pause(&false);
    collectibles.burn_collectible_for_perk(&user, &token_id);
    assert_eq!(collectibles.balance_of(&user, &token_id), 0);
}
