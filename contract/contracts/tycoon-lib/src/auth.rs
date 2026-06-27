// Cross-contract auth matrix types for Tycoon contracts.
//
// ## How cross-contract auth works in Soroban
//
// When contract A calls an entrypoint on contract B, the `require_auth()`
// checks inside B still apply — cross-contract calls do NOT bypass auth.
// The authorizing address must have pre-signed the invocation in the
// transaction's auth envelope before the call is made.
//
// Example: if the reward-system contract calls `tycoon_token.mint(user, 100)`,
// the mint function invokes `admin.require_auth()`.  For the call to succeed
// the admin address must already be present as an authorized invoker in the
// outer transaction.  The admin can be:
//   - An account keypair that signed the transaction.
//   - A multisig / DAO account that satisfied its own auth policy.
//   - The reward-system contract itself, if it is the stored admin.
//
// ## Auth requirement vocabulary
//
// | `AuthRequirement` variant    | Guard in code                     |
// |------------------------------|-----------------------------------|
// | `None`                       | No `require_auth` call            |
// | `AdminOnly`                  | `require_admin_auth(admin)`       |
// | `UserSelf`                   | `caller.require_auth()`           |
// | `AdminOrPrivilegedCaller`    | owner check OR registered caller  |
//
// ## Reference auth table (tycoon-token)
//
// | Entrypoint        | Auth requirement           | Notes                          |
// |-------------------|----------------------------|--------------------------------|
// | initialize        | None                       | One-time; admin not set yet    |
// | mint              | AdminOnly                  | Admin must pre-sign            |
// | set_admin         | AdminOnly                  | Admin key rotation             |
// | admin             | None (read-only)           | Anyone can query               |
// | total_supply      | None (read-only)           | Anyone can query               |
// | transfer          | UserSelf (from)            | Token owner signs              |
// | transfer_from     | UserSelf (spender)         | Spender contract signs         |
// | approve           | UserSelf (from)            | Owner grants allowance         |
// | allowance         | None (read-only)           | Anyone can query               |
// | balance           | None (read-only)           | Anyone can query               |
// | burn              | UserSelf (from)            | Token owner signs              |
// | burn_from         | UserSelf (spender)         | Spender contract signs         |
// | decimals/name/symbol | None (read-only)        | SEP-41 view functions          |
//
// ## Reference auth table (tycoon-game)
//
// | Entrypoint                | Auth requirement           | Notes                         |
// |---------------------------|----------------------------|-------------------------------|
// | initialize                | None (owner pre-signs)     | One-time setup                |
// | admin_*                   | AdminOnly                  | Owner must sign               |
// | register_player           | UserSelf (caller)          | Player registers themselves   |
// | remove_player_from_game   | AdminOrPrivilegedCaller    | Owner or backend controller   |
// | get_user / read-only      | None                       | Open view                     |

/// The authentication requirement for a Tycoon contract entrypoint.
///
/// Use this type in per-contract documentation tables to make the auth surface
/// explicit and easy to audit.  It carries no runtime enforcement — each
/// contract's `require_auth()` calls are the enforcement points.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum AuthRequirement {
    /// No authentication check is performed.
    ///
    /// Appropriate for:
    /// - Pure read-only view functions (balance, total_supply, etc.).
    /// - One-time initializers where the admin address does not yet exist.
    None,
    /// The stored admin/owner address must authorize the invocation.
    ///
    /// Implementation: call `tycoon_lib::access_control::require_admin_auth(admin)`
    /// as the first statement in the function body.
    AdminOnly,
    /// The user initiating the action must authorize their own account.
    ///
    /// Implementation: call `caller.require_auth()` where `caller` is the
    /// address whose state is being mutated (token owner, registered player, etc.).
    UserSelf,
    /// Either the stored admin/owner **or** a registered privileged caller
    /// (e.g. the backend game controller) must authorize.
    ///
    /// Implementation: read both the admin address and the privileged-caller
    /// address from storage, call `caller.require_auth()`, then check that
    /// `caller == admin || caller == privileged_caller`.
    AdminOrPrivilegedCaller,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_auth_requirement_variants_are_distinct() {
        assert_ne!(AuthRequirement::None, AuthRequirement::AdminOnly);
        assert_ne!(AuthRequirement::None, AuthRequirement::UserSelf);
        assert_ne!(AuthRequirement::None, AuthRequirement::AdminOrPrivilegedCaller);
        assert_ne!(AuthRequirement::AdminOnly, AuthRequirement::UserSelf);
        assert_ne!(
            AuthRequirement::AdminOnly,
            AuthRequirement::AdminOrPrivilegedCaller
        );
        assert_ne!(
            AuthRequirement::UserSelf,
            AuthRequirement::AdminOrPrivilegedCaller
        );
    }

    #[test]
    fn test_auth_requirement_eq_reflexive() {
        assert_eq!(AuthRequirement::None, AuthRequirement::None);
        assert_eq!(AuthRequirement::AdminOnly, AuthRequirement::AdminOnly);
        assert_eq!(AuthRequirement::UserSelf, AuthRequirement::UserSelf);
        assert_eq!(
            AuthRequirement::AdminOrPrivilegedCaller,
            AuthRequirement::AdminOrPrivilegedCaller
        );
    }

    #[test]
    fn test_auth_requirement_clone() {
        let r = AuthRequirement::AdminOrPrivilegedCaller;
        assert_eq!(r, r.clone());
    }

    #[test]
    fn test_auth_requirement_match_is_exhaustive() {
        let cases = [
            AuthRequirement::None,
            AuthRequirement::AdminOnly,
            AuthRequirement::UserSelf,
            AuthRequirement::AdminOrPrivilegedCaller,
        ];
        for req in &cases {
            let requires_signature = match req {
                AuthRequirement::None => false,
                AuthRequirement::AdminOnly => true,
                AuthRequirement::UserSelf => true,
                AuthRequirement::AdminOrPrivilegedCaller => true,
            };
            // None is the only variant that does not require a signature.
            assert_eq!(*req == AuthRequirement::None, !requires_signature);
        }
    }

    #[test]
    fn test_admin_only_is_stricter_than_user_self() {
        // AdminOnly requires a specific privileged key; UserSelf allows any
        // authenticated user.  They must be distinct.
        assert_ne!(AuthRequirement::AdminOnly, AuthRequirement::UserSelf);
    }

    #[test]
    fn test_read_only_entrypoints_use_none() {
        // Verify the None variant is intended for read-only / open entrypoints.
        let read_only_auth = AuthRequirement::None;
        assert_eq!(read_only_auth, AuthRequirement::None);
    }
}
