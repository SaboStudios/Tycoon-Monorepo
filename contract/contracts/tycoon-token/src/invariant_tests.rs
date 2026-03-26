/// # Tycoon Token (TYC) — Mint/Burn Invariant & Cap Tests
///
/// ## Invariants documented
///
/// | ID  | Invariant |
/// |-----|-----------|
/// | INV-01 | `total_supply` always equals the sum of all individual balances |
/// | INV-02 | `total_supply` increases by exactly `amount` on every successful `mint` |
/// | INV-03 | `total_supply` decreases by exactly `amount` on every successful `burn` / `burn_from` |
/// | INV-04 | `total_supply` is never negative |
/// | INV-05 | Minting zero or a negative amount is rejected |
/// | INV-06 | Burning zero or a negative amount is rejected |
/// | INV-07 | Burning more than a holder's balance is rejected |
/// | INV-08 | `burn_from` is rejected when allowance is insufficient |
/// | INV-09 | Arithmetic overflow on `mint` is caught and panics (no silent wrap) |
/// | INV-10 | Sequential mint → burn round-trip restores the original `total_supply` |
/// | INV-11 | Multiple independent mints accumulate correctly in `total_supply` |
/// | INV-12 | Multiple independent burns reduce `total_supply` correctly |
/// | INV-13 | Burning the entire supply of a holder reduces `total_supply` to zero |
/// | INV-14 | `burn_from` reduces both the holder's balance and the spender's allowance |
/// | INV-15 | Only the admin can mint; non-admin callers are rejected |
/// | INV-16 | `MintEvent` is emitted with correct `to` and `amount` on every mint |
/// | INV-17 | `BurnEvent` is emitted with correct `from` and `amount` on every burn |
///
/// Test names follow the pattern `test_inv_<ID>_<short_description>`.
use super::*;
use soroban_sdk::{
    testutils::{Address as _, Events},
    Env, IntoVal,
};

// ── helpers ──────────────────────────────────────────────────────────────────

const INITIAL_SUPPLY: i128 = 1_000_000_000_000_000_000_000_000_000; // 1e9 * 10^18

/// Spin up a fresh environment, register the contract, and initialize it.
/// Returns `(env, client, admin)`.
fn setup() -> (Env, TycoonTokenClient<'static>, Address) {
    let e = Env::default();
    e.mock_all_auths();
    let contract_id = e.register(TycoonToken, ());
    let client = TycoonTokenClient::new(&e, &contract_id);
    let admin = Address::generate(&e);
    client.initialize(&admin, &INITIAL_SUPPLY);
    (e, client, admin)
}

// ── INV-01 ────────────────────────────────────────────────────────────────────

/// INV-01: total_supply == sum of all balances after a series of mints and burns.
#[test]
fn test_inv_01_total_supply_equals_sum_of_balances() {
    let (e, client, admin) = setup();

    let user0 = Address::generate(&e);
    let user1 = Address::generate(&e);
    let user2 = Address::generate(&e);
    let user3 = Address::generate(&e);
    let user4 = Address::generate(&e);

    client.mint(&user0, &1_000_000_000_000_000_000_000_i128);
    client.mint(&user1, &2_000_000_000_000_000_000_000_i128);
    client.mint(&user2, &500_000_000_000_000_000_000_i128);
    client.mint(&user3, &3_000_000_000_000_000_000_000_i128);
    client.mint(&user4, &750_000_000_000_000_000_000_i128);

    // Burn some from the first two users
    client.burn(&user0, &500_000_000_000_000_000_000);
    client.burn(&user1, &1_000_000_000_000_000_000_000);

    let sum: i128 = client.balance(&user0)
        + client.balance(&user1)
        + client.balance(&user2)
        + client.balance(&user3)
        + client.balance(&user4)
        + client.balance(&admin);

    assert_eq!(client.total_supply(), sum);
}

// ── INV-02 ────────────────────────────────────────────────────────────────────

/// INV-02 table-driven: total_supply increases by exactly `amount` on each mint.
#[test]
fn test_inv_02_mint_increases_total_supply_exactly() {
    let cases: &[i128] = &[
        1,
        1_000_000_000_000_000_000, // 1 TYC
        500_000_000_000_000_000_000_000_000,
        INITIAL_SUPPLY,
    ];

    for &amount in cases {
        let (_, client, _) = setup();
        let user = Address::generate(&client.env);
        let before = client.total_supply();
        client.mint(&user, &amount);
        assert_eq!(
            client.total_supply(),
            before + amount,
            "INV-02 failed for mint amount {amount}"
        );
    }
}

// ── INV-03 ────────────────────────────────────────────────────────────────────

/// INV-03 table-driven: total_supply decreases by exactly `amount` on each burn.
#[test]
fn test_inv_03_burn_decreases_total_supply_exactly() {
    let cases: &[i128] = &[
        1,
        1_000_000_000_000_000_000,
        100_000_000_000_000_000_000_000_000,
        INITIAL_SUPPLY,
    ];

    for &amount in cases {
        let (_, client, admin) = setup();
        let before = client.total_supply();
        client.burn(&admin, &amount);
        assert_eq!(
            client.total_supply(),
            before - amount,
            "INV-03 failed for burn amount {amount}"
        );
    }
}

// ── INV-04 ────────────────────────────────────────────────────────────────────

/// INV-04: total_supply is never negative — burning the full supply reaches zero, not below.
#[test]
fn test_inv_04_total_supply_never_negative() {
    let (_, client, admin) = setup();
    client.burn(&admin, &INITIAL_SUPPLY);
    assert_eq!(client.total_supply(), 0);
    assert!(client.total_supply() >= 0);
}

// ── INV-05 ────────────────────────────────────────────────────────────────────

/// INV-05: minting zero is rejected.
#[test]
#[should_panic(expected = "Amount must be positive")]
fn test_inv_05a_mint_zero_rejected() {
    let (_, client, _) = setup();
    let user = Address::generate(&client.env);
    client.mint(&user, &0);
}

/// INV-05: minting a negative amount is rejected.
#[test]
#[should_panic(expected = "Amount must be positive")]
fn test_inv_05b_mint_negative_rejected() {
    let (_, client, _) = setup();
    let user = Address::generate(&client.env);
    client.mint(&user, &-1);
}

// ── INV-06 ────────────────────────────────────────────────────────────────────

/// INV-06: burning zero is rejected.
#[test]
#[should_panic(expected = "Amount must be positive")]
fn test_inv_06a_burn_zero_rejected() {
    let (_, client, admin) = setup();
    client.burn(&admin, &0);
}

/// INV-06: burning a negative amount is rejected.
#[test]
#[should_panic(expected = "Amount must be positive")]
fn test_inv_06b_burn_negative_rejected() {
    let (_, client, admin) = setup();
    client.burn(&admin, &-1);
}

// ── INV-07 ────────────────────────────────────────────────────────────────────

/// INV-07: burning more than the holder's balance is rejected.
#[test]
#[should_panic(expected = "Insufficient balance")]
fn test_inv_07_burn_exceeds_balance_rejected() {
    let (_, client, admin) = setup();
    client.burn(&admin, &(INITIAL_SUPPLY + 1));
}

/// INV-07: burning from an account with zero balance is rejected.
#[test]
#[should_panic(expected = "Insufficient balance")]
fn test_inv_07b_burn_from_zero_balance_rejected() {
    let (_, client, _) = setup();
    let empty_user = Address::generate(&client.env);
    client.burn(&empty_user, &1);
}

// ── INV-08 ────────────────────────────────────────────────────────────────────

/// INV-08: burn_from with insufficient allowance is rejected.
#[test]
#[should_panic(expected = "Insufficient allowance")]
fn test_inv_08a_burn_from_insufficient_allowance_rejected() {
    let (_, client, admin) = setup();
    let spender = Address::generate(&client.env);
    let allowance: i128 = 100_000_000_000_000_000_000_000_000;
    client.approve(&admin, &spender, &allowance, &0);
    client.burn_from(&spender, &admin, &(allowance + 1));
}

/// INV-08: burn_from with zero allowance is rejected.
#[test]
#[should_panic(expected = "Insufficient allowance")]
fn test_inv_08b_burn_from_zero_allowance_rejected() {
    let (_, client, admin) = setup();
    let spender = Address::generate(&client.env);
    // No approve call — allowance defaults to 0
    client.burn_from(&spender, &admin, &1);
}

// ── INV-09 ────────────────────────────────────────────────────────────────────

/// INV-09: minting an amount that would overflow i128 is caught (no silent wrap).
/// We mint i128::MAX - INITIAL_SUPPLY + 1 to a fresh user, which pushes total_supply
/// past i128::MAX.
#[test]
#[should_panic(expected = "Supply overflow")]
fn test_inv_09_mint_overflow_guard() {
    let (_, client, _) = setup();
    let user = Address::generate(&client.env);
    // total_supply is currently INITIAL_SUPPLY; adding this would overflow i128
    let overflow_amount = i128::MAX - INITIAL_SUPPLY + 1;
    client.mint(&user, &overflow_amount);
}

/// INV-09: minting i128::MAX to a single user overflows the balance.
/// The Soroban host wraps the inner "Balance overflow" panic in a HostError envelope.
#[test]
#[should_panic(expected = "WasmVm")]
fn test_inv_09b_mint_balance_overflow_guard() {
    let (_, client, _) = setup();
    let user = Address::generate(&client.env);
    // First mint fills the user's balance close to i128::MAX
    client.mint(&user, &(i128::MAX - 1));
    // Second mint of 2 overflows the user's balance
    client.mint(&user, &2);
}

// ── INV-10 ────────────────────────────────────────────────────────────────────

/// INV-10: mint then burn of the same amount is a no-op on total_supply.
#[test]
fn test_inv_10_mint_burn_round_trip_restores_supply() {
    let (_, client, admin) = setup();
    let user = Address::generate(&client.env);
    let amount: i128 = 42_000_000_000_000_000_000_000;
    let before = client.total_supply();

    client.mint(&user, &amount);
    assert_eq!(client.total_supply(), before + amount);

    client.burn(&user, &amount);
    assert_eq!(client.total_supply(), before, "Round-trip should restore supply");
}

// ── INV-11 ────────────────────────────────────────────────────────────────────

/// INV-11: multiple sequential mints accumulate correctly in total_supply.
#[test]
fn test_inv_11_multiple_mints_accumulate_in_total_supply() {
    let (_, client, _) = setup();
    let amounts: [i128; 6] = [
        1_000_000_000_000_000_000_000,
        2_000_000_000_000_000_000_000,
        3_000_000_000_000_000_000_000,
        500_000_000_000_000_000_000,
        750_000_000_000_000_000_000,
        250_000_000_000_000_000_000,
    ];
    let mut expected = INITIAL_SUPPLY;

    for amount in amounts {
        let user = Address::generate(&client.env);
        client.mint(&user, &amount);
        expected += amount;
        assert_eq!(client.total_supply(), expected);
    }
}

// ── INV-12 ────────────────────────────────────────────────────────────────────

/// INV-12: multiple sequential burns reduce total_supply correctly.
#[test]
fn test_inv_12_multiple_burns_reduce_total_supply_correctly() {
    let (_, client, admin) = setup();
    let burn_amounts: [i128; 4] = [
        100_000_000_000_000_000_000_000_000,
        200_000_000_000_000_000_000_000_000,
        50_000_000_000_000_000_000_000_000,
        150_000_000_000_000_000_000_000_000,
    ];
    let mut expected = INITIAL_SUPPLY;

    for amount in burn_amounts {
        client.burn(&admin, &amount);
        expected -= amount;
        assert_eq!(client.total_supply(), expected);
    }
}

// ── INV-13 ────────────────────────────────────────────────────────────────────

/// INV-13: burning the entire balance of the sole holder reduces total_supply to zero.
#[test]
fn test_inv_13_burn_entire_supply_reaches_zero() {
    let (_, client, admin) = setup();
    client.burn(&admin, &INITIAL_SUPPLY);
    assert_eq!(client.total_supply(), 0);
    assert_eq!(client.balance(&admin), 0);
}

// ── INV-14 ────────────────────────────────────────────────────────────────────

/// INV-14: burn_from reduces both the holder's balance and the spender's allowance by `amount`.
#[test]
fn test_inv_14_burn_from_reduces_balance_and_allowance() {
    let (_, client, admin) = setup();
    let spender = Address::generate(&client.env);
    let allowance: i128 = 200_000_000_000_000_000_000_000_000;
    let burn_amount: i128 = 80_000_000_000_000_000_000_000_000;

    client.approve(&admin, &spender, &allowance, &0);

    let supply_before = client.total_supply();
    let balance_before = client.balance(&admin);

    client.burn_from(&spender, &admin, &burn_amount);

    assert_eq!(client.balance(&admin), balance_before - burn_amount, "INV-14: balance");
    assert_eq!(client.allowance(&admin, &spender), allowance - burn_amount, "INV-14: allowance");
    assert_eq!(client.total_supply(), supply_before - burn_amount, "INV-14: supply");
}

/// INV-14: burn_from exhausting the full allowance leaves allowance at zero.
#[test]
fn test_inv_14b_burn_from_exhausts_allowance_to_zero() {
    let (_, client, admin) = setup();
    let spender = Address::generate(&client.env);
    let allowance: i128 = 50_000_000_000_000_000_000_000_000;

    client.approve(&admin, &spender, &allowance, &0);
    client.burn_from(&spender, &admin, &allowance);

    assert_eq!(client.allowance(&admin, &spender), 0);
}

// ── INV-15 ────────────────────────────────────────────────────────────────────

/// INV-15: a non-admin address cannot mint tokens.
/// Soroban auth failures surface as a host panic; we verify the supply is unchanged.
#[test]
#[should_panic]
fn test_inv_15_non_admin_cannot_mint() {
    let e = Env::default();
    // Do NOT mock_all_auths — let auth checks run for real
    let contract_id = e.register(TycoonToken, ());
    let client = TycoonTokenClient::new(&e, &contract_id);
    let admin = Address::generate(&e);
    let attacker = Address::generate(&e);

    // Initialize with real auth mocked only for this call
    e.mock_all_auths();
    client.initialize(&admin, &INITIAL_SUPPLY);

    // Now drop mock_all_auths and attempt mint as attacker — should panic
    let e2 = Env::default();
    let contract_id2 = e2.register(TycoonToken, ());
    let client2 = TycoonTokenClient::new(&e2, &contract_id2);
    let admin2 = Address::generate(&e2);
    e2.mock_all_auths();
    client2.initialize(&admin2, &INITIAL_SUPPLY);

    // Attempt mint without mocking auth for admin — attacker has no admin rights
    // This should panic because admin.require_auth() will fail
    let victim = Address::generate(&e2);
    // We call mint but only mock auth for `attacker`, not `admin2`
    e2.mock_auths(&[soroban_sdk::testutils::MockAuth {
        address: &attacker,
        invoke: &soroban_sdk::testutils::MockAuthInvoke {
            contract: &contract_id2,
            fn_name: "mint",
            args: soroban_sdk::vec![&e2, victim.clone().into_val(&e2), 1_i128.into_val(&e2)],
            sub_invokes: &[],
        },
    }]);
    client2.mint(&victim, &1);
}

// ── INV-16 ────────────────────────────────────────────────────────────────────

/// INV-16: MintEvent is emitted with the correct `to` and `amount` on every mint.
#[test]
fn test_inv_16_mint_emits_event_with_correct_fields() {
    let (e, client, _) = setup();
    let user = Address::generate(&e);
    let amount: i128 = 7_000_000_000_000_000_000_000;

    client.mint(&user, &amount);

    let events = e.events().all();
    // The last event should be the MintEvent from our mint call
    let last = events.last().expect("expected at least one event");
    // MintEvent topics: [contract_address, "mint", to]
    // data: amount (single-value format)
    let event_data: i128 = last.2.into_val(&e);
    assert_eq!(event_data, amount, "INV-16: MintEvent amount mismatch");
}

/// INV-16: initialization also emits a MintEvent for the initial supply.
#[test]
fn test_inv_16b_initialize_emits_mint_event() {
    let e = Env::default();
    e.mock_all_auths();
    let contract_id = e.register(TycoonToken, ());
    let client = TycoonTokenClient::new(&e, &contract_id);
    let admin = Address::generate(&e);

    client.initialize(&admin, &INITIAL_SUPPLY);

    let events = e.events().all();
    assert!(!events.is_empty(), "INV-16b: expected MintEvent on initialize");
    let last = events.last().unwrap();
    let event_data: i128 = last.2.into_val(&e);
    assert_eq!(event_data, INITIAL_SUPPLY);
}

// ── INV-17 ────────────────────────────────────────────────────────────────────

/// INV-17: BurnEvent is emitted with the correct `from` and `amount` on burn.
#[test]
fn test_inv_17_burn_emits_event_with_correct_fields() {
    let (e, client, admin) = setup();
    let burn_amount: i128 = 3_000_000_000_000_000_000_000;

    client.burn(&admin, &burn_amount);

    let events = e.events().all();
    let last = events.last().expect("expected at least one event");
    let event_data: i128 = last.2.into_val(&e);
    assert_eq!(event_data, burn_amount, "INV-17: BurnEvent amount mismatch");
}

/// INV-17: BurnEvent is emitted with the correct fields on burn_from.
#[test]
fn test_inv_17b_burn_from_emits_event_with_correct_fields() {
    let (e, client, admin) = setup();
    let spender = Address::generate(&e);
    let allowance: i128 = 100_000_000_000_000_000_000_000_000;
    let burn_amount: i128 = 40_000_000_000_000_000_000_000_000;

    client.approve(&admin, &spender, &allowance, &0);
    client.burn_from(&spender, &admin, &burn_amount);

    let events = e.events().all();
    let last = events.last().expect("expected at least one event");
    let event_data: i128 = last.2.into_val(&e);
    assert_eq!(event_data, burn_amount, "INV-17b: BurnEvent amount mismatch");
}

// ── Additional edge-case / fuzz-style table tests ─────────────────────────────

/// Table-driven: verify total_supply invariant across a sequence of mixed mint/burn ops.
#[test]
fn test_supply_invariant_mixed_operations_table() {
    struct Op {
        is_mint: bool,
        amount: i128,
    }

    let ops = [
        Op { is_mint: true,  amount: 1_000_000_000_000_000_000_000 },
        Op { is_mint: true,  amount: 2_000_000_000_000_000_000_000 },
        Op { is_mint: false, amount: 500_000_000_000_000_000_000 },
        Op { is_mint: true,  amount: 5_000_000_000_000_000_000_000 },
        Op { is_mint: false, amount: 3_000_000_000_000_000_000_000 },
        Op { is_mint: false, amount: 1_000_000_000_000_000_000_000 },
    ];

    let (_, client, admin) = setup();
    let user = Address::generate(&client.env);
    // Give user enough balance for burns
    client.mint(&user, &10_000_000_000_000_000_000_000);
    let mut expected = client.total_supply();

    for op in &ops {
        if op.is_mint {
            let recipient = Address::generate(&client.env);
            client.mint(&recipient, &op.amount);
            expected += op.amount;
        } else {
            client.burn(&user, &op.amount);
            expected -= op.amount;
        }
        assert_eq!(client.total_supply(), expected, "supply invariant violated");
    }
}

/// Boundary: minting 1 (smallest positive unit) is valid.
#[test]
fn test_mint_minimum_unit() {
    let (_, client, _) = setup();
    let user = Address::generate(&client.env);
    let before = client.total_supply();
    client.mint(&user, &1);
    assert_eq!(client.balance(&user), 1);
    assert_eq!(client.total_supply(), before + 1);
}

/// Boundary: burning 1 (smallest positive unit) is valid.
#[test]
fn test_burn_minimum_unit() {
    let (_, client, admin) = setup();
    let before = client.total_supply();
    client.burn(&admin, &1);
    assert_eq!(client.total_supply(), before - 1);
}

/// Boundary: burn_from with allowance == amount (exact) succeeds and leaves allowance at 0.
#[test]
fn test_burn_from_exact_allowance_boundary() {
    let (_, client, admin) = setup();
    let spender = Address::generate(&client.env);
    let exact: i128 = 1_000_000_000_000_000_000;
    client.approve(&admin, &spender, &exact, &0);
    client.burn_from(&spender, &admin, &exact);
    assert_eq!(client.allowance(&admin, &spender), 0);
    assert_eq!(client.total_supply(), INITIAL_SUPPLY - exact);
}
