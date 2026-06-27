// Admin-only vs public entrypoint formalization for Tycoon contracts.
//
// ## Design contract
//
// Every Tycoon contract splits its `#[contractimpl]` surface into three tiers:
//
// | Tier                | Guard                              | Block label           |
// |---------------------|------------------------------------|-----------------------|
// | One-time initializer | None (admin does not exist yet)   | `// ── Initialize ──` |
// | Admin-only          | `require_admin_auth(admin)`        | `// ── Admin-only ──` |
// | Public              | `caller.require_auth()` (or none)  | `// ── Public ──`     |
//
// Contracts expose this structure via `#[contractimpl]` block comments so
// that any auditor can identify access tiers by reading top-to-bottom.
//
// ## Deprecated shims
//
// When entrypoint names are renamed, the old names are kept as thin wrapper
// shims decorated with `#[deprecated]`.  They delegate to the canonical
// `admin_*` form and will be removed in the next major version.  See
// `tycoon-game` for the reference implementation.
//
// ## Usage pattern (copy into each contract)
//
// ```ignore
// impl MyContract {
//     fn require_admin(env: &Env) -> Address {
//         let admin: Address = env.storage().instance()
//             .get(&DataKey::Admin)
//             .expect("Contract not initialized");
//         tycoon_lib::access_control::require_admin_auth(&admin);
//         admin
//     }
// }
// ```

use soroban_sdk::Address;

/// Marker documenting the access tier of a Tycoon contract entrypoint.
///
/// Attach this type to documentation tables in contract source files to make
/// access requirements explicit and auditable.  There is no runtime enforcement
/// in `tycoon-lib` itself — each contract's `require_admin_auth` call is the
/// enforcement point.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum EntrypointKind {
    /// Called exactly once during deployment.  No admin key exists yet, so no
    /// `require_auth` is performed at this tier.
    OneTimeInitializer,
    /// Callable only by the stored admin/owner address.
    ///
    /// Every function in this tier **must** call `require_admin_auth(admin)` as
    /// its first statement before reading or mutating any state.
    AdminOnly,
    /// Callable by any address, subject to the entrypoint's own auth checks.
    ///
    /// User-mutating functions **must** call `caller.require_auth()`.
    /// Pure read-only functions require no auth.
    Public,
}

/// Require that `admin` has authorized the current invocation.
///
/// This is the canonical guard for admin-only entrypoints.  Contracts define a
/// private `require_admin(env)` helper that reads the stored admin address from
/// instance storage and delegates to this function:
///
/// ```ignore
/// fn require_admin(env: &Env) -> Address {
///     let admin: Address = env.storage().instance()
///         .get(&DataKey::Admin)
///         .expect("Contract not initialized");
///     tycoon_lib::access_control::require_admin_auth(&admin);
///     admin
/// }
/// ```
///
/// # Panics
///
/// Panics (via the Soroban host) if `admin` has not signed the current
/// transaction.
pub fn require_admin_auth(admin: &Address) {
    admin.require_auth();
}

#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::{testutils::Address as _, Env};

    #[test]
    fn test_entrypoint_kind_variants_are_distinct() {
        assert_ne!(EntrypointKind::OneTimeInitializer, EntrypointKind::AdminOnly);
        assert_ne!(EntrypointKind::AdminOnly, EntrypointKind::Public);
        assert_ne!(EntrypointKind::OneTimeInitializer, EntrypointKind::Public);
    }

    #[test]
    fn test_entrypoint_kind_eq_reflexive() {
        assert_eq!(
            EntrypointKind::OneTimeInitializer,
            EntrypointKind::OneTimeInitializer
        );
        assert_eq!(EntrypointKind::AdminOnly, EntrypointKind::AdminOnly);
        assert_eq!(EntrypointKind::Public, EntrypointKind::Public);
    }

    #[test]
    fn test_entrypoint_kind_can_be_cloned() {
        let k = EntrypointKind::AdminOnly;
        assert_eq!(k, k.clone());
    }

    #[test]
    fn test_require_admin_auth_succeeds_when_mocked() {
        let env = Env::default();
        env.mock_all_auths();
        let admin = soroban_sdk::Address::generate(&env);
        // Must not panic when auth is mocked.
        require_admin_auth(&admin);
    }

    #[test]
    fn test_entrypoint_kind_match_is_exhaustive() {
        let kinds = [
            EntrypointKind::OneTimeInitializer,
            EntrypointKind::AdminOnly,
            EntrypointKind::Public,
        ];
        for kind in &kinds {
            let label = match kind {
                EntrypointKind::OneTimeInitializer => "init",
                EntrypointKind::AdminOnly => "admin",
                EntrypointKind::Public => "public",
            };
            assert!(!label.is_empty());
        }
    }
}
