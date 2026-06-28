/// # tycoon-lib fees — coverage gap tests
///
/// Fills branches not exercised by the existing `fees::tests` module:
///
/// | Gap | Test(s) |
/// |-----|---------|
/// | All fees sum to exactly 10 000 bps (100%) — residue is zero | `test_fees_sum_to_100_pct_no_residue` |
/// | Total fees exceed 10 000 bps — invalid config returns all as residue | `test_fees_exceed_100_pct_handled_gracefully` |
/// | Large amount near u128 ceiling — no overflow in multiplication | `test_large_amount_no_overflow` |
/// | Single fee component, others zero | `test_single_fee_component_only` |
/// | Amount = 1 (minimum unit) — floor division produces correct residue | `test_amount_one_floor_division` |
/// | All three fees are equal (symmetric split) | `test_symmetric_three_way_split` |
/// | platform_fee_bps = 10 000 (100%) — full amount to platform | `test_platform_takes_all` |
/// | creator_fee_bps = 10 000 (100%) — full amount to creator | `test_creator_takes_all` |
/// | pool_fee_bps = 10 000 (100%) — full amount to pool | `test_pool_takes_all` |
/// | Amount zero — all outputs are zero | `test_amount_zero_handled_gracefully` |
/// | All bps zero — residue equals input | `test_fees_all_zero_bps` |
/// | Boundary validity: exactly 10 000 valid, 10 001 invalid | `test_fee_config_edge_case_validity` |
/// | Table-driven invariant: split + residue == input | `test_invariant_sum_equals_input_table` |
#[cfg(test)]
mod tests {
    use crate::fees::{calculate_fee_split, FeeConfig};
    use soroban_sdk::{testutils::Address as _, Env};

    fn cfg(env: &Env, p: u32, c: u32, pool: u32) -> FeeConfig {
        FeeConfig {
            platform_fee_bps: p,
            creator_fee_bps: c,
            pool_fee_bps: pool,
            platform_address: soroban_sdk::Address::generate(env),
            pool_address: soroban_sdk::Address::generate(env),
        }
    }

    #[test]
    fn test_fee_config_is_valid() {
        let env = Env::default();
        let valid_config = cfg(&env, 2500, 2500, 5000);
        assert!(valid_config.is_valid());

        let invalid_config = cfg(&env, 6000, 6000, 6000);
        assert!(!invalid_config.is_valid());
    }

    /// All fees sum to exactly 10 000 bps — residue must be zero.
    #[test]
    fn test_fees_sum_to_100_pct_no_residue() {
        let env = Env::default();
        // 25% + 25% + 50% = 100%
        let config = cfg(&env, 2500, 2500, 5000);
        let split = calculate_fee_split(10_000, &config);
        assert_eq!(split.platform_amount, 2500);
        assert_eq!(split.creator_amount, 2500);
        assert_eq!(split.pool_amount, 5000);
        assert_eq!(
            split.residue, 0,
            "residue must be zero when fees sum to 100%"
        );
    }

    /// Total fees exceed 10 000 bps — invalid config returns entire amount as residue.
    #[test]
    fn test_fees_exceed_100_pct_handled_gracefully() {
        let env = Env::default();
        // 60% + 60% + 60% = 180% — invalid config
        let config = cfg(&env, 6000, 6000, 6000);
        let split = calculate_fee_split(100, &config);

        assert_eq!(split.platform_amount, 0);
        assert_eq!(split.creator_amount, 0);
        assert_eq!(split.pool_amount, 0);
        assert_eq!(
            split.residue, 100,
            "Invalid fee config must gracefully return amount as residue"
        );

        let sum = split.platform_amount + split.creator_amount + split.pool_amount + split.residue;
        assert_eq!(sum, 100);
    }

    /// Large amount near u128 ceiling — multiplication must not overflow.
    #[test]
    fn test_large_amount_no_overflow() {
        let env = Env::default();
        // Use 1% fees to keep amounts well within u128
        let config = cfg(&env, 100, 100, 100);
        // u128::MAX / 10000 ≈ 3.4e34 — safe for 1% fee
        let large: u128 = u128::MAX / 10_001;
        let split = calculate_fee_split(large, &config);
        let sum = split.platform_amount + split.creator_amount + split.pool_amount + split.residue;
        assert_eq!(sum, large, "sum must equal input for large amounts");
    }

    /// Only platform fee set — creator and pool are zero.
    #[test]
    fn test_single_fee_component_only() {
        let env = Env::default();
        let config = cfg(&env, 500, 0, 0); // 5% platform only
        let split = calculate_fee_split(1000, &config);
        assert_eq!(split.platform_amount, 50);
        assert_eq!(split.creator_amount, 0);
        assert_eq!(split.pool_amount, 0);
        assert_eq!(split.residue, 950);
    }

    /// Amount = 1 — floor division means all fees round to 0, residue = 1.
    #[test]
    fn test_amount_one_floor_division() {
        let env = Env::default();
        let config = cfg(&env, 250, 500, 1000); // 2.5% + 5% + 10%
        let split = calculate_fee_split(1, &config);
        assert_eq!(split.platform_amount, 0);
        assert_eq!(split.creator_amount, 0);
        assert_eq!(split.pool_amount, 0);
        assert_eq!(split.residue, 1);
    }

    /// Symmetric three-way split: 33.33% each — residue absorbs rounding.
    #[test]
    fn test_symmetric_three_way_split() {
        let env = Env::default();
        let config = cfg(&env, 3333, 3333, 3333);
        let split = calculate_fee_split(10_000, &config);
        assert_eq!(split.platform_amount, 3333);
        assert_eq!(split.creator_amount, 3333);
        assert_eq!(split.pool_amount, 3333);
        assert_eq!(split.residue, 1); // 10000 - 9999 = 1
        let sum = split.platform_amount + split.creator_amount + split.pool_amount + split.residue;
        assert_eq!(sum, 10_000);
    }

    /// platform_fee_bps = 10 000 (100%) — full amount goes to platform, residue = 0.
    #[test]
    fn test_platform_takes_all() {
        let env = Env::default();
        let config = cfg(&env, 10_000, 0, 0);
        let split = calculate_fee_split(5_000, &config);
        assert_eq!(split.platform_amount, 5_000);
        assert_eq!(split.creator_amount, 0);
        assert_eq!(split.pool_amount, 0);
        assert_eq!(split.residue, 0);
    }

    /// Table-driven: invariant holds for a range of amounts and fee configs.
    #[test]
    fn test_invariant_sum_equals_input_table() {
        let env = Env::default();
        let cases: &[(u32, u32, u32, u128)] = &[
            (100, 200, 300, 0),
            (100, 200, 300, 1),
            (100, 200, 300, 9999),
            (100, 200, 300, 10_000),
            (100, 200, 300, 1_000_000),
            (0, 0, 0, 999_999_999),
            (5000, 3000, 2000, 10_000), // exactly 100%
        ];
        for &(p, c, pool, amount) in cases {
            let config = cfg(&env, p, c, pool);
            let split = calculate_fee_split(amount, &config);
            let sum =
                split.platform_amount + split.creator_amount + split.pool_amount + split.residue;
            assert_eq!(
                sum, amount,
                "invariant failed: p={p} c={c} pool={pool} amount={amount}"
            );
        }
    }

    #[test]
    fn test_creator_takes_all() {
        let env = Env::default();
        let config = cfg(&env, 0, 10_000, 0);
        let split = calculate_fee_split(5_000, &config);
        assert_eq!(split.platform_amount, 0);
        assert_eq!(split.creator_amount, 5_000);
        assert_eq!(split.pool_amount, 0);
        assert_eq!(split.residue, 0);
    }

    #[test]
    fn test_pool_takes_all() {
        let env = Env::default();
        let config = cfg(&env, 0, 0, 10_000);
        let split = calculate_fee_split(7_777, &config);
        assert_eq!(split.platform_amount, 0);
        assert_eq!(split.creator_amount, 0);
        assert_eq!(split.pool_amount, 7_777);
        assert_eq!(split.residue, 0);
    }

    #[test]
    fn test_amount_zero_handled_gracefully() {
        let env = Env::default();
        let config = cfg(&env, 1000, 2000, 3000);
        let split = calculate_fee_split(0, &config);
        assert_eq!(split.platform_amount, 0);
        assert_eq!(split.creator_amount, 0);
        assert_eq!(split.pool_amount, 0);
        assert_eq!(split.residue, 0);
    }

    #[test]
    fn test_fees_all_zero_bps() {
        let env = Env::default();
        let config = cfg(&env, 0, 0, 0);
        let split = calculate_fee_split(999, &config);
        assert_eq!(split.platform_amount, 0);
        assert_eq!(split.creator_amount, 0);
        assert_eq!(split.pool_amount, 0);
        assert_eq!(split.residue, 999);
    }

    #[test]
    fn test_fee_config_edge_case_validity() {
        let env = Env::default();
        // Exactly 10000 should be valid
        let config_exact = cfg(&env, 3334, 3333, 3333);
        assert!(config_exact.is_valid());

        // 10001 should be invalid
        let config_over = cfg(&env, 3334, 3334, 3333);
        assert!(!config_over.is_valid());
    }

    /// Table-driven: invariant holds for a range of amounts and fee configs.
    #[test]
    fn test_invariant_sum_equals_input_table() {
        let env = Env::default();
        let cases: &[(u32, u32, u32, u128)] = &[
            (100, 200, 300, 0),
            (100, 200, 300, 1),
            (100, 200, 300, 9999),
            (100, 200, 300, 10_000),
            (100, 200, 300, 1_000_000),
            (0, 0, 0, 999_999_999),
            (5000, 3000, 2000, 10_000), // exactly 100%
        ];
        for &(p, c, pool, amount) in cases {
            let config = cfg(&env, p, c, pool);
            let split = calculate_fee_split(amount, &config);
            let sum =
                split.platform_amount + split.creator_amount + split.pool_amount + split.residue;
            assert_eq!(
                sum, amount,
                "invariant failed: p={p} c={c} pool={pool} amount={amount}"
            );
        }
    }

    /// Integration: fee split result fields are never individually larger than the input.
    #[test]
    fn test_each_field_never_exceeds_input() {
        let env = Env::default();
        let config = cfg(&env, 3000, 3000, 3000);
        let amount = 9999u128;
        let split = calculate_fee_split(amount, &config);
        assert!(split.platform_amount <= amount);
        assert!(split.creator_amount <= amount);
        assert!(split.pool_amount <= amount);
        assert!(split.residue <= amount);
    }

    /// Integration: is_valid is consistent with calculate_fee_split behaviour.
    #[test]
    fn test_is_valid_consistent_with_split() {
        let env = Env::default();
        let valid = cfg(&env, 1000, 2000, 3000);
        assert!(valid.is_valid());
        let split = calculate_fee_split(10_000, &valid);
        assert!(split.platform_amount > 0 || split.creator_amount > 0 || split.pool_amount > 0);

        let invalid = cfg(&env, 5000, 5000, 5000);
        assert!(!invalid.is_valid());
        let split_invalid = calculate_fee_split(10_000, &invalid);
        assert_eq!(split_invalid.platform_amount, 0);
        assert_eq!(split_invalid.creator_amount, 0);
        assert_eq!(split_invalid.pool_amount, 0);
        assert_eq!(split_invalid.residue, 10_000);
    }
}
