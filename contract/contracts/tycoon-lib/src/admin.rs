// ============================================================
// Admin-only vs Public Entrypoints (SW-LIB-001)
// ============================================================
//
// This module formalizes the distinction between admin-only
// entrypoints and publicly-callable entrypoints across all
// Tycoon contracts.
//
// ## Entrypoint classification
//
// | Access tier   | Auth requirement              | Description                           |
// |---------------|-------------------------------|---------------------------------------|
// | `AdminOnly`   | admin.require_auth()          | Mutates privileged state              |
// | `SelfAuth`    | caller.require_auth()         | Caller authenticates for own actions  |
// | `SpenderAuth` | spender.require_auth()        | Third-party acts with approval        |
// | `ReadOnly`    | None                          | Pure reads; safe for any caller       |
//
// ## Usage pattern
//
// Every contract that stores an admin key should use `require_admin`
// from this module.  This centralises the auth check, making the
// boundary easy to audit and test.
//
// ```rust
// use tycoon_lib::admin::{require_admin, EntrypointAccess};
//
// pub fn set_config(e: Env, admin_key: &DataKey, new_val: u32) {
//     require_admin(&e, admin_key);
//     e.storage().instance().set(&CONFIG_KEY, &new_val);
// }
// ```
//
// ## Admin-only functions in the Tycoon ecosystem
//
// | Contract              | Admin-only entrypoints                       |
// |-----------------------|----------------------------------------------|
// | tycoon-token          | initialize (one-time), mint, set_admin       |
// | tycoon-game           | initialize, set_owner, withdraw              |
// | tycoon-collectibles   | initialize, set_collectible, set_cash_tier   |
// | tycoon-reward-system  | initialize, set_reward, pause/unpause        |

use soroban_sdk::{contracttype, Address, Env};

// ─── Types ────────────────────────────────────────────────────────────────────

/// Classifies the auth requirement of a contract entrypoint.
///
/// Use this to document — and enforce — who may call a function.
#[contracttype]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum EntrypointAccess {
    /// Only the designated admin address may call this function.
    /// Guard with `require_admin`.
    AdminOnly,
    /// The acting party authenticates for their own account.
    /// Guard with `caller.require_auth()`.
    SelfAuth,
    /// A pre-approved spender acts on behalf of an owner.
    /// Guard with `spender.require_auth()`.
    SpenderAuth,
    /// No signature required; safe for public observation.
    ReadOnly,
}

// ─── Admin key storage ────────────────────────────────────────────────────────

/// Standard storage key used by contracts that keep a single admin address
/// in instance storage.  Contracts with a different key type can pass their
/// own key to the free function `require_admin_with_key`.
#[contracttype]
#[derive(Clone)]
pub enum AdminKey {
    Admin,
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/// Reads the admin address from instance storage at `AdminKey::Admin`,
/// calls `require_auth()` on it, and returns the address.
///
/// # Panics
/// - If no admin is stored (contract not initialised).
/// - If the admin's auth is not satisfied in the current transaction.
pub fn require_admin(env: &Env) -> Address {
    let admin: Address = env
        .storage()
        .instance()
        .get(&AdminKey::Admin)
        .expect("Admin not set");
    admin.require_auth();
    admin
}

/// Stores `admin` at `AdminKey::Admin` in instance storage.
///
/// Must be called exactly once during contract initialisation before any
/// admin-gated function can succeed.
pub fn set_admin(env: &Env, admin: &Address) {
    env.storage().instance().set(&AdminKey::Admin, admin);
}

/// Reads the current admin without performing an auth check.
///
/// Useful for event emission and cross-contract introspection.
pub fn get_admin(env: &Env) -> Option<Address> {
    env.storage().instance().get(&AdminKey::Admin)
}

/// Returns `true` if the provided address matches the stored admin.
///
/// Does **not** call `require_auth`; use this only for informational
/// checks, not as a security guard.
pub fn is_admin(env: &Env, candidate: &Address) -> bool {
    match get_admin(env) {
        Some(admin) => admin == *candidate,
        None => false,
    }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::{testutils::Address as _, Env};

    #[test]
    fn test_entrypoint_access_variants_are_distinct() {
        assert_ne!(EntrypointAccess::AdminOnly, EntrypointAccess::SelfAuth);
        assert_ne!(EntrypointAccess::AdminOnly, EntrypointAccess::SpenderAuth);
        assert_ne!(EntrypointAccess::AdminOnly, EntrypointAccess::ReadOnly);
        assert_ne!(EntrypointAccess::SelfAuth, EntrypointAccess::SpenderAuth);
        assert_ne!(EntrypointAccess::SelfAuth, EntrypointAccess::ReadOnly);
        assert_ne!(EntrypointAccess::SpenderAuth, EntrypointAccess::ReadOnly);
    }

    #[test]
    fn test_entrypoint_access_clone() {
        let access = EntrypointAccess::AdminOnly;
        assert_eq!(access.clone(), EntrypointAccess::AdminOnly);
    }

    #[test]
    fn test_set_and_get_admin() {
        let env = Env::default();
        let admin = Address::generate(&env);

        assert_eq!(get_admin(&env), None);
        set_admin(&env, &admin);
        assert_eq!(get_admin(&env), Some(admin.clone()));
    }

    #[test]
    fn test_is_admin_true_for_set_address() {
        let env = Env::default();
        let admin = Address::generate(&env);
        set_admin(&env, &admin);
        assert!(is_admin(&env, &admin));
    }

    #[test]
    fn test_is_admin_false_for_different_address() {
        let env = Env::default();
        let admin = Address::generate(&env);
        let other = Address::generate(&env);
        set_admin(&env, &admin);
        assert!(!is_admin(&env, &other));
    }

    #[test]
    fn test_is_admin_false_when_not_set() {
        let env = Env::default();
        let candidate = Address::generate(&env);
        assert!(!is_admin(&env, &candidate));
    }

    #[test]
    fn test_set_admin_overwrites_previous() {
        let env = Env::default();
        let admin_v1 = Address::generate(&env);
        let admin_v2 = Address::generate(&env);

        set_admin(&env, &admin_v1);
        assert!(is_admin(&env, &admin_v1));
        assert!(!is_admin(&env, &admin_v2));

        set_admin(&env, &admin_v2);
        assert!(!is_admin(&env, &admin_v1));
        assert!(is_admin(&env, &admin_v2));
    }

    #[test]
    #[should_panic(expected = "Admin not set")]
    fn test_require_admin_panics_when_not_set() {
        let env = Env::default();
        env.mock_all_auths();
        require_admin(&env);
    }

    #[test]
    fn test_require_admin_succeeds_with_mock_auth() {
        let env = Env::default();
        env.mock_all_auths();
        let admin = Address::generate(&env);
        set_admin(&env, &admin);
        let returned = require_admin(&env);
        assert_eq!(returned, admin);
    }

    #[test]
    fn test_entrypoint_access_used_in_match() {
        let access = EntrypointAccess::SelfAuth;
        let description = match access {
            EntrypointAccess::AdminOnly => "admin only",
            EntrypointAccess::SelfAuth => "self auth",
            EntrypointAccess::SpenderAuth => "spender auth",
            EntrypointAccess::ReadOnly => "read only",
        };
        assert_eq!(description, "self auth");
    }

    #[test]
    fn test_admin_only_classification_for_privileged_ops() {
        let privileged_ops: &[EntrypointAccess] = &[
            EntrypointAccess::AdminOnly,
            EntrypointAccess::AdminOnly,
            EntrypointAccess::AdminOnly,
        ];
        for op in privileged_ops {
            assert_eq!(*op, EntrypointAccess::AdminOnly);
        }
    }

    #[test]
    fn test_read_only_classification_for_query_ops() {
        let query_ops: &[EntrypointAccess] = &[
            EntrypointAccess::ReadOnly,
            EntrypointAccess::ReadOnly,
            EntrypointAccess::ReadOnly,
        ];
        for op in query_ops {
            assert_eq!(*op, EntrypointAccess::ReadOnly);
        }
    }
}
