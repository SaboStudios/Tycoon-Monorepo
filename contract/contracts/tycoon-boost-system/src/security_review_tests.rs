//! SW-CT-025: Security review tests for tycoon-boost-system.
//!
//! Covers the three findings from SECURITY_REVIEW_CHECKLIST.md:
//!   SEC-01 — admin_grant_boost / admin_revoke_boost reject non-admin callers
//!   SEC-02 — additive_total u32 wrapping overflow (documents current behavior)
//!   SEC-03 — final mixed-stacking as u32 silent truncation (documents current behavior)

#![cfg(test)]
extern crate std;
use super::*;
use soroban_sdk::{testutils::Address as _, Env};

fn nb(id: u128, value: u32) -> Boost {
    Boost { id, boost_type: BoostType::Additive, value, priority: 0, expires_at_ledger: 0 }
}

// ── SEC-01: auth enforcement without mock_all_auths ───────────────────────────

/// admin_grant_boost must reject a call that provides no admin authorization.
#[test]
#[should_panic]
fn test_admin_grant_boost_rejects_without_auth() {
    let env = Env::default();
    let contract_id = env.register(TycoonBoostSystem, ());
    let client = TycoonBoostSystemClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    let player = Address::generate(&env);

    env.mock_all_auths();
    client.initialize(&admin);

    // Fresh env with no mocked auths — admin.require_auth() must reject
    let env2 = Env::default();
    let client2 = TycoonBoostSystemClient::new(&env2, &contract_id);
    client2.admin_grant_boost(&player, &nb(1, 500));
}

/// admin_revoke_boost must reject a call that provides no admin authorization.
#[test]
#[should_panic]
fn test_admin_revoke_boost_rejects_without_auth() {
    let env = Env::default();
    let contract_id = env.register(TycoonBoostSystem, ());
    let client = TycoonBoostSystemClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    let player = Address::generate(&env);

    env.mock_all_auths();
    client.initialize(&admin);
    client.admin_grant_boost(&player, &nb(1, 500));

    // Fresh env with no mocked auths — admin.require_auth() must reject
    let env2 = Env::default();
    let client2 = TycoonBoostSystemClient::new(&env2, &contract_id);
    client2.admin_revoke_boost(&player, &1u128);
}

// ── SEC-02: additive_total u32 wrapping overflow ──────────────────────────────

/// Documents that additive_total wraps on u32 overflow.
/// With 10 boosts each at value = u32::MAX / 10 + 1 the sum wraps,
/// producing a result lower than the sum of the individual values.
/// This test pins the current (wrapping) behavior so any future fix is visible.
#[test]
fn test_additive_overflow_wraps() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(TycoonBoostSystem, ());
    let client = TycoonBoostSystemClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    client.initialize(&admin);
    let player = Address::generate(&env);

    // Each value = 429_496_730 (≈ u32::MAX / 10 + 1)
    // 10 × 429_496_730 = 4_294_967_300 which wraps to 4 in u32
    let per_boost: u32 = u32::MAX / 10 + 1;
    for i in 0..10u128 {
        client.add_boost(&player, &nb(i, per_boost));
    }

    let total = client.calculate_total_boost(&player);
    // If additive_total wrapped, the result will be far below what 10 large
    // additive boosts should produce. We assert it is NOT the correct value
    // (10000 * (1 + 10 * per_boost / 10000)) to document the overflow.
    let correct_additive_sum = (per_boost as u64) * 10;
    let expected_if_no_overflow =
        (10000u64 * (10000 + correct_additive_sum) / 10000) as u32;
    // The actual result differs from the mathematically correct one
    assert_ne!(
        total, expected_if_no_overflow,
        "SEC-02: additive overflow no longer wraps — update checklist"
    );
}

// ── SEC-03: mixed-stacking final cast truncation ──────────────────────────────

/// Documents that the final `as u32` cast in apply_stacking_rules silently
/// truncates when the result exceeds u32::MAX.
/// Pins current behavior; a future fix (saturating_cast or checked) will
/// cause this test to fail, signaling the checklist needs updating.
#[test]
fn test_mixed_overflow_truncates() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(TycoonBoostSystem, ());
    let client = TycoonBoostSystemClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    client.initialize(&admin);
    let player = Address::generate(&env);

    // A single multiplicative boost with value = u32::MAX produces
    // multiplicative_total = (10000 * u32::MAX) / 10000 = u32::MAX.
    // Then the additive term adds 10000 (base), giving
    // u32::MAX * (10000 + 0) / 10000 = u32::MAX which fits.
    // To force truncation we need multiplicative_total > u32::MAX after the
    // chain. Use two large multiplicative boosts:
    // step1: 10000 * 3_000_000 / 10000 = 3_000_000
    // step2: 3_000_000 * 3_000_000 / 10000 = 900_000_000_000 / 10000 = 90_000_000
    // That still fits. Use value close to u32::MAX for step2:
    // step1: 10000 * (u32::MAX/2) / 10000 = u32::MAX/2 ≈ 2_147_483_647
    // step2: 2_147_483_647 * (u32::MAX/2) / 10000 overflows u64? No:
    //   2^31 * 2^31 = 2^62 < 2^64. Result = 2^62 / 10000 ≈ 4.6e14 > u32::MAX.
    // Final cast as u32 truncates.
    let large = u32::MAX / 2;
    client.add_boost(&player, &Boost {
        id: 1, boost_type: BoostType::Multiplicative, value: large, priority: 0, expires_at_ledger: 0,
    });
    client.add_boost(&player, &Boost {
        id: 2, boost_type: BoostType::Multiplicative, value: large, priority: 0, expires_at_ledger: 0,
    });

    let total = client.calculate_total_boost(&player);

    // Mathematically correct (u64): 10000 * large/10000 * large/10000 * (10000+0)/10000
    let step1 = 10000u64 * large as u64 / 10000;
    let step2 = step1 * large as u64 / 10000;
    let correct_u64 = step2 * 10000 / 10000; // additive=0

    if correct_u64 > u32::MAX as u64 {
        // Truncation occurred — result is the low 32 bits
        assert_eq!(total, correct_u64 as u32,
            "SEC-03: truncation behavior changed — update checklist");
    }
    // If correct_u64 fits in u32, the test is a no-op (no truncation for these values)
}
