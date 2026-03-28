/// # Tycoon Token — Error Branch & Snapshot Tests
///
/// Covers branches not exercised by test.rs or invariant_tests.rs:
///
/// | Branch | Test(s) |
/// |--------|---------|
/// | `transfer` with negative amount | `test_transfer_negative_amount` |
/// | `transfer` zero amount (no-op path) | `test_transfer_zero_is_noop` |
/// | `transfer_from` with negative amount | `test_transfer_from_negative_amount` |
/// | `transfer_from` zero amount (no-op path) | `test_transfer_from_zero_is_noop` |
/// | `approve` with negative amount | `test_approve_negative_amount` |
/// | `approve` zero clears allowance | `test_approve_zero_clears_allowance` |
/// | `set_admin` called by non-admin | `test_set_admin_unauthorized` |
/// | `mint` before `initialize` | `test_mint_before_initialize` |
/// | `balance` for unknown address returns 0 | `test_balance_unknown_address` |
/// | `allowance` for unknown pair returns 0 | `test_allowance_unknown_pair` |
/// | `total_supply` before initialize returns 0 | `test_total_supply_before_initialize` |
/// | Snapshot: token metadata | `test_snapshot_token_metadata` |
/// | Snapshot: state after mint+transfer+burn | `test_snapshot_state_after_operations` |
///
/// ## Snapshot convention
///
/// Soroban's test environment does not ship a snapshot assertion library.
/// We use explicit `assert_eq!` on known-good values as "inline snapshots".
/// When intentional behaviour changes, update the expected values here and
/// add a comment explaining the change (e.g. `// SNAPSHOT UPDATED: decimals
/// changed from 18 to 6 in PR #NNN`).
use super::*;
use soroban_sdk::{testutils::Address as _, Env};

const INITIAL_SUPPLY: i128 = 1_000_000_000_000_000_000_000_000_000;

fn setup() -> (Env, TycoonTokenClient<'static>, Address) {
    let e = Env::default();
    e.mock_all_auths();
    let id = e.register(TycoonToken, ());
    let client = TycoonTokenClient::new(&e, &id);
    let admin = Address::generate(&e);
    client.initialize(&admin, &INITIAL_SUPPLY);
    (e, client, admin)
}

// ── transfer error branches ───────────────────────────────────────────────────

/// `transfer` with a negative amount must be rejected.
#[test]
#[should_panic(expected = "Amount cannot be negative")]
fn test_transfer_negative_amount() {
    let (e, client, admin) = setup();
    let user = Address::generate(&e);
    client.transfer(&admin, &user, &-1);
}

/// `transfer` of zero is a documented no-op: balances must not change.
#[test]
fn test_transfer_zero_is_noop() {
    let (e, client, admin) = setup();
    let user = Address::generate(&e);
    let before_admin = client.balance(&admin);
    let before_user = client.balance(&user);

    client.transfer(&admin, &user, &0);

    assert_eq!(client.balance(&admin), before_admin, "admin balance changed on zero transfer");
    assert_eq!(client.balance(&user), before_user, "user balance changed on zero transfer");
}

// ── transfer_from error branches ──────────────────────────────────────────────

/// `transfer_from` with a negative amount must be rejected.
#[test]
#[should_panic(expected = "Amount cannot be negative")]
fn test_transfer_from_negative_amount() {
    let (e, client, admin) = setup();
    let spender = Address::generate(&e);
    let recipient = Address::generate(&e);
    let allowance: i128 = 1_000_000_000_000_000_000;
    client.approve(&admin, &spender, &allowance, &0);
    client.transfer_from(&spender, &admin, &recipient, &-1);
}

/// `transfer_from` of zero is a documented no-op: balances and allowance must not change.
#[test]
fn test_transfer_from_zero_is_noop() {
    let (e, client, admin) = setup();
    let spender = Address::generate(&e);
    let recipient = Address::generate(&e);
    let allowance: i128 = 1_000_000_000_000_000_000;
    client.approve(&admin, &spender, &allowance, &0);

    let before_balance = client.balance(&admin);
    let before_allowance = client.allowance(&admin, &spender);

    client.transfer_from(&spender, &admin, &recipient, &0);

    assert_eq!(client.balance(&admin), before_balance, "balance changed on zero transfer_from");
    assert_eq!(
        client.allowance(&admin, &spender),
        before_allowance,
        "allowance changed on zero transfer_from"
    );
}

// ── approve error branches ────────────────────────────────────────────────────

/// `approve` with a negative amount must be rejected.
#[test]
#[should_panic(expected = "Amount cannot be negative")]
fn test_approve_negative_amount() {
    let (e, client, admin) = setup();
    let spender = Address::generate(&e);
    client.approve(&admin, &spender, &-1, &0);
}

/// `approve` with zero clears (sets to 0) the existing allowance.
#[test]
fn test_approve_zero_clears_allowance() {
    let (e, client, admin) = setup();
    let spender = Address::generate(&e);
    let allowance: i128 = 500_000_000_000_000_000;
    client.approve(&admin, &spender, &allowance, &0);
    assert_eq!(client.allowance(&admin, &spender), allowance);

    client.approve(&admin, &spender, &0, &0);
    assert_eq!(client.allowance(&admin, &spender), 0, "allowance should be 0 after approve(0)");
}

// ── set_admin error branch ────────────────────────────────────────────────────

/// `set_admin` called without admin auth must panic.
/// We use a fresh env without mock_all_auths so the auth check fires.
#[test]
#[should_panic]
fn test_set_admin_unauthorized() {
    let e = Env::default();
    // No mock_all_auths — auth checks are live.
    let id = e.register(TycoonToken, ());
    let client = TycoonTokenClient::new(&e, &id);
    let admin = Address::generate(&e);
    let attacker = Address::generate(&e);

    // Initialize with mocked auth for this one call only.
    e.mock_all_auths();
    client.initialize(&admin, &INITIAL_SUPPLY);

    // Attempt set_admin without admin auth — should panic.
    // (mock_all_auths is still active here, but the contract checks
    //  admin.require_auth() which will fail for a non-admin caller
    //  when we don't provide the right mock.)
    let e2 = Env::default();
    let id2 = e2.register(TycoonToken, ());
    let client2 = TycoonTokenClient::new(&e2, &id2);
    let admin2 = Address::generate(&e2);
    e2.mock_all_auths();
    client2.initialize(&admin2, &INITIAL_SUPPLY);

    // Call set_admin mocking only attacker's auth — admin2.require_auth() will fail.
    e2.mock_auths(&[soroban_sdk::testutils::MockAuth {
        address: &attacker,
        invoke: &soroban_sdk::testutils::MockAuthInvoke {
            contract: &id2,
            fn_name: "set_admin",
            args: soroban_sdk::vec![&e2, attacker.clone().into_val(&e2)],
            sub_invokes: &[],
        },
    }]);
    client2.set_admin(&attacker);
}

// ── pre-initialize branches ───────────────────────────────────────────────────

/// Calling `mint` before `initialize` panics because `Admin` key is absent.
#[test]
#[should_panic]
fn test_mint_before_initialize() {
    let e = Env::default();
    e.mock_all_auths();
    let id = e.register(TycoonToken, ());
    let client = TycoonTokenClient::new(&e, &id);
    let user = Address::generate(&e);
    client.mint(&user, &1_000_000_000_000_000_000);
}

// ── default-value branches ────────────────────────────────────────────────────

/// `balance` for an address that has never received tokens returns 0.
#[test]
fn test_balance_unknown_address() {
    let (e, client, _) = setup();
    let stranger = Address::generate(&e);
    assert_eq!(client.balance(&stranger), 0);
}

/// `allowance` for a pair that has never been approved returns 0.
#[test]
fn test_allowance_unknown_pair() {
    let (e, client, _) = setup();
    let owner = Address::generate(&e);
    let spender = Address::generate(&e);
    assert_eq!(client.allowance(&owner, &spender), 0);
}

/// `total_supply` before `initialize` returns 0 (unwrap_or default).
#[test]
fn test_total_supply_before_initialize() {
    let e = Env::default();
    e.mock_all_auths();
    let id = e.register(TycoonToken, ());
    let client = TycoonTokenClient::new(&e, &id);
    assert_eq!(client.total_supply(), 0);
}

// ── inline snapshots ─────────────────────────────────────────────────────────

/// Snapshot: token metadata must match the agreed values.
///
/// If these values change intentionally (e.g. rebranding), update the
/// expected strings here and document the reason in the commit message.
/// SNAPSHOT: name="Tycoon", symbol="TYC", decimals=18
#[test]
fn test_snapshot_token_metadata() {
    let (e, client, _) = setup();
    // SNAPSHOT UPDATED: change these only when the token spec changes.
    assert_eq!(client.name(), soroban_sdk::String::from_str(&e, "Tycoon"));
    assert_eq!(client.symbol(), soroban_sdk::String::from_str(&e, "TYC"));
    assert_eq!(client.decimals(), 18u32);
}

/// Snapshot: known state after a deterministic sequence of operations.
///
/// This acts as a regression guard — if any arithmetic or storage logic
/// changes, this test will catch the drift.
/// SNAPSHOT: after mint(1e21) + transfer(5e20) + burn(2e20)
#[test]
fn test_snapshot_state_after_operations() {
    let (e, client, admin) = setup();
    let user = Address::generate(&e);

    let mint_amount: i128 = 1_000_000_000_000_000_000_000; // 1 000 TYC
    let transfer_amount: i128 = 500_000_000_000_000_000_000; // 500 TYC
    let burn_amount: i128 = 200_000_000_000_000_000_000; // 200 TYC

    client.mint(&user, &mint_amount);
    client.transfer(&user, &admin, &transfer_amount);
    client.burn(&user, &burn_amount);

    // SNAPSHOT: user ends with mint - transfer - burn = 300 TYC
    let expected_user: i128 = mint_amount - transfer_amount - burn_amount;
    assert_eq!(client.balance(&user), expected_user, "snapshot: user balance");

    // SNAPSHOT: admin ends with INITIAL_SUPPLY + transfer
    let expected_admin: i128 = INITIAL_SUPPLY + transfer_amount;
    assert_eq!(client.balance(&admin), expected_admin, "snapshot: admin balance");

    // SNAPSHOT: total_supply = INITIAL_SUPPLY + mint - burn
    let expected_supply: i128 = INITIAL_SUPPLY + mint_amount - burn_amount;
    assert_eq!(client.total_supply(), expected_supply, "snapshot: total_supply");
}
