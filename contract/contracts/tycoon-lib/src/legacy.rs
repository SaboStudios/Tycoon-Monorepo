//! # legacy — deprecated re-exports for tycoon-lib consumers
//!
//! This module provides **deprecated** type aliases and free-function wrappers
//! for entrypoints that have been moved or removed.  All items here emit a
//! compiler warning when used; update your import paths to silence the warning.
//!
//! ## Migration guide
//!
//! | Deprecated path | Replacement |
//! |-----------------|-------------|
//! | `tycoon_lib::legacy::FeeConfig` | `tycoon_lib::fees::FeeConfig` |
//! | `tycoon_lib::legacy::FeeSplit` | `tycoon_lib::fees::FeeSplit` |
//! | `tycoon_lib::legacy::calculate_fee_split` | `tycoon_lib::fees::calculate_fee_split` |
//! | `tycoon_lib::legacy::Pause` | Implement pause locally — see `tycoon-main-game/src/storage.rs` |

use crate::fees;

// ---------------------------------------------------------------
// Deprecated fee type aliases
// ---------------------------------------------------------------

/// Deprecated alias for [`crate::fees::FeeConfig`].
///
/// # Migration
///
/// Replace `tycoon_lib::legacy::FeeConfig` with `tycoon_lib::fees::FeeConfig`.
#[deprecated(
    since = "0.2.0",
    note = "Import `FeeConfig` from `tycoon_lib::fees::FeeConfig` instead."
)]
pub type FeeConfig = fees::FeeConfig;

/// Deprecated alias for [`crate::fees::FeeSplit`].
///
/// # Migration
///
/// Replace `tycoon_lib::legacy::FeeSplit` with `tycoon_lib::fees::FeeSplit`.
#[deprecated(
    since = "0.2.0",
    note = "Import `FeeSplit` from `tycoon_lib::fees::FeeSplit` instead."
)]
pub type FeeSplit = fees::FeeSplit;

// ---------------------------------------------------------------
// Deprecated fee function wrapper
// ---------------------------------------------------------------

/// Deprecated wrapper for [`crate::fees::calculate_fee_split`].
///
/// # Migration
///
/// ```text
/// // Before
/// use tycoon_lib::legacy::calculate_fee_split;
///
/// // After
/// use tycoon_lib::fees::calculate_fee_split;
/// ```
#[deprecated(
    since = "0.2.0",
    note = "Use `tycoon_lib::fees::calculate_fee_split` instead."
)]
pub fn calculate_fee_split(amount: u128, config: &fees::FeeConfig) -> fees::FeeSplit {
    fees::calculate_fee_split(amount, config)
}

// ---------------------------------------------------------------
// Pause stub (module removed)
// ---------------------------------------------------------------

/// Placeholder for the removed `pause` module.
///
/// The global pause contract was removed.  Each contract now manages its
/// own pause flag for better isolation.
///
/// # Migration
///
/// Copy the `PauseKey` storage key and the `is_paused` / `set_paused` helpers
/// from `tycoon-main-game/src/storage.rs` into your own contract's storage module.
#[deprecated(
    since = "0.2.0",
    note = "The pause module has been removed. Implement pause locally in each contract — \
            see tycoon-main-game/src/storage.rs for the canonical pattern."
)]
pub struct Pause;

// ---------------------------------------------------------------
// Tests for the deprecated path
// ---------------------------------------------------------------

#[cfg(test)]
mod tests {
    // Allow deprecated to test that the re-exports still work.
    #[allow(deprecated)]
    use super::{calculate_fee_split, FeeConfig, FeeSplit};
    use soroban_sdk::{testutils::Address as _, Env};

    #[allow(deprecated)]
    #[test]
    fn test_legacy_fee_config_alias_is_valid() {
        let env = Env::default();
        let config: FeeConfig = crate::fees::FeeConfig {
            platform_fee_bps: 500,
            creator_fee_bps: 500,
            pool_fee_bps: 500,
            platform_address: soroban_sdk::Address::generate(&env),
            pool_address: soroban_sdk::Address::generate(&env),
        };
        assert!(config.is_valid());
    }

    #[allow(deprecated)]
    #[test]
    fn test_legacy_calculate_fee_split_delegates_correctly() {
        let env = Env::default();
        let config = crate::fees::FeeConfig {
            platform_fee_bps: 1000,
            creator_fee_bps: 2000,
            pool_fee_bps: 3000,
            platform_address: soroban_sdk::Address::generate(&env),
            pool_address: soroban_sdk::Address::generate(&env),
        };
        let split: FeeSplit = calculate_fee_split(10_000, &config);
        assert_eq!(split.platform_amount, 1000);
        assert_eq!(split.creator_amount, 2000);
        assert_eq!(split.pool_amount, 3000);
        assert_eq!(split.residue, 4000);
    }

    #[allow(deprecated)]
    #[test]
    fn test_legacy_alias_result_matches_canonical() {
        let env = Env::default();
        let config = crate::fees::FeeConfig {
            platform_fee_bps: 250,
            creator_fee_bps: 250,
            pool_fee_bps: 250,
            platform_address: soroban_sdk::Address::generate(&env),
            pool_address: soroban_sdk::Address::generate(&env),
        };
        let legacy_split = calculate_fee_split(8_000, &config);
        let canonical_split = crate::fees::calculate_fee_split(8_000, &config);
        assert_eq!(legacy_split, canonical_split);
    }
}
