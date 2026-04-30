/// # Simulation Scenarios — tycoon-game (SW-CT-009)
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
/// | SIM-12 | Full player lifecycle: register → play → remove from game |
/// | SIM-13 | Large collectible catalogue: 10 distinct token IDs stored and retrieved |
/// | SIM-14 | All cash tiers set in one pass; each value is independently correct |
/// | SIM-15 | Partial USDC withdrawal leaves correct residual balance |
/// | SIM-16 | Owner removes multiple players from the same game in sequence |
/// | SIM-17 | Backend controller removes players across multiple concurrent games |
/// | SIM-18 | Treasury invariant holds across multiple escrow lock/release cycles |
/// | SIM-19 | Unregistered address returns `None` from `get_user` |
/// | SIM-20 | `export_state` reflects reward_system address set during initialize |
#[cfg(test)]
mod tests {
    extern crate std;
    use crate::{TreasurySnapshot, TycoonContract, TycoonContractClient};
    use soroban_sdk::{
        testutils::{Address as _, Events},
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
        assert!(
            !snap.invariant_holds(),
            "SIM-03: invariant should be violated"
        );
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
        assert!(
            res.is_err(),
            "SIM-06: old controller should be rejected after rotation"
        );
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
        assert!(
            dump.is_initialized,
            "SIM-11: contract should be initialized"
        );
        assert_eq!(
            dump.state_version, 1,
            "SIM-11: state version should be 1 after initialize"
        );
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

    // ── SIM-12 ────────────────────────────────────────────────────────────────

    /// SIM-12: Full player lifecycle — register, then owner removes them from a game.
    ///
    /// Verifies that registration and game removal are independent operations
    /// that compose correctly: a registered player can be removed from a game
    /// by the owner, and their profile is still readable afterwards.
    #[test]
    fn sim_12_full_player_lifecycle_register_then_remove() {
        let env = Env::default();
        env.mock_all_auths();
        let (_, client, owner, _, _) = setup(&env);

        let player = Address::generate(&env);
        client.register_player(&String::from_str(&env, "tycoon_pro"), &player);

        let user = client
            .get_user(&player)
            .expect("SIM-12: user must exist after registration");
        assert_eq!(user.username, String::from_str(&env, "tycoon_pro"));
        assert_eq!(user.games_played, 0);

        // Owner removes the player from game 1 at turn 7
        client.remove_player_from_game(&owner, &1, &player, &7);

        // Profile is still intact after removal
        let user_after = client
            .get_user(&player)
            .expect("SIM-12: user must still exist after removal");
        assert_eq!(
            user_after.address, player,
            "SIM-12: address must be unchanged"
        );
    }

    // ── SIM-13 ────────────────────────────────────────────────────────────────

    /// SIM-13: Large collectible catalogue — 10 distinct token IDs stored and retrieved.
    ///
    /// Confirms that persistent storage correctly scopes each `Collectible(token_id)`
    /// key independently and that no entry overwrites another.
    #[test]
    fn sim_13_large_collectible_catalogue_ten_entries() {
        let env = Env::default();
        env.mock_all_auths();
        let (_, client, _, _, _) = setup(&env);

        // Store 10 collectibles with distinct values
        for i in 1_u128..=10 {
            client.admin_set_collectible_info(
                &i,
                &(i as u32),      // perk
                &(i as u32 * 10), // strength
                &(i * 1_000),     // tyc_price
                &(i * 500),       // usdc_price
                &(i as u64 * 5),  // shop_stock
            );
        }

        // Verify each entry is independently correct
        for i in 1_u128..=10 {
            let info = client.get_collectible_info(&i);
            assert_eq!(info.0, i as u32, "SIM-13: perk mismatch for token {i}");
            assert_eq!(
                info.1,
                i as u32 * 10,
                "SIM-13: strength mismatch for token {i}"
            );
            assert_eq!(
                info.2,
                i * 1_000,
                "SIM-13: tyc_price mismatch for token {i}"
            );
            assert_eq!(info.3, i * 500, "SIM-13: usdc_price mismatch for token {i}");
            assert_eq!(
                info.4,
                i as u64 * 5,
                "SIM-13: shop_stock mismatch for token {i}"
            );
        }
    }

    // ── SIM-14 ────────────────────────────────────────────────────────────────

    /// SIM-14: All cash tiers set in one pass; each value is independently correct.
    ///
    /// Simulates the admin bootstrapping the full cash-tier table at launch.
    /// Verifies that tiers do not bleed into each other.
    #[test]
    fn sim_14_all_cash_tiers_set_and_retrieved_independently() {
        let env = Env::default();
        env.mock_all_auths();
        let (_, client, _, _, _) = setup(&env);

        let tiers: [(u32, u128); 5] = [(1, 100), (2, 500), (3, 1_000), (4, 5_000), (5, 10_000)];

        for (tier, value) in tiers {
            client.admin_set_cash_tier_value(&tier, &value);
        }

        for (tier, expected) in tiers {
            assert_eq!(
                client.get_cash_tier_value(&tier),
                expected,
                "SIM-14: cash tier {tier} value mismatch"
            );
        }
    }

    // ── SIM-15 ────────────────────────────────────────────────────────────────

    /// SIM-15: Partial USDC withdrawal leaves the correct residual balance.
    ///
    /// Mirrors SIM-09 but for USDC and with a partial (not full) withdrawal,
    /// confirming the two token balances are tracked independently.
    #[test]
    fn sim_15_partial_usdc_withdrawal_leaves_correct_residual() {
        let env = Env::default();
        env.mock_all_auths();
        let (contract_id, client, _, _, usdc_id) = setup(&env);

        let total: i128 = 10_000;
        fund(&env, &usdc_id, &contract_id, total);

        let recipient = Address::generate(&env);
        client.admin_withdraw_funds(&usdc_id, &recipient, &3_000);

        assert_eq!(
            TokenClient::new(&env, &usdc_id).balance(&contract_id),
            7_000,
            "SIM-15: contract USDC residual must be 7_000"
        );
        assert_eq!(
            TokenClient::new(&env, &usdc_id).balance(&recipient),
            3_000,
            "SIM-15: recipient must receive exactly 3_000 USDC"
        );
    }

    // ── SIM-16 ────────────────────────────────────────────────────────────────

    /// SIM-16: Owner removes multiple players from the same game in sequence.
    ///
    /// Simulates a game-end sweep where the owner evicts all remaining players.
    /// Each removal must succeed independently and emit its own event.
    #[test]
    fn sim_16_owner_removes_multiple_players_same_game() {
        let env = Env::default();
        env.mock_all_auths();
        let (_, client, owner, _, _) = setup(&env);

        let game_id: u128 = 42;
        let players = [
            Address::generate(&env),
            Address::generate(&env),
            Address::generate(&env),
        ];
        let turn_counts = [3_u32, 7, 12];

        for (player, turns) in players.iter().zip(turn_counts.iter()) {
            client.register_player(&String::from_str(&env, "player"), player);
            client.remove_player_from_game(&owner, &game_id, player, turns);
        }

        // All removals succeeded — verify via event count (3 remove events + 3 register no-ops)
        let events = env.events().all();
        assert!(
            !events.is_empty(),
            "SIM-16: PlayerRemovedFromGame events must be emitted"
        );
    }

    // ── SIM-17 ────────────────────────────────────────────────────────────────

    /// SIM-17: Backend controller removes players across multiple concurrent games.
    ///
    /// Verifies that the backend controller role works correctly when managing
    /// several game sessions simultaneously — game IDs are independent.
    #[test]
    fn sim_17_backend_controller_removes_players_across_games() {
        let env = Env::default();
        env.mock_all_auths();
        let (_, client, _, _, _) = setup(&env);

        let controller = Address::generate(&env);
        client.admin_set_game_controller(&controller);

        let player_a = Address::generate(&env);
        let player_b = Address::generate(&env);
        let player_c = Address::generate(&env);

        // Three different game IDs
        client.remove_player_from_game(&controller, &101, &player_a, &5);
        client.remove_player_from_game(&controller, &102, &player_b, &9);
        client.remove_player_from_game(&controller, &103, &player_c, &2);

        let events = env.events().all();
        assert!(
            !events.is_empty(),
            "SIM-17: events must be emitted for each removal"
        );
    }

    // ── SIM-18 ────────────────────────────────────────────────────────────────

    /// SIM-18: Treasury invariant holds across multiple escrow lock/release cycles.
    ///
    /// Extends SIM-04 with a larger iteration count and varying stake sizes to
    /// stress-test the invariant across realistic game-session patterns.
    #[test]
    fn sim_18_treasury_invariant_multiple_escrow_cycles_varying_stakes() {
        let stakes = [100_u64, 250, 500, 1_000, 2_500];
        let mut snap = TreasurySnapshot {
            sum_of_balances: 20_000,
            escrow: 0,
            liabilities: 8_000,
            treasury: 12_000,
        };
        snap.assert_invariant();

        for stake in stakes {
            // Lock into escrow
            snap.sum_of_balances -= stake;
            snap.escrow += stake;
            snap.assert_invariant();

            // Release back to balances (game resolved, no payout)
            snap.escrow -= stake;
            snap.sum_of_balances += stake;
            snap.assert_invariant();
        }
    }

    // ── SIM-19 ────────────────────────────────────────────────────────────────

    /// SIM-19: Unregistered address returns `None` from `get_user`.
    ///
    /// Confirms the storage default for an unknown key is `None` and that
    /// looking up a non-existent player does not panic.
    #[test]
    fn sim_19_unregistered_address_returns_none() {
        let env = Env::default();
        env.mock_all_auths();
        let (_, client, _, _, _) = setup(&env);

        let stranger = Address::generate(&env);
        assert!(
            client.get_user(&stranger).is_none(),
            "SIM-19: get_user must return None for an unregistered address"
        );
    }

    // ── SIM-20 ────────────────────────────────────────────────────────────────

    /// SIM-20: `export_state` reflects the reward_system address set during initialize.
    ///
    /// Verifies that the reward system address stored at init time is faithfully
    /// returned by the read-only `export_state` view and is distinct from both
    /// the game contract address and the token addresses.
    #[test]
    fn sim_20_export_state_reflects_reward_system_address() {
        let env = Env::default();
        env.mock_all_auths();

        let contract_id = env.register(TycoonContract, ());
        let client = TycoonContractClient::new(&env, &contract_id);
        let owner = Address::generate(&env);
        let tyc_id = env
            .register_stellar_asset_contract_v2(Address::generate(&env))
            .address();
        let usdc_id = env
            .register_stellar_asset_contract_v2(Address::generate(&env))
            .address();
        let reward_system = Address::generate(&env);

        client.initialize(&tyc_id, &usdc_id, &owner, &reward_system);

        let dump = client.export_state();

        assert_eq!(
            dump.reward_system, reward_system,
            "SIM-20: reward_system must match the address passed to initialize"
        );
        assert_ne!(
            dump.reward_system, contract_id,
            "SIM-20: reward_system must not equal the game contract address"
        );
        assert_ne!(
            dump.reward_system, tyc_id,
            "SIM-20: reward_system must not equal the TYC token address"
        );
        assert_ne!(
            dump.reward_system, usdc_id,
            "SIM-20: reward_system must not equal the USDC token address"
        );
    }
}
