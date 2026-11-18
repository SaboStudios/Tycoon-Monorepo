//! Fee splitting for Tycoon sales.
//!
//! # Residue recipient
//!
//! `calculate_fee_split` rounds the platform and pool shares down, so the
//! three named amounts (`platform_amount`, `creator_amount`, `pool_amount`)
//! can sum to less than the sale `amount`. The leftover rounding dust is
//! reported in `FeeSplit::residue` and is paid to the **creator**: the
//! creator receives `creator_amount + residue`.
//!
//! Callers must not add the residue themselves. Use
//! [`FeeSplit::creator_total`] (or [`calculate_fee_split`]'s companion
//! [`calculate_paid_amounts`]) so the paid amounts always sum to `amount`.

#![no_std]
use soroban_sdk::{contracterror, contracttype, Address, Env, Vec};

use soroban_sdk::contracttype;

/// Basis-point denominator (100% = 10_000 bps).
pub const BASIS_POINTS: u32 = 10_000;

/// The result of splitting a sale `amount` into fee components.
///
/// Invariant: `platform_amount + creator_amount + pool_amount + residue == amount`.
///
/// The `residue` (rounding dust) is paid to the **creator**, so the creator's
/// total payout is `creator_amount + residue`. Prefer [`FeeSplit::creator_total`]
/// over reading `creator_amount` directly.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct FeeSplit {
    /// Amount owed to the platform.
    pub platform_amount: i128,
    /// Amount owed to the creator, excluding residue.
    pub creator_amount: i128,
    /// Amount owed to the pool.
    pub pool_amount: i128,
    /// Rounding dust. Paid to the creator (see [`FeeSplit::creator_total`]).
    pub residue: i128,
}

impl FeeSplit {
    /// The creator's total payout, including the residue.
    ///
    /// This is the amount a caller should transfer to the creator; it makes
    /// the paid amounts sum to the original sale `amount` without the caller
    /// having to remember to add the residue.
    pub fn creator_total(&self) -> i128 {
        self.creator_amount + self.residue
    }
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

/// Splits `amount` into platform, creator, and pool fees using the basis
/// points in `config`.
///
/// The fee denominator is **10,000 basis points**, i.e. `10,000 bps = 100%`
/// (so `100 bps = 1%`). Each share is computed as
/// `amount * fee_bps / 10_000`, truncating any fractional remainder.
///
/// `residue` is the rounding leftover: the part of `amount` not distributed
/// to any of the three recipients after truncation. It always satisfies
/// `platform_amount + creator_amount + pool_amount + residue == amount`.
///
/// # Example
///
/// With `platform_fee_bps = creator_fee_bps = pool_fee_bps = 3333`
/// (33.33% each) and `amount = 100`:
///
/// - `platform_amount = 100 * 3333 / 10_000 = 33`
/// - `creator_amount = 33`
/// - `pool_amount = 33`
/// - `residue = 100 - (33 * 3) = 1`
///
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

/// Splits `amount` into platform, creator, and pool shares.
///
/// `platform_bps` and `pool_bps` are basis points of `amount`; the creator
/// receives the remainder. Rounding dust is placed in `FeeSplit::residue`
/// and is paid to the creator (see [`FeeSplit::creator_total`]).
///
/// The four fields of the returned [`FeeSplit`] always sum to `amount`.
pub fn calculate_fee_split(amount: i128, platform_bps: u32, pool_bps: u32) -> FeeSplit {
    let platform_amount = amount * (platform_bps as i128) / (BASIS_POINTS as i128);
    let pool_amount = amount * (pool_bps as i128) / (BASIS_POINTS as i128);
    let creator_amount = amount - platform_amount - pool_amount;

    Ok(FeeSplit {
        platform_amount,
        creator_amount,
        pool_amount,
        residue: 0,
    }
}

/// The three amounts a caller must actually transfer, with the residue
/// already folded into the creator's share.
///
/// `platform + creator + pool == amount`, so a caller can pay everyone
/// without doing the addition themselves.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct PaidAmounts {
    /// Amount to transfer to the platform.
    pub platform: i128,
    /// Amount to transfer to the creator (includes residue).
    pub creator: i128,
    /// Amount to transfer to the pool.
    pub pool: i128,
}

/// Computes the amounts to pay, folding the residue into the creator's share.
///
/// The returned [`PaidAmounts`] always sum to `amount`.
pub fn calculate_paid_amounts(amount: i128, platform_bps: u32, pool_bps: u32) -> PaidAmounts {
    let split = calculate_fee_split(amount, platform_bps, pool_bps);
    PaidAmounts {
        platform: split.platform_amount,
        creator: split.creator_total(),
        pool: split.pool_amount,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_fee_split_sums_to_amount() {
        let split = calculate_fee_split(100, 3333, 1000);
        assert_eq!(
            split.platform_amount + split.creator_amount + split.pool_amount + split.residue,
            100
        );
    }

    #[test]
    fn test_residue_goes_to_creator_100_units_3333_bps() {
        // 100 units at 3333 bps platform, 1000 bps pool.
        let split = calculate_fee_split(100, 3333, 1000);

        assert_eq!(split.platform_amount, 33);
        assert_eq!(split.creator_amount, 33);
        assert_eq!(split.pool_amount, 33);
        assert_eq!(split.residue, 1); // 100 - (33*3) = 1
    }

    #[test]
    fn test_zero_amount() {
        let env = Env::default();
        let config = config_with_bps(&env, 250, 500, 1000);

        // A zero amount yields an all-zero split (see the rustdoc example).
        let split = calculate_fee_split(0, &config).unwrap();
        assert_eq!(split.platform_amount, 33);
        assert_eq!(split.creator_amount, 33);
        assert_eq!(split.pool_amount, 33);
        assert_eq!(split.residue, 1); // 100 - (33*3) = 1
    }

    #[test]
    fn test_zero_amount() {
        let env = Env::default();
        let config = config_with_bps(&env, 250, 500, 1000);

        // A zero amount yields an all-zero split (see the rustdoc example).
        let split = calculate_fee_split(0, &config).unwrap();
        assert_eq!(split.platform_amount, 0);
        assert_eq!(split.creator_amount, 0);
        assert_eq!(split.pool_amount, 0);
        assert_eq!(split.residue, 0);
        assert_eq!(split.creator_total(), 57);

        // Paid amounts sum to the input with no leftover.
        let paid = calculate_paid_amounts(100, 3333, 1000);
        assert_eq!(paid.platform + paid.creator + paid.pool, 100);
        assert_eq!(paid.creator, split.creator_total());
    }

    #[test]
    fn test_residue_is_paid_to_creator() {
        // 100 units at 3333 bps platform only: 33 platform, 67 creator, 0 residue.
        // Use a case that produces dust: 1 unit at 3333 bps -> 0 platform, 1 creator.
        let split = calculate_fee_split(1, 3333, 3333);

        assert_eq!(split.platform_amount, 0);
        assert_eq!(split.pool_amount, 0);
        assert_eq!(split.residue, 1);

        // amount 100 * 1 / 10000 = 0 as well (still below one unit)
        let split = calculate_fee_split(100, 3333, 3333);
        assert_eq!(split.platform_amount, 0);
        assert_eq!(split.residue, 100);

        // amount 10000 * 1 / 10000 = 1 (first non-zero)
        let split = calculate_fee_split(10000, 3333, 3333);
        assert_
        assert_eq!(split.platform_amount, 0);
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
        assert_eq!(split.residue, 0);

        // Creator total always includes residue.
        let split = FeeSplit {
            platform_amount: 33,
            creator_amount: 66,
            pool_amount: 0,
            residue: 1,
        };
        assert_eq!(split.creator_total(), 67);
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

    #[test]
    fn test_paid_amounts_sum_to_input() {
        for amount in [0i128, 1, 7, 100, 3333, 10_000] {
            let paid = calculate_paid_amounts(amount, 3333, 1000);
            assert_eq!(paid.platform + paid.creator + paid.pool, amount);
        }
    }
}
