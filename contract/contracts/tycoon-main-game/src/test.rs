#![cfg(test)]

use super::*;
use crate::storage::{
    get_game, get_game_settings, next_game_id, set_game, set_game_settings, Game, GameMode,
    GameSettings, GameStatus,
};
use soroban_sdk::{testutils::Address as _, Address, Env, String, Vec};

// -----------------------------------------------------------------------
// Test helpers
// -----------------------------------------------------------------------

fn setup_contract(env: &Env) -> (Address, TycoonMainGameClient<'_>, Address, Address) {
    let contract_id = env.register(TycoonMainGame, ());
    let client = TycoonMainGameClient::new(env, &contract_id);
    let owner = Address::generate(env);
    let reward_system = Address::generate(env);
    (contract_id, client, owner, reward_system)
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

// -----------------------------------------------------------------------
// GameSettings struct tests
// -----------------------------------------------------------------------

#[test]
fn test_game_settings_stores_and_retrieves() {
    let env = Env::default();
    env.mock_all_auths();
    let (contract_id, _, _, _) = setup_contract(&env);

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
    let (contract_id, _, _, _) = setup_contract(&env);

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
    let (contract_id, _, _, _) = setup_contract(&env);

    env.as_contract(&contract_id, || {
        assert!(get_game_settings(&env, 999).is_none());
    });
}

#[test]
fn test_game_settings_overwrite() {
    let env = Env::default();
    env.mock_all_auths();
    let (contract_id, _, _, _) = setup_contract(&env);

    env.as_contract(&contract_id, || {
        let settings_v1 = GameSettings {
            max_players: 4,
            auction: false,
            starting_cash: 1500,
            private_room_code: String::from_str(&env, ""),
        };
        set_game_settings(&env, 1, &settings_v1);

        let settings_v2 = GameSettings {
            max_players: 6,
            auction: true,
            starting_cash: 3000,
            private_room_code: String::from_str(&env, "NEWCODE"),
        };
        set_game_settings(&env, 1, &settings_v2);

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
// Game struct tests
// -----------------------------------------------------------------------

#[test]
fn test_game_stores_and_retrieves_all_fields() {
    let env = Env::default();
    env.mock_all_auths();
    let (contract_id, _, _, _) = setup_contract(&env);

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
    let (contract_id, _, _, _) = setup_contract(&env);

    env.as_contract(&contract_id, || {
        assert!(get_game(&env, 404).is_none());
    });
}

#[test]
fn test_game_status_transitions_stored_correctly() {
    let env = Env::default();
    env.mock_all_auths();
    let (contract_id, _, _, _) = setup_contract(&env);

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
    let (contract_id, _, _, _) = setup_contract(&env);

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
    let (contract_id, _, _, _) = setup_contract(&env);

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
    let (contract_id, _, _, _) = setup_contract(&env);

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
    let (contract_id, _, _, _) = setup_contract(&env);

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
    let (contract_id, _, _, _) = setup_contract(&env);

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
    let (contract_id, _, _, _) = setup_contract(&env);

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
    let (contract_id, _, _, _) = setup_contract(&env);

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
// next_game_id tests
// -----------------------------------------------------------------------

#[test]
fn test_next_game_id_increments() {
    let env = Env::default();
    env.mock_all_auths();
    let (contract_id, _, _, _) = setup_contract(&env);

    env.as_contract(&contract_id, || {
        assert_eq!(next_game_id(&env), 1);
        assert_eq!(next_game_id(&env), 2);
        assert_eq!(next_game_id(&env), 3);
    });
}

// -----------------------------------------------------------------------
// Contract view function tests
// -----------------------------------------------------------------------

#[test]
fn test_get_game_via_contract_view() {
    let env = Env::default();
    env.mock_all_auths();
    let (contract_id, client, owner, reward_system) = setup_contract(&env);

    client.initialize(&owner, &reward_system);

    let creator = Address::generate(&env);
    let game = make_game(&env, 1, creator);

    // Write into the contract's own storage context
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
    let (contract_id, client, owner, reward_system) = setup_contract(&env);

    client.initialize(&owner, &reward_system);

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
    let (_, client, owner, reward_system) = setup_contract(&env);

    client.initialize(&owner, &reward_system);

    assert!(client.get_game(&999).is_none());
}
