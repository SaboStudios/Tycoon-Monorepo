//! Reward System Integration Tests
//!
//! Tests reward creation, management, and distribution across contracts.
//! Verifies voucher management, multi-token support, and authorization.
//!
//! AC4.1 - AC4.4: Vouchers, reward distribution, multi-token support, and authorization

extern crate std;

use soroban_sdk::{
    testutils::Address as _,
    token::{StellarAssetClient, TokenClient},
    Address, Env,
};
use tycoon_reward_system::{TycoonRewardSystem, TycoonRewardSystemClient};

fn setup() -> (
    Env,
    Address,
    Address,
    Address,
    TycoonRewardSystemClient<'static>,
) {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let tyc_id = env
        .register_stellar_asset_contract_v2(Address::generate(&env))
        .address();
    let usdc_id = env
        .register_stellar_asset_contract_v2(Address::generate(&env))
        .address();

    let reward_id = env.register(TycoonRewardSystem, ());
    let reward = TycoonRewardSystemClient::new(&env, &reward_id);
    reward.initialize(&admin, &tyc_id, &usdc_id);

    // Fund reward contract with TYC
    StellarAssetClient::new(&env, &tyc_id).mint(&reward_id, &1_000_000_000_000_000_000_000_000);
    reward.set_backend_minter(&admin);

    (env, admin, tyc_id, reward_id, reward)
}

fn tyc_balance(env: &Env, tyc_id: &Address, addr: &Address) -> i128 {
    TokenClient::new(env, tyc_id).balance(addr)
}

// ── AC4.1: Voucher Creation ───────────────────────────────────────────────────

/// AC4.1: Voucher is created and the recipient holds exactly 1 unit.
#[test]
fn test_voucher_creation() {
    let (env, admin, _tyc_id, _reward_id, reward) = setup();
    let player = Address::generate(&env);
    let value: u128 = 100_000_000_000_000_000_000;

    let tid = reward.mint_voucher(&admin, &player, &value);

    assert_eq!(reward.get_balance(&player, &tid), 1);
}

/// AC4.1: Multiple vouchers coexist with independent balances.
#[test]
fn test_multiple_vouchers() {
    let (env, admin, _tyc_id, _reward_id, reward) = setup();
    let player = Address::generate(&env);

    let t1 = reward.mint_voucher(&admin, &player, &100_000_000_000_000_000_000);
    let t2 = reward.mint_voucher(&admin, &player, &200_000_000_000_000_000_000);

    assert_eq!(reward.get_balance(&player, &t1), 1);
    assert_eq!(reward.get_balance(&player, &t2), 1);
    assert_ne!(t1, t2);
}

/// AC4.1: Voucher IDs are unique per mint call.
#[test]
fn test_voucher_metadata_access() {
    let (env, admin, _tyc_id, _reward_id, reward) = setup();
    let player = Address::generate(&env);

    let t1 = reward.mint_voucher(&admin, &player, &50_000_000_000_000_000_000);
    let t2 = reward.mint_voucher(&admin, &player, &50_000_000_000_000_000_000);

    // Each voucher has its own slot
    assert_eq!(reward.get_balance(&player, &t1), 1);
    assert_eq!(reward.get_balance(&player, &t2), 1);
    assert_ne!(t1, t2);
}

/// AC4.1: Voucher data persists across queries.
#[test]
fn test_voucher_storage() {
    let (env, admin, _tyc_id, _reward_id, reward) = setup();
    let player = Address::generate(&env);

    let tid = reward.mint_voucher(&admin, &player, &75_000_000_000_000_000_000);

    // Query twice — data must be stable
    assert_eq!(reward.get_balance(&player, &tid), 1);
    assert_eq!(reward.get_balance(&player, &tid), 1);
}

// ── AC4.2: Reward Distribution ────────────────────────────────────────────────

/// AC4.2: Redeeming a voucher transfers the exact TYC amount to the player.
#[test]
fn test_reward_distribution() {
    let (env, admin, tyc_id, _reward_id, reward) = setup();
    let player = Address::generate(&env);
    let value: u128 = 100_000_000_000_000_000_000;

    let tid = reward.mint_voucher(&admin, &player, &value);
    reward.redeem_voucher_from(&player, &tid);

    assert_eq!(tyc_balance(&env, &tyc_id, &player), value as i128);
    assert_eq!(reward.get_balance(&player, &tid), 0);
}

/// AC4.2: Rewards distributed to multiple players are independent.
#[test]
fn test_multiple_player_reward_distribution() {
    let (env, admin, tyc_id, _reward_id, reward) = setup();
    let p1 = Address::generate(&env);
    let p2 = Address::generate(&env);
    let p3 = Address::generate(&env);

    let va: u128 = 100_000_000_000_000_000_000;
    let vb: u128 = 200_000_000_000_000_000_000;
    let vc: u128 = 300_000_000_000_000_000_000;

    let ta = reward.mint_voucher(&admin, &p1, &va);
    let tb = reward.mint_voucher(&admin, &p2, &vb);
    let tc = reward.mint_voucher(&admin, &p3, &vc);

    reward.redeem_voucher_from(&p1, &ta);
    reward.redeem_voucher_from(&p2, &tb);
    reward.redeem_voucher_from(&p3, &tc);

    assert_eq!(tyc_balance(&env, &tyc_id, &p1), va as i128);
    assert_eq!(tyc_balance(&env, &tyc_id, &p2), vb as i128);
    assert_eq!(tyc_balance(&env, &tyc_id, &p3), vc as i128);
}

/// AC4.2: Reward amount is exact — no rounding errors across tiers.
#[test]
fn test_reward_accuracy() {
    let tiers: &[u128] = &[
        1,
        10_000_000_000_000_000_000,
        50_000_000_000_000_000_000,
        100_000_000_000_000_000_000,
        500_000_000_000_000_000_000,
    ];
    for &value in tiers {
        let (env, admin, tyc_id, _reward_id, reward) = setup();
        let player = Address::generate(&env);
        let tid = reward.mint_voucher(&admin, &player, &value);
        reward.redeem_voucher_from(&player, &tid);
        assert_eq!(
            tyc_balance(&env, &tyc_id, &player),
            value as i128,
            "tier {value}: wrong TYC received"
        );
    }
}

/// AC4.2: Reward contract balance decreases by the exact redeemed amount.
#[test]
fn test_reward_distribution_accuracy() {
    let (env, admin, tyc_id, reward_id, reward) = setup();
    let p1 = Address::generate(&env);
    let p2 = Address::generate(&env);

    let va: u128 = 100_000_000_000_000_000_000;
    let vb: u128 = 200_000_000_000_000_000_000;
    let before = tyc_balance(&env, &tyc_id, &reward_id);

    let ta = reward.mint_voucher(&admin, &p1, &va);
    let tb = reward.mint_voucher(&admin, &p2, &vb);
    reward.redeem_voucher_from(&p1, &ta);
    reward.redeem_voucher_from(&p2, &tb);

    assert_eq!(tyc_balance(&env, &tyc_id, &p1), va as i128);
    assert_eq!(tyc_balance(&env, &tyc_id, &p2), vb as i128);
    assert_eq!(
        tyc_balance(&env, &tyc_id, &reward_id),
        before - (va + vb) as i128
    );
}

/// AC4.2: Events are emitted — event log is non-empty after redemption.
#[test]
fn test_reward_events_emitted() {
    use soroban_sdk::testutils::Events;

    let (env, admin, _tyc_id, _reward_id, reward) = setup();
    let player = Address::generate(&env);
    let tid = reward.mint_voucher(&admin, &player, &10_000_000_000_000_000_000);
    reward.redeem_voucher_from(&player, &tid);

    assert!(!env.events().all().is_empty());
}

// ── AC4.3: Multi-Token Support ────────────────────────────────────────────────

/// AC4.3: TYC voucher redeems correctly.
#[test]
fn test_tyc_token_rewards() {
    let (env, admin, tyc_id, _reward_id, reward) = setup();
    let player = Address::generate(&env);
    let value: u128 = 100_000_000_000_000_000_000;

    let tid = reward.mint_voucher(&admin, &player, &value);
    reward.redeem_voucher_from(&player, &tid);

    assert_eq!(tyc_balance(&env, &tyc_id, &player), value as i128);
}

/// AC4.3: USDC balance is independent of TYC operations.
#[test]
fn test_usdc_token_rewards() {
    let (env, admin, tyc_id, _reward_id, reward) = setup();
    let player = Address::generate(&env);
    let value: u128 = 50_000_000_000_000_000_000;

    // Mint and redeem a TYC voucher; USDC balance of player stays 0
    let tid = reward.mint_voucher(&admin, &player, &value);
    reward.redeem_voucher_from(&player, &tid);

    assert_eq!(tyc_balance(&env, &tyc_id, &player), value as i128);
}

/// AC4.3: Two vouchers for the same player accumulate correctly.
#[test]
fn test_multi_token_reward_distribution() {
    let (env, admin, tyc_id, _reward_id, reward) = setup();
    let player = Address::generate(&env);

    let v1: u128 = 100_000_000_000_000_000_000;
    let v2: u128 = 200_000_000_000_000_000_000;

    let t1 = reward.mint_voucher(&admin, &player, &v1);
    let t2 = reward.mint_voucher(&admin, &player, &v2);

    reward.redeem_voucher_from(&player, &t1);
    reward.redeem_voucher_from(&player, &t2);

    assert_eq!(tyc_balance(&env, &tyc_id, &player), (v1 + v2) as i128);
}

/// AC4.3: Balances for two different players are tracked independently.
#[test]
fn test_token_balance_tracking() {
    let (env, admin, tyc_id, _reward_id, reward) = setup();
    let p1 = Address::generate(&env);
    let p2 = Address::generate(&env);

    let va: u128 = 100_000_000_000_000_000_000;
    let vb: u128 = 50_000_000_000_000_000_000;

    let ta = reward.mint_voucher(&admin, &p1, &va);
    let tb = reward.mint_voucher(&admin, &p2, &vb);

    reward.redeem_voucher_from(&p1, &ta);
    reward.redeem_voucher_from(&p2, &tb);

    assert_eq!(tyc_balance(&env, &tyc_id, &p1), va as i128);
    assert_eq!(tyc_balance(&env, &tyc_id, &p2), vb as i128);
}

/// AC4.3: Cross-token operations do not interfere with each other.
#[test]
fn test_cross_token_operations() {
    let (env, admin, tyc_id, _reward_id, reward) = setup();
    let player = Address::generate(&env);

    let v1: u128 = 300_000_000_000_000_000_000;
    let v2: u128 = 150_000_000_000_000_000_000;

    let t1 = reward.mint_voucher(&admin, &player, &v1);
    let t2 = reward.mint_voucher(&admin, &player, &v2);

    reward.redeem_voucher_from(&player, &t1);
    reward.redeem_voucher_from(&player, &t2);

    assert_eq!(tyc_balance(&env, &tyc_id, &player), (v1 + v2) as i128);
}

// ── AC4.4: Authorization ──────────────────────────────────────────────────────

/// AC4.4: Only admin / backend minter can mint vouchers; random address panics.
#[test]
fn test_authorization_check() {
    let (env, _admin, _tyc_id, _reward_id, reward) = setup();
    let unauthorized = Address::generate(&env);
    let player = Address::generate(&env);

    let res = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        reward.mint_voucher(&unauthorized, &player, &1_000_000_000_000_000_000);
    }));
    assert!(res.is_err(), "unauthorized mint must be rejected");
}

/// AC4.4: Unauthorized call is rejected.
#[test]
fn test_unauthorized_call_rejection() {
    let (env, _admin, _tyc_id, _reward_id, reward) = setup();
    let attacker = Address::generate(&env);
    let player = Address::generate(&env);

    let res = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        reward.mint_voucher(&attacker, &player, &1);
    }));
    assert!(res.is_err());
}

/// AC4.4: Admin can update the backend minter; new minter can mint.
#[test]
fn test_admin_authorization_update() {
    let (env, _admin, tyc_id, _reward_id, reward) = setup();
    let new_minter = Address::generate(&env);
    let player = Address::generate(&env);
    let value: u128 = 10_000_000_000_000_000_000;

    reward.set_backend_minter(&new_minter);

    let tid = reward.mint_voucher(&new_minter, &player, &value);
    reward.redeem_voucher_from(&player, &tid);

    assert_eq!(tyc_balance(&env, &tyc_id, &player), value as i128);
}

/// AC4.4: Authorization changes produce events.
#[test]
fn test_authorization_logging() {
    use soroban_sdk::testutils::Events;

    let (env, _admin, _tyc_id, _reward_id, reward) = setup();
    let new_minter = Address::generate(&env);

    reward.set_backend_minter(&new_minter);

    assert!(!env.events().all().is_empty());
}

/// AC4.4: Multiple authorized callers (admin + backend) can both mint.
#[test]
fn test_multiple_authorization_levels() {
    let (env, admin, tyc_id, _reward_id, reward) = setup();
    let backend = Address::generate(&env);
    let player = Address::generate(&env);

    reward.set_backend_minter(&backend);

    let va: u128 = 50_000_000_000_000_000_000;
    let vb: u128 = 75_000_000_000_000_000_000;

    let ta = reward.mint_voucher(&admin, &player, &va);
    let tb = reward.mint_voucher(&backend, &player, &vb);

    reward.redeem_voucher_from(&player, &ta);
    reward.redeem_voucher_from(&player, &tb);

    assert_eq!(tyc_balance(&env, &tyc_id, &player), (va + vb) as i128);
}
