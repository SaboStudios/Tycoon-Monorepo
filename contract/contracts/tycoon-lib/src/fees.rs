#![no_std]
use soroban_sdk::{contracterror, contracttype, Address, Env, Vec};

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct FeeConfig {
    pub platform_fee_bps: u32, // Basis points (100 = 1%)
    pub creator_fee_bps: u32,
    pub pool_fee_bps: u32,
    pub platform_address: Address,
    pub pool_address: Address,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct FeeSplit {
    pub platform_amount: u128,
    pub creator_amount: u128,
    pub pool_amount: u128,
    pub residue: u128,
}

#[contracterror]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum FeeError {
    /// The sum of the basis points exceeds 10,000 (100%).
    InvalidFeeConfig = 1,
    /// `amount * bps` would overflow a `u128`.
    Overflow = 2,
}

const BPS_DENOMINATOR: u128 = 10000;

pub fn calculate_fee_split(amount: u128, config: &FeeConfig) -> Result<FeeSplit, FeeError> {
    let total_bps = config.platform_fee_bps as u128
        + config.creator_fee_bps as u128
        + config.pool_fee_bps as u128;
    if total_bps > BPS_DENOMINATOR {
        return Err(FeeError::InvalidFeeConfig);
    }

    let platform_amount = amount
        .checked_mul(config.platform_fee_bps as u128)
        .ok_or(FeeError::Overflow)?
        / BPS_DENOMINATOR;
    let creator_amount = amount
        .checked_mul(config.creator_fee_bps as u128)
        .ok_or(FeeError::Overflow)?
        / BPS_DENOMINATOR;
    let pool_amount = amount
        .checked_mul(config.pool_fee_bps as u128)
        .ok_or(FeeError::Overflow)?
        / BPS_DENOMINATOR;

    let total_distributed = platform_amount + creator_amount + pool_amount;
    let residue = amount.saturating_sub(total_distributed);

    Ok(FeeSplit {
        platform_amount,
        creator_amount,
        pool_amount,
        residue,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::testutils::Address as _;
    use soroban_sdk::Env;

    fn config_with_bps(env: &Env, platform: u32, creator: u32, pool: u32) -> FeeConfig {
        FeeConfig {
            platform_fee_bps: platform,
            creator_fee_bps: creator,
            pool_fee_bps: pool,
            platform_address: Address::generate(env),
            pool_address: Address::generate(env),
        }
    }

    #[test]
    fn test_fee_split_sum_less_than_or_equal_to_input() {
        let env = Env::default();
        let config = config_with_bps(&env, 250, 500, 1000);

        let amounts = [100, 1000, 10000, 1234567, 0, 1];
        for amount in amounts {
            let split = calculate_fee_split(amount, &config).unwrap();
            let sum =
                split.platform_amount + split.creator_amount + split.pool_amount + split.residue;
            assert_eq!(
                sum, amount,
                "Sum of split + residue must equal input for amount {}",
                amount
            );
            assert!(split.platform_amount + split.creator_amount + split.pool_amount <= amount);
        }
    }

    #[test]
    fn test_zero_royalty() {
        let env = Env::default();
        let config = config_with_bps(&env, 0, 0, 0);

        let split = calculate_fee_split(1000, &config).unwrap();
        assert_eq!(split.platform_amount, 0);
        assert_eq!(split.creator_amount, 0);
        assert_eq!(split.pool_amount, 0);
        assert_eq!(split.residue, 1000);
    }

    #[test]
    fn test_rounding_residue() {
        let env = Env::default();
        // 33.33% each
        let config = config_with_bps(&env, 3333, 3333, 3333);

        let split = calculate_fee_split(100, &config).unwrap();
        // 100 * 3333 / 10000 = 33
        assert_eq!(split.platform_amount, 33);
        assert_eq!(split.creator_amount, 33);
        assert_eq!(split.pool_amount, 33);
        assert_eq!(split.residue, 1); // 100 - (33*3) = 1
    }

    #[test]
    fn test_zero_amount() {
        let env = Env::default();
        let config = config_with_bps(&env, 250, 500, 1000);

        let split = calculate_fee_split(0, &config).unwrap();
        assert_eq!(split.platform_amount, 0);
        assert_eq!(split.creator_amount, 0);
        assert_eq!(split.pool_amount, 0);
        assert_eq!(split.residue, 0);
    }

    #[test]
    fn test_smallest_amount_rounds_down_to_zero() {
        let env = Env::default();
        // 1 bps = 0.01%; amount 99 * 1 / 10000 = 0 (truncated)
        let config = config_with_bps(&env, 1, 1, 1);

        let split = calculate_fee_split(99, &config).unwrap();
        assert_eq!(split.platform_amount, 0);
        assert_eq!(split.creator_amount, 0);
        assert_eq!(split.pool_amount, 0);
        assert_eq!(split.residue, 99);

        // amount 100 * 1 / 10000 = 0 as well (still below one unit)
        let split = calculate_fee_split(100, &config).unwrap();
        assert_eq!(split.platform_amount, 0);
        assert_eq!(split.residue, 100);

        // amount 10000 * 1 / 10000 = 1 (first non-zero)
        let split = calculate_fee_split(10000, &config).unwrap();
        assert_eq!(split.platform_amount, 1);
        assert_eq!(split.creator_amount, 1);
        assert_eq!(split.pool_amount, 1);
        assert_eq!(split.residue, 9997);
    }

    #[test]
    fn test_full_fee_bps_consumes_entire_amount() {
        let env = Env::default();
        // 10000 bps = 100% to platform
        let config = config_with_bps(&env, 10000, 0, 0);

        let split = calculate_fee_split(5000, &config).unwrap();
        assert_eq!(split.platform_amount, 5000);
        assert_eq!(split.creator_amount, 0);
        assert_eq!(split.pool_amount, 0);
        assert_eq!(split.residue, 0);
    }

    #[test]
    fn test_rates_summing_past_denominator_rejected() {
        let env = Env::default();
        // Each leg is 100%: sum is 30000 bps, far past 10000.
        let config = config_with_bps(&env, 10000, 10000, 10000);

        let result = calculate_fee_split(1000, &config);
        assert_eq!(result, Err(FeeError::InvalidFeeConfig));
    }

    #[test]
    fn test_rates_just_past_denominator_rejected() {
        let env = Env::default();
        let config = config_with_bps(&env, 5000, 5000, 1);

        let result = calculate_fee_split(1000, &config);
        assert_eq!(result, Err(FeeError::InvalidFeeConfig));
    }

    #[test]
    fn test_large_amount_overflow_rejected() {
        let env = Env::default();
        let config = config_with_bps(&env, 10000, 0, 0);

        // amount * bps overflows u128 when amount is near u128::MAX.
        let result = calculate_fee_split(u128::MAX, &config);
        assert_eq!(result, Err(FeeError::Overflow));
    }

    #[test]
    fn test_large_amount_non_overflowing_boundary() {
        let env = Env::default();
        let config = config_with_bps(&env, 10000, 0, 0);

        let safe_amount = u128::MAX / 10000;
        let split = calculate_fee_split(safe_amount, &config).unwrap();
        assert_eq!(split.platform_amount, safe_amount);
        assert_eq!(split.residue, 0);
    }
}
