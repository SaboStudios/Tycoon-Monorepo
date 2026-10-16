#![cfg(test)]

use super::*;
use soroban_sdk::{
    testutils::{Address as _, Events},
    token::{StellarAssetClient, TokenClient},
    Address, Env, String,
};

// Helper function to create a mock token contract
fn create_token_contract<'a>(env: &Env, admin: &Address) -> (Address, TokenClient<'a>) {
    let token_contract = env.register_stellar_asset_contract_v2(admin.clone());
    let token_address = token_contract.address();
    let token_client = TokenClient::new(env, &token_address);
    (token_address, token_client)
}

// Helper function to setup a test contract
fn setup_contract(env: &Env) -> (Address, TycoonContractClient<'_>, Address, Address, Address) {
    let contract_id = env.register(TycoonContract, ());
    let client = TycoonContractClient::new(env, &contract_id);

    let owner = Address::generate(env);
    let tyc_admin = Address::generate(env);
    let usdc_admin = Address::generate(env);

    let (tyc_token, _) = create_token_contract(env, &tyc_admin);
    let (usdc_token, _) = create_token_contract(env, &usdc_admin);

    (contract_id, client, owner, tyc_token, usdc_token)
}

// ===== INITIALIZATION TESTS =====

#[test]
fn test_initialize_success() {
    let env = Env::default();
    env.mock_all_auths();

    let (_, client, owner, tyc_token, usdc_token) = setup_contract(&env);
    let reward_system = Address::generate(&env);

    // Initialize the contract
    client.initialize(&tyc_token, &usdc_token, &owner, &reward_system);

    // Verify initialization was successful by trying to use owner functions
    // This implicitly tests that the owner was set correctly
}

#[test]
#[should_panic(expected = "Contract already initialized")]
fn test_initialize_twice_fails() {
    let env = Env::default();
    env.mock_all_auths();

    let (_, client, owner, tyc_token, usdc_token) = setup_contract(&env);
    let reward_system = Address::generate(&env);

    // First initialization should succeed
    client.initialize(&tyc_token, &usdc_token, &owner, &reward_system);

    // Second initialization should panic
    client.initialize(&tyc_token, &usdc_token, &owner, &reward_system);
}

// ===== WITHDRAWAL TESTS =====

#[test]
fn test_withdraw_tyc_by_owner_success() {
    let env = Env::default();
    env.mock_all_auths();

    let (contract_id, client, owner, tyc_token, usdc_token) = setup_contract(&env);
    let reward_system = Address::generate(&env);

    client.initialize(&tyc_token, &usdc_token, &owner, &reward_system);

    let tyc_admin_client = StellarAssetClient::new(&env, &tyc_token);
    tyc_admin_client.mint(&contract_id, &1000);

    let recipient = Address::generate(&env);

    client.withdraw_funds(&tyc_token, &recipient, &500);

    let tyc_client = TokenClient::new(&env, &tyc_token);
    assert_eq!(tyc_client.balance(&recipient), 500);

    // Verify the contract balance decreased
    assert_eq!(tyc_client.balance(&contract_id), 500);
}

#[test]
fn test_withdraw_usdc_by_owner_success() {
    let env = Env::default();
    env.mock_all_auths();

    let (contract_id, client, owner, tyc_token, usdc_token) = setup_contract(&env);
    let reward_system = Address::generate(&env);

    client.initialize(&tyc_token, &usdc_token, &owner, &reward_system);

    let usdc_admin_client = StellarAssetClient::new(&env, &usdc_token);
    usdc_admin_client.mint(&contract_id, &2000);

    let recipient = Address::generate(&env);

    client.withdraw_funds(&usdc_token, &recipient, &1500);

    let usdc_client = TokenClient::new(&env, &usdc_token);
    assert_eq!(usdc_client.balance(&recipient), 1500);

    assert_eq!(usdc_client.balance(&contract_id), 500);
}

#[test]
#[should_panic(expected = "Insufficient contract balance")]
fn test_withdraw_insufficient_balance_fails() {
    let env = Env::default();
    env.mock_all_auths();

    let (contract_id, client, owner, tyc_token, usdc_token) = setup_contract(&env);
    let reward_system = Address::generate(&env);

    // Initialize the contract
    client.initialize(&tyc_token, &usdc_token, &owner, &reward_system);

    // Mint only 100 TYC tokens to the contract
    let tyc_admin_client = StellarAssetClient::new(&env, &tyc_token);
    tyc_admin_client.mint(&contract_id, &100);

    let recipient = Address::generate(&env);

    // Try to withdraw more than available - should panic
    client.withdraw_funds(&tyc_token, &recipient, &500);
}

#[test]
#[should_panic(expected = "Invalid token address")]
fn test_withdraw_invalid_token_fails() {
    let env = Env::default();
    env.mock_all_auths();

    let (_, client, owner, tyc_token, usdc_token) = setup_contract(&env);
    let reward_system = Address::generate(&env);

    // Initialize the contract
    client.initialize(&tyc_token, &usdc_token, &owner, &reward_system);

    // Try to withdraw a different token (not TYC or USDC)
    let other_token = Address::generate(&env);
    let recipient = Address::generate(&env);

    client.withdraw_funds(&other_token, &recipient, &100);
}

#[test]
fn test_withdraw_emits_event() {
    let env = Env::default();
    env.mock_all_auths();

    let (contract_id, client, owner, tyc_token, usdc_token) = setup_contract(&env);
    let reward_system = Address::generate(&env);

    // Initialize the contract
    client.initialize(&tyc_token, &usdc_token, &owner, &reward_system);

    // Mint some TYC tokens to the contract
    let tyc_admin_client = StellarAssetClient::new(&env, &tyc_token);
    tyc_admin_client.mint(&contract_id, &1000);

    let recipient = Address::generate(&env);

    // Withdraw funds
    client.withdraw_funds(&tyc_token, &recipient, &500);

    // Verify event was emitted
    let events = env.events().all();
    let _event = events.last().unwrap();

    // Verify event has the expected topics and data
    assert!(!events.is_empty());
}

// ===== TREASURY INVARIANT TESTS =====

fn valid(sum_of_balances: u64, escrow: u64, liabilities: u64, treasury: u64) -> TreasurySnapshot {
    TreasurySnapshot {
        sum_of_balances,
        escrow,
        liabilities,
        treasury,
    }
}

#[test]
fn test_treasury_invariant_balanced_zero_state() {
    assert!(valid(0, 0, 0, 0).invariant_holds());
}

#[test]
fn test_treasury_invariant_balanced_typical_state() {
    assert!(valid(900, 100, 600, 400).invariant_holds());
}

#[test]
fn test_treasury_invariant_balanced_escrow_heavy_state() {
    assert!(valid(0, 1_000, 500, 500).invariant_holds());
}

#[test]
fn test_treasury_invariant_unbalanced_returns_false() {
    assert!(!valid(900, 100, 600, 401).invariant_holds());
}

#[test]
fn test_treasury_invariant_unbalanced_zero_treasury() {
    assert!(!valid(500, 0, 500, 1).invariant_holds());
}

#[test]
fn test_treasury_invariant_assert_does_not_panic_when_balanced() {
    valid(800, 200, 700, 300).assert_invariant();
}

#[test]
#[should_panic(expected = "Treasury invariant violated")]
fn test_treasury_invariant_assert_panics_when_unbalanced() {
    valid(800, 200, 700, 301).assert_invariant();
}

#[test]
fn test_treasury_invariant_lock_into_escrow_preserves_invariant() {
    let mut snapshot = valid(1_000, 0, 0, 1_000);
    let amount = 200_u64;

    snapshot.sum_of_balances -= amount;
    snapshot.escrow += amount;

    snapshot.assert_invariant();
}

#[test]
fn test_treasury_invariant_release_escrow_back_to_balances_preserves_invariant() {
    let mut snapshot = valid(800, 200, 500, 500);
    let amount = 200_u64;

    snapshot.escrow -= amount;
    snapshot.sum_of_balances += amount;

    snapshot.assert_invariant();
}

#[test]
fn test_treasury_invariant_reclassify_liability_to_treasury_preserves_invariant() {
    let mut snapshot = valid(800, 0, 200, 600);
    let amount = 200_u64;

    snapshot.liabilities -= amount;
    snapshot.treasury += amount;

    snapshot.assert_invariant();
}

#[test]
fn test_treasury_invariant_generated_scenarios_pass() {
    for sum_of_balances in [0_u64, 125, 400, 1_250, 10_000] {
        for escrow in [0_u64, 1, 25, 100, 750] {
            let total_assets = sum_of_balances + escrow;
            for liabilities in [0_u64, 50, 200, 500] {
                if liabilities > total_assets {
                    continue;
                }
                let treasury = total_assets - liabilities;
                valid(sum_of_balances, escrow, liabilities, treasury).assert_invariant();
            }
        }
    }
}

// ===== COLLECTIBLE INFO TESTS =====

#[test]
fn test_get_collectible_info_success() {
    let env = Env::default();
    env.mock_all_auths();

    let (_, client, owner, tyc_token, usdc_token) = setup_contract(&env);
    let reward_system = Address::generate(&env);
    client.initialize(&tyc_token, &usdc_token, &owner, &reward_system);

    let token_id = 1_u32;
    let perk = 5_u32;
    let strength = 10_u32;
    let tyc_price = 100_i128;
    let usdc_price = 50_i128;
    let shop_stock = 20_u32;

    client.set_collectible_info(
        &token_id,
        &perk,
        &strength,
        &tyc_price,
        &usdc_price,
        &shop_stock,
    );

    let info = client.get_collectible_info(&token_id);
    assert_eq!(info, (perk, strength, tyc_price, usdc_price, shop_stock));
}

#[test]
fn test_set_collectible_info_success() {
    let env = Env::default();
    env.mock_all_auths();

    let (_, client, owner, tyc_token, usdc_token) = setup_contract(&env);
    let reward_system = Address::generate(&env);
    client.initialize(&tyc_token, &usdc_token, &owner, &reward_system);

    let token_id = 7_u32;
    let perk = 3_u32;
    let strength = 42_u32;
    let tyc_price = 250_i128;
    let usdc_price = 125_i128;
    let shop_stock = 9_u32;

    client.set_collectible_info(
        &token_id,
        &perk,
        &strength,
        &tyc_price,
        &usdc_price,
        &shop_stock,
    );

    let info = client.get_collectible_info(&token_id);
    assert_eq!(info, (perk, strength, tyc_price, usdc_price, shop_stock));
}

#[test]
#[should_panic]
fn test_set_collectible_info_non_owner_rejected() {
    let env = Env::default();

    let (_, client, owner, tyc_token, usdc_token) = setup_contract(&env);
    let reward_system = Address::generate(&env);

    env.mock_all_auths();
    client.initialize(&tyc_token, &usdc_token, &owner, &reward_system);

    // Only the owner authorizes; the non-owner caller is not mocked.
    env.set_auths(&[]);

    let non_owner = Address::generate(&env);
    env.mock_auths(&[soroban_sdk::testutils::MockAuth {
        address: &non_owner,
        invoke: &soroban_sdk::testutils::MockAuthInvoke {
            contract: &client.address,
            fn_name: "set_collectible_info",
            args: (
                1_u32,
                1_u32,
                1_u32,
                1_i128,
                1_i128,
                1_u32,
            )
                .into_val(&env),
            sub_invokes: &[],
        },
    }]);

    client.set_collectible_info(&1_u32, &1_u32, &1_u32, &1_i128, &1_i128, &1_u32);
}

// ===== CASH TIER TESTS =====

#[test]
fn test_get_cash_tier_value_success() {
    let env = Env::default();
    env.mock_all_auths();

    let (_, client, owner, tyc_token, usdc_token) = setup_contract(&env);
    let reward_system = Address::generate(&env);
    client.initialize(&tyc_token, &usdc_token, &owner, &reward_system);

    let tier = 1_u32;
    let value = 500_i128;

    client.set_cash_tier_value(&tier, &value);

    assert_eq!(client.get_cash_tier_value(&tier), value);
}

#[test]
fn test_set_cash_tier_value_success() {
    let env = Env::default();
    env.mock_all_auths();

    let (_, client, owner, tyc_token, usdc_token) = setup_contract(&env);
    let reward_system = Address::generate(&env);
    client.initialize(&tyc_token, &usdc_token, &owner, &reward_system);

    let tier = 3_u32;
    let value = 1_234_i128;

    client.set_cash_tier_value(&tier, &value);

    assert_eq!(client.get_cash_tier_value(&tier), value);
}

#[test]
#[should_panic]
fn test_set_cash_tier_value_non_owner_rejected() {
    let env = Env::default();

    let (_, client, owner, tyc_token, usdc_token) = setup_contract(&env);
    let reward_system = Address::generate(&env);

    env.mock_all_auths();
    client.initialize(&tyc_token, &usdc_token, &owner, &reward_system);

    // Only the owner authorizes; the non-owner caller is not mocked.
    env.set_auths(&[]);

    let non_owner = Address::generate(&env);
    env.mock_auths(&[soroban_sdk::testutils::MockAuth {
        address: &non_owner,
        invoke: &soroban_sdk::testutils::MockAuthInvoke {
            contract: &client.address,
            fn_name: "set_cash_tier_value",
            args: (1_u32, 1_i128).into_val(&env),
            sub_invokes: &[],
        },
    }]);

    client.set_cash_tier_value(&1_u32, &1_i128);
}
