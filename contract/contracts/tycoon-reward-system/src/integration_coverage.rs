/// # Unit and Integration Coverage — TycoonRewardSystem (SW-CT-019)
///
/// Covers code paths not exercised by the existing test modules:
///
/// | Test                                      | Path covered                                      |
/// |-------------------------------------------|---------------------------------------------------|
/// | `test_migrate_from_v0_to_v1`             | migrate() when StateVersion == 0 (real migration) |
/// | `test_migrate_noop_at_v1`                | migrate() idempotency at version 1               |
/// | `test_mint_voucher_emits_events`          | mint_voucher event emission                       |
/// | `test_redeem_voucher_emits_events`        | redeem_voucher_from event emission                |
/// | `test_withdraw_funds_emits_events`        | withdraw_funds event emission                     |
/// | `test_multi_user_independent_balances`    | distinct token_ids for multiple users             |
/// | `test_get_balance_returns_zero_unminted`  | get_balance returns 0 for unminted token_ids      |
/// | `test_full_mint_transfer_redeem_flow`     | end-to-end: admin → user A transfers to user B   |
/// | `test_voucher_count_monotonic`            | VoucherCount increments without gaps              |
/// | `test_backend_minter_none_by_default`     | get_backend_minter returns None before any set    |
#[cfg(test)]
mod tests {
    extern crate std;

    use crate::{DataKey, TycoonRewardSystem, TycoonRewardSystemClient};
    use soroban_sdk::{
        testutils::{Address as _, Events},
        token::StellarAssetClient,
        Address, Env,
    };

    fn setup(env: &Env) -> (TycoonRewardSystemClient, Address, Address, Address, Address) {
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
        (client, admin, tyc, usdc, contract_id)
    }

    // ── migrate() ─────────────────────────────────────────────────────────────

    /// Exercises the real migration path: migrate() when StateVersion is 0
    /// must advance it to 1. This code branch is not reached by initialize()
    /// (which always starts at v1) so requires direct state manipulation.
    #[test]
    fn test_migrate_from_v0_to_v1() {
        let env = Env::default();
        env.mock_all_auths();
        let (client, _admin, _tyc, _usdc, contract_id) = setup(&env);

        // Simulate pre-migration state by writing version 0 directly
        env.as_contract(&contract_id, || {
            env.storage()
                .persistent()
                .set(&DataKey::StateVersion, &0u32);
        });

        let version_before: u32 = env.as_contract(&contract_id, || {
            env.storage()
                .persistent()
                .get(&DataKey::StateVersion)
                .unwrap_or(0)
        });
        assert_eq!(version_before, 0, "precondition: StateVersion must be 0");

        client.migrate();

        let version_after: u32 = env.as_contract(&contract_id, || {
            env.storage()
                .persistent()
                .get(&DataKey::StateVersion)
                .unwrap_or(0)
        });
        assert_eq!(version_after, 1, "migrate must advance StateVersion to 1");
    }

    /// Calling migrate when already at version 1 is a documented no-op.
    #[test]
    fn test_migrate_noop_at_v1() {
        let env = Env::default();
        env.mock_all_auths();
        let (client, _admin, _tyc, _usdc, contract_id) = setup(&env);

        client.migrate(); // no-op at v1

        let version: u32 = env.as_contract(&contract_id, || {
            env.storage()
                .persistent()
                .get(&DataKey::StateVersion)
                .unwrap_or(0)
        });
        assert_eq!(version, 1, "migrate at v1 must leave version unchanged");
    }

    // ── Event emission ────────────────────────────────────────────────────────

    /// mint_voucher must emit at least one event.
    #[test]
    fn test_mint_voucher_emits_events() {
        let env = Env::default();
        env.mock_all_auths();
        let (client, admin, _tyc, _usdc, _cid) = setup(&env);
        let user = Address::generate(&env);

        let before = env.events().all().len();
        let _ = client.mint_voucher(&admin, &user, &500);
        assert!(
            env.events().all().len() > before,
            "mint_voucher must emit at least one event"
        );
    }

    /// redeem_voucher_from must emit at least one event.
    #[test]
    fn test_redeem_voucher_emits_events() {
        let env = Env::default();
        env.mock_all_auths();
        let (client, admin, tyc, _usdc, contract_id) = setup(&env);
        let user = Address::generate(&env);

        StellarAssetClient::new(&env, &tyc).mint(&contract_id, &10_000);
        let token_id = client.mint_voucher(&admin, &user, &500);

        let before = env.events().all().len();
        client.redeem_voucher_from(&user, &token_id);
        assert!(
            env.events().all().len() > before,
            "redeem_voucher_from must emit at least one event"
        );
    }

    /// withdraw_funds must emit at least one event.
    #[test]
    fn test_withdraw_funds_emits_events() {
        let env = Env::default();
        env.mock_all_auths();
        let (client, _admin, tyc, _usdc, contract_id) = setup(&env);
        let recipient = Address::generate(&env);

        StellarAssetClient::new(&env, &tyc).mint(&contract_id, &10_000);

        let before = env.events().all().len();
        client.withdraw_funds(&tyc, &recipient, &1_000);
        assert!(
            env.events().all().len() > before,
            "withdraw_funds must emit at least one event"
        );
    }

    // ── Multi-user balance isolation ──────────────────────────────────────────

    /// Each user has an independent balance for distinct token_ids.
    /// Verifies no cross-contamination between (user, token_id) storage keys.
    #[test]
    fn test_multi_user_independent_balances() {
        let env = Env::default();
        env.mock_all_auths();
        let (client, admin, _tyc, _usdc, _cid) = setup(&env);

        let users: std::vec::Vec<Address> = (0..4).map(|_| Address::generate(&env)).collect();
        let values = [100u128, 200u128, 300u128, 400u128];

        let token_ids: std::vec::Vec<u128> = users
            .iter()
            .zip(values.iter())
            .map(|(u, &v)| client.mint_voucher(&admin, u, &v))
            .collect();

        // Each user holds exactly 1 of their own token; 0 of all others
        for (i, (user, &tid)) in users.iter().zip(token_ids.iter()).enumerate() {
            assert_eq!(client.get_balance(user, &tid), 1, "user {i}: balance must be 1");
            assert_eq!(
                client.owned_token_count(user),
                1,
                "user {i}: must own exactly 1 token type"
            );

            for (j, &other_tid) in token_ids.iter().enumerate() {
                if i != j {
                    assert_eq!(
                        client.get_balance(user, &other_tid),
                        0,
                        "user {i} must not hold token_id from user {j}"
                    );
                }
            }
        }
    }

    /// get_balance returns 0 for any token_id that has never been minted.
    #[test]
    fn test_get_balance_returns_zero_unminted() {
        let env = Env::default();
        env.mock_all_auths();
        let (client, _admin, _tyc, _usdc, _cid) = setup(&env);
        let user = Address::generate(&env);

        for &tid in &[0u128, 1, 999, 1_000_000_000, u128::MAX] {
            assert_eq!(
                client.get_balance(&user, &tid),
                0,
                "unminted token_id {tid} must return 0"
            );
        }
    }

    // ── Full integration lifecycle ─────────────────────────────────────────────

    /// End-to-end: admin mints to user A, user A transfers to user B, user B redeems.
    /// Verifies all state transitions across the full voucher lifecycle.
    #[test]
    fn test_full_mint_transfer_redeem_flow() {
        let env = Env::default();
        env.mock_all_auths();

        let admin = Address::generate(&env);
        let user_a = Address::generate(&env);
        let user_b = Address::generate(&env);

        let tyc = env
            .register_stellar_asset_contract_v2(Address::generate(&env))
            .address();
        let usdc = env
            .register_stellar_asset_contract_v2(Address::generate(&env))
            .address();
        let contract_id = env.register(TycoonRewardSystem, ());
        let client = TycoonRewardSystemClient::new(&env, &contract_id);
        client.initialize(&admin, &tyc, &usdc);
        StellarAssetClient::new(&env, &tyc).mint(&contract_id, &1_000_000);

        let tyc_value: u128 = 250_000;

        // Phase 1: admin mints to user A
        let token_id = client.mint_voucher(&admin, &user_a, &tyc_value);
        assert_eq!(client.get_balance(&user_a, &token_id), 1);
        assert_eq!(client.owned_token_count(&user_a), 1);
        assert_eq!(client.get_balance(&user_b, &token_id), 0);

        // Phase 2: user A transfers to user B
        client.transfer(&user_a, &user_b, &token_id, &1);
        assert_eq!(client.get_balance(&user_a, &token_id), 0);
        assert_eq!(client.owned_token_count(&user_a), 0);
        assert_eq!(client.get_balance(&user_b, &token_id), 1);
        assert_eq!(client.owned_token_count(&user_b), 1);

        // Phase 3: user B redeems
        client.redeem_voucher_from(&user_b, &token_id);
        assert_eq!(client.get_balance(&user_b, &token_id), 0);
        assert_eq!(client.owned_token_count(&user_b), 0);

        // TYC transferred to user B only; user A received nothing
        let tyc_client = soroban_sdk::token::Client::new(&env, &tyc);
        assert_eq!(tyc_client.balance(&user_b), tyc_value as i128);
        assert_eq!(tyc_client.balance(&user_a), 0);
    }

    // ── Voucher ID monotonicity ───────────────────────────────────────────────

    /// VoucherCount increments monotonically; IDs never reuse within a session.
    #[test]
    fn test_voucher_count_monotonic() {
        let env = Env::default();
        env.mock_all_auths();
        let (client, admin, _tyc, _usdc, _cid) = setup(&env);
        let user = Address::generate(&env);

        let ids: std::vec::Vec<u128> = (0..5)
            .map(|_| client.mint_voucher(&admin, &user, &0))
            .collect();

        for window in ids.windows(2) {
            assert_eq!(
                window[1] - window[0],
                1,
                "each successive voucher ID must be exactly 1 greater"
            );
        }
    }

    // ── get_backend_minter default ─────────────────────────────────────────────

    /// get_backend_minter returns None before any set_backend_minter call.
    #[test]
    fn test_backend_minter_none_by_default() {
        let env = Env::default();
        env.mock_all_auths();
        let (client, _admin, _tyc, _usdc, _cid) = setup(&env);
        assert_eq!(
            client.get_backend_minter(),
            None,
            "backend minter must be None until explicitly set"
        );
    }
}
