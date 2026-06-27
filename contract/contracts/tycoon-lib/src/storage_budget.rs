// Storage rent budget reference for Tycoon contracts.
//
// ## Background
//
// Soroban persistent storage entries have independent TTL (time-to-live)
// counters measured in ledgers.  When a persistent entry's TTL reaches zero it
// is archived and a non-trivial restoration fee is required to read or write it
// again.  Instance storage is exempt — the Soroban host refreshes the instance
// TTL on every contract invocation.
//
// ## Storage classification
//
// | Kind       | When to use                               | TTL management                      |
// |------------|-------------------------------------------|-------------------------------------|
// | Instance   | Admin keys, config, version numbers       | Automatic per invocation            |
// | Persistent | Per-user state: balances, profiles, flags | Implicit on write; extend on access |
// | Temporary  | Short-lived computation (intra-tx)        | Bounded to transaction lifetime     |
//
// ## Recommended constants (calibrated for ~5 seconds/ledger on Soroban mainnet)
//
// | Constant                  | Ledgers     | Wall-clock    |
// |---------------------------|-------------|---------------|
// | `PERSISTENT_MIN_TTL`      | 17 280      | ≈ 24 hours    |
// | `PERSISTENT_TARGET_TTL`   | 2 073 600   | ≈ 120 days    |
// | `TTL_BUMP_THRESHOLD`      | 518 400     | ≈ 30 days     |
//
// ## TTL extension policy
//
// **Instance keys** (admin address, state version, initialization flag): The
// Soroban host automatically refreshes the instance TTL on every contract
// invocation.  No explicit `extend_ttl` call is needed.
//
// **Persistent keys** (user balances, profiles, registrations): Every
// `storage().persistent().set(...)` call implicitly grants a baseline TTL.
// To prevent archival during periods of inactivity, call `extend_ttl` when
// the remaining TTL falls below `TTL_BUMP_THRESHOLD`.  Active users (those
// who transact regularly) receive an implicit TTL refresh on every write.
//
// ## Cost budget by operation (approximate, Soroban mainnet)
//
// | Operation    | Instance writes | Persistent writes | Approx cost |
// |--------------|-----------------|-------------------|-------------|
// | initialize   | 3               | 1 (admin balance) | ~0.005 XLM  |
// | mint         | 1 (supply)      | 1 (balance)       | ~0.003 XLM  |
// | transfer     | 0               | 2 (from, to)      | ~0.004 XLM  |
// | approve      | 0               | 1 (allowance)     | ~0.002 XLM  |
// | burn         | 1 (supply)      | 1 (balance)       | ~0.003 XLM  |
// | read-only    | 0               | 0                 | ~0.001 XLM  |

/// Minimum acceptable TTL for persistent storage entries.
///
/// At ~5 seconds per ledger this corresponds to approximately 24 hours.
/// Entries whose remaining TTL is below this value should be bumped immediately.
pub const PERSISTENT_MIN_TTL: u32 = 17_280;

/// Recommended target TTL when extending a persistent storage entry.
///
/// At ~5 seconds per ledger this corresponds to approximately 120 days, giving
/// inactive accounts a comfortable window before their state is archived.
pub const PERSISTENT_TARGET_TTL: u32 = 2_073_600;

/// Proactive bump threshold for persistent entries.
///
/// When the remaining TTL of a persistent entry falls below this value the
/// contract should extend it to `PERSISTENT_TARGET_TTL`.  At ~5 seconds per
/// ledger this corresponds to approximately 30 days.
pub const TTL_BUMP_THRESHOLD: u32 = 518_400;

/// Classifies a storage key by its cost and lifetime characteristics.
///
/// Use this in per-contract storage documentation tables to make the TTL
/// strategy for each key explicit and auditable.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum StorageKind {
    /// Bundled with the contract instance.  The Soroban host refreshes the
    /// instance TTL on every invocation — no manual `extend_ttl` call is
    /// required.  Use for: admin address, config, state version, init flag.
    Instance,
    /// Stored independently with its own TTL counter.  Must be extended on
    /// every write (via the implicit TTL grant) and proactively bumped when
    /// `remaining_ttl < TTL_BUMP_THRESHOLD`.  Use for: user balances,
    /// profiles, allowances, registrations.
    Persistent,
    /// Lives only for the duration of a single transaction.  Cannot be read
    /// across ledger boundaries.  Use for: ephemeral computation state.
    Temporary,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_constants_are_ordered() {
        assert!(PERSISTENT_MIN_TTL < TTL_BUMP_THRESHOLD);
        assert!(TTL_BUMP_THRESHOLD < PERSISTENT_TARGET_TTL);
    }

    #[test]
    fn test_persistent_min_ttl_value() {
        // 17_280 ledgers × 5 s/ledger = 86_400 s = 24 hours
        assert_eq!(PERSISTENT_MIN_TTL, 17_280);
    }

    #[test]
    fn test_persistent_target_ttl_value() {
        // 2_073_600 ledgers × 5 s/ledger = 10_368_000 s ≈ 120 days
        assert_eq!(PERSISTENT_TARGET_TTL, 2_073_600);
    }

    #[test]
    fn test_ttl_bump_threshold_value() {
        // 518_400 ledgers × 5 s/ledger = 2_592_000 s = 30 days
        assert_eq!(TTL_BUMP_THRESHOLD, 518_400);
    }

    #[test]
    fn test_storage_kind_variants_are_distinct() {
        assert_ne!(StorageKind::Instance, StorageKind::Persistent);
        assert_ne!(StorageKind::Persistent, StorageKind::Temporary);
        assert_ne!(StorageKind::Instance, StorageKind::Temporary);
    }

    #[test]
    fn test_storage_kind_eq_reflexive() {
        assert_eq!(StorageKind::Instance, StorageKind::Instance);
        assert_eq!(StorageKind::Persistent, StorageKind::Persistent);
        assert_eq!(StorageKind::Temporary, StorageKind::Temporary);
    }

    #[test]
    fn test_storage_kind_clone() {
        let k = StorageKind::Persistent;
        assert_eq!(k, k.clone());
    }

    #[test]
    fn test_storage_kind_match_is_exhaustive() {
        let kinds = [
            StorageKind::Instance,
            StorageKind::Persistent,
            StorageKind::Temporary,
        ];
        for kind in &kinds {
            let label = match kind {
                StorageKind::Instance => "instance",
                StorageKind::Persistent => "persistent",
                StorageKind::Temporary => "temporary",
            };
            assert!(!label.is_empty());
        }
    }

    #[test]
    fn test_bump_threshold_is_fraction_of_target() {
        // Bump threshold should be roughly 25 % of the target TTL
        let ratio = PERSISTENT_TARGET_TTL / TTL_BUMP_THRESHOLD;
        assert!(ratio >= 3 && ratio <= 5, "Expected ratio 3-5, got {}", ratio);
    }
}
