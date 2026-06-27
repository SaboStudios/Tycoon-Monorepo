/// # Security Review Checklist — TycoonRewardSystem (SW-CT-018)
///
/// Tests organized by security category so reviewers can trace each
/// security concern directly to its covering test(s).
///
/// ## Checklist
///
/// ### SC-01 Access Control
/// - [x] Admin-only functions reject non-admin callers (see admin_access_control_tests.rs)
/// - [x] mint_voucher only callable by admin or registered backend minter (see test.rs)
///
/// ### SC-02 Pause Guard
/// - [x] redeem_voucher_from panics when paused (see test.rs)
/// - [x] transfer panics when paused (see test.rs, transfer_tests.rs)
/// - [x] mint_voucher panics when paused              ← SC-02 gap covered here
///
/// ### SC-03 Initialization Guard
/// - [x] initialize panics if called a second time (see test.rs)
///
/// ### SC-04 Replay / Double-spend Protection
/// - [x] redeem_voucher_from removes VoucherValue on success (see test.rs)
///
/// ### SC-05 Token Allowlist
/// - [x] withdraw_funds panics for tokens not in allowlist (see test.rs)
///
/// ### SC-06 Arithmetic Safety
/// - [x] Balance overflow at u64::MAX panics (see overflow_rounding_tests.rs)
/// - [x] Burn when balance < amount panics (see overflow_rounding_tests.rs)
///
/// ### SC-07 Deprecated API Guard
/// - [x] redeem_voucher (deprecated stub) always panics (see test.rs)
///
/// ### SC-08 Backend Minter Rotation Safety
/// - [x] Cleared minter is immediately rejected (see test.rs)
/// - [x] New minter accepted immediately after rotation (see simulation_scenarios.rs)
#[cfg(test)]
mod tests {
    extern crate std;

    use crate::{TycoonRewardSystem, TycoonRewardSystemClient};
    use soroban_sdk::{testutils::Address as _, token::StellarAssetClient, Address, Env};

    fn setup(env: &Env) -> (TycoonRewardSystemClient, Address, Address, Address) {
        let contract_id = env.register(TycoonRewardSystem, ());
        let client = TycoonRewardSystemClient::new(env, &contract_id);
        let admin = Address::generate(env);
        let tyc = env
            .register_stellar_asset_contract_v2(Address::generate(env))
            .address();
        let usdc = env
            .register_stellar_asset_contract_v2(Address::generate(env))
            .address();
        client.initialize(&admin, &tyc, &usdc);
        (client, admin, tyc, usdc)
    }

    // ── SC-02: Pause Guard — mint_voucher (gap identified during review) ──────

    /// mint_voucher must panic when the contract is paused.
    /// redeem and transfer already had pause-gate tests; this covers the mint path.
    #[test]
    fn sc02_mint_voucher_blocked_when_paused() {
        let env = Env::default();
        env.mock_all_auths();

        let admin = Address::generate(&env);
        let user = Address::generate(&env);
        let tyc = env
            .register_stellar_asset_contract_v2(Address::generate(&env))
            .address();
        let usdc = env
            .register_stellar_asset_contract_v2(Address::generate(&env))
            .address();
        let contract_id = env.register(TycoonRewardSystem, ());
        let client = TycoonRewardSystemClient::new(&env, &contract_id);
        client.initialize(&admin, &tyc, &usdc);
        StellarAssetClient::new(&env, &tyc).mint(&contract_id, &10_000);

        // Confirm mint works before pause
        let _ = client.mint_voucher(&admin, &user, &100);

        // Pause — mint must be blocked
        client.pause();
        let res = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            client.mint_voucher(&admin, &user, &100);
        }));
        assert!(res.is_err(), "mint_voucher must panic when paused");

        // Unpause — mint works again
        client.unpause();
        let token_id = client.mint_voucher(&admin, &user, &100);
        assert_eq!(client.get_balance(&user, &token_id), 1);
    }

    /// Pause state transitions are atomic: pausing sets the flag, unpausing
    /// clears it, and the gate tests confirm the flag is read on every call.
    #[test]
    fn sc02_pause_unpause_state_is_accurate() {
        let env = Env::default();
        env.mock_all_auths();
        let (client, admin, _tyc, _usdc) = setup(&env);
        let user = Address::generate(&env);

        // Unpaused by default — mint succeeds
        let _ = client.mint_voucher(&admin, &user, &0);

        client.pause();
        let res = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            client.mint_voucher(&admin, &user, &0);
        }));
        assert!(res.is_err(), "must be blocked while paused");

        client.unpause();
        let tid = client.mint_voucher(&admin, &user, &0);
        assert_eq!(client.get_balance(&user, &tid), 1);
    }

    // ── SC-05: Token Allowlist ────────────────────────────────────────────────

    /// withdraw_funds must reject any token not in the TYC/USDC allowlist.
    #[test]
    fn sc05_withdraw_rejects_unlisted_token() {
        let env = Env::default();
        env.mock_all_auths();
        let (client, _admin, _tyc, _usdc) = setup(&env);

        let rogue = env
            .register_stellar_asset_contract_v2(Address::generate(&env))
            .address();
        let recipient = Address::generate(&env);

        let res = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            client.withdraw_funds(&rogue, &recipient, &1);
        }));
        assert!(res.is_err(), "unlisted token must be rejected");
    }

    // ── SC-07: Deprecated API Guard ───────────────────────────────────────────

    /// The deprecated redeem_voucher stub panics regardless of contract state.
    #[test]
    fn sc07_deprecated_redeem_voucher_panics_regardless_of_state() {
        let env = Env::default();
        env.mock_all_auths();
        let (client, _admin, _tyc, _usdc) = setup(&env);

        // Unpaused state
        let res = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            client.redeem_voucher(&999_999);
        }));
        assert!(
            res.is_err(),
            "redeem_voucher (deprecated) must always panic"
        );

        // Also panics when paused
        client.pause();
        let res2 = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            client.redeem_voucher(&0);
        }));
        assert!(
            res2.is_err(),
            "redeem_voucher (deprecated) must panic even when paused"
        );
    }

    // ── SC-08: Backend Minter Rotation Safety ─────────────────────────────────

    /// Rotating to a new minter: old is rejected, new is accepted — no gap.
    #[test]
    fn sc08_minter_rotation_is_atomic() {
        let env = Env::default();
        env.mock_all_auths();
        let (client, admin, _tyc, _usdc) = setup(&env);

        let old_minter = Address::generate(&env);
        let new_minter = Address::generate(&env);
        let user = Address::generate(&env);

        client.set_backend_minter(&old_minter);
        // Old minter can mint
        let _ = client.mint_voucher(&old_minter, &user, &0);

        // Rotate: clear old, set new
        client.clear_backend_minter();
        client.set_backend_minter(&new_minter);

        // New minter accepted immediately
        let tid = client.mint_voucher(&new_minter, &user, &0);
        assert_eq!(client.get_balance(&user, &tid), 1);

        // Old minter rejected immediately
        let res = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            client.mint_voucher(&old_minter, &user, &0);
        }));
        assert!(res.is_err(), "old minter must be rejected after rotation");

        // Admin can still mint directly
        let tid2 = client.mint_voucher(&admin, &user, &0);
        assert_eq!(client.get_balance(&user, &tid2), 1);
    }
}
