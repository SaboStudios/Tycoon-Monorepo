/// SW-CT-005 — tycoon-token: deprecation path for legacy entrypoints
///
/// Verifies that:
/// - Each deprecated entrypoint always panics with the expected message.
/// - The canonical replacement still works after a failed legacy call.
/// - Supply and balances are never mutated by a deprecated call.
extern crate std;

use crate::TycoonToken;
use soroban_sdk::{testutils::Address as _, Env};

const SUPPLY: i128 = 1_000_000_000_000_000_000_000_000_000;

// -------------------------------------------------------------------------
// legacy_mint
// -------------------------------------------------------------------------

#[test]
#[should_panic(expected = "legacy_mint is deprecated; use mint instead")]
fn legacy_mint_always_panics() {
    let e = Env::default();
    e.mock_all_auths();
    let contract_id = e.register(TycoonToken, ());
    let client = crate::TycoonTokenClient::new(&e, &contract_id);
    let admin = soroban_sdk::Address::generate(&e);
    let user = soroban_sdk::Address::generate(&e);
    client.initialize(&admin, &SUPPLY);
    client.legacy_mint(&user, &1_000);
}

#[test]
fn legacy_mint_does_not_change_supply() {
    let e = Env::default();
    e.mock_all_auths();
    let contract_id = e.register(TycoonToken, ());
    let client = crate::TycoonTokenClient::new(&e, &contract_id);
    let admin = soroban_sdk::Address::generate(&e);
    let user = soroban_sdk::Address::generate(&e);
    client.initialize(&admin, &SUPPLY);

    let supply_before = client.total_supply();
    let balance_before = client.balance(&user);

    let res = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        client.legacy_mint(&user, &1_000);
    }));
    assert!(res.is_err(), "expected legacy_mint to panic");

    assert_eq!(client.total_supply(), supply_before);
    assert_eq!(client.balance(&user), balance_before);
}

#[test]
fn canonical_mint_still_works_after_legacy_mint_attempt() {
    let e = Env::default();
    e.mock_all_auths();
    let contract_id = e.register(TycoonToken, ());
    let client = crate::TycoonTokenClient::new(&e, &contract_id);
    let admin = soroban_sdk::Address::generate(&e);
    let user = soroban_sdk::Address::generate(&e);
    client.initialize(&admin, &SUPPLY);

    let _ = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        client.legacy_mint(&user, &1_000);
    }));

    let mint_amount: i128 = 500_000_000_000_000_000_000;
    client.mint(&user, &mint_amount);
    assert_eq!(client.balance(&user), mint_amount);
    assert_eq!(client.total_supply(), SUPPLY + mint_amount);
}

// -------------------------------------------------------------------------
// legacy_burn
// -------------------------------------------------------------------------

#[test]
#[should_panic(expected = "legacy_burn is deprecated; use burn instead")]
fn legacy_burn_always_panics() {
    let e = Env::default();
    e.mock_all_auths();
    let contract_id = e.register(TycoonToken, ());
    let client = crate::TycoonTokenClient::new(&e, &contract_id);
    let admin = soroban_sdk::Address::generate(&e);
    client.initialize(&admin, &SUPPLY);
    client.legacy_burn(&admin, &1_000);
}

#[test]
fn legacy_burn_does_not_change_supply() {
    let e = Env::default();
    e.mock_all_auths();
    let contract_id = e.register(TycoonToken, ());
    let client = crate::TycoonTokenClient::new(&e, &contract_id);
    let admin = soroban_sdk::Address::generate(&e);
    client.initialize(&admin, &SUPPLY);

    let supply_before = client.total_supply();
    let balance_before = client.balance(&admin);

    let res = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        client.legacy_burn(&admin, &1_000);
    }));
    assert!(res.is_err(), "expected legacy_burn to panic");

    assert_eq!(client.total_supply(), supply_before);
    assert_eq!(client.balance(&admin), balance_before);
}

#[test]
fn canonical_burn_still_works_after_legacy_burn_attempt() {
    let e = Env::default();
    e.mock_all_auths();
    let contract_id = e.register(TycoonToken, ());
    let client = crate::TycoonTokenClient::new(&e, &contract_id);
    let admin = soroban_sdk::Address::generate(&e);
    client.initialize(&admin, &SUPPLY);

    let _ = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        client.legacy_burn(&admin, &1_000);
    }));

    let burn_amount: i128 = 100_000_000_000_000_000_000_000_000;
    client.burn(&admin, &burn_amount);
    assert_eq!(client.balance(&admin), SUPPLY - burn_amount);
    assert_eq!(client.total_supply(), SUPPLY - burn_amount);
}

// -------------------------------------------------------------------------
// legacy_transfer
// -------------------------------------------------------------------------

#[test]
#[should_panic(expected = "legacy_transfer is deprecated; use transfer instead")]
fn legacy_transfer_always_panics() {
    let e = Env::default();
    e.mock_all_auths();
    let contract_id = e.register(TycoonToken, ());
    let client = crate::TycoonTokenClient::new(&e, &contract_id);
    let admin = soroban_sdk::Address::generate(&e);
    let user = soroban_sdk::Address::generate(&e);
    client.initialize(&admin, &SUPPLY);
    client.legacy_transfer(&admin, &user, &1_000);
}

#[test]
fn legacy_transfer_does_not_move_tokens() {
    let e = Env::default();
    e.mock_all_auths();
    let contract_id = e.register(TycoonToken, ());
    let client = crate::TycoonTokenClient::new(&e, &contract_id);
    let admin = soroban_sdk::Address::generate(&e);
    let user = soroban_sdk::Address::generate(&e);
    client.initialize(&admin, &SUPPLY);

    let admin_balance_before = client.balance(&admin);
    let user_balance_before = client.balance(&user);

    let res = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        client.legacy_transfer(&admin, &user, &1_000);
    }));
    assert!(res.is_err(), "expected legacy_transfer to panic");

    assert_eq!(client.balance(&admin), admin_balance_before);
    assert_eq!(client.balance(&user), user_balance_before);
}

#[test]
fn canonical_transfer_still_works_after_legacy_transfer_attempt() {
    let e = Env::default();
    e.mock_all_auths();
    let contract_id = e.register(TycoonToken, ());
    let client = crate::TycoonTokenClient::new(&e, &contract_id);
    let admin = soroban_sdk::Address::generate(&e);
    let user = soroban_sdk::Address::generate(&e);
    client.initialize(&admin, &SUPPLY);

    let _ = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        client.legacy_transfer(&admin, &user, &1_000);
    }));

    let amount: i128 = 500_000_000_000_000_000_000_000_000;
    client.transfer(&admin, &user, &amount);
    assert_eq!(client.balance(&admin), SUPPLY - amount);
    assert_eq!(client.balance(&user), amount);
}

// -------------------------------------------------------------------------
// Additional edge case coverage
// -------------------------------------------------------------------------

/// Multiple consecutive legacy_mint attempts should all panic without side effects.
#[test]
fn multiple_legacy_mint_attempts_all_fail() {
    let e = Env::default();
    e.mock_all_auths();
    let contract_id = e.register(TycoonToken, ());
    let client = crate::TycoonTokenClient::new(&e, &contract_id);
    let admin = soroban_sdk::Address::generate(&e);
    let user = soroban_sdk::Address::generate(&e);
    client.initialize(&admin, &SUPPLY);

    let supply_before = client.total_supply();
    let balance_before = client.balance(&user);

    for _ in 0..3 {
        let res = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            client.legacy_mint(&user, &1_000);
        }));
        assert!(res.is_err(), "expected legacy_mint to panic");
    }

    assert_eq!(client.total_supply(), supply_before);
    assert_eq!(client.balance(&user), balance_before);
}

/// Legacy_burn with zero amount should still panic (deprecated regardless of amount).
#[test]
#[should_panic(expected = "legacy_burn is deprecated; use burn instead")]
fn legacy_burn_with_zero_amount_panics() {
    let e = Env::default();
    e.mock_all_auths();
    let contract_id = e.register(TycoonToken, ());
    let client = crate::TycoonTokenClient::new(&e, &contract_id);
    let admin = soroban_sdk::Address::generate(&e);
    client.initialize(&admin, &SUPPLY);
    client.legacy_burn(&admin, &0);
}

/// Legacy_transfer with large amount should still panic without moving tokens.
#[test]
fn legacy_transfer_large_amount_does_not_move_tokens() {
    let e = Env::default();
    e.mock_all_auths();
    let contract_id = e.register(TycoonToken, ());
    let client = crate::TycoonTokenClient::new(&e, &contract_id);
    let admin = soroban_sdk::Address::generate(&e);
    let user = soroban_sdk::Address::generate(&e);
    client.initialize(&admin, &SUPPLY);

    let large_amount: i128 = 999_000_000_000_000_000_000_000_000;
    let admin_balance_before = client.balance(&admin);
    let user_balance_before = client.balance(&user);

    let res = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        client.legacy_transfer(&admin, &user, &large_amount);
    }));
    assert!(res.is_err(), "expected legacy_transfer to panic");

    assert_eq!(client.balance(&admin), admin_balance_before);
    assert_eq!(client.balance(&user), user_balance_before);
}

/// Interleaving legacy and canonical operations: legacy fails, canonical succeeds.
#[test]
fn interleaved_legacy_and_canonical_operations() {
    let e = Env::default();
    e.mock_all_auths();
    let contract_id = e.register(TycoonToken, ());
    let client = crate::TycoonTokenClient::new(&e, &contract_id);
    let admin = soroban_sdk::Address::generate(&e);
    let user_a = soroban_sdk::Address::generate(&e);
    let user_b = soroban_sdk::Address::generate(&e);
    client.initialize(&admin, &SUPPLY);

    // Canonical mint
    let mint_amount: i128 = 100_000_000_000_000_000_000;
    client.mint(&user_a, &mint_amount);
    assert_eq!(client.balance(&user_a), mint_amount);

    // Legacy mint attempt (fails)
    let _ = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        client.legacy_mint(&user_b, &mint_amount);
    }));
    assert_eq!(client.balance(&user_b), 0);

    // Canonical transfer
    let transfer_amount: i128 = 50_000_000_000_000_000_000;
    client.transfer(&user_a, &user_b, &transfer_amount);
    assert_eq!(client.balance(&user_a), mint_amount - transfer_amount);
    assert_eq!(client.balance(&user_b), transfer_amount);

    // Legacy transfer attempt (fails)
    let balance_a_before = client.balance(&user_a);
    let balance_b_before = client.balance(&user_b);
    let _ = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        client.legacy_transfer(&user_a, &user_b, &10_000);
    }));
    assert_eq!(client.balance(&user_a), balance_a_before);
    assert_eq!(client.balance(&user_b), balance_b_before);

    // Canonical burn
    let burn_amount: i128 = 20_000_000_000_000_000_000;
    client.burn(&user_b, &burn_amount);
    assert_eq!(client.balance(&user_b), transfer_amount - burn_amount);

    // Legacy burn attempt (fails)
    let balance_b_before_burn = client.balance(&user_b);
    let _ = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        client.legacy_burn(&user_b, &5_000);
    }));
    assert_eq!(client.balance(&user_b), balance_b_before_burn);
}

/// Legacy operations should not affect allowances.
#[test]
fn legacy_operations_do_not_affect_allowances() {
    let e = Env::default();
    e.mock_all_auths();
    let contract_id = e.register(TycoonToken, ());
    let client = crate::TycoonTokenClient::new(&e, &contract_id);
    let admin = soroban_sdk::Address::generate(&e);
    let spender = soroban_sdk::Address::generate(&e);
    client.initialize(&admin, &SUPPLY);

    // Set an allowance
    let allowance: i128 = 1_000_000_000_000_000_000;
    client.approve(&admin, &spender, &allowance, &0);
    assert_eq!(client.allowance(&admin, &spender), allowance);

    // Attempt legacy operations
    let _ = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        client.legacy_mint(&spender, &1_000);
    }));
    let _ = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        client.legacy_burn(&admin, &1_000);
    }));
    let _ = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        client.legacy_transfer(&admin, &spender, &1_000);
    }));

    // Allowance should remain unchanged
    assert_eq!(client.allowance(&admin, &spender), allowance);
}
