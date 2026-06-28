// ============================================================
// Cross-Contract Auth Matrix (SW-LIB-003)
// ============================================================
//
// In Soroban, cross-contract calls do NOT bypass auth checks.
// When contract A calls `contract_b.some_fn()`, the inner
// `require_auth()` call still validates the cryptographic
// signature present in the outer transaction envelope.
// There is no "trusted caller" bypass — auth is always
// cryptographic, not address-based trust.
//
// ## Design implications
//
// 1. A contract should never assume "if the caller is address X,
//    skip auth".  Soroban's `require_auth` validates the on-chain
//    signature no matter who calls.
//
// 2. For admin-only cross-contract operations (e.g., a reward contract
//    calling `token.mint()`), the admin must pre-sign the full call
//    tree, or the admin must be a contract that itself holds the key.
//
// 3. Read-only cross-contract calls (balance, allowance, etc.) need
//    no auth — they are safe to call from any context.
//
// ## Ecosystem auth matrix
//
// | Calling contract      | Target fn          | Required signer       |
// |-----------------------|--------------------|-----------------------|
// | tycoon-reward-system  | token.mint         | token admin           |
// | tycoon-collectibles   | token.transfer     | collectibles contract |
// | tycoon-game           | token.transfer     | game contract         |
// | tycoon-game           | reward.trigger     | game contract         |
// | any                   | token.balance      | — (read-only)         |
// | any                   | token.total_supply | — (read-only)         |
//
// `CallerKind` and `AuthRequirement` below capture this matrix as
// types so tests can assert the correct auth tier at compile time.

use soroban_sdk::contracttype;

// ─── Types ────────────────────────────────────────────────────────────────────

/// The category of entity that is making a cross-contract call.
#[contracttype]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum CallerKind {
    /// The designated admin of the target contract.
    Admin,
    /// The owner of a resource (e.g., token balance holder).
    Owner,
    /// An address pre-approved by an owner via `approve`.
    Spender,
    /// An arbitrary contract address — no pre-established trust.
    AnyContract,
    /// No caller required (read-only or public init).
    None,
}

/// The auth requirement imposed by a specific entrypoint.
#[contracttype]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum AuthRequirement {
    /// Entrypoint calls `admin.require_auth()`.
    AdminAuth,
    /// Entrypoint calls `caller.require_auth()` where caller owns the resource.
    OwnerAuth,
    /// Entrypoint calls `spender.require_auth()`.
    SpenderAuth,
    /// Entrypoint accepts any authenticated caller (`caller.require_auth()`).
    AnyAuth,
    /// No auth required (pure reads or one-time initialisation).
    NoAuth,
}

/// A single row in the cross-contract auth matrix.
///
/// Documents which auth tier a specific entrypoint requires and the
/// expected caller kind in a cross-contract invocation scenario.
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct AuthMatrixEntry {
    /// Name of the target entrypoint.
    pub entrypoint: &'static str,
    /// Auth requirement imposed by the entrypoint.
    pub requirement: AuthRequirement,
    /// Expected kind of cross-contract caller.
    pub expected_caller: CallerKind,
    /// Whether this entrypoint is safe to call from any contract without
    /// pre-arranged signing (i.e., read-only).
    pub is_read_only: bool,
}

impl AuthMatrixEntry {
    /// Returns `true` if this entry requires admin-level auth.
    pub fn requires_admin(&self) -> bool {
        self.requirement == AuthRequirement::AdminAuth
    }

    /// Returns `true` if this entrypoint can be safely called without a
    /// pre-arranged signature (pure reads).
    pub fn is_freely_callable(&self) -> bool {
        self.requirement == AuthRequirement::NoAuth
    }
}

// ─── Auth matrix for the Tycoon token contract ────────────────────────────────

/// Returns the canonical cross-contract auth matrix for tycoon-token.
///
/// This is a static description of entrypoints and their auth requirements.
/// Use it in tests to assert that entrypoint classification hasn't regressed.
pub fn tycoon_token_auth_matrix() -> &'static [AuthMatrixEntry] {
    &[
        AuthMatrixEntry { entrypoint: "initialize",   requirement: AuthRequirement::NoAuth,      expected_caller: CallerKind::None,        is_read_only: false },
        AuthMatrixEntry { entrypoint: "mint",         requirement: AuthRequirement::AdminAuth,   expected_caller: CallerKind::Admin,       is_read_only: false },
        AuthMatrixEntry { entrypoint: "set_admin",    requirement: AuthRequirement::AdminAuth,   expected_caller: CallerKind::Admin,       is_read_only: false },
        AuthMatrixEntry { entrypoint: "transfer",     requirement: AuthRequirement::OwnerAuth,   expected_caller: CallerKind::Owner,       is_read_only: false },
        AuthMatrixEntry { entrypoint: "transfer_from",requirement: AuthRequirement::SpenderAuth, expected_caller: CallerKind::Spender,     is_read_only: false },
        AuthMatrixEntry { entrypoint: "approve",      requirement: AuthRequirement::OwnerAuth,   expected_caller: CallerKind::Owner,       is_read_only: false },
        AuthMatrixEntry { entrypoint: "burn",         requirement: AuthRequirement::OwnerAuth,   expected_caller: CallerKind::Owner,       is_read_only: false },
        AuthMatrixEntry { entrypoint: "burn_from",    requirement: AuthRequirement::SpenderAuth, expected_caller: CallerKind::Spender,     is_read_only: false },
        AuthMatrixEntry { entrypoint: "balance",      requirement: AuthRequirement::NoAuth,      expected_caller: CallerKind::AnyContract, is_read_only: true  },
        AuthMatrixEntry { entrypoint: "allowance",    requirement: AuthRequirement::NoAuth,      expected_caller: CallerKind::AnyContract, is_read_only: true  },
        AuthMatrixEntry { entrypoint: "total_supply", requirement: AuthRequirement::NoAuth,      expected_caller: CallerKind::AnyContract, is_read_only: true  },
        AuthMatrixEntry { entrypoint: "decimals",     requirement: AuthRequirement::NoAuth,      expected_caller: CallerKind::AnyContract, is_read_only: true  },
        AuthMatrixEntry { entrypoint: "name",         requirement: AuthRequirement::NoAuth,      expected_caller: CallerKind::AnyContract, is_read_only: true  },
        AuthMatrixEntry { entrypoint: "symbol",       requirement: AuthRequirement::NoAuth,      expected_caller: CallerKind::AnyContract, is_read_only: true  },
        AuthMatrixEntry { entrypoint: "admin",        requirement: AuthRequirement::NoAuth,      expected_caller: CallerKind::AnyContract, is_read_only: true  },
    ]
}

// ─── Tests ────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_caller_kind_variants_are_distinct() {
        assert_ne!(CallerKind::Admin, CallerKind::Owner);
        assert_ne!(CallerKind::Admin, CallerKind::Spender);
        assert_ne!(CallerKind::Admin, CallerKind::AnyContract);
        assert_ne!(CallerKind::Admin, CallerKind::None);
        assert_ne!(CallerKind::Owner, CallerKind::Spender);
        assert_ne!(CallerKind::Owner, CallerKind::AnyContract);
        assert_ne!(CallerKind::Owner, CallerKind::None);
        assert_ne!(CallerKind::Spender, CallerKind::AnyContract);
        assert_ne!(CallerKind::Spender, CallerKind::None);
        assert_ne!(CallerKind::AnyContract, CallerKind::None);
    }

    #[test]
    fn test_auth_requirement_variants_are_distinct() {
        assert_ne!(AuthRequirement::AdminAuth, AuthRequirement::OwnerAuth);
        assert_ne!(AuthRequirement::AdminAuth, AuthRequirement::SpenderAuth);
        assert_ne!(AuthRequirement::AdminAuth, AuthRequirement::AnyAuth);
        assert_ne!(AuthRequirement::AdminAuth, AuthRequirement::NoAuth);
        assert_ne!(AuthRequirement::OwnerAuth, AuthRequirement::SpenderAuth);
        assert_ne!(AuthRequirement::OwnerAuth, AuthRequirement::NoAuth);
        assert_ne!(AuthRequirement::SpenderAuth, AuthRequirement::NoAuth);
    }

    #[test]
    fn test_auth_matrix_entry_requires_admin() {
        let mint = AuthMatrixEntry {
            entrypoint: "mint",
            requirement: AuthRequirement::AdminAuth,
            expected_caller: CallerKind::Admin,
            is_read_only: false,
        };
        assert!(mint.requires_admin());
        assert!(!mint.is_freely_callable());
    }

    #[test]
    fn test_auth_matrix_entry_read_only() {
        let balance = AuthMatrixEntry {
            entrypoint: "balance",
            requirement: AuthRequirement::NoAuth,
            expected_caller: CallerKind::AnyContract,
            is_read_only: true,
        };
        assert!(!balance.requires_admin());
        assert!(balance.is_freely_callable());
    }

    #[test]
    fn test_tycoon_token_matrix_admin_entries_require_admin() {
        let matrix = tycoon_token_auth_matrix();
        let admin_fns = ["mint", "set_admin"];
        for fn_name in admin_fns {
            let entry = matrix.iter().find(|e| e.entrypoint == fn_name)
                .unwrap_or_else(|| panic!("{fn_name} not in matrix"));
            assert!(entry.requires_admin(), "{fn_name} should require admin auth");
            assert_eq!(entry.expected_caller, CallerKind::Admin);
        }
    }

    #[test]
    fn test_tycoon_token_matrix_read_only_entries_are_freely_callable() {
        let matrix = tycoon_token_auth_matrix();
        let read_fns = ["balance", "allowance", "total_supply", "decimals", "name", "symbol", "admin"];
        for fn_name in read_fns {
            let entry = matrix.iter().find(|e| e.entrypoint == fn_name)
                .unwrap_or_else(|| panic!("{fn_name} not in matrix"));
            assert!(entry.is_freely_callable(), "{fn_name} should be freely callable");
            assert!(entry.is_read_only, "{fn_name} should be marked read_only");
        }
    }

    #[test]
    fn test_tycoon_token_matrix_owner_auth_entries() {
        let matrix = tycoon_token_auth_matrix();
        let owner_fns = ["transfer", "approve", "burn"];
        for fn_name in owner_fns {
            let entry = matrix.iter().find(|e| e.entrypoint == fn_name)
                .unwrap_or_else(|| panic!("{fn_name} not in matrix"));
            assert_eq!(entry.requirement, AuthRequirement::OwnerAuth, "{fn_name} should require OwnerAuth");
            assert_eq!(entry.expected_caller, CallerKind::Owner);
            assert!(!entry.is_read_only);
        }
    }

    #[test]
    fn test_tycoon_token_matrix_spender_auth_entries() {
        let matrix = tycoon_token_auth_matrix();
        let spender_fns = ["transfer_from", "burn_from"];
        for fn_name in spender_fns {
            let entry = matrix.iter().find(|e| e.entrypoint == fn_name)
                .unwrap_or_else(|| panic!("{fn_name} not in matrix"));
            assert_eq!(entry.requirement, AuthRequirement::SpenderAuth, "{fn_name} should require SpenderAuth");
            assert_eq!(entry.expected_caller, CallerKind::Spender);
        }
    }

    #[test]
    fn test_tycoon_token_matrix_no_read_only_entry_requires_auth() {
        let matrix = tycoon_token_auth_matrix();
        for entry in matrix {
            if entry.is_read_only {
                assert_eq!(
                    entry.requirement,
                    AuthRequirement::NoAuth,
                    "read-only entrypoint '{}' must not require auth",
                    entry.entrypoint
                );
            }
        }
    }

    #[test]
    fn test_tycoon_token_matrix_no_admin_entry_is_read_only() {
        let matrix = tycoon_token_auth_matrix();
        for entry in matrix {
            if entry.requires_admin() {
                assert!(
                    !entry.is_read_only,
                    "admin-only entrypoint '{}' must not be read-only",
                    entry.entrypoint
                );
            }
        }
    }

    #[test]
    fn test_caller_kind_used_in_match() {
        let kind = CallerKind::Spender;
        let label = match kind {
            CallerKind::Admin => "admin",
            CallerKind::Owner => "owner",
            CallerKind::Spender => "spender",
            CallerKind::AnyContract => "any",
            CallerKind::None => "none",
        };
        assert_eq!(label, "spender");
    }

    #[test]
    fn test_auth_requirement_used_in_match() {
        let req = AuthRequirement::SpenderAuth;
        let requires_sig = match req {
            AuthRequirement::NoAuth => false,
            _ => true,
        };
        assert!(requires_sig);
    }

    #[test]
    fn test_all_matrix_entries_have_consistent_read_only_flag() {
        let matrix = tycoon_token_auth_matrix();
        let write_count = matrix.iter().filter(|e| !e.is_read_only).count();
        let read_count = matrix.iter().filter(|e| e.is_read_only).count();
        assert!(write_count > 0, "expected at least one write entrypoint");
        assert!(read_count > 0, "expected at least one read-only entrypoint");
        assert_eq!(write_count + read_count, matrix.len());
    }
}
