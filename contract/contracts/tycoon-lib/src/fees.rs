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

    #[test]
    fn test_fee_split_sum_less_than_or_equal_to_input() {
        let env = Env::default();
        let config = FeeConfig {
            platform_fee_bps: 250, // 2.5%
            creator_fee_bps: 500,  // 5%
            pool_fee_bps: 1000,    // 10%
            platform_address: Address::generate(&env),
            pool_address: Address::generate(&env),
        };

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
        let config = FeeConfig {
            platform_fee_bps: 0,
            creator_fee_bps: 0,
            pool_fee_bps: 0,
            platform_address: Address::generate(&env),
            pool_address: Address::generate(&env),
        };

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
        let config = FeeConfig {
            platform_fee_bps: 3333,
            creator_fee_bps: 3333,
            pool_fee_bps: 3333,
            platform_address: Address::generate(&env),
            pool_address: Address::generate(&env),
        };

        let split = calculate_fee_split(100, &config);
        // 100 * 3333 / 10000 = 33
        assert_eq!(split.platform_amount, 33);
        assert_eq!(split.creator_amount, 33);
        assert_eq!(split.pool_amount, 33);
        assert_eq!(split.residue, 1); // 100 - (33*3) = 1
    }
}
