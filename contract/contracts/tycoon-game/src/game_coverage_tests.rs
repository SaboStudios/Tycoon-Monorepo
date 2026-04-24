/// # Game Coverage Tests — tycoon-game (SW-CT-008)
///
/// Integration scenarios that cover paths not exercised by the existing
/// unit tests in `test.rs` or the simulation scenarios in
/// `simulation_scenarios.rs`.
///
/// ## Scenarios
///
/// | ID     | Scenario |
/// |--------|----------|
/// | GCT-01 | `withdraw_funds` event carries correct token, recipient, and amount |
/// | GCT-02 | Withdraw TYC then USDC in sequence; both balances correct |
/// | GCT-03 | `remove_player_from_game` when no backend controller is set and caller is owner |
/// | GCT-04 | `export_state` reflects backend controller after it is set |
/// | GCT-05 | `migrate` at v0 advances to v1; subsequent migrate is a no-op |
#[cfg(test)]
mod tests {
    extern crate std;

    use crate::{storage, TycoonContract, TycoonContractClient};
    use soroban_sdk::{
        testutils::{Address as _, Events},
        token::{StellarAssetClient, TokenClient},
        Address, Env,
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
        client.initialize(&tyc_id, &usdc_id, &owner, &reward);
        (contract_id, client, owner, tyc_id, usdc_id)
    }

    fn fund(env: &Env, token: &Address, to: &Address, amount: i128) {
        StellarAssetClient::new(env, token).mint(to, &amount);
    }

    // ── GCT-01 ───────────────────────────────────────────────────────────────

    /// GCT-01: `withdraw_funds` emits a `FundsWithdrawn` event whose data
    /// field equals the withdrawn amount.
    #[test]
    fn gct_01_withdraw_event_carries_correct_data() {
        let env = Env::default();
        env.mock_all_auths();
        let (contract_id, client, _, tyc_id, _) = setup(&env);

        fund(&env, &tyc_id, &contract_id, 1_000);
        let recipient = Address::generate(&env);
        client.withdraw_funds(&tyc_id, &recipient, &750);

        let events = env.events().all();
        assert!(!events.is_empty(), "GCT-01: at least one event must be emitted");

        // The last event is the FundsWithdrawn event; its data is the amount.
        let (_contract, _topics, data) = events.last().unwrap();
        let emitted_amount: u128 = soroban_sdk::FromVal::from_val(&env, &data);
        assert_eq!(emitted_amount, 750, "GCT-01: event data must equal withdrawn amount");
    }

    // ── GCT-02 ───────────────────────────────────────────────────────────────

    /// GCT-02: Withdraw TYC then USDC in sequence; both token balances are
    /// updated independently.
    #[test]
    fn gct_02_sequential_withdraw_tyc_then_usdc() {
        let env = Env::default();
        env.mock_all_auths();
        let (contract_id, client, _, tyc_id, usdc_id) = setup(&env);

        fund(&env, &tyc_id, &contract_id, 5_000);
        fund(&env, &usdc_id, &contract_id, 3_000);

        let recipient = Address::generate(&env);
        client.withdraw_funds(&tyc_id, &recipient, &2_000);
        client.withdraw_funds(&usdc_id, &recipient, &1_000);

        assert_eq!(
            TokenClient::new(&env, &tyc_id).balance(&contract_id),
            3_000,
            "GCT-02: TYC contract balance after withdrawal"
        );
        assert_eq!(
            TokenClient::new(&env, &usdc_id).balance(&contract_id),
            2_000,
            "GCT-02: USDC contract balance after withdrawal"
        );
        assert_eq!(
            TokenClient::new(&env, &tyc_id).balance(&recipient),
            2_000,
            "GCT-02: recipient TYC balance"
        );
        assert_eq!(
            TokenClient::new(&env, &usdc_id).balance(&recipient),
            1_000,
            "GCT-02: recipient USDC balance"
        );
    }

    // ── GCT-03 ───────────────────────────────────────────────────────────────

    /// GCT-03: `remove_player_from_game` succeeds when no backend controller
    /// has been set and the caller is the owner.
    #[test]
    fn gct_03_remove_player_no_backend_controller_owner_succeeds() {
        let env = Env::default();
        env.mock_all_auths();
        let (_, client, owner, _, _) = setup(&env);

        // No set_backend_game_controller call — backend_controller is None.
        let player = Address::generate(&env);
        client.remove_player_from_game(&owner, &99, &player, &7);

        let events = env.events().all();
        assert!(!events.is_empty(), "GCT-03: PlayerRemovedFromGame event must be emitted");
    }

    // ── GCT-04 ───────────────────────────────────────────────────────────────

    /// GCT-04: `export_state` reflects the backend controller address after
    /// `set_backend_game_controller` is called.
    #[test]
    fn gct_04_export_state_reflects_backend_controller() {
        let env = Env::default();
        env.mock_all_auths();
        let (_, client, _, _, _) = setup(&env);

        assert!(
            client.export_state().backend_controller.is_none(),
            "GCT-04: backend_controller must be None before it is set"
        );

        let controller = Address::generate(&env);
        client.set_backend_game_controller(&controller);

        assert_eq!(
            client.export_state().backend_controller,
            Some(controller),
            "GCT-04: export_state must reflect the newly set backend controller"
        );
    }

    // ── GCT-05 ───────────────────────────────────────────────────────────────

    /// GCT-05: `migrate` at v0 advances to v1; a second call at v1 is a no-op.
    #[test]
    fn gct_05_migrate_v0_to_v1_then_noop() {
        let env = Env::default();
        env.mock_all_auths();

        // Bootstrap minimum state without calling initialize so version stays 0.
        let contract_id = env.register(TycoonContract, ());
        let client = TycoonContractClient::new(&env, &contract_id);
        let owner = Address::generate(&env);
        let tyc_id = env
            .register_stellar_asset_contract_v2(Address::generate(&env))
            .address();
        let usdc_id = env
            .register_stellar_asset_contract_v2(Address::generate(&env))
            .address();
        let reward = Address::generate(&env);

        storage::set_owner(&env, &owner);
        storage::set_tyc_token(&env, &tyc_id);
        storage::set_usdc_token(&env, &usdc_id);
        storage::set_reward_system(&env, &reward);
        // state_version defaults to 0

        assert_eq!(storage::get_state_version(&env), 0, "GCT-05: pre-condition: version must be 0");

        client.migrate();
        assert_eq!(storage::get_state_version(&env), 1, "GCT-05: version must be 1 after first migrate");

        // Second migrate at v1 must be a no-op (no panic, version unchanged).
        client.migrate();
        assert_eq!(storage::get_state_version(&env), 1, "GCT-05: version must remain 1 after second migrate");
    }
}
