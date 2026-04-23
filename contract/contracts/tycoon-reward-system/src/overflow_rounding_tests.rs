/// # Reward System — Overflow & Rounding Test Matrix (#397)
///
/// ## Rounding Mode
///
/// Voucher values are stored as `u128` integers. There is no fractional arithmetic
/// inside the contract — all reward amounts are whole token units (with 18 decimal
/// places handled off-chain by the backend before calling `mint_voucher`).
///
/// The rounding contract is therefore:
///   **"The contract transfers exactly the `tyc_value` stored at mint time — no more,
///   no less. Any tier-to-token conversion rounding is the backend's responsibility
///   and must be floor-rounded before submission."**
///
/// This file verifies:
///   - Overflow guards on voucher balance (`u64::MAX`)
///   - Overflow guards on `VoucherCount` (`u128` wrapping is impossible in practice
///     but the counter arithmetic is exercised)
///   - Exact value preservation: what goes in comes out unchanged
///   - Zero-balance paths (redeem, burn, withdraw with empty state)
///   - Tier matrix: Bronze / Silver / Gold / Platinum reward amounts
///   - Withdrawal rounding: exact, partial, and zero amounts
///   - Large value vouchers (near `u128::MAX / 2` to stay within `i128` cast)
///   - Multiple vouchers per user — cumulative redemption correctness
///   - `owned_token_count` stays consistent across all edge cases
///
/// ## Tier Definitions (aligned with backend accounting)
///
/// | Tier     | TYC value (raw units, 18 dec) | Notes                        |
/// |----------|-------------------------------|------------------------------|
/// | Bronze   | 10_000_000_000_000_000_000    | 10 TYC                       |
/// | Silver   | 50_000_000_000_000_000_000    | 50 TYC                       |
/// | Gold     | 100_000_000_000_000_000_000   | 100 TYC                      |
/// | Platinum | 500_000_000_000_000_000_000   | 500 TYC                      |
/// | Minimum  | 1                             | Smallest valid unit          |
/// | Large    | 9_000_000_000_000_000_000_000 | Near practical ceiling       |
///
/// Test names follow the pattern `test_<category>_<short_description>`.
extern crate std;

use crate::{TycoonRewardSystem, TycoonRewardSystemClient};
use soroban_sdk::testutils::Address as TestAddress;
use soroban_sdk::{token, Address, Env};

// ── Tier constants (backend-aligned) ─────────────────────────────────────────

const TIER_BRONZE: u128 = 10_000_000_000_000_000_000; // 10 TYC
const TIER_SILVER: u128 = 50_000_000_000_000_000_000; // 50 TYC
const TIER_GOLD: u128 = 100_000_000_000_000_000_000; // 100 TYC
const TIER_PLATINUM: u128 = 500_000_000_000_000_000_000; // 500 TYC
const TIER_MINIMUM: u128 = 1; // 1 raw unit
const TIER_LARGE: u128 = 9_000_000_000_000_000_000_000; // 9000 TYC

// ── Test harness ──────────────────────────────────────────────────────────────

struct Harness<'a> {
    env: Env,
    client: TycoonRewardSystemClient<'a>,
    admin: Address,
    tyc_token_id: Address,
    contract_id: Address,
}

impl<'a> Harness<'a> {
    fn new() -> Self {
        let env = Env::default();
        env.mock_all_auths();

        let admin = Address::generate(&env);
        let tyc_token_admin = Address::generate(&env);
        let tyc_token_id = env
            .register_stellar_asset_contract_v2(tyc_token_admin)
            .address();
        let usdc_token_admin = Address::generate(&env);
        let usdc_token_id = env
            .register_stellar_asset_contract_v2(usdc_token_admin)
            .address();

        let contract_id = env.register(TycoonRewardSystem, ());
        let client = TycoonRewardSystemClient::new(&env, &contract_id);
        client.initialize(&admin, &tyc_token_id, &usdc_token_id);

        Harness {
            env,
            client,
            admin,
            tyc_token_id,
            contract_id,
        }
    }

    /// Fund the reward contract with `amount` TYC stroop-units.
    fn fund_contract(&self, amount: i128) {
        token::StellarAssetClient::new(&self.env, &self.tyc_token_id)
            .mint(&self.contract_id, &amount);
    }

    fn tyc_balance_of(&self, addr: &Address) -> i128 {
        token::Client::new(&self.env, &self.tyc_token_id).balance(addr)
    }
}

// ── Tier matrix ───────────────────────────────────────────────────────────────

/// Table-driven: each tier mints a voucher, redeems it, and verifies the exact
/// TYC amount lands in the user's wallet and is deducted from the contract.
#[test]
fn test_tier_matrix_exact_value_preserved_on_redeem() {
    let tiers: &[(&str, u128)] = &[
        ("Bronze", TIER_BRONZE),
        ("Silver", TIER_SILVER),
        ("Gold", TIER_GOLD),
        ("Platinum", TIER_PLATINUM),
        ("Minimum", TIER_MINIMUM),
        ("Large", TIER_LARGE),
    ];

    for (name, tyc_value) in tiers {
        let h = Harness::new();
        let user = Address::generate(&h.env);

        // Fund contract with exactly the voucher value
        h.fund_contract(*tyc_value as i128);

        let token_id = h.client.mint_voucher(&h.admin, &user, tyc_value);
        assert_eq!(
            h.client.get_balance(&user, &token_id),
            1,
            "{name}: balance before redeem"
        );

        let contract_before = h.tyc_balance_of(&h.contract_id);
        h.client.redeem_voucher_from(&user, &token_id);

        assert_eq!(
            h.tyc_balance_of(&user),
            *tyc_value as i128,
            "{name}: user received wrong amount"
        );
        assert_eq!(
            h.tyc_balance_of(&h.contract_id),
            contract_before - *tyc_value as i128,
            "{name}: contract balance not reduced correctly"
        );
        assert_eq!(
            h.client.get_balance(&user, &token_id),
            0,
            "{name}: voucher not burned"
        );
    }
}

/// Table-driven: minting multiple tiers to the same user accumulates
/// owned_token_count correctly and each redemption is independent.
#[test]
fn test_tier_matrix_multiple_tiers_per_user() {
    let h = Harness::new();
    let user = Address::generate(&h.env);

    let tiers: &[u128] = &[TIER_BRONZE, TIER_SILVER, TIER_GOLD, TIER_PLATINUM];
    let total: u128 = tiers.iter().sum();

    h.fund_contract(total as i128);

    let mut token_ids = std::vec::Vec::new();
    for &value in tiers {
        let tid = h.client.mint_voucher(&h.admin, &user, &value);
        token_ids.push(tid);
    }

    assert_eq!(h.client.owned_token_count(&user), tiers.len() as u32);

    // Redeem all in order; verify running balance
    let mut expected_user_balance: i128 = 0;
    for (i, &tid) in token_ids.iter().enumerate() {
        h.client.redeem_voucher_from(&user, &tid);
        expected_user_balance += tiers[i] as i128;
        assert_eq!(h.tyc_balance_of(&user), expected_user_balance);
        assert_eq!(
            h.client.owned_token_count(&user),
            (tiers.len() - i - 1) as u32
        );
    }
}

// ── Overflow guards ───────────────────────────────────────────────────────────

/// Overflow: minting a second voucher of the same token_id to the same user
/// when their balance is already u64::MAX must panic with "Balance overflow".
#[test]
#[should_panic]
fn test_overflow_voucher_balance_u64_max() {
    let h = Harness::new();
    let user = Address::generate(&h.env);
    let token_id: u128 = 42;

    // Directly use test_mint to set balance to u64::MAX
    h.client.test_mint(&user, &token_id, &u64::MAX);
    assert_eq!(h.client.get_balance(&user, &token_id), u64::MAX);

    // Minting 1 more must overflow
    h.client.test_mint(&user, &token_id, &1);
}

/// Overflow: minting amount=0 is a no-op (does not panic, balance unchanged).
#[test]
fn test_overflow_mint_zero_amount_is_noop() {
    let h = Harness::new();
    let user = Address::generate(&h.env);
    let token_id: u128 = 99;

    h.client.test_mint(&user, &token_id, &5);
    h.client.test_mint(&user, &token_id, &0); // no-op
    assert_eq!(h.client.get_balance(&user, &token_id), 5);
}

/// Overflow: large voucher value (near i128 ceiling) is stored and redeemed exactly.
/// Verifies no silent truncation in the u128 → i128 cast path.
#[test]
fn test_overflow_large_voucher_value_exact_transfer() {
    let h = Harness::new();
    let user = Address::generate(&h.env);

    // i128::MAX = 170_141_183_460_469_231_731_687_303_715_884_105_727
    // Use a value that fits in i128 but is very large
    let large_value: u128 = 170_141_183_460_469_231_731_687_303_715_884_105_727; // i128::MAX

    h.fund_contract(large_value as i128);
    let token_id = h.client.mint_voucher(&h.admin, &user, &large_value);
    h.client.redeem_voucher_from(&user, &token_id);

    assert_eq!(h.tyc_balance_of(&user), large_value as i128);
}

/// Overflow: VoucherCount increments correctly across many mints (no u128 overflow
/// in the counter range we exercise).
#[test]
fn test_overflow_voucher_count_increments_monotonically() {
    let h = Harness::new();
    let user = Address::generate(&h.env);

    let first_id = h.client.mint_voucher(&h.admin, &user, &TIER_BRONZE);
    let second_id = h.client.mint_voucher(&h.admin, &user, &TIER_BRONZE);
    let third_id = h.client.mint_voucher(&h.admin, &user, &TIER_BRONZE);

    // IDs must be strictly increasing
    assert!(
        second_id > first_id,
        "voucher IDs must be monotonically increasing"
    );
    assert!(
        third_id > second_id,
        "voucher IDs must be monotonically increasing"
    );
    // Each increment is exactly 1
    assert_eq!(second_id - first_id, 1);
    assert_eq!(third_id - second_id, 1);
}

// ── Zero-balance paths ────────────────────────────────────────────────────────

/// Zero-balance: redeeming a token_id that was never minted panics ("Invalid token_id").
#[test]
#[should_panic(expected = "Invalid token_id")]
fn test_zero_balance_redeem_nonexistent_voucher() {
    let h = Harness::new();
    let user = Address::generate(&h.env);
    h.client.redeem_voucher_from(&user, &999_999_999_999);
}

/// Zero-balance: redeeming the same voucher twice panics on the second attempt.
#[test]
fn test_zero_balance_double_redeem_rejected() {
    let h = Harness::new();
    let user = Address::generate(&h.env);

    h.fund_contract(TIER_GOLD as i128);
    let token_id = h.client.mint_voucher(&h.admin, &user, &TIER_GOLD);
    h.client.redeem_voucher_from(&user, &token_id);

    // Second redeem must fail
    let res = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        h.client.redeem_voucher_from(&user, &token_id);
    }));
    assert!(res.is_err(), "double redeem should be rejected");
}

/// Zero-balance: burning more than the held balance panics ("Insufficient balance").
#[test]
#[should_panic(expected = "Insufficient balance")]
fn test_zero_balance_burn_exceeds_balance() {
    let h = Harness::new();
    let user = Address::generate(&h.env);
    let token_id: u128 = 77;

    h.client.test_mint(&user, &token_id, &1);
    h.client.test_burn(&user, &token_id, &2); // 2 > 1
}

/// Zero-balance: burning from an account that holds zero panics ("Insufficient balance").
#[test]
#[should_panic(expected = "Insufficient balance")]
fn test_zero_balance_burn_from_empty_account() {
    let h = Harness::new();
    let user = Address::generate(&h.env);
    h.client.test_burn(&user, &42, &1);
}

/// Zero-balance: burn amount=0 is a no-op (does not panic).
#[test]
fn test_zero_balance_burn_zero_amount_is_noop() {
    let h = Harness::new();
    let user = Address::generate(&h.env);
    let token_id: u128 = 55;

    h.client.test_mint(&user, &token_id, &3);
    h.client.test_burn(&user, &token_id, &0); // no-op
    assert_eq!(h.client.get_balance(&user, &token_id), 3);
}

/// Zero-balance: withdraw_funds with amount=0 succeeds (no-op transfer).
#[test]
fn test_zero_balance_withdraw_zero_amount() {
    let h = Harness::new();
    let recipient = Address::generate(&h.env);

    h.fund_contract(1000);
    // Withdrawing 0 should not panic
    h.client.withdraw_funds(&h.tyc_token_id, &recipient, &0);
    assert_eq!(h.tyc_balance_of(&recipient), 0);
    assert_eq!(h.tyc_balance_of(&h.contract_id), 1000);
}

/// Zero-balance: withdraw_funds when contract has no TYC panics ("Insufficient contract balance").
#[test]
#[should_panic(expected = "Insufficient contract balance")]
fn test_zero_balance_withdraw_from_empty_contract() {
    let h = Harness::new();
    let recipient = Address::generate(&h.env);
    // Contract has 0 TYC — withdraw should fail
    h.client.withdraw_funds(&h.tyc_token_id, &recipient, &1);
}

/// Zero-balance: owned_token_count for a fresh address is 0.
#[test]
fn test_zero_balance_owned_token_count_fresh_address() {
    let h = Harness::new();
    let user = Address::generate(&h.env);
    assert_eq!(h.client.owned_token_count(&user), 0);
}

/// Zero-balance: owned_token_count returns to 0 after all vouchers are redeemed.
#[test]
fn test_zero_balance_owned_token_count_after_full_redeem() {
    let h = Harness::new();
    let user = Address::generate(&h.env);

    h.fund_contract((TIER_BRONZE + TIER_SILVER) as i128);

    let t1 = h.client.mint_voucher(&h.admin, &user, &TIER_BRONZE);
    let t2 = h.client.mint_voucher(&h.admin, &user, &TIER_SILVER);
    assert_eq!(h.client.owned_token_count(&user), 2);

    h.client.redeem_voucher_from(&user, &t1);
    assert_eq!(h.client.owned_token_count(&user), 1);

    h.client.redeem_voucher_from(&user, &t2);
    assert_eq!(h.client.owned_token_count(&user), 0);
}

// ── Withdrawal rounding ───────────────────────────────────────────────────────

/// Withdrawal: exact full balance withdrawal leaves contract at zero.
#[test]
fn test_withdrawal_exact_full_balance() {
    let h = Harness::new();
    let recipient = Address::generate(&h.env);

    h.fund_contract(TIER_PLATINUM as i128);
    h.client
        .withdraw_funds(&h.tyc_token_id, &recipient, &TIER_PLATINUM);

    assert_eq!(h.tyc_balance_of(&h.contract_id), 0);
    assert_eq!(h.tyc_balance_of(&recipient), TIER_PLATINUM as i128);
}

/// Withdrawal: partial withdrawal leaves correct remainder.
#[test]
fn test_withdrawal_partial_leaves_correct_remainder() {
    let h = Harness::new();
    let recipient = Address::generate(&h.env);

    let funded: i128 = TIER_PLATINUM as i128;
    let withdraw: u128 = TIER_GOLD;
    h.fund_contract(funded);
    h.client
        .withdraw_funds(&h.tyc_token_id, &recipient, &withdraw);

    assert_eq!(
        h.tyc_balance_of(&h.contract_id),
        funded - withdraw as i128,
        "remainder after partial withdrawal"
    );
    assert_eq!(h.tyc_balance_of(&recipient), withdraw as i128);
}

/// Withdrawal: sequential partial withdrawals accumulate correctly.
#[test]
fn test_withdrawal_sequential_partial_withdrawals() {
    let h = Harness::new();
    let recipient = Address::generate(&h.env);

    let funded: i128 = (TIER_BRONZE + TIER_SILVER + TIER_GOLD + TIER_PLATINUM) as i128;
    h.fund_contract(funded);

    let withdrawals: &[u128] = &[TIER_BRONZE, TIER_SILVER, TIER_GOLD];
    let mut remaining = funded;

    for &amount in withdrawals {
        h.client
            .withdraw_funds(&h.tyc_token_id, &recipient, &amount);
        remaining -= amount as i128;
        assert_eq!(h.tyc_balance_of(&h.contract_id), remaining);
    }

    // Final withdrawal of the rest
    h.client
        .withdraw_funds(&h.tyc_token_id, &recipient, &TIER_PLATINUM);
    assert_eq!(h.tyc_balance_of(&h.contract_id), 0);
}

/// Withdrawal: withdrawing 1 unit (minimum) works correctly.
#[test]
fn test_withdrawal_minimum_unit() {
    let h = Harness::new();
    let recipient = Address::generate(&h.env);

    h.fund_contract(10);
    h.client
        .withdraw_funds(&h.tyc_token_id, &recipient, &TIER_MINIMUM);

    assert_eq!(h.tyc_balance_of(&recipient), 1);
    assert_eq!(h.tyc_balance_of(&h.contract_id), 9);
}

/// Withdrawal: attempting to withdraw more than the balance panics.
#[test]
#[should_panic(expected = "Insufficient contract balance")]
fn test_withdrawal_exceeds_balance_rejected() {
    let h = Harness::new();
    let recipient = Address::generate(&h.env);

    h.fund_contract(TIER_BRONZE as i128);
    // Try to withdraw SILVER (> BRONZE)
    h.client
        .withdraw_funds(&h.tyc_token_id, &recipient, &TIER_SILVER);
}

// ── Reward accrual boundaries ─────────────────────────────────────────────────

/// Accrual: minting a voucher does NOT transfer TYC to the user immediately —
/// the value is only transferred on redemption.
#[test]
fn test_accrual_mint_does_not_transfer_tyc() {
    let h = Harness::new();
    let user = Address::generate(&h.env);

    h.fund_contract(TIER_GOLD as i128);
    h.client.mint_voucher(&h.admin, &user, &TIER_GOLD);

    // User has no TYC yet — only a voucher
    assert_eq!(h.tyc_balance_of(&user), 0);
    assert_eq!(h.tyc_balance_of(&h.contract_id), TIER_GOLD as i128);
}

/// Accrual: voucher value is immutable after minting — stored value equals redeemed value.
#[test]
fn test_accrual_voucher_value_immutable_after_mint() {
    let h = Harness::new();
    let user = Address::generate(&h.env);

    let value = TIER_SILVER;
    h.fund_contract(value as i128);
    let token_id = h.client.mint_voucher(&h.admin, &user, &value);

    // Redeem and verify exact value
    h.client.redeem_voucher_from(&user, &token_id);
    assert_eq!(h.tyc_balance_of(&user), value as i128);
}

/// Accrual: multiple users each redeem their own vouchers independently.
/// No cross-contamination between user balances.
#[test]
fn test_accrual_independent_user_redemptions() {
    let h = Harness::new();
    let users: std::vec::Vec<Address> = (0..4).map(|_| Address::generate(&h.env)).collect();
    let values: &[u128] = &[TIER_BRONZE, TIER_SILVER, TIER_GOLD, TIER_PLATINUM];

    let total: i128 = values.iter().map(|&v| v as i128).sum();
    h.fund_contract(total);

    let token_ids: std::vec::Vec<u128> = users
        .iter()
        .zip(values.iter())
        .map(|(user, &value)| h.client.mint_voucher(&h.admin, user, &value))
        .collect();

    // Redeem in reverse order to ensure no ordering dependency
    for i in (0..4).rev() {
        h.client.redeem_voucher_from(&users[i], &token_ids[i]);
        assert_eq!(h.tyc_balance_of(&users[i]), values[i] as i128);
    }
}

/// Accrual: redeeming when contract has insufficient TYC panics.
/// This guards against under-funded contract states.
#[test]
fn test_accrual_redeem_fails_when_contract_underfunded() {
    let h = Harness::new();
    let user = Address::generate(&h.env);

    // Fund with less than the voucher value
    h.fund_contract((TIER_GOLD - 1) as i128);
    let token_id = h.client.mint_voucher(&h.admin, &user, &TIER_GOLD);

    let res = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        h.client.redeem_voucher_from(&user, &token_id);
    }));
    assert!(
        res.is_err(),
        "redeem should fail when contract is underfunded"
    );
}

/// Accrual: minting a voucher with value=0 is stored and redeems 0 TYC.
/// (Zero-value vouchers are technically valid — the contract does not reject them.)
#[test]
fn test_accrual_zero_value_voucher_redeems_zero() {
    let h = Harness::new();
    let user = Address::generate(&h.env);

    // No funding needed — 0 TYC transfer
    let token_id = h.client.mint_voucher(&h.admin, &user, &0);
    assert_eq!(h.client.get_balance(&user, &token_id), 1);

    h.client.redeem_voucher_from(&user, &token_id);
    assert_eq!(h.tyc_balance_of(&user), 0);
    assert_eq!(h.client.get_balance(&user, &token_id), 0);
}

// ── Snapshot tests ────────────────────────────────────────────────────────────
//
// These snapshot-style tests pin the exact numeric outcomes for each tier so
// that any accidental change to reward math is caught immediately.
// Update these intentionally when tokenomics change.

/// Snapshot: Bronze tier — 10 TYC (10_000_000_000_000_000_000 raw units).
#[test]
fn test_snapshot_bronze_tier_exact_value() {
    let h = Harness::new();
    let user = Address::generate(&h.env);
    h.fund_contract(TIER_BRONZE as i128);
    let tid = h.client.mint_voucher(&h.admin, &user, &TIER_BRONZE);
    h.client.redeem_voucher_from(&user, &tid);
    assert_eq!(h.tyc_balance_of(&user), 10_000_000_000_000_000_000_i128);
}

/// Snapshot: Silver tier — 50 TYC (50_000_000_000_000_000_000 raw units).
#[test]
fn test_snapshot_silver_tier_exact_value() {
    let h = Harness::new();
    let user = Address::generate(&h.env);
    h.fund_contract(TIER_SILVER as i128);
    let tid = h.client.mint_voucher(&h.admin, &user, &TIER_SILVER);
    h.client.redeem_voucher_from(&user, &tid);
    assert_eq!(h.tyc_balance_of(&user), 50_000_000_000_000_000_000_i128);
}

/// Snapshot: Gold tier — 100 TYC (100_000_000_000_000_000_000 raw units).
#[test]
fn test_snapshot_gold_tier_exact_value() {
    let h = Harness::new();
    let user = Address::generate(&h.env);
    h.fund_contract(TIER_GOLD as i128);
    let tid = h.client.mint_voucher(&h.admin, &user, &TIER_GOLD);
    h.client.redeem_voucher_from(&user, &tid);
    assert_eq!(h.tyc_balance_of(&user), 100_000_000_000_000_000_000_i128);
}

/// Snapshot: Platinum tier — 500 TYC (500_000_000_000_000_000_000 raw units).
#[test]
fn test_snapshot_platinum_tier_exact_value() {
    let h = Harness::new();
    let user = Address::generate(&h.env);
    h.fund_contract(TIER_PLATINUM as i128);
    let tid = h.client.mint_voucher(&h.admin, &user, &TIER_PLATINUM);
    h.client.redeem_voucher_from(&user, &tid);
    assert_eq!(h.tyc_balance_of(&user), 500_000_000_000_000_000_000_i128);
}

/// Snapshot: Minimum unit — 1 raw unit redeems as exactly 1.
#[test]
fn test_snapshot_minimum_unit_exact_value() {
    let h = Harness::new();
    let user = Address::generate(&h.env);
    h.fund_contract(1);
    let tid = h.client.mint_voucher(&h.admin, &user, &TIER_MINIMUM);
    h.client.redeem_voucher_from(&user, &tid);
    assert_eq!(h.tyc_balance_of(&user), 1_i128);
}
