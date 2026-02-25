#![cfg(test)]

use super::*;
use crate::storage::{
    get_game, get_game_settings, next_game_id, set_game, set_game_settings, Game, GameMode,
    GameSettings, GameStatus,
};
use soroban_sdk::{
    testutils::{Address as _, Events},
    token::{StellarAssetClient, TokenClient},
    Address, Env, String, Vec,
};

// -----------------------------------------------------------------------
// Test helpers
// -----------------------------------------------------------------------

/// Returns (contract_id, client, owner, reward_system, usdc_token_address).
fn setup_contract(env: &Env) -> (Address, TycoonMainGameClient<'_>, Address, Address, Address) {
    let contract_id = env.register(TycoonMainGame, ());
    let client = TycoonMainGameClient::new(env, &contract_id);

    let owner = Address::generate(env);
    let reward_system = Address::generate(env);

    // Create a real Stellar asset so token transfers work in tests
    let usdc_admin = Address::generate(env);
    let usdc_token = env
        .register_stellar_asset_contract_v2(usdc_admin.clone())
        .address();

    (contract_id, client, owner, reward_system, usdc_token)
}

fn make_settings(env: &Env) -> GameSettings {
    GameSettings {
        max_players: 4,
        auction: false,
        starting_cash: 1500,
        private_room_code: String::from_str(env, ""),
    }
}

fn make_game(env: &Env, id: u64, creator: Address) -> Game {
    let mut players = Vec::new(env);
    players.push_back(creator.clone());

    Game {
        id,
        code: String::from_str(env, "ABC123"),
        creator: creator.clone(),
        status: GameStatus::Pending,
        winner: None,
        number_of_players: 4,
        joined_players: players,
        mode: GameMode::Public,
        ai: false,
        stake_per_player: 100,
        total_staked: 100,
        created_at: 1_000_000,
        ended_at: 0,
    }
}

/// Build a game with optional extra players and a configurable stake.
fn make_game_with_stake(
    env: &Env,
    id: u64,
    creator: Address,
    stake: u128,
    extra_players: &[Address],
) -> Game {
    let mut players = Vec::new(env);
    players.push_back(creator.clone());
    for p in extra_players {
        players.push_back(p.clone());
    }
    let total_staked = stake * players.len() as u128;

    Game {
        id,
        code: String::from_str(env, "TEST01"),
        creator,
        status: GameStatus::Pending,
        winner: None,
        number_of_players: 4,
        joined_players: players,
        mode: GameMode::Public,
        ai: false,
        stake_per_player: stake,
        total_staked,
        created_at: 1_000,
        ended_at: 0,
    }
}

// -----------------------------------------------------------------------
// Existing: GameSettings struct tests
// -----------------------------------------------------------------------

#[test]
fn test_game_settings_stores_and_retrieves() {
    let env = Env::default();
    env.mock_all_auths();
    let (contract_id, _, _, _, _) = setup_contract(&env);

    let settings = make_settings(&env);

    env.as_contract(&contract_id, || {
        set_game_settings(&env, 1, &settings);
        let retrieved = get_game_settings(&env, 1).expect("Settings not found");
        assert_eq!(retrieved.max_players, 4);
        assert_eq!(retrieved.auction, false);
        assert_eq!(retrieved.starting_cash, 1500);
        assert_eq!(retrieved.private_room_code, String::from_str(&env, ""));
    });
}

#[test]
fn test_game_settings_private_room_code_stored() {
    let env = Env::default();
    env.mock_all_auths();
    let (contract_id, _, _, _, _) = setup_contract(&env);

    let settings = GameSettings {
        max_players: 2,
        auction: true,
        starting_cash: 2000,
        private_room_code: String::from_str(&env, "SECRET99"),
    };

    env.as_contract(&contract_id, || {
        set_game_settings(&env, 42, &settings);
        let retrieved = get_game_settings(&env, 42).unwrap();
        assert_eq!(
            retrieved.private_room_code,
            String::from_str(&env, "SECRET99")
        );
        assert_eq!(retrieved.auction, true);
        assert_eq!(retrieved.max_players, 2);
        assert_eq!(retrieved.starting_cash, 2000);
    });
}

#[test]
fn test_game_settings_returns_none_for_unknown_id() {
    let env = Env::default();
    env.mock_all_auths();
    let (contract_id, _, _, _, _) = setup_contract(&env);

    env.as_contract(&contract_id, || {
        assert!(get_game_settings(&env, 999).is_none());
    });
}

#[test]
fn test_game_settings_overwrite() {
    let env = Env::default();
    env.mock_all_auths();
    let (contract_id, _, _, _, _) = setup_contract(&env);

    env.as_contract(&contract_id, || {
        let v1 = GameSettings {
            max_players: 4,
            auction: false,
            starting_cash: 1500,
            private_room_code: String::from_str(&env, ""),
        };
        set_game_settings(&env, 1, &v1);

        let v2 = GameSettings {
            max_players: 6,
            auction: true,
            starting_cash: 3000,
            private_room_code: String::from_str(&env, "NEWCODE"),
        };
        set_game_settings(&env, 1, &v2);

        let retrieved = get_game_settings(&env, 1).unwrap();
        assert_eq!(retrieved.max_players, 6);
        assert_eq!(retrieved.starting_cash, 3000);
        assert_eq!(
            retrieved.private_room_code,
            String::from_str(&env, "NEWCODE")
        );
    });
}

// -----------------------------------------------------------------------
// Existing: Game struct tests
// -----------------------------------------------------------------------

#[test]
fn test_game_stores_and_retrieves_all_fields() {
    let env = Env::default();
    env.mock_all_auths();
    let (contract_id, _, _, _, _) = setup_contract(&env);

    let creator = Address::generate(&env);
    let game = make_game(&env, 1, creator.clone());

    env.as_contract(&contract_id, || {
        set_game(&env, &game);
        let retrieved = get_game(&env, 1).expect("Game not found");
        assert_eq!(retrieved.id, 1);
        assert_eq!(retrieved.code, String::from_str(&env, "ABC123"));
        assert_eq!(retrieved.creator, creator);
        assert_eq!(retrieved.status, GameStatus::Pending);
        assert_eq!(retrieved.winner, None);
        assert_eq!(retrieved.number_of_players, 4);
        assert_eq!(retrieved.joined_players.len(), 1);
        assert_eq!(retrieved.mode, GameMode::Public);
        assert_eq!(retrieved.ai, false);
        assert_eq!(retrieved.stake_per_player, 100);
        assert_eq!(retrieved.total_staked, 100);
        assert_eq!(retrieved.created_at, 1_000_000);
        assert_eq!(retrieved.ended_at, 0);
    });
}

#[test]
fn test_game_returns_none_for_unknown_id() {
    let env = Env::default();
    env.mock_all_auths();
    let (contract_id, _, _, _, _) = setup_contract(&env);

    env.as_contract(&contract_id, || {
        assert!(get_game(&env, 404).is_none());
    });
}

#[test]
fn test_game_status_transitions_stored_correctly() {
    let env = Env::default();
    env.mock_all_auths();
    let (contract_id, _, _, _, _) = setup_contract(&env);

    let creator = Address::generate(&env);
    let mut game = make_game(&env, 1, creator);

    env.as_contract(&contract_id, || {
        set_game(&env, &game);
        assert_eq!(get_game(&env, 1).unwrap().status, GameStatus::Pending);

        game.status = GameStatus::Ongoing;
        set_game(&env, &game);
        assert_eq!(get_game(&env, 1).unwrap().status, GameStatus::Ongoing);

        game.status = GameStatus::Ended;
        game.ended_at = 2_000_000;
        set_game(&env, &game);
        let ended = get_game(&env, 1).unwrap();
        assert_eq!(ended.status, GameStatus::Ended);
        assert_eq!(ended.ended_at, 2_000_000);
    });
}

#[test]
fn test_game_winner_stored_correctly() {
    let env = Env::default();
    env.mock_all_auths();
    let (contract_id, _, _, _, _) = setup_contract(&env);

    let creator = Address::generate(&env);
    let winner = Address::generate(&env);
    let mut game = make_game(&env, 1, creator);
    game.status = GameStatus::Ended;
    game.winner = Some(winner.clone());
    game.ended_at = 5_000_000;

    env.as_contract(&contract_id, || {
        set_game(&env, &game);
        let retrieved = get_game(&env, 1).unwrap();
        assert_eq!(retrieved.winner, Some(winner));
        assert_eq!(retrieved.ended_at, 5_000_000);
    });
}

#[test]
fn test_game_joined_players_stored_correctly() {
    let env = Env::default();
    env.mock_all_auths();
    let (contract_id, _, _, _, _) = setup_contract(&env);

    let creator = Address::generate(&env);
    let player2 = Address::generate(&env);
    let player3 = Address::generate(&env);

    let mut players = Vec::new(&env);
    players.push_back(creator.clone());
    players.push_back(player2.clone());
    players.push_back(player3.clone());

    let game = Game {
        id: 1,
        code: String::from_str(&env, "XYZ789"),
        creator: creator.clone(),
        status: GameStatus::Ongoing,
        winner: None,
        number_of_players: 4,
        joined_players: players,
        mode: GameMode::Public,
        ai: false,
        stake_per_player: 0,
        total_staked: 0,
        created_at: 1_000,
        ended_at: 0,
    };

    env.as_contract(&contract_id, || {
        set_game(&env, &game);
        let retrieved = get_game(&env, 1).unwrap();
        assert_eq!(retrieved.joined_players.len(), 3);
        assert_eq!(retrieved.joined_players.get(0), Some(creator));
        assert_eq!(retrieved.joined_players.get(1), Some(player2));
        assert_eq!(retrieved.joined_players.get(2), Some(player3));
    });
}

#[test]
fn test_game_ai_flag_stored() {
    let env = Env::default();
    env.mock_all_auths();
    let (contract_id, _, _, _, _) = setup_contract(&env);

    let creator = Address::generate(&env);
    let mut game = make_game(&env, 1, creator);
    game.ai = true;

    env.as_contract(&contract_id, || {
        set_game(&env, &game);
        assert!(get_game(&env, 1).unwrap().ai);
    });
}

#[test]
fn test_game_private_mode_stored() {
    let env = Env::default();
    env.mock_all_auths();
    let (contract_id, _, _, _, _) = setup_contract(&env);

    let creator = Address::generate(&env);
    let mut game = make_game(&env, 1, creator);
    game.mode = GameMode::Private;

    env.as_contract(&contract_id, || {
        set_game(&env, &game);
        assert_eq!(get_game(&env, 1).unwrap().mode, GameMode::Private);
    });
}

#[test]
fn test_game_staking_fields_stored() {
    let env = Env::default();
    env.mock_all_auths();
    let (contract_id, _, _, _, _) = setup_contract(&env);

    let creator = Address::generate(&env);
    let mut game = make_game(&env, 1, creator);
    game.stake_per_player = 500;
    game.total_staked = 2000;

    env.as_contract(&contract_id, || {
        set_game(&env, &game);
        let retrieved = get_game(&env, 1).unwrap();
        assert_eq!(retrieved.stake_per_player, 500);
        assert_eq!(retrieved.total_staked, 2000);
    });
}

#[test]
fn test_multiple_games_stored_independently() {
    let env = Env::default();
    env.mock_all_auths();
    let (contract_id, _, _, _, _) = setup_contract(&env);

    let creator1 = Address::generate(&env);
    let creator2 = Address::generate(&env);

    let game1 = make_game(&env, 1, creator1.clone());
    let mut game2 = make_game(&env, 2, creator2.clone());
    game2.code = String::from_str(&env, "GAME2X");
    game2.mode = GameMode::Private;
    game2.stake_per_player = 250;

    env.as_contract(&contract_id, || {
        set_game(&env, &game1);
        set_game(&env, &game2);

        let r1 = get_game(&env, 1).unwrap();
        let r2 = get_game(&env, 2).unwrap();

        assert_eq!(r1.id, 1);
        assert_eq!(r1.creator, creator1);
        assert_eq!(r1.mode, GameMode::Public);

        assert_eq!(r2.id, 2);
        assert_eq!(r2.creator, creator2);
        assert_eq!(r2.mode, GameMode::Private);
        assert_eq!(r2.stake_per_player, 250);
        assert_eq!(r2.code, String::from_str(&env, "GAME2X"));
    });
}

#[test]
fn test_game_and_settings_stored_independently_for_same_id() {
    let env = Env::default();
    env.mock_all_auths();
    let (contract_id, _, _, _, _) = setup_contract(&env);

    let creator = Address::generate(&env);
    let game = make_game(&env, 1, creator);
    let settings = GameSettings {
        max_players: 4,
        auction: true,
        starting_cash: 2000,
        private_room_code: String::from_str(&env, "ROOM1"),
    };

    env.as_contract(&contract_id, || {
        set_game(&env, &game);
        set_game_settings(&env, 1, &settings);

        let retrieved_game = get_game(&env, 1).unwrap();
        let retrieved_settings = get_game_settings(&env, 1).unwrap();

        assert_eq!(retrieved_game.id, 1);
        assert_eq!(retrieved_settings.max_players, 4);
        assert_eq!(retrieved_settings.auction, true);
    });
}

// -----------------------------------------------------------------------
// Existing: next_game_id tests
// -----------------------------------------------------------------------

#[test]
fn test_next_game_id_increments() {
    let env = Env::default();
    env.mock_all_auths();
    let (contract_id, _, _, _, _) = setup_contract(&env);

    env.as_contract(&contract_id, || {
        assert_eq!(next_game_id(&env), 1);
        assert_eq!(next_game_id(&env), 2);
        assert_eq!(next_game_id(&env), 3);
    });
}

// -----------------------------------------------------------------------
// Existing: Contract view function tests (updated initialize signature)
// -----------------------------------------------------------------------

#[test]
fn test_get_game_via_contract_view() {
    let env = Env::default();
    env.mock_all_auths();
    let (contract_id, client, owner, reward_system, usdc_token) = setup_contract(&env);

    client.initialize(&owner, &reward_system, &usdc_token);

    let creator = Address::generate(&env);
    let game = make_game(&env, 1, creator);

    env.as_contract(&contract_id, || {
        set_game(&env, &game);
    });

    let retrieved = client.get_game(&1).expect("Game not returned");
    assert_eq!(retrieved.id, 1);
    assert_eq!(retrieved.status, GameStatus::Pending);
}

#[test]
fn test_get_game_settings_via_contract_view() {
    let env = Env::default();
    env.mock_all_auths();
    let (contract_id, client, owner, reward_system, usdc_token) = setup_contract(&env);

    client.initialize(&owner, &reward_system, &usdc_token);

    let settings = make_settings(&env);

    env.as_contract(&contract_id, || {
        set_game_settings(&env, 1, &settings);
    });

    let retrieved = client.get_game_settings(&1).expect("Settings not returned");
    assert_eq!(retrieved.max_players, 4);
    assert_eq!(retrieved.starting_cash, 1500);
}

#[test]
fn test_get_game_returns_none_for_unknown_via_contract() {
    let env = Env::default();
    env.mock_all_auths();
    let (_, client, owner, reward_system, usdc_token) = setup_contract(&env);

    client.initialize(&owner, &reward_system, &usdc_token);

    assert!(client.get_game(&999).is_none());
}

// -----------------------------------------------------------------------
// initialize — updated signature tests
// -----------------------------------------------------------------------

#[test]
fn test_initialize_stores_all_values() {
    let env = Env::default();
    env.mock_all_auths();
    let (contract_id, client, owner, reward_system, usdc_token) = setup_contract(&env);

    client.initialize(&owner, &reward_system, &usdc_token);

    env.as_contract(&contract_id, || {
        assert_eq!(storage::get_owner(&env), owner);
        assert_eq!(storage::get_reward_system(&env), reward_system);
        assert_eq!(storage::get_usdc_token(&env), usdc_token);
    });
}

#[test]
#[should_panic(expected = "Contract already initialized")]
fn test_initialize_twice_panics() {
    let env = Env::default();
    env.mock_all_auths();
    let (_, client, owner, reward_system, usdc_token) = setup_contract(&env);

    client.initialize(&owner, &reward_system, &usdc_token);
    client.initialize(&owner, &reward_system, &usdc_token);
}

// -----------------------------------------------------------------------
// leave_pending_game — success cases
// -----------------------------------------------------------------------

#[test]
fn test_leave_pending_game_removes_player() {
    let env = Env::default();
    env.mock_all_auths();
    let (contract_id, client, owner, reward_system, usdc_token) = setup_contract(&env);
    client.initialize(&owner, &reward_system, &usdc_token);

    let creator = Address::generate(&env);
    let player2 = Address::generate(&env);

    env.as_contract(&contract_id, || {
        let id = next_game_id(&env);
        set_game(
            &env,
            &make_game_with_stake(&env, id, creator.clone(), 0, &[player2.clone()]),
        );
    });

    client.leave_pending_game(&1, &player2);

    let game = client.get_game(&1).unwrap();
    assert_eq!(game.joined_players.len(), 1);
    assert_eq!(game.joined_players.get(0), Some(creator));
    assert!(matches!(game.status, GameStatus::Pending));
}

#[test]
fn test_leave_pending_game_with_stake_refunds_player() {
    let env = Env::default();
    env.mock_all_auths();
    let (contract_id, client, owner, reward_system, usdc_token) = setup_contract(&env);
    client.initialize(&owner, &reward_system, &usdc_token);

    let creator = Address::generate(&env);
    let player2 = Address::generate(&env);
    let stake: u128 = 500;

    // Fund the contract so it can pay the refund
    StellarAssetClient::new(&env, &usdc_token).mint(&contract_id, &(stake as i128 * 2));

    env.as_contract(&contract_id, || {
        let id = next_game_id(&env);
        set_game(
            &env,
            &make_game_with_stake(&env, id, creator.clone(), stake, &[player2.clone()]),
        );
    });

    let before = TokenClient::new(&env, &usdc_token).balance(&player2);
    client.leave_pending_game(&1, &player2);
    let after = TokenClient::new(&env, &usdc_token).balance(&player2);

    assert_eq!(after - before, stake as i128);
}

#[test]
fn test_leave_pending_game_decrements_total_staked() {
    let env = Env::default();
    env.mock_all_auths();
    let (contract_id, client, owner, reward_system, usdc_token) = setup_contract(&env);
    client.initialize(&owner, &reward_system, &usdc_token);

    let creator = Address::generate(&env);
    let player2 = Address::generate(&env);
    let stake: u128 = 200;

    StellarAssetClient::new(&env, &usdc_token).mint(&contract_id, &(stake as i128 * 2));

    env.as_contract(&contract_id, || {
        let id = next_game_id(&env);
        set_game(
            &env,
            &make_game_with_stake(&env, id, creator.clone(), stake, &[player2.clone()]),
        );
    });

    let before = client.get_game(&1).unwrap().total_staked;
    client.leave_pending_game(&1, &player2);
    let after = client.get_game(&1).unwrap().total_staked;

    assert_eq!(before - after, stake);
}

#[test]
fn test_leave_pending_game_zero_stake_no_transfer() {
    let env = Env::default();
    env.mock_all_auths();
    let (contract_id, client, owner, reward_system, usdc_token) = setup_contract(&env);
    client.initialize(&owner, &reward_system, &usdc_token);

    let creator = Address::generate(&env);
    let player2 = Address::generate(&env);

    // No USDC minted — a transfer attempt would fail, proving no transfer occurs
    env.as_contract(&contract_id, || {
        let id = next_game_id(&env);
        set_game(
            &env,
            &make_game_with_stake(&env, id, creator.clone(), 0, &[player2.clone()]),
        );
    });

    client.leave_pending_game(&1, &player2);

    let game = client.get_game(&1).unwrap();
    assert_eq!(game.joined_players.len(), 1);
    assert_eq!(game.total_staked, 0);
}

#[test]
fn test_leave_pending_game_middle_player_leaves() {
    let env = Env::default();
    env.mock_all_auths();
    let (contract_id, client, owner, reward_system, usdc_token) = setup_contract(&env);
    client.initialize(&owner, &reward_system, &usdc_token);

    let creator = Address::generate(&env);
    let player2 = Address::generate(&env);
    let player3 = Address::generate(&env);

    env.as_contract(&contract_id, || {
        let id = next_game_id(&env);
        set_game(
            &env,
            &make_game_with_stake(
                &env,
                id,
                creator.clone(),
                0,
                &[player2.clone(), player3.clone()],
            ),
        );
    });

    client.leave_pending_game(&1, &player2);

    let game = client.get_game(&1).unwrap();
    assert_eq!(game.joined_players.len(), 2);
    // player2 must not be present
    for i in 0..game.joined_players.len() {
        assert_ne!(game.joined_players.get(i), Some(player2.clone()));
    }
    assert!(matches!(game.status, GameStatus::Pending));
}

// -----------------------------------------------------------------------
// leave_pending_game — event tests
// -----------------------------------------------------------------------

#[test]
fn test_leave_pending_game_emits_player_left_event() {
    let env = Env::default();
    env.mock_all_auths();
    let (contract_id, client, owner, reward_system, usdc_token) = setup_contract(&env);
    client.initialize(&owner, &reward_system, &usdc_token);

    let creator = Address::generate(&env);
    let player2 = Address::generate(&env);

    env.as_contract(&contract_id, || {
        let id = next_game_id(&env);
        set_game(
            &env,
            &make_game_with_stake(&env, id, creator, 0, &[player2.clone()]),
        );
    });

    client.leave_pending_game(&1, &player2);

    assert!(!env.events().all().is_empty());
}

#[test]
fn test_leave_pending_game_last_player_emits_two_events() {
    let env = Env::default();
    env.mock_all_auths();
    let (contract_id, client, owner, reward_system, usdc_token) = setup_contract(&env);
    client.initialize(&owner, &reward_system, &usdc_token);

    let creator = Address::generate(&env);

    env.as_contract(&contract_id, || {
        let id = next_game_id(&env);
        set_game(
            &env,
            &make_game_with_stake(&env, id, creator.clone(), 0, &[]),
        );
    });

    client.leave_pending_game(&1, &creator);

    // PlayerLeftPending + PendingGameEnded
    assert!(env.events().all().len() >= 2);
}

// -----------------------------------------------------------------------
// leave_pending_game — panic cases
// -----------------------------------------------------------------------

#[test]
#[should_panic(expected = "Game not found")]
fn test_leave_pending_game_unknown_game_panics() {
    let env = Env::default();
    env.mock_all_auths();
    let (_, client, owner, reward_system, usdc_token) = setup_contract(&env);
    client.initialize(&owner, &reward_system, &usdc_token);

    client.leave_pending_game(&999, &Address::generate(&env));
}

#[test]
#[should_panic(expected = "Game is not pending")]
fn test_leave_pending_game_ongoing_panics() {
    let env = Env::default();
    env.mock_all_auths();
    let (contract_id, client, owner, reward_system, usdc_token) = setup_contract(&env);
    client.initialize(&owner, &reward_system, &usdc_token);

    let creator = Address::generate(&env);

    env.as_contract(&contract_id, || {
        let id = next_game_id(&env);
        let mut game = make_game_with_stake(&env, id, creator.clone(), 0, &[]);
        game.status = GameStatus::Ongoing;
        set_game(&env, &game);
    });

    client.leave_pending_game(&1, &creator);
}

#[test]
#[should_panic(expected = "Game is not pending")]
fn test_leave_pending_game_ended_panics() {
    let env = Env::default();
    env.mock_all_auths();
    let (contract_id, client, owner, reward_system, usdc_token) = setup_contract(&env);
    client.initialize(&owner, &reward_system, &usdc_token);

    let creator = Address::generate(&env);

    env.as_contract(&contract_id, || {
        let id = next_game_id(&env);
        let mut game = make_game_with_stake(&env, id, creator.clone(), 0, &[]);
        game.status = GameStatus::Ended;
        set_game(&env, &game);
    });

    client.leave_pending_game(&1, &creator);
}

#[test]
#[should_panic(expected = "Player is not in this game")]
fn test_leave_pending_game_non_member_panics() {
    let env = Env::default();
    env.mock_all_auths();
    let (contract_id, client, owner, reward_system, usdc_token) = setup_contract(&env);
    client.initialize(&owner, &reward_system, &usdc_token);

    let creator = Address::generate(&env);
    let outsider = Address::generate(&env);

    env.as_contract(&contract_id, || {
        let id = next_game_id(&env);
        set_game(&env, &make_game_with_stake(&env, id, creator, 0, &[]));
    });

    client.leave_pending_game(&1, &outsider);
}
