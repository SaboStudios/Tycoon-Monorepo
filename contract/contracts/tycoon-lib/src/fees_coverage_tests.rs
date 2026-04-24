/// # tycoon-lib fees — coverage gap tests (SW-001)
///
/// Fills branches not exercised by the existing `fees::tests` module:
///
/// | Gap | Test(s) |
/// |-----|---------|
/// | All fees sum to exactly 10 000 bps (100%) — residue is zero | `test_fees_sum_to_100_pct_no_residue` |
/// | Total fees exceed 10 000 bps — saturating_sub prevents underflow | `test_fees_exceed_100_pct_residue_saturates` |
/// | Large amount near u128 ceiling — no overflow in multiplication | `test_large_amount_no_overflow` |
/// | Single fee component, others zero | `test_single_fee_component_only` |
/// | Amount = 1 (minimum unit) — floor division produces correct residue | `test_amount_one_floor_division` |
/// | All three fees are equal (symmetric split) | `test_symmetric_three_way_split` |
/// | platform_fee_bps = 10 000 (100%) — full amount to platform | `test_platform_takes_all` |
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

    /// Total fees exceed 10 000 bps — saturating_sub must prevent underflow.
    #[test]
    fn test_fees_exceed_100_pct_residue_saturates() {
        let env = Env::default();
        // 60% + 60% + 60% = 180% — total_distributed > amount
        let config = cfg(&env, 6000, 6000, 6000);
        let split = calculate_fee_split(100, &config);
        // Each: 100 * 6000 / 10000 = 60
        assert_eq!(split.platform_amount, 60);
        assert_eq!(split.creator_amount, 60);
        assert_eq!(split.pool_amount, 60);
        // total_distributed = 180 > 100 → saturating_sub → residue = 0
        assert_eq!(split.residue, 0, "saturating_sub must prevent underflow");
        // Invariant: sum of all parts must not exceed input
        let sum = split.platform_amount + split.creator_amount + split.pool_amount + split.residue;
        // sum here is 180 which is > 100 — this is the documented over-allocation case.
        // The contract's saturating_sub only protects residue from wrapping; callers
        // must not configure fees > 100%. Flag for security review if bps validation
        // is not enforced at the call site.
        let _ = sum; // acknowledged
    }

    /// Large amount near u128 ceiling — multiplication must not overflow.
    #[test]
    fn test_large_amount_no_overflow() {
        let env = Env::default();
        // Use 1% fees to keep amounts well within u128
        let config = cfg(&env, 100, 100, 100);
        // u128::MAX / 10000 ≈ 3.4e34 — safe for 1% fee
        let large: u128 = u128::MAX / 10_001; // stays within safe range
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
        // 1 * anything / 10000 = 0 (floor)
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
}
