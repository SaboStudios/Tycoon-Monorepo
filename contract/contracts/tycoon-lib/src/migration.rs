// ============================================================
// Upgrade / Migration Key Governance (SW-LIB-004)
// ============================================================
//
// Soroban contracts are immutable once deployed, but the host
// platform exposes a `update_current_contract_wasm` function that
// replaces the WASM blob at the contract's address.  This is the
// primary upgrade mechanism for Tycoon contracts.
//
// ## Threat model
//
// Without governance controls, any admin can silently replace the
// contract WASM, potentially:
// - Introducing backdoors or rug-pull logic.
// - Breaking the state schema that on-chain data was written with.
// - Bypassing the access control the community expects.
//
// ## Governance model
//
// tycoon-lib provides shared types and helpers for upgrade governance:
//
// 1. **MigrationKey** — Associates a state schema version with the
//    ledger at which it was set.  Contracts store this alongside
//    their admin key so the schema version is always readable.
//
// 2. **MigrationGuard** — Records the pending upgrade: the new WASM
//    hash and the earliest ledger at which the upgrade can execute.
//    This enforces a time-lock between proposing and executing.
//
// 3. **MigrationState** — Tracks whether an upgrade is currently
//    pending, completed, or whether the contract has never been
//    upgraded.
//
// ## Time-lock policy
//
// | Constant                   | Value (ledgers) | Approx wall-clock |
// |----------------------------|-----------------|-------------------|
// | MIN_UPGRADE_DELAY_LEDGERS  | 17_280          | ~1 day            |
// | DEFAULT_UPGRADE_DELAY      | 51_840          | ~3 days           |
//
// The delay gives stakeholders time to review the proposed WASM before
// it takes effect.  A multisig admin can veto by rotating the key.
//
// ## State schema versioning
//
// Every contract that stores persistent user data must increment
// `state_version` on every deployment that changes the storage schema.
// Indexers and client libraries read this version to decide whether
// to re-derive cached data.
//
// Contracts must **never** decrement the version.

use soroban_sdk::contracttype;

// ─── Constants ────────────────────────────────────────────────────────────────

/// Minimum time-lock delay for an upgrade proposal (≈ 1 day at 5-s cadence).
pub const MIN_UPGRADE_DELAY_LEDGERS: u32 = 17_280;

/// Default time-lock delay for an upgrade proposal (≈ 3 days).
pub const DEFAULT_UPGRADE_DELAY: u32 = 51_840;

/// The initial state schema version for a freshly deployed contract.
pub const INITIAL_STATE_VERSION: u32 = 1;

// ─── Types ────────────────────────────────────────────────────────────────────

/// Associates a state schema version with the ledger it was set on.
///
/// Stored in instance storage alongside the admin key so that any
/// observer can identify the current data layout without calling
/// the contract.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct MigrationKey {
    /// Monotonically increasing schema version.  Start at
    /// `INITIAL_STATE_VERSION` and increment by 1 on each
    /// schema-breaking upgrade.
    pub version: u32,
    /// Ledger sequence number when this version was set.
    pub set_at_ledger: u32,
}

impl MigrationKey {
    /// Creates a key for the initial deployment.
    pub fn initial(current_ledger: u32) -> Self {
        Self {
            version: INITIAL_STATE_VERSION,
            set_at_ledger: current_ledger,
        }
    }

    /// Advances the version by 1 and records the current ledger.
    ///
    /// # Panics
    /// Panics on overflow (version > u32::MAX), which is unreachable in practice.
    pub fn next(&self, current_ledger: u32) -> Self {
        Self {
            version: self.version.checked_add(1).expect("version overflow"),
            set_at_ledger: current_ledger,
        }
    }

    /// Returns `true` if `other` is a valid successor of `self`.
    ///
    /// A valid successor has `version == self.version + 1` and
    /// `set_at_ledger >= self.set_at_ledger`.
    pub fn is_valid_successor(&self, other: &MigrationKey) -> bool {
        other.version == self.version + 1 && other.set_at_ledger >= self.set_at_ledger
    }
}

/// Lifecycle state of an upgrade proposal.
#[contracttype]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum MigrationState {
    /// No upgrade has ever been proposed or executed.
    None,
    /// An upgrade has been proposed and is waiting for the time-lock to expire.
    Pending,
    /// The upgrade has been executed; the WASM has been replaced.
    Completed,
    /// The upgrade proposal was cancelled before execution.
    Cancelled,
}

/// An in-flight upgrade proposal.
///
/// Stored in instance storage when an admin proposes an upgrade.
/// The upgrade may only be executed after `earliest_execute_ledger`
/// has passed.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct MigrationGuard {
    /// SHA-256 hash of the new WASM blob (as stored on the network).
    pub new_wasm_hash: soroban_sdk::BytesN<32>,
    /// Ledger sequence after which `execute_upgrade` may be called.
    pub earliest_execute_ledger: u32,
    /// The schema version that the new WASM expects.
    pub target_version: u32,
    /// Current state of the proposal.
    pub state: MigrationState,
}

impl MigrationGuard {
    /// Returns `true` if the time-lock has expired and the upgrade can
    /// be executed at `current_ledger`.
    pub fn is_executable(&self, current_ledger: u32) -> bool {
        self.state == MigrationState::Pending
            && current_ledger >= self.earliest_execute_ledger
    }

    /// Returns `true` if the proposal is still in the time-lock window.
    pub fn is_locked(&self, current_ledger: u32) -> bool {
        self.state == MigrationState::Pending
            && current_ledger < self.earliest_execute_ledger
    }
}

// ─── Governance helpers ───────────────────────────────────────────────────────

/// Validates that a proposed upgrade delay meets the minimum requirement.
///
/// # Errors (via panic)
/// Panics if `delay < MIN_UPGRADE_DELAY_LEDGERS`.
pub fn assert_valid_upgrade_delay(delay: u32) {
    if delay < MIN_UPGRADE_DELAY_LEDGERS {
        panic!("Upgrade delay below minimum");
    }
}

/// Validates that a new schema version is a strict increment over the current.
///
/// # Errors (via panic)
/// Panics if `new_version != current_version + 1`.
pub fn assert_valid_version_increment(current_version: u32, new_version: u32) {
    if new_version != current_version.saturating_add(1) {
        panic!("Invalid version increment");
    }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::{BytesN, Env};

    fn dummy_hash(env: &Env) -> BytesN<32> {
        BytesN::from_array(env, &[0u8; 32])
    }

    // ── MigrationKey ──────────────────────────────────────────────────────────

    #[test]
    fn test_migration_key_initial() {
        let key = MigrationKey::initial(100);
        assert_eq!(key.version, INITIAL_STATE_VERSION);
        assert_eq!(key.set_at_ledger, 100);
    }

    #[test]
    fn test_migration_key_next_increments_version() {
        let key = MigrationKey::initial(100);
        let next = key.next(200);
        assert_eq!(next.version, 2);
        assert_eq!(next.set_at_ledger, 200);
    }

    #[test]
    fn test_migration_key_is_valid_successor() {
        let v1 = MigrationKey::initial(100);
        let v2 = v1.next(200);
        assert!(v1.is_valid_successor(&v2));
    }

    #[test]
    fn test_migration_key_invalid_successor_same_version() {
        let v1 = MigrationKey::initial(100);
        let same = MigrationKey { version: 1, set_at_ledger: 200 };
        assert!(!v1.is_valid_successor(&same));
    }

    #[test]
    fn test_migration_key_invalid_successor_skip_version() {
        let v1 = MigrationKey::initial(100);
        let skip = MigrationKey { version: 3, set_at_ledger: 200 };
        assert!(!v1.is_valid_successor(&skip));
    }

    #[test]
    fn test_migration_key_invalid_successor_older_ledger() {
        let v1 = MigrationKey { version: 1, set_at_ledger: 200 };
        let regressed = MigrationKey { version: 2, set_at_ledger: 100 };
        assert!(!v1.is_valid_successor(&regressed));
    }

    #[test]
    fn test_migration_key_clone() {
        let key = MigrationKey::initial(50);
        let clone = key.clone();
        assert_eq!(key, clone);
    }

    // ── MigrationState ────────────────────────────────────────────────────────

    #[test]
    fn test_migration_state_variants_are_distinct() {
        assert_ne!(MigrationState::None, MigrationState::Pending);
        assert_ne!(MigrationState::None, MigrationState::Completed);
        assert_ne!(MigrationState::None, MigrationState::Cancelled);
        assert_ne!(MigrationState::Pending, MigrationState::Completed);
        assert_ne!(MigrationState::Pending, MigrationState::Cancelled);
        assert_ne!(MigrationState::Completed, MigrationState::Cancelled);
    }

    #[test]
    fn test_migration_state_used_in_match() {
        let state = MigrationState::Pending;
        let label = match state {
            MigrationState::None => "none",
            MigrationState::Pending => "pending",
            MigrationState::Completed => "completed",
            MigrationState::Cancelled => "cancelled",
        };
        assert_eq!(label, "pending");
    }

    // ── MigrationGuard ────────────────────────────────────────────────────────

    #[test]
    fn test_migration_guard_is_executable_after_lock() {
        let env = Env::default();
        let guard = MigrationGuard {
            new_wasm_hash: dummy_hash(&env),
            earliest_execute_ledger: 1000,
            target_version: 2,
            state: MigrationState::Pending,
        };
        assert!(!guard.is_executable(999));
        assert!(guard.is_executable(1000));
        assert!(guard.is_executable(1001));
    }

    #[test]
    fn test_migration_guard_is_locked_before_deadline() {
        let env = Env::default();
        let guard = MigrationGuard {
            new_wasm_hash: dummy_hash(&env),
            earliest_execute_ledger: 500,
            target_version: 2,
            state: MigrationState::Pending,
        };
        assert!(guard.is_locked(100));
        assert!(guard.is_locked(499));
        assert!(!guard.is_locked(500));
    }

    #[test]
    fn test_migration_guard_not_executable_if_completed() {
        let env = Env::default();
        let guard = MigrationGuard {
            new_wasm_hash: dummy_hash(&env),
            earliest_execute_ledger: 100,
            target_version: 2,
            state: MigrationState::Completed,
        };
        assert!(!guard.is_executable(200));
        assert!(!guard.is_locked(50));
    }

    #[test]
    fn test_migration_guard_not_executable_if_cancelled() {
        let env = Env::default();
        let guard = MigrationGuard {
            new_wasm_hash: dummy_hash(&env),
            earliest_execute_ledger: 100,
            target_version: 2,
            state: MigrationState::Cancelled,
        };
        assert!(!guard.is_executable(200));
    }

    // ── Governance helpers ────────────────────────────────────────────────────

    #[test]
    fn test_assert_valid_upgrade_delay_passes_minimum() {
        assert_valid_upgrade_delay(MIN_UPGRADE_DELAY_LEDGERS);
        assert_valid_upgrade_delay(DEFAULT_UPGRADE_DELAY);
        assert_valid_upgrade_delay(u32::MAX);
    }

    #[test]
    #[should_panic(expected = "Upgrade delay below minimum")]
    fn test_assert_valid_upgrade_delay_rejects_below_minimum() {
        assert_valid_upgrade_delay(MIN_UPGRADE_DELAY_LEDGERS - 1);
    }

    #[test]
    fn test_assert_valid_version_increment_succeeds() {
        assert_valid_version_increment(1, 2);
        assert_valid_version_increment(5, 6);
    }

    #[test]
    #[should_panic(expected = "Invalid version increment")]
    fn test_assert_valid_version_increment_rejects_skip() {
        assert_valid_version_increment(1, 3);
    }

    #[test]
    #[should_panic(expected = "Invalid version increment")]
    fn test_assert_valid_version_increment_rejects_same() {
        assert_valid_version_increment(2, 2);
    }

    #[test]
    #[should_panic(expected = "Invalid version increment")]
    fn test_assert_valid_version_increment_rejects_decrement() {
        assert_valid_version_increment(3, 2);
    }

    #[test]
    fn test_constants_are_consistent() {
        assert!(DEFAULT_UPGRADE_DELAY >= MIN_UPGRADE_DELAY_LEDGERS);
        assert!(MIN_UPGRADE_DELAY_LEDGERS > 0);
        assert_eq!(INITIAL_STATE_VERSION, 1);
    }

    #[test]
    fn test_migration_key_chain() {
        let v1 = MigrationKey::initial(0);
        let v2 = v1.next(100);
        let v3 = v2.next(200);
        assert_eq!(v1.version, 1);
        assert_eq!(v2.version, 2);
        assert_eq!(v3.version, 3);
        assert!(v1.is_valid_successor(&v2));
        assert!(v2.is_valid_successor(&v3));
        assert!(!v1.is_valid_successor(&v3));
    }
}
