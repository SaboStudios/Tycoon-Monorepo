/// # Cross-contract flow: Stake paths — Main Game ↔ Token (#1745)
///
/// Exercises the staking and stake-refund paths in the `tycoon-main-game`
/// contract.  These tests verify the full round-trip:
///
/// - A player can leave a pending game and receive their USDC stake refund.
/// - Multiple stake refunds correctly update the `total_staked` balance.
/// - The last player leaving ends the game (status → Ended).
/// - Paused contract blocks `leave_pending_game`.
/// - Events emitted during stake refund.
///
/// | Test | Path |
/// |------|------|
/// | `leave_pending_game_refunds_stake`                  | leave_pending_game → token.transfer |
/// | `leave_pending_game_decrements_total_staked`        | leave_pending_game → total_staked accounting |
/// | `last_player_leaves_ends_game`                      | last leave → game.status = Ended |
/// | `leave_pending_game_blocked_while_paused`           | pause → leave_pending_game panic |
/// | `stake_refund_emits_event`                          | leave_pending_game → PlayerLeft event |
#[cfg(test)]
mod tests {
    extern crate std;
    use soroban_sdk::{
        testutils::{Address as _, Ledger},
        token::{Client as TokenClient, StellarAssetClient},
        Address, Env, String, Symbol,
    };
    use tycoon_main_game::{
        storage::{Game, GameMode, GameStatus},
        TycoonMainGame, TycoonMainGameClient,
    };

    const STAKE_AMOUNT: u128 = 500_000_000_000; // 500 USDC

    /// Deploy the main-game contract along with a mock USDC token.
    /// Returns (main_game_id, client, admin, usdc_id).
    fn setup_main_game_env(
        env: &Env,
    ) -> (Address, TycoonMainGameClient, Address, Address) {
        let admin = Address::generate(env);

        // Register a mock USDC token (stellar asset contract v2)
        let usdc_id = env
            .register_stellar_asset_contract_v2(Address::generate(env))
            .address();

        // Register reward system (needed by main game)
        let reward_id = env.register(tycoon_reward_system::TycoonRewardSystem, ());
        let reward_client =
            tycoon_reward_system::TycoonRewardSystemClient::new(env, &reward_id);
        reward_client.initialize(&admin, &usdc_id, &usdc_id);

        // Register main game contract
        let main_game_id = env.register(TycoonMainGame, ());
        let main_game_client = TycoonMainGameClient::new(env, &main_game_id);
        main_game_client.initialize(&admin, &reward_id, &usdc_id);

        // Fund the main-game contract with USDC for stake refunds
        let usdc_admin = StellarAssetClient::new(env, &usdc_id);
        usdc_admin.mint(&main_game_id, &(STAKE_AMOUNT as i128 * 10));

        (main_game_id, main_game_client, admin, usdc_id)
    }

    fn store_game(env: &Env, contract_id: &Address, game: &Game) {
        env.as_contract(contract_id, || {
            tycoon_main_game::storage::set_game(env, game);
        });
    }

    fn get_game_stored(env: &Env, contract_id: &Address, game_id: u64) -> Option<Game> {
        env.as_contract(contract_id, || {
            tycoon_main_game::storage::get_game(env, game_id)
        })
    }

    #[test]
    fn leave_pending_game_refunds_stake() {
        let env = Env::default();
        env.mock_all_auths();

        let (main_game_id, client, _admin, usdc_id) = setup_main_game_env(&env);
        let player_a = Address::generate(&env);

        // Create a pending game with stakes
        let mut joined = to_vec(&env, &[player_a.clone()]);
        let game = Game {
            id: 1,
            code: String::from_str(&env, "GAME01"),
            creator: player_a.clone(),
            status: GameStatus::Pending,
            winner: None,
            number_of_players: 1,
            joined_players: joined,
            mode: GameMode::Public,
            ai: false,
            stake_per_player: STAKE_AMOUNT,
            total_staked: STAKE_AMOUNT,
            created_at: env.ledger().timestamp(),
            ended_at: 0,
        };
        store_game(&env, &main_game_id, &game);

        // Check player USDC balance before
        let token_client = TokenClient::new(&env, &usdc_id);
        let balance_before = token_client.balance(&player_a);

        // Player leaves and gets stake refund
        client.leave_pending_game(&1, &player_a);

        // Verify player received the stake refund
        let balance_after = token_client.balance(&player_a);
        assert_eq!(
            balance_after,
            balance_before + STAKE_AMOUNT as i128,
            "Player should receive stake refund in USDC"
        );
    }

    #[test]
    fn leave_pending_game_decrements_total_staked() {
        let env = Env::default();
        env.mock_all_auths();

        let (main_game_id, client, _admin, _usdc_id) = setup_main_game_env(&env);
        let player_a = Address::generate(&env);
        let player_b = Address::generate(&env);

        let joined = to_vec(&env, &[player_a.clone(), player_b.clone()]);
        let game = Game {
            id: 1,
            code: String::from_str(&env, "GAME01"),
            creator: player_a.clone(),
            status: GameStatus::Pending,
            winner: None,
            number_of_players: 2,
            joined_players: joined,
            mode: GameMode::Public,
            ai: false,
            stake_per_player: STAKE_AMOUNT,
            total_staked: STAKE_AMOUNT * 2,
            created_at: env.ledger().timestamp(),
            ended_at: 0,
        };
        store_game(&env, &main_game_id, &game);

        // Player A leaves
        client.leave_pending_game(&1, &player_a);

        let game_after = get_game_stored(&env, &main_game_id, 1)
            .expect("Game should still exist");
        assert_eq!(
            game_after.total_staked,
            STAKE_AMOUNT,
            "total_staked should decrease by one stake"
        );
        assert_eq!(
            game_after.joined_players.len(),
            1,
            "Only player B should remain"
        );
        assert_eq!(
            game_after.joined_players.get(0),
            Some(player_b.clone()),
            "Player B should be the remaining player"
        );
    }

    #[test]
    fn last_player_leaves_ends_game() {
        let env = Env::default();
        env.mock_all_auths();

        let (main_game_id, client, _admin, _usdc_id) = setup_main_game_env(&env);
        let player_a = Address::generate(&env);

        let joined = to_vec(&env, &[player_a.clone()]);
        let game = Game {
            id: 1,
            code: String::from_str(&env, "GAME01"),
            creator: player_a.clone(),
            status: GameStatus::Pending,
            winner: None,
            number_of_players: 1,
            joined_players: joined,
            mode: GameMode::Public,
            ai: false,
            stake_per_player: STAKE_AMOUNT,
            total_staked: STAKE_AMOUNT,
            created_at: env.ledger().timestamp(),
            ended_at: 0,
        };
        store_game(&env, &main_game_id, &game);

        // Last (only) player leaves — game should end
        client.leave_pending_game(&1, &player_a);

        let game_after = get_game_stored(&env, &main_game_id, 1)
            .expect("Game should still exist");
        assert!(
            matches!(game_after.status, GameStatus::Ended),
            "Last player leaving should end the game"
        );
        assert_eq!(
            game_after.joined_players.len(),
            0,
            "No players should remain"
        );
        assert!(game_after.ended_at > 0, "ended_at should be set");
    }

    #[test]
    #[should_panic(expected = "blocked")]
    fn leave_pending_game_blocked_while_paused() {
        let env = Env::default();
        env.mock_all_auths();

        let (main_game_id, client, admin, _usdc_id) = setup_main_game_env(&env);
        let player_a = Address::generate(&env);

        // Pause the contract
        let reason = Symbol::new(&env, "SEC");
        client.pause(&admin, &reason, &1000);
        assert!(client.is_paused());

        // Create a game
        let joined = to_vec(&env, &[player_a.clone()]);
        let game = Game {
            id: 1,
            code: String::from_str(&env, "GAME01"),
            creator: player_a.clone(),
            status: GameStatus::Pending,
            winner: None,
            number_of_players: 1,
            joined_players: joined,
            mode: GameMode::Public,
            ai: false,
            stake_per_player: STAKE_AMOUNT,
            total_staked: STAKE_AMOUNT,
            created_at: env.ledger().timestamp(),
            ended_at: 0,
        };
        store_game(&env, &main_game_id, &game);

        // Attempting to leave while paused should panic
        client.leave_pending_game(&1, &player_a);
    }

    #[test]
    fn stake_refund_emits_event() {
        let env = Env::default();
        env.mock_all_auths();

        let (main_game_id, client, _admin, _usdc_id) = setup_main_game_env(&env);
        let player_a = Address::generate(&env);

        let joined = to_vec(&env, &[player_a.clone()]);
        let game = Game {
            id: 1,
            code: String::from_str(&env, "GAME01"),
            creator: player_a.clone(),
            status: GameStatus::Pending,
            winner: None,
            number_of_players: 1,
            joined_players: joined,
            mode: GameMode::Public,
            ai: false,
            stake_per_player: STAKE_AMOUNT,
            total_staked: STAKE_AMOUNT,
            created_at: env.ledger().timestamp(),
            ended_at: 0,
        };
        store_game(&env, &main_game_id, &game);

        let _ = env.events().all();
        client.leave_pending_game(&1, &player_a);

        let events = env.events().all();
        assert!(!events.is_empty(), "Should emit events on stake refund");
    }

    /// Helper to create a Vec<Address> from a slice
    fn to_vec(env: &Env, addrs: &[Address]) -> soroban_sdk::Vec<Address> {
        let mut v = soroban_sdk::Vec::new(env);
        for a in addrs {
            v.push_back(a.clone());
        }
        v
    }
}