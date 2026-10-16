#![no_std]
use soroban_sdk::{contracttype, Address, Env, Vec};

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct FeeConfig {
    pub platform_fee_bps: u32,  // Basis points (100 = 1%)
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

pub fn calculate_fee_split(amount: u128, config: &FeeConfig) -> FeeSplit {
    let platform_amount = (amount * config.platform_fee_bps as u128) / 10000;
    let creator_amount = (amount * config.creator_fee_bps as u128) / 10000;
    let pool_amount = (amount * config.pool_fee_bps as u128) / 10000;
    
    let total_distributed = platform_amount + creator_amount + pool_amount;
    let residue = amount.saturating_sub(total_distributed);

    FeeSplit {
        platform_amount,
        creator_amount,
        pool_amount,
        residue,
    }
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
            let split = calculate_fee_split(amount, &config);
            let sum = split.platform_amount + split.creator_amount + split.pool_amount + split.residue;
            assert_eq!(sum, amount, "Sum of split + residue must equal input for amount {}", amount);
            assert!(split.platform_amount + split.creator_amount + split.pool_amount <= amount);
        }
    }

    #[test]
    fn test_zero_royalty() {
        let env = Env::default();
        let config = config_with_bps(&env, 0, 0, 0);

        let split = calculate_fee_split(1000, &config);
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

        let split = calculate_fee_split(100, &config);
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

        let split = calculate_fee_split(0, &config);
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

        let split = calculate_fee_split(99, &config);
        assert_eq!(split.platform_amount, 0);
        assert_eq!(split.creator_amount, 0);
        assert_eq!(split.pool_amount, 0);
        assert_eq!(split.residue, 99);

        // amount 100 * 1 / 10000 = 0 as well (still below one unit)
        let split = calculate_fee_split(100, &config);
        assert_eq!(split.platform_amount, 0);
        assert_eq!(split.residue, 100);

        // amount 10000 * 1 / 10000 = 1 (first non-zero)
        let split = calculate_fee_split(10000, &config);
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

        let split = calculate_fee_split(5000, &config);
        assert_eq!(split.platform_amount, 5000);
        assert_eq!(split.creator_amount, 0);
        assert_eq!(split.pool_amount, 0);
        assert_eq!(split.residue, 0);
    }

    #[test]
    fn test_large_amount_overflow_behaviour() {
        let env = Env::default();
        let config = config_with_bps(&env, 10000, 0, 0);

        // amount * bps overflows u128 when amount is near u128::MAX.
        // Document current behaviour: the multiplication wraps in release
        // builds, so we only assert the non-overflowing boundary here.
        let safe_amount = u128::MAX / 10000;
        let split = calculate_fee_split(safe_amount, &config);
        assert_eq!(split.platform_amount, safe_amount);
        assert_eq!(split.residue, 0);
    }
}
