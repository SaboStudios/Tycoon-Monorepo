/// # Admin Access Control Tests — tycoon-game (SW-CT-012)
///
/// Verifies that every admin-only entrypoint rejects calls from non-owner
/// addresses, and that the canonical `admin_*` names work correctly.
///
/// | ID      | Scenario |
/// |---------|----------|
/// | ACT-01  | `admin_withdraw_funds` rejects non-owner |
/// | ACT-02  | `admin_set_collectible_info` rejects non-owner |
/// | ACT-03  | `admin_set_cash_tier_value` rejects non-owner |
/// | ACT-04  | `admin_set_backend_game_controller` rejects non-owner |
/// | ACT-05  | `admin_migrate` rejects non-owner |
/// | ACT-06  | `admin_withdraw_funds` succeeds for owner |
/// | ACT-07  | `admin_set_collectible_info` succeeds for owner |
/// | ACT-08  | `admin_set_cash_tier_value` succeeds for owner |
/// | ACT-09  | `admin_set_backend_game_controller` succeeds for owner |
/// | ACT-10  | `admin_migrate` succeeds for owner |
/// | ACT-11  | Deprecated shims still work (backward-compat) |
/// | ACT-12  | `remove_player_from_game` rejects address that is neither owner nor controller |
/// | ACT-13  | `remove_player_from_game` accepts backend controller |
#[cfg(test)]
mod tests {
    use crate::{TycoonContract, TycoonContractClient};
    use soroban_sdk::{
        testutils::{Address as _, MockAuth, MockAuthInvoke},
        token::StellarAssetClient,
        Address, Env, IntoVal,
    };

    // ── helpers ───────────────────────────────────────────────────────────────

    fn setup(env: &Env) -> (Address, TycoonContractClient<'_>, Address, Address, Address) {
        let contract_id = env.register(TycoonContract, ());
        let client = TycoonContractClient::new(env, &contract_id);
        let owner = Address::generate(env);
        let tyc_id = env
            .register_stellar_asset_contract_v2(Address::generate(env))
            .address();
        let usdc_id = env
            .register_stellar_asset_contract_v2(Address::generate(env))
            .address();
        let reward = Address::generate(env);
        env.mock_all_auths();
        client.initialize(&tyc_id, &usdc_id, &owner, &reward);
        (contract_id, client, owner, tyc_id, usdc_id)
    }

    // ── ACT-01: admin_withdraw_funds rejects non-owner ────────────────────────

    #[test]
    #[should_panic]
    fn act_01_withdraw_funds_rejects_non_owner() {
        let env = Env::default();
        let (contract_id, client, _owner, tyc_id, _usdc_id) = setup(&env);

        // Fund the contract
        env.mock_all_auths();
        StellarAssetClient::new(&env, &tyc_id).mint(&contract_id, &1_000);

        let attacker = Address::generate(&env);
        let recipient = Address::generate(&env);

        // Only mock auth for the attacker — owner auth is NOT provided
        env.mock_auths(&[MockAuth {
            address: &attacker,
            invoke: &MockAuthInvoke {
                contract: &contract_id,
                fn_name: "admin_withdraw_funds",
                args: (&tyc_id, &recipient, 500_u128).into_val(&env),
                sub_invokes: &[],
            },
        }]);

        client.admin_withdraw_funds(&tyc_id, &recipient, &500);
    }

    // ── ACT-02: admin_set_collectible_info rejects non-owner ─────────────────

    #[test]
    #[should_panic]
    fn act_02_set_collectible_info_rejects_non_owner() {
        let env = Env::default();
        let (contract_id, client, _owner, _tyc_id, _usdc_id) = setup(&env);

        let attacker = Address::generate(&env);

        env.mock_auths(&[MockAuth {
            address: &attacker,
            invoke: &MockAuthInvoke {
                contract: &contract_id,
                fn_name: "admin_set_collectible_info",
                args: (1_u128, 1_u32, 1_u32, 100_u128, 50_u128, 10_u64).into_val(&env),
                sub_invokes: &[],
            },
        }]);

        client.admin_set_collectible_info(&1, &1, &1, &100, &50, &10);
    }

    // ── ACT-03: admin_set_cash_tier_value rejects non-owner ──────────────────

    #[test]
    #[should_panic]
    fn act_03_set_cash_tier_value_rejects_non_owner() {
        let env = Env::default();
        let (contract_id, client, _owner, _tyc_id, _usdc_id) = setup(&env);

        let attacker = Address::generate(&env);

        env.mock_auths(&[MockAuth {
            address: &attacker,
            invoke: &MockAuthInvoke {
                contract: &contract_id,
                fn_name: "admin_set_cash_tier_value",
                args: (1_u32, 1000_u128).into_val(&env),
                sub_invokes: &[],
            },
        }]);

        client.admin_set_cash_tier_value(&1, &1000);
    }

    // ── ACT-04: admin_set_game_controller rejects non-owner ──────────

    #[test]
    #[should_panic]
    fn act_04_set_backend_controller_rejects_non_owner() {
        let env = Env::default();
        let (contract_id, client, _owner, _tyc_id, _usdc_id) = setup(&env);

        let attacker = Address::generate(&env);
        let new_controller = Address::generate(&env);

        env.mock_auths(&[MockAuth {
            address: &attacker,
            invoke: &MockAuthInvoke {
                contract: &contract_id,
                fn_name: "admin_set_game_controller",
                args: (&new_controller,).into_val(&env),
                sub_invokes: &[],
            },
        }]);

        client.admin_set_game_controller(&new_controller);
    }

    // ── ACT-05: admin_migrate rejects non-owner ───────────────────────────────

    #[test]
    #[should_panic]
    fn act_05_migrate_rejects_non_owner() {
        let env = Env::default();
        let (contract_id, client, _owner, _tyc_id, _usdc_id) = setup(&env);

        let attacker = Address::generate(&env);

        env.mock_auths(&[MockAuth {
            address: &attacker,
            invoke: &MockAuthInvoke {
                contract: &contract_id,
                fn_name: "admin_migrate",
                args: ().into_val(&env),
                sub_invokes: &[],
            },
        }]);

        client.admin_migrate();
    }

    // ── ACT-06 through ACT-10: owner succeeds ────────────────────────────────

    #[test]
    fn act_06_withdraw_funds_owner_succeeds() {
        let env = Env::default();
        env.mock_all_auths();
        let (contract_id, client, _owner, tyc_id, _usdc_id) = setup(&env);

        StellarAssetClient::new(&env, &tyc_id).mint(&contract_id, &1_000);
        let recipient = Address::generate(&env);
        client.admin_withdraw_funds(&tyc_id, &recipient, &500);

        assert_eq!(
            soroban_sdk::token::TokenClient::new(&env, &tyc_id).balance(&recipient),
            500
        );
    }

    #[test]
    fn act_07_set_collectible_info_owner_succeeds() {
        let env = Env::default();
        env.mock_all_auths();
        let (_, client, _, _, _) = setup(&env);

        client.admin_set_collectible_info(&7, &3, &50, &200, &100, &20);
        assert_eq!(client.get_collectible_info(&7), (3, 50, 200, 100, 20));
    }

    #[test]
    fn act_08_set_cash_tier_value_owner_succeeds() {
        let env = Env::default();
        env.mock_all_auths();
        let (_, client, _, _, _) = setup(&env);

        client.admin_set_cash_tier_value(&5, &9999);
        assert_eq!(client.get_cash_tier_value(&5), 9999);
    }

    #[test]
    fn act_09_set_backend_controller_owner_succeeds() {
        let env = Env::default();
        env.mock_all_auths();
        let (_, client, _, _, _) = setup(&env);

        let controller = Address::generate(&env);
        client.admin_set_game_controller(&controller);

        assert_eq!(client.export_state().backend_controller, Some(controller));
    }

    #[test]
    fn act_10_migrate_owner_succeeds() {
        let env = Env::default();
        env.mock_all_auths();
        let (_, client, _, _, _) = setup(&env);

        // At v1 after initialize — migrate is a no-op, must not panic
        client.admin_migrate();
        assert_eq!(client.export_state().state_version, 1);
    }

    // ── ACT-11: deprecated shims still work ──────────────────────────────────

    #[test]
    fn act_11_deprecated_shims_still_work() {
        let env = Env::default();
        env.mock_all_auths();
        let (contract_id, client, _owner, tyc_id, _usdc_id) = setup(&env);

        // set_collectible_info shim
        client.set_collectible_info(&99, &1, &10, &100, &50, &5);
        assert_eq!(client.get_collectible_info(&99), (1, 10, 100, 50, 5));

        // set_cash_tier_value shim
        client.set_cash_tier_value(&9, &777);
        assert_eq!(client.get_cash_tier_value(&9), 777);

        // set_backend_game_controller shim
        let ctrl = Address::generate(&env);
        client.set_backend_game_controller(&ctrl);
        assert_eq!(client.export_state().backend_controller, Some(ctrl.clone()));

        // withdraw_funds shim
        StellarAssetClient::new(&env, &tyc_id).mint(&contract_id, &500);
        let recipient = Address::generate(&env);
        client.withdraw_funds(&tyc_id, &recipient, &200);
        assert_eq!(
            soroban_sdk::token::TokenClient::new(&env, &tyc_id).balance(&recipient),
            200
        );

        // migrate shim
        client.migrate();
        assert_eq!(client.export_state().state_version, 1);
    }

    // ── ACT-12: remove_player_from_game rejects random address ───────────────

    #[test]
    #[should_panic(expected = "Unauthorized: caller must be owner or backend game controller")]
    fn act_12_remove_player_rejects_random_address() {
        let env = Env::default();
        env.mock_all_auths();
        let (_, client, _, _, _) = setup(&env);

        let random = Address::generate(&env);
        let player = Address::generate(&env);
        client.remove_player_from_game(&random, &1, &player, &5);
    }

    // ── ACT-13: remove_player_from_game accepts backend controller ────────────

    #[test]
    fn act_13_remove_player_accepts_backend_controller() {
        let env = Env::default();
        env.mock_all_auths();
        let (_, client, _, _, _) = setup(&env);

        let controller = Address::generate(&env);
        client.admin_set_game_controller(&controller);

        let player = Address::generate(&env);
        // Must not panic
        client.remove_player_from_game(&controller, &42, &player, &7);
    }
}
