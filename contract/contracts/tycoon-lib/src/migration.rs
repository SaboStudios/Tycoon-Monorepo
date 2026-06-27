// Upgrade / migration key governance for Tycoon contracts.
//
// ## Migration pattern
//
// Every Tycoon contract stores a monotonically-increasing `StateVersion` in
// instance storage (key: `DataKey::StateVersion`).  The lifecycle is:
//
//   1. `initialize` — sets `StateVersion` to `INITIAL_STATE_VERSION` (1).
//   2. `admin_migrate` — called by the admin after a WASM upgrade.  Each call
//      increments the version by exactly 1.  Steps must be sequential.
//   3. Running at the target version — `admin_migrate` is a no-op (idempotent).
//
// ## Key governance rules
//
// 1. Only the admin/owner address may call migration entrypoints.
// 2. Each `admin_migrate` call must advance the version by exactly 1
//    (`is_valid_migration_step` enforces this).
// 3. Migration functions must be idempotent — re-running at the current
//    version must be a safe no-op.
// 4. After a WASM upgrade the admin should call `admin_migrate` to signal
//    consumers that state-schema changes have been applied.
// 5. The admin key used to trigger migration should be rotated after the
//    upgrade succeeds, using `admin_transfer_ownership`, to limit the blast
//    radius of a compromised key.
//
// ## Implementation template
//
// ```ignore
// pub fn admin_migrate(env: Env) {
//     Self::require_admin(&env);
//     let current = storage::get_state_version(&env);
//     if tycoon_lib::migration::is_migration_needed(current, 2) {
//         // apply v1 → v2 schema changes here
//         storage::set_state_version(&env, 2);
//     }
//     // already at v2 — safe no-op
// }
// ```
//
// ## Version table (update in each contract's source)
//
// | Version | Change                                              |
// |---------|-----------------------------------------------------|
// | 1       | Initial schema set during `initialize`.             |
// | 2+      | Future: add rows here as migrations are applied.   |

/// Monotonically-increasing version number for a contract's state schema.
///
/// Stored as `DataKey::StateVersion` in instance storage.  The Soroban host
/// refreshes instance TTL on every invocation, so no explicit `extend_ttl`
/// call is needed for this key.
pub type StateVersion = u32;

/// The version assigned during `initialize`.  All Tycoon contracts start here.
pub const INITIAL_STATE_VERSION: StateVersion = 1;

/// Returns `true` when migrating from `from` to `to` is a valid single step.
///
/// A valid migration step must increment the version by exactly 1.  Skipping
/// versions or decrementing is rejected to preserve the sequential invariant.
///
/// # Examples
///
/// ```
/// use tycoon_lib::migration::is_valid_migration_step;
/// assert!(is_valid_migration_step(1, 2));   // v1 → v2: valid
/// assert!(!is_valid_migration_step(1, 3));  // v1 → v3: skip — invalid
/// assert!(!is_valid_migration_step(2, 1));  // downgrade — invalid
/// assert!(!is_valid_migration_step(0, 0));  // no-op at zero — invalid
/// ```
pub fn is_valid_migration_step(from: StateVersion, to: StateVersion) -> bool {
    to == from.saturating_add(1) && to > from
}

/// Returns `true` when `current` is strictly less than `target`, meaning a
/// migration to `target` is still required.
///
/// Use this inside `admin_migrate` to make each version transition idempotent:
/// skip the migration body when the contract is already at or beyond `target`.
///
/// # Examples
///
/// ```
/// use tycoon_lib::migration::is_migration_needed;
/// assert!(is_migration_needed(1, 2));   // needs upgrading
/// assert!(!is_migration_needed(2, 2));  // already at target
/// assert!(!is_migration_needed(3, 2));  // beyond target — also no-op
/// ```
pub fn is_migration_needed(current: StateVersion, target: StateVersion) -> bool {
    current < target
}

#[cfg(test)]
mod tests {
    use super::*;

    // ── INITIAL_STATE_VERSION ────────────────────────────────────────────────

    #[test]
    fn test_initial_state_version_is_one() {
        assert_eq!(INITIAL_STATE_VERSION, 1);
    }

    // ── is_valid_migration_step ──────────────────────────────────────────────

    #[test]
    fn test_valid_step_one_to_two() {
        assert!(is_valid_migration_step(1, 2));
    }

    #[test]
    fn test_valid_step_two_to_three() {
        assert!(is_valid_migration_step(2, 3));
    }

    #[test]
    fn test_valid_step_zero_to_one() {
        assert!(is_valid_migration_step(0, 1));
    }

    #[test]
    fn test_invalid_skip_version() {
        // Skipping from v1 to v3 is not allowed.
        assert!(!is_valid_migration_step(1, 3));
    }

    #[test]
    fn test_invalid_downgrade() {
        // Downgrading from v2 to v1 is not allowed.
        assert!(!is_valid_migration_step(2, 1));
    }

    #[test]
    fn test_invalid_same_version() {
        // Staying at the same version is not a valid migration step.
        assert!(!is_valid_migration_step(1, 1));
        assert!(!is_valid_migration_step(0, 0));
    }

    #[test]
    fn test_invalid_large_skip() {
        assert!(!is_valid_migration_step(1, 100));
    }

    #[test]
    fn test_saturating_add_prevents_overflow() {
        // u32::MAX + 1 saturates to u32::MAX, which cannot equal u32::MAX + 1.
        assert!(!is_valid_migration_step(u32::MAX, u32::MAX.saturating_add(1)));
    }

    // ── is_migration_needed ──────────────────────────────────────────────────

    #[test]
    fn test_migration_needed_when_current_less_than_target() {
        assert!(is_migration_needed(1, 2));
        assert!(is_migration_needed(0, 1));
        assert!(is_migration_needed(1, 10));
    }

    #[test]
    fn test_no_migration_needed_when_at_target() {
        assert!(!is_migration_needed(2, 2));
        assert!(!is_migration_needed(1, 1));
    }

    #[test]
    fn test_no_migration_needed_when_beyond_target() {
        // Already past target — also a safe no-op.
        assert!(!is_migration_needed(3, 2));
        assert!(!is_migration_needed(10, 5));
    }

    // ── Idempotency invariant ────────────────────────────────────────────────

    #[test]
    fn test_idempotent_migration_pattern() {
        // Simulates the pattern used inside admin_migrate.
        let mut current: StateVersion = INITIAL_STATE_VERSION;
        let target: StateVersion = 2;

        if is_migration_needed(current, target) {
            assert!(is_valid_migration_step(current, target));
            current = target;
        }

        // Re-running must be a no-op.
        let was_needed = is_migration_needed(current, target);
        assert!(!was_needed, "second call must be a no-op");
        assert_eq!(current, 2);
    }

    #[test]
    fn test_sequential_migrations() {
        // Three sequential migrations: v1 → v2 → v3 → v4.
        let mut version: StateVersion = INITIAL_STATE_VERSION;
        for target in [2, 3, 4] {
            assert!(is_migration_needed(version, target));
            assert!(is_valid_migration_step(version, target));
            version = target;
        }
        assert_eq!(version, 4);
        // No further migration needed.
        assert!(!is_migration_needed(version, 4));
    }
}
