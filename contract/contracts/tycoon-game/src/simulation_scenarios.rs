/// # Simulation Scenarios — tycoon-game (SW-FE-001)
///
/// These tests exercise the contract's on-chain behaviour under realistic
/// game-session scenarios. Each scenario is self-contained: it creates its
/// own `Env::default()` so there is no shared state between runs.
///
/// ## Scenarios
///
/// | ID     | Scenario |
/// |--------|----------|
/// | SIM-01 | Treasury invariant holds across a full deposit → escrow → release cycle |
/// | SIM-02 | Treasury invariant holds after a partial withdrawal |
/// | SIM-03 | Treasury invariant is violated when liabilities exceed assets (negative test) |
/// | SIM-04 | Sequential game sessions do not corrupt treasury state |
/// | SIM-05 | Multiple players registered; each has independent user state |
/// | SIM-06 | Backend controller rotation: old controller loses access, new one gains it |
/// | SIM-07 | Collectible catalogue survives multiple set/overwrite cycles |
/// | SIM-08 | Cash tier catalogue survives multiple set/overwrite cycles |
/// | SIM-09 | Withdraw-all empties contract balance to zero |
/// | SIM-10 | Withdraw-zero is a no-op (balance unchanged) |
/// | SIM-11 | `export_state` view returns correct initialized values |
#[cfg(test)]
mod tests {
    extern crate std;
    use crate::{TycoonContract, TycoonContractClient, TreasurySnapshot};
    use soroban_sdk::{
        testutils::Address as _,
        token::{StellarAssetClient, TokenClient},
        Address, Env, String,
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

    // ── SIM-01 ────────────────────────────────────────────────────────────────

    /// SIM-01: Treasury invariant holds across a deposit → escrow → release cycle.
    #[test]
    fn sim_01_treasury_invariant_deposit_escrow_release() {
        let mut snap = TreasurySnapshot {
            sum_of_balances: 1_000,
            escrow: 0,
            liabilities: 600,
            treasury: 400,
        };
        snap.assert_invariant();

        let lock = 200_u64;
        snap.sum_of_balances -= lock;
        snap.escrow += lock;
        snap.assert_invariant();

        snap.escrow -= lock;
        snap.sum_of_balances += lock;
        snap.assert_invariant();
    }

    // ── SIM-02 ────────────────────────────────────────────────────────────────

    /// SIM-02: Treasury invariant holds after a partial withdrawal.
    #[test]
    fn sim_02_treasury_invariant_after_partial_withdrawal() {
        let mut snap = TreasurySnapshot {
            sum_of_balances: 2_000,
            escrow: 500,
            liabilities: 1_000,
            treasury: 1_500,
        };
        snap.assert_invariant();

        let withdraw = 300_u64;
        snap.sum_of_balances -= withdraw;
        snap.treasury -= withdraw;
        snap.assert_invariant();
    }

    // ── SIM-03 ────────────────────────────────────────────────────────────────

    /// SIM-03: Treasury invariant is violated when liabilities exceed assets (negative test).
    #[test]
    fn sim_03_treasury_invariant_violated_when_liabilities_exceed_assets() {
        let snap = TreasurySnapshot {
            sum_of_balances: 500,
            escrow: 100,
            liabilities: 700, // 700 > 600 total assets → invariant broken
            treasury: 0,
        };
        assert!(!snap.invariant_holds(), "SIM-03: invariant should be violated");
    }

    // ── SIM-04 ────────────────────────────────────────────────────────────────

    /// SIM-04: Sequential game sessions do not corrupt treasury state.
    #[test]
    fn sim_04_sequential_sessions_preserve_treasury_invariant() {
        let mut snap = TreasurySnapshot {
            sum_of_balances: 10_000,
            escrow: 0,
            liabilities: 5_000,
            treasury: 5_000,
        };

        for _ in 0..3 {
            let stake = 500_u64;
            snap.sum_of_balances -= stake;
            snap.escrow += stake;
            snap.assert_invariant();

            snap.escrow -= stake;
            snap.sum_of_balances += stake;
            snap.assert_invariant();
        }
    }

    // ── SIM-05 ────────────────────────────────────────────────────────────────

    /// SIM-05: Multiple players registered; each has independent user state.
    ///
    /// Uses a fixed-size array — consistent with the no_std contract style
    /// and avoids pulling in std::vec::Vec in test code.
    #[test]
    fn sim_05_multiple_players_independent_state() {
        let env = Env::default();
        env.mock_all_auths();
        let (_, client, _, _, _) = setup(&env);

        let players = [
            Address::generate(&env),
            Address::generate(&env),
            Address::generate(&env),
            Address::generate(&env),
            Address::generate(&env),
        ];
        let names = ["alice", "bob", "carol", "dave", "eve"];

        for (player, name) in players.iter().zip(names.iter()) {
            client.register_player(&String::from_str(&env, name), player);
        }

        for (player, name) in players.iter().zip(names.iter()) {
            let user = client.get_user(player).expect("user should exist");
            assert_eq!(user.username, String::from_str(&env, name));
            assert_eq!(user.address, *player);
            assert_eq!(user.games_played, 0);
            assert_eq!(user.games_won, 0);
        }
    }

    // ── SIM-06 ────────────────────────────────────────────────────────────────

    /// SIM-06: Backend controller rotation — old controller loses access, new one gains it.
    #[test]
    fn sim_06_backend_controller_rotation() {
        let env = Env::default();
        env.mock_all_auths();
        let (_, client, _, _, _) = setup(&env);

        let old_controller = Address::generate(&env);
        let new_controller = Address::generate(&env);
        let player = Address::generate(&env);

        client.set_backend_game_controller(&old_controller);
        client.remove_player_from_game(&old_controller, &1, &player, &3);

        client.set_backend_game_controller(&new_controller);
        client.remove_player_from_game(&new_controller, &2, &player, &7);

        // Old controller must now be rejected
        let res = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            client.remove_player_from_game(&old_controller, &3, &player, &1);
        }));
        assert!(res.is_err(), "SIM-06: old controller should be rejected after rotation");
    }

    // ── SIM-07 ────────────────────────────────────────────────────────────────

    /// SIM-07: Collectible catalogue survives multiple set/overwrite cycles.
    #[test]
    fn sim_07_collectible_catalogue_overwrite_cycles() {
        let env = Env::default();
        env.mock_all_auths();
        let (_, client, _, _, _) = setup(&env);

        client.set_collectible_info(&1, &5, &100, &1_000, &500, &50);
        assert_eq!(client.get_collectible_info(&1), (5, 100, 1_000, 500, 50));

        client.set_collectible_info(&1, &10, &200, &2_000, &1_000, &25);
        assert_eq!(client.get_collectible_info(&1), (10, 200, 2_000, 1_000, 25));

        client.set_collectible_info(&1, &1, &50, &500, &250, &100);
        assert_eq!(client.get_collectible_info(&1), (1, 50, 500, 250, 100));
    }

    // ── SIM-08 ────────────────────────────────────────────────────────────────

    /// SIM-08: Cash tier catalogue survives multiple set/overwrite cycles.
    #[test]
    fn sim_08_cash_tier_catalogue_overwrite_cycles() {
        let env = Env::default();
        env.mock_all_auths();
        let (_, client, _, _, _) = setup(&env);

        client.set_cash_tier_value(&1, &1_000);
        assert_eq!(client.get_cash_tier_value(&1), 1_000);

        client.set_cash_tier_value(&1, &2_500);
        assert_eq!(client.get_cash_tier_value(&1), 2_500);

        client.set_cash_tier_value(&1, &500);
        assert_eq!(client.get_cash_tier_value(&1), 500);
    }

    // ── SIM-09 ────────────────────────────────────────────────────────────────

    /// SIM-09: Withdraw-all empties contract TYC balance to exactly zero.
    #[test]
    fn sim_09_withdraw_all_empties_balance() {
        let env = Env::default();
        env.mock_all_auths();
        let (contract_id, client, _, tyc_id, _) = setup(&env);

        let total: i128 = 5_000_000_000_000_000_000_000;
        fund(&env, &tyc_id, &contract_id, total);

        let recipient = Address::generate(&env);
        client.withdraw_funds(&tyc_id, &recipient, &(total as u128));

        assert_eq!(TokenClient::new(&env, &tyc_id).balance(&contract_id), 0);
        assert_eq!(TokenClient::new(&env, &tyc_id).balance(&recipient), total);
    }

    // ── SIM-10 ────────────────────────────────────────────────────────────────

    /// SIM-10: Withdraw-zero is a no-op — contract balance is unchanged.
    #[test]
    fn sim_10_withdraw_zero_is_noop() {
        let env = Env::default();
        env.mock_all_auths();
        let (contract_id, client, _, tyc_id, _) = setup(&env);

        let total: i128 = 1_000_000_000_000_000_000_000;
        fund(&env, &tyc_id, &contract_id, total);

        let recipient = Address::generate(&env);
        client.withdraw_funds(&tyc_id, &recipient, &0);

        assert_eq!(TokenClient::new(&env, &tyc_id).balance(&contract_id), total);
        assert_eq!(TokenClient::new(&env, &tyc_id).balance(&recipient), 0);
    }

    // ── SIM-11 ────────────────────────────────────────────────────────────────

    /// SIM-11: `export_state` view returns correct initialized values.
    ///
    /// Verifies that the view function reflects the addresses passed to
    /// `initialize` and that the state version is set to 1 on first deploy.
    /// Also confirms `backend_controller` is `None` before it is explicitly set.
    #[test]
    fn sim_11_export_state_reflects_initialized_values() {
        let env = Env::default();
        env.mock_all_auths();
        let (contract_id, client, owner, tyc_id, usdc_id) = setup(&env);

        let dump = client.export_state();

        assert_eq!(dump.owner, owner, "SIM-11: owner mismatch");
        assert_eq!(dump.tyc_token, tyc_id, "SIM-11: TYC token mismatch");
        assert_eq!(dump.usdc_token, usdc_id, "SIM-11: USDC token mismatch");
        assert!(dump.is_initialized, "SIM-11: contract should be initialized");
        assert_eq!(dump.state_version, 1, "SIM-11: state version should be 1 after initialize");
        assert!(
            dump.backend_controller.is_none(),
            "SIM-11: backend_controller should be None before set_backend_game_controller"
        );
        // reward_system must differ from the game contract itself
        assert_ne!(
            dump.reward_system, contract_id,
            "SIM-11: reward_system should not equal the game contract address"
        );
    }
}
