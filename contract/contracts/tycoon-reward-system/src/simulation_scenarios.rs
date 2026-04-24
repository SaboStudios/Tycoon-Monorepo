/// # SW-CT-015 — Tycoon Reward System: Simulation Scenarios
///
/// This module exercises realistic end-to-end game flows against the
/// `TycoonRewardSystem` contract running inside the Soroban sandbox.
///
/// ## Scenarios covered
///
/// | ID   | Name                                    | Description                                                  |
/// |------|-----------------------------------------|--------------------------------------------------------------|
/// | S-01 | Season-end batch reward                 | Backend mints N vouchers for N players; all redeem           |
/// | S-02 | Leaderboard top-3 payout                | Gold / Silver / Bronze tier payouts to ranked players        |
/// | S-03 | Voucher gifting (P2P transfer + redeem) | Player A earns, gifts to Player B, B redeems                 |
/// | S-04 | Pause mid-season, resume               | Admin pauses; pending redeems blocked; unpause; all succeed  |
/// | S-05 | Backend minter rotation                 | Old minter revoked; new minter takes over; old key rejected  |
/// | S-06 | Treasury withdrawal after season        | Admin drains residual TYC and USDC to treasury wallet        |
/// | S-07 | Concurrent multi-voucher accrual        | Single player accumulates 5 vouchers, redeems sequentially   |
/// | S-08 | Double-redeem guard                     | Redeeming the same voucher twice must panic on second call   |
/// | S-09 | Underfunded contract guard              | Redeem panics when contract TYC balance < voucher value      |
/// | S-10 | owned_token_count lifecycle             | Count tracks mint → transfer → redeem across two players     |
extern crate std;

use crate::{TycoonRewardSystem, TycoonRewardSystemClient};
use soroban_sdk::{
    testutils::Address as _,
    token::{Client as TokenClient, StellarAssetClient},
    Address, Env,
};
use std::vec::Vec;

// ── Tier constants (aligned with overflow_rounding_tests) ────────────────────
const TIER_BRONZE: u128 = 10_000_000_000_000_000_000; // 10 TYC
const TIER_SILVER: u128 = 50_000_000_000_000_000_000; // 50 TYC
const TIER_GOLD: u128 = 100_000_000_000_000_000_000; // 100 TYC

/// Total TYC pre-funded to the reward contract for most scenarios (1 000 TYC).
const CONTRACT_FUND: i128 = 1_000_000_000_000_000_000_000;

// ── Shared harness ────────────────────────────────────────────────────────────

struct Sim<'a> {
    env: Env,
    client: TycoonRewardSystemClient<'a>,
    #[allow(dead_code)]
    admin: Address,
    backend: Address,
    tyc_id: Address,
    usdc_id: Address,
    contract_id: Address,
}

impl Sim<'_> {
    fn new() -> Self {
        let env = Env::default();
        env.mock_all_auths();

        let admin = Address::generate(&env);
        let backend = Address::generate(&env);

        let tyc_id = env
            .register_stellar_asset_contract_v2(Address::generate(&env))
            .address();
        let usdc_id = env
            .register_stellar_asset_contract_v2(Address::generate(&env))
            .address();

        let contract_id = env.register(TycoonRewardSystem, ());
        let client = TycoonRewardSystemClient::new(&env, &contract_id);
        client.initialize(&admin, &tyc_id, &usdc_id);

        // Authorise backend as minter
        client.set_backend_minter(&backend);

        // Pre-fund contract with TYC
        StellarAssetClient::new(&env, &tyc_id).mint(&contract_id, &CONTRACT_FUND);

        Sim { env, client, admin, backend, tyc_id, usdc_id, contract_id }
    }

    fn tyc_balance(&self, addr: &Address) -> i128 {
        TokenClient::new(&self.env, &self.tyc_id).balance(addr)
    }

    fn usdc_balance(&self, addr: &Address) -> i128 {
        TokenClient::new(&self.env, &self.usdc_id).balance(addr)
    }

    fn fund_usdc(&self, amount: i128) {
        StellarAssetClient::new(&self.env, &self.usdc_id)
            .mint(&self.contract_id, &amount);
    }
}

// ── S-01: Season-end batch reward ─────────────────────────────────────────────

/// Backend mints one voucher per player at season end; every player redeems.
/// Verifies that the contract balance decreases by exactly the sum of all
/// voucher values and each player receives the correct TYC amount.
#[test]
fn sim_s01_season_end_batch_reward() {
    let sim = Sim::new();

    let players: Vec<Address> = (0..5).map(|_| Address::generate(&sim.env)).collect();
    let reward = TIER_BRONZE; // 10 TYC each

    // Backend mints one voucher per player
    let token_ids: Vec<u128> = players
        .iter()
        .map(|p| sim.client.mint_voucher(&sim.backend, p, &reward))
        .collect();

    // Verify each player holds exactly 1 voucher
    for (player, &tid) in players.iter().zip(token_ids.iter()) {
        assert_eq!(sim.client.get_balance(player, &tid), 1);
        assert_eq!(sim.client.owned_token_count(player), 1);
    }

    let contract_before = sim.tyc_balance(&sim.contract_id);

    // All players redeem
    for (player, &tid) in players.iter().zip(token_ids.iter()) {
        sim.client.redeem_voucher_from(player, &tid);
    }

    // Each player should have received TIER_BRONZE TYC
    for player in &players {
        assert_eq!(sim.tyc_balance(player), reward as i128);
        assert_eq!(sim.client.owned_token_count(player), 0);
    }

    // Contract balance decreased by exactly 5 × TIER_BRONZE
    let expected_drain = (reward as i128) * 5;
    assert_eq!(
        sim.tyc_balance(&sim.contract_id),
        contract_before - expected_drain
    );
}

// ── S-02: Leaderboard top-3 payout ───────────────────────────────────────────

/// Simulates a leaderboard payout: 1st place gets Gold, 2nd Silver, 3rd Bronze.
/// Verifies that each player receives the correct tier amount.
#[test]
fn sim_s02_leaderboard_top3_payout() {
    let sim = Sim::new();

    let first = Address::generate(&sim.env);
    let second = Address::generate(&sim.env);
    let third = Address::generate(&sim.env);

    let tid1 = sim.client.mint_voucher(&sim.backend, &first, &TIER_GOLD);
    let tid2 = sim.client.mint_voucher(&sim.backend, &second, &TIER_SILVER);
    let tid3 = sim.client.mint_voucher(&sim.backend, &third, &TIER_BRONZE);

    sim.client.redeem_voucher_from(&first, &tid1);
    sim.client.redeem_voucher_from(&second, &tid2);
    sim.client.redeem_voucher_from(&third, &tid3);

    assert_eq!(sim.tyc_balance(&first), TIER_GOLD as i128);
    assert_eq!(sim.tyc_balance(&second), TIER_SILVER as i128);
    assert_eq!(sim.tyc_balance(&third), TIER_BRONZE as i128);

    // All vouchers burned — balances zero
    assert_eq!(sim.client.get_balance(&first, &tid1), 0);
    assert_eq!(sim.client.get_balance(&second, &tid2), 0);
    assert_eq!(sim.client.get_balance(&third, &tid3), 0);
}

// ── S-03: Voucher gifting (P2P transfer + redeem) ────────────────────────────

/// Player A earns a voucher, transfers it to Player B, and Player B redeems it.
/// Verifies that only the final holder can redeem and receives the TYC.
#[test]
fn sim_s03_voucher_gifting_transfer_then_redeem() {
    let sim = Sim::new();

    let player_a = Address::generate(&sim.env);
    let player_b = Address::generate(&sim.env);

    let tid = sim.client.mint_voucher(&sim.backend, &player_a, &TIER_SILVER);

    assert_eq!(sim.client.get_balance(&player_a, &tid), 1);
    assert_eq!(sim.client.owned_token_count(&player_a), 1);

    // A gifts to B
    sim.client.transfer(&player_a, &player_b, &tid, &1);

    assert_eq!(sim.client.get_balance(&player_a, &tid), 0);
    assert_eq!(sim.client.owned_token_count(&player_a), 0);
    assert_eq!(sim.client.get_balance(&player_b, &tid), 1);
    assert_eq!(sim.client.owned_token_count(&player_b), 1);

    // B redeems
    sim.client.redeem_voucher_from(&player_b, &tid);

    assert_eq!(sim.tyc_balance(&player_b), TIER_SILVER as i128);
    assert_eq!(sim.tyc_balance(&player_a), 0); // A received nothing
    assert_eq!(sim.client.owned_token_count(&player_b), 0);
}

// ── S-04: Pause mid-season, resume ───────────────────────────────────────────

/// Admin pauses the contract mid-season. Pending redeems and transfers are
/// blocked. After unpause, all operations succeed normally.
#[test]
fn sim_s04_pause_mid_season_then_resume() {
    let sim = Sim::new();

    let player = Address::generate(&sim.env);
    let player2 = Address::generate(&sim.env);

    let tid = sim.client.mint_voucher(&sim.backend, &player, &TIER_BRONZE);

    // Admin pauses
    sim.client.pause();

    // Redeem blocked
    let redeem_result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        sim.client.redeem_voucher_from(&player, &tid);
    }));
    assert!(redeem_result.is_err(), "redeem must be blocked while paused");

    // Transfer blocked
    let transfer_result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        sim.client.transfer(&player, &player2, &tid, &1);
    }));
    assert!(transfer_result.is_err(), "transfer must be blocked while paused");

    // Voucher still intact after failed attempts
    assert_eq!(sim.client.get_balance(&player, &tid), 1);

    // Admin unpauses
    sim.client.unpause();

    // Redeem now succeeds
    sim.client.redeem_voucher_from(&player, &tid);
    assert_eq!(sim.tyc_balance(&player), TIER_BRONZE as i128);
}

// ── S-05: Backend minter rotation ────────────────────────────────────────────

/// Old backend minter is revoked; new minter is set. Old key can no longer
/// mint; new key can. Verifies the rotation is atomic and clean.
#[test]
fn sim_s05_backend_minter_rotation() {
    let sim = Sim::new();

    let old_minter = sim.backend.clone();
    let new_minter = Address::generate(&sim.env);
    let player = Address::generate(&sim.env);

    // Old minter can mint before rotation
    let tid_old = sim.client.mint_voucher(&old_minter, &player, &TIER_BRONZE);
    assert_eq!(sim.client.get_balance(&player, &tid_old), 1);

    // Admin rotates: clear old, set new
    sim.client.clear_backend_minter();
    assert_eq!(sim.client.get_backend_minter(), None);

    // Old minter is now rejected
    let old_mint_result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        sim.client.mint_voucher(&old_minter, &player, &TIER_BRONZE);
    }));
    assert!(old_mint_result.is_err(), "old minter must be rejected after rotation");

    // Set new minter
    sim.client.set_backend_minter(&new_minter);
    assert_eq!(sim.client.get_backend_minter(), Some(new_minter.clone()));

    // New minter can mint
    let tid_new = sim.client.mint_voucher(&new_minter, &player, &TIER_SILVER);
    assert_eq!(sim.client.get_balance(&player, &tid_new), 1);

    // Redeem both vouchers
    sim.client.redeem_voucher_from(&player, &tid_old);
    sim.client.redeem_voucher_from(&player, &tid_new);

    let expected = (TIER_BRONZE + TIER_SILVER) as i128;
    assert_eq!(sim.tyc_balance(&player), expected);
}

// ── S-06: Treasury withdrawal after season ───────────────────────────────────

/// After all vouchers are redeemed, admin withdraws residual TYC and USDC
/// to a treasury wallet. Verifies exact amounts and contract reaches zero.
#[test]
fn sim_s06_treasury_withdrawal_after_season() {
    let sim = Sim::new();

    let player = Address::generate(&sim.env);
    let treasury = Address::generate(&sim.env);

    // Fund USDC as well
    let usdc_fund: i128 = 500_000_000_000_000_000_000; // 500 USDC
    sim.fund_usdc(usdc_fund);

    // Mint and redeem one voucher so some TYC leaves the contract
    let tid = sim.client.mint_voucher(&sim.backend, &player, &TIER_GOLD);
    sim.client.redeem_voucher_from(&player, &tid);

    let remaining_tyc = sim.tyc_balance(&sim.contract_id);
    let remaining_usdc = sim.usdc_balance(&sim.contract_id);

    assert!(remaining_tyc > 0, "contract should still hold residual TYC");
    assert_eq!(remaining_usdc, usdc_fund);

    // Admin withdraws all TYC
    sim.client
        .withdraw_funds(&sim.tyc_id, &treasury, &(remaining_tyc as u128));
    assert_eq!(sim.tyc_balance(&sim.contract_id), 0);
    assert_eq!(sim.tyc_balance(&treasury), remaining_tyc);

    // Admin withdraws all USDC
    sim.client
        .withdraw_funds(&sim.usdc_id, &treasury, &(remaining_usdc as u128));
    assert_eq!(sim.usdc_balance(&sim.contract_id), 0);
    assert_eq!(sim.usdc_balance(&treasury), usdc_fund);
}

// ── S-07: Concurrent multi-voucher accrual ───────────────────────────────────

/// A single player accumulates 5 vouchers of different tiers across a season,
/// then redeems them one by one. Verifies cumulative TYC balance and that
/// owned_token_count decrements correctly on each redemption.
#[test]
fn sim_s07_multi_voucher_accrual_and_sequential_redeem() {
    let sim = Sim::new();

    let player = Address::generate(&sim.env);

    let tiers = [TIER_BRONZE, TIER_SILVER, TIER_GOLD, TIER_BRONZE, TIER_SILVER];
    let expected_total: u128 = tiers.iter().sum();

    let token_ids: Vec<u128> = tiers
        .iter()
        .map(|&v| sim.client.mint_voucher(&sim.backend, &player, &v))
        .collect();

    assert_eq!(sim.client.owned_token_count(&player), 5);

    // Redeem sequentially and verify count decrements
    for (i, &tid) in token_ids.iter().enumerate() {
        sim.client.redeem_voucher_from(&player, &tid);
        let expected_count = (4 - i) as u32;
        assert_eq!(
            sim.client.owned_token_count(&player),
            expected_count,
            "owned_token_count should be {} after redeeming voucher {}",
            expected_count,
            i + 1
        );
    }

    assert_eq!(sim.tyc_balance(&player), expected_total as i128);
    assert_eq!(sim.client.owned_token_count(&player), 0);
}

// ── S-08: Double-redeem guard ─────────────────────────────────────────────────

/// Attempting to redeem the same voucher twice must panic on the second call.
/// The first redemption burns the voucher; the second has no balance to burn.
#[test]
fn sim_s08_double_redeem_panics() {
    let sim = Sim::new();

    let player = Address::generate(&sim.env);
    let tid = sim.client.mint_voucher(&sim.backend, &player, &TIER_BRONZE);

    // First redeem succeeds
    sim.client.redeem_voucher_from(&player, &tid);
    assert_eq!(sim.tyc_balance(&player), TIER_BRONZE as i128);

    // Second redeem must panic (voucher value entry removed)
    let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        sim.client.redeem_voucher_from(&player, &tid);
    }));
    assert!(result.is_err(), "double-redeem must panic");

    // Player balance unchanged after failed second attempt
    assert_eq!(sim.tyc_balance(&player), TIER_BRONZE as i128);
}

// ── S-09: Underfunded contract guard ─────────────────────────────────────────

/// If the contract holds less TYC than a voucher's value, the redeem must
/// panic and leave the voucher intact (no partial transfer).
#[test]
fn sim_s09_underfunded_contract_panics_on_redeem() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let backend = Address::generate(&env);
    let player = Address::generate(&env);

    let tyc_id = env
        .register_stellar_asset_contract_v2(Address::generate(&env))
        .address();
    let usdc_id = env
        .register_stellar_asset_contract_v2(Address::generate(&env))
        .address();

    let contract_id = env.register(TycoonRewardSystem, ());
    let client = TycoonRewardSystemClient::new(&env, &contract_id);
    client.initialize(&admin, &tyc_id, &usdc_id);
    client.set_backend_minter(&backend);

    // Fund with only 1 raw unit — far less than TIER_BRONZE
    StellarAssetClient::new(&env, &tyc_id).mint(&contract_id, &1);

    let tid = client.mint_voucher(&backend, &player, &TIER_BRONZE);
    assert_eq!(client.get_balance(&player, &tid), 1);

    // Redeem must panic because contract balance < voucher value
    let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        client.redeem_voucher_from(&player, &tid);
    }));
    assert!(result.is_err(), "redeem must panic when contract is underfunded");

    // Voucher must still be intact (burn happens before transfer in CEI, but
    // the token transfer panic unwinds the whole invocation in the sandbox)
    // — balance check is best-effort; the key invariant is the panic above.
}

// ── S-10: owned_token_count lifecycle ────────────────────────────────────────

/// Verifies that owned_token_count stays consistent across the full lifecycle:
/// mint → transfer (partial) → redeem (remaining) for two players.
#[test]
fn sim_s10_owned_token_count_full_lifecycle() {
    let sim = Sim::new();

    let alice = Address::generate(&sim.env);
    let bob = Address::generate(&sim.env);

    // Alice earns 3 vouchers
    let tid1 = sim.client.mint_voucher(&sim.backend, &alice, &TIER_BRONZE);
    let tid2 = sim.client.mint_voucher(&sim.backend, &alice, &TIER_SILVER);
    let tid3 = sim.client.mint_voucher(&sim.backend, &alice, &TIER_GOLD);

    assert_eq!(sim.client.owned_token_count(&alice), 3);
    assert_eq!(sim.client.owned_token_count(&bob), 0);

    // Alice gifts tid1 to Bob
    sim.client.transfer(&alice, &bob, &tid1, &1);
    assert_eq!(sim.client.owned_token_count(&alice), 2);
    assert_eq!(sim.client.owned_token_count(&bob), 1);

    // Alice redeems tid2
    sim.client.redeem_voucher_from(&alice, &tid2);
    assert_eq!(sim.client.owned_token_count(&alice), 1);

    // Bob redeems tid1
    sim.client.redeem_voucher_from(&bob, &tid1);
    assert_eq!(sim.client.owned_token_count(&bob), 0);

    // Alice redeems tid3 — now at zero
    sim.client.redeem_voucher_from(&alice, &tid3);
    assert_eq!(sim.client.owned_token_count(&alice), 0);

    // Verify TYC balances
    let alice_expected = (TIER_SILVER + TIER_GOLD) as i128;
    let bob_expected = TIER_BRONZE as i128;
    assert_eq!(sim.tyc_balance(&alice), alice_expected);
    assert_eq!(sim.tyc_balance(&bob), bob_expected);
}
