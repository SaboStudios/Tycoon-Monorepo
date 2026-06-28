// ============================================================
// Storage Rent Budget Review (SW-LIB-002)
// ============================================================
//
// Soroban storage is metered.  Every persistent and temporary entry
// carries an independent TTL (time-to-live, measured in ledgers).
// When a TTL reaches zero the entry becomes *archived*; restoring it
// costs an additional fee.  Instance storage entries are renewed
// automatically whenever the contract is invoked.
//
// ## Storage tiers
//
// | Tier        | TTL scope      | Renewal               | Use-case                          |
// |-------------|----------------|-----------------------|-----------------------------------|
// | Instance    | Contract-wide  | Automatic on invoke   | Admin key, flags, config          |
// | Persistent  | Per-entry      | Manual extend_ttl     | Balances, user data, game state   |
// | Temporary   | Per-entry      | Never survives ledger | Nonces, per-tx scratch space      |
//
// ## TTL constants
//
// The values below represent sensible defaults for Soroban mainnet.
// Adjust LEDGERS_PER_DAY if the network parameter changes.
//
// | Constant                     | Value (ledgers) | Approx wall-clock time |
// |------------------------------|-----------------|------------------------|
// | LEDGERS_PER_DAY              | 17_280          | 1 day (5-s cadence)    |
// | INSTANCE_BUMP_LEDGERS        | 518_400         | ~30 days               |
// | INSTANCE_BUMP_THRESHOLD      | 259_200         | ~15 days               |
// | PERSISTENT_BUMP_LEDGERS      | 518_400         | ~30 days               |
// | PERSISTENT_BUMP_THRESHOLD    | 259_200         | ~15 days               |
// | TEMP_BUMP_LEDGERS            | 17_280          | ~1 day                 |
//
// ## TTL-extension policy
//
// - **Instance entries**: automatically renewed by the Soroban host on
//   every contract invocation — no manual call needed.
// - **Persistent entries**: each `set()` implicitly grants a baseline
//   TTL.  For long-lived entries (user balances, game state) callers
//   should call `bump_persistent` after every mutation so the entry
//   survives periods of inactivity.
// - **Temporary entries**: short-lived scratch space; extend manually
//   if they must survive across multiple transaction phases.
//
// ## Cost estimates (mainnet approximations)
//
// | Operation                | Writes     | Estimated XLM fee |
// |--------------------------|------------|-------------------|
// | initialize (admin+flag)  | 2 instance | ~0.003 XLM        |
// | set persistent entry     | 1 persist  | ~0.002 XLM        |
// | bump persistent entry    | 0 writes   | ~0.001 XLM        |
// | read instance key        | 0          | ~0.001 XLM        |
// | read persistent key      | 0          | ~0.001 XLM        |

use soroban_sdk::{contracttype, Env};

// ─── Constants ────────────────────────────────────────────────────────────────

/// Approximate ledgers per day at a 5-second block time.
pub const LEDGERS_PER_DAY: u32 = 17_280;

/// Target TTL for instance storage entries (~30 days).
pub const INSTANCE_BUMP_LEDGERS: u32 = 518_400;

/// Threshold below which instance storage should be bumped (~15 days).
/// Bump when TTL < threshold to avoid bumping on every call.
pub const INSTANCE_BUMP_THRESHOLD: u32 = 259_200;

/// Target TTL for persistent storage entries (~30 days).
pub const PERSISTENT_BUMP_LEDGERS: u32 = 518_400;

/// Threshold below which a persistent entry should be bumped (~15 days).
pub const PERSISTENT_BUMP_THRESHOLD: u32 = 259_200;

/// TTL for temporary storage entries (~1 day).
pub const TEMP_BUMP_LEDGERS: u32 = LEDGERS_PER_DAY;

// ─── Types ────────────────────────────────────────────────────────────────────

/// Classifies a storage key by its Soroban storage tier.
#[contracttype]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum StorageTier {
    /// Renewed automatically on every invocation; no manual bump needed.
    Instance,
    /// Independent TTL; must be bumped manually to survive inactivity.
    Persistent,
    /// Ephemeral; only survives within the current transaction group.
    Temporary,
}

/// Per-operation storage cost description.
///
/// Used to document and verify the storage write budget of each entrypoint.
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct RentBudgetEntry {
    /// Name of the entrypoint (e.g., `"mint"`, `"transfer"`).
    pub entrypoint: &'static str,
    /// Number of instance storage writes.
    pub instance_writes: u32,
    /// Number of persistent storage writes.
    pub persistent_writes: u32,
    /// Number of temporary storage writes.
    pub temporary_writes: u32,
}

impl RentBudgetEntry {
    /// Total storage writes across all tiers.
    pub fn total_writes(&self) -> u32 {
        self.instance_writes + self.persistent_writes + self.temporary_writes
    }

    /// Returns `true` if this operation writes to persistent storage (and thus
    /// requires TTL management).
    pub fn touches_persistent(&self) -> bool {
        self.persistent_writes > 0
    }
}

// ─── TTL helpers ──────────────────────────────────────────────────────────────

/// Extends the instance storage TTL to at least `INSTANCE_BUMP_LEDGERS`
/// if the current TTL is below `INSTANCE_BUMP_THRESHOLD`.
///
/// Call this from any entrypoint that reads instance storage in a
/// read-heavy path where the contract may not be invoked for weeks.
pub fn bump_instance(env: &Env) {
    env.storage()
        .instance()
        .extend_ttl(INSTANCE_BUMP_THRESHOLD, INSTANCE_BUMP_LEDGERS);
}

/// Extends the TTL of a **persistent** storage entry identified by `key`.
///
/// Soroban's `extend_ttl(threshold, target)` is a no-op when the entry's
/// remaining TTL is already above `threshold`, so it is safe to call on
/// every mutation path without paying the bump cost unnecessarily.
pub fn bump_persistent<K>(env: &Env, key: &K)
where
    K: soroban_sdk::IntoVal<Env, soroban_sdk::Val>,
{
    env.storage()
        .persistent()
        .extend_ttl(key, PERSISTENT_BUMP_THRESHOLD, PERSISTENT_BUMP_LEDGERS);
}

// ─── Tests ────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::{contracttype, Env};

    #[contracttype]
    #[derive(Clone)]
    enum TestKey {
        Foo,
    }

    #[test]
    fn test_ledger_constants_are_consistent() {
        assert!(INSTANCE_BUMP_LEDGERS > INSTANCE_BUMP_THRESHOLD);
        assert!(PERSISTENT_BUMP_LEDGERS > PERSISTENT_BUMP_THRESHOLD);
        assert_eq!(INSTANCE_BUMP_LEDGERS, PERSISTENT_BUMP_LEDGERS);
        assert_eq!(INSTANCE_BUMP_THRESHOLD, PERSISTENT_BUMP_THRESHOLD);
        assert_eq!(TEMP_BUMP_LEDGERS, LEDGERS_PER_DAY);
    }

    #[test]
    fn test_instance_bump_is_approximately_30_days() {
        let days = INSTANCE_BUMP_LEDGERS / LEDGERS_PER_DAY;
        assert_eq!(days, 30);
    }

    #[test]
    fn test_temp_bump_is_approximately_1_day() {
        let days = TEMP_BUMP_LEDGERS / LEDGERS_PER_DAY;
        assert_eq!(days, 1);
    }

    #[test]
    fn test_storage_tier_variants_are_distinct() {
        assert_ne!(StorageTier::Instance, StorageTier::Persistent);
        assert_ne!(StorageTier::Instance, StorageTier::Temporary);
        assert_ne!(StorageTier::Persistent, StorageTier::Temporary);
    }

    #[test]
    fn test_storage_tier_clone() {
        let tier = StorageTier::Persistent;
        assert_eq!(tier.clone(), StorageTier::Persistent);
    }

    #[test]
    fn test_rent_budget_entry_total_writes() {
        let entry = RentBudgetEntry {
            entrypoint: "transfer",
            instance_writes: 0,
            persistent_writes: 2,
            temporary_writes: 0,
        };
        assert_eq!(entry.total_writes(), 2);
        assert!(entry.touches_persistent());
    }

    #[test]
    fn test_rent_budget_entry_read_only_has_zero_writes() {
        let entry = RentBudgetEntry {
            entrypoint: "balance",
            instance_writes: 0,
            persistent_writes: 0,
            temporary_writes: 0,
        };
        assert_eq!(entry.total_writes(), 0);
        assert!(!entry.touches_persistent());
    }

    #[test]
    fn test_rent_budget_entry_initialize_writes() {
        let entry = RentBudgetEntry {
            entrypoint: "initialize",
            instance_writes: 3,
            persistent_writes: 1,
            temporary_writes: 0,
        };
        assert_eq!(entry.total_writes(), 4);
        assert!(entry.touches_persistent());
    }

    #[test]
    fn test_known_operations_budget_table() {
        let table: &[RentBudgetEntry] = &[
            RentBudgetEntry { entrypoint: "initialize", instance_writes: 3, persistent_writes: 1, temporary_writes: 0 },
            RentBudgetEntry { entrypoint: "mint",        instance_writes: 1, persistent_writes: 1, temporary_writes: 0 },
            RentBudgetEntry { entrypoint: "transfer",    instance_writes: 0, persistent_writes: 2, temporary_writes: 0 },
            RentBudgetEntry { entrypoint: "approve",     instance_writes: 0, persistent_writes: 1, temporary_writes: 0 },
            RentBudgetEntry { entrypoint: "burn",        instance_writes: 1, persistent_writes: 1, temporary_writes: 0 },
            RentBudgetEntry { entrypoint: "balance",     instance_writes: 0, persistent_writes: 0, temporary_writes: 0 },
        ];
        for entry in table {
            assert!(
                entry.total_writes() <= 4,
                "entrypoint '{}' exceeds write budget: {}",
                entry.entrypoint,
                entry.total_writes()
            );
        }
        let read_count = table.iter().filter(|e| !e.touches_persistent()).count();
        assert!(read_count > 0, "expected at least one read-only operation");
    }

    #[test]
    fn test_bump_instance_does_not_panic() {
        let env = Env::default();
        bump_instance(&env);
    }

    #[test]
    fn test_bump_persistent_does_not_panic_on_missing_key() {
        let env = Env::default();
        // Key doesn't exist yet — extend_ttl on a missing key is a no-op in the test env.
        bump_persistent(&env, &TestKey::Foo);
    }

    #[test]
    fn test_storage_tier_used_in_match() {
        let tier = StorageTier::Persistent;
        let description = match tier {
            StorageTier::Instance => "instance",
            StorageTier::Persistent => "persistent",
            StorageTier::Temporary => "temporary",
        };
        assert_eq!(description, "persistent");
    }
}
