#![cfg(test)]

use crate::{TycoonMainGame, TycoonMainGameClient};
use soroban_sdk::{
    testutils::{Address as _, Ledger},
    Address, Env, Symbol,
};

fn create_admin(env: &Env) -> Address {
    Address::generate(env)
}

fn create_user(env: &Env) -> Address {
    Address::generate(env)
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
        assert!(!retrieved.auction);
        assert_eq!(retrieved.starting_cash, 1500);
        assert_eq!(retrieved.private_room_code, String::from_str(&env, ""));
    });
}
// ============================================================
// Initialization Tests
// ============================================================

#[test]
fn test_initialize_contract() {
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
        assert!(retrieved.auction);
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
        assert!(!retrieved.ai);
        assert_eq!(retrieved.stake_per_player, 100);
        assert_eq!(retrieved.total_staked, 100);
        assert_eq!(retrieved.created_at, 1_000_000);
        assert_eq!(retrieved.ended_at, 0);
    });
}

    let admin = create_admin(&env);
    let contract_id = env.register_contract(None, TycoonMainGame);
    let client = TycoonMainGameClient::new(&env, &contract_id);
    client.initialize(&admin, &None, &0);

    assert_eq!(client.get_admin(), admin);
    assert!(!client.is_paused());
}

#[test]
#[should_panic(expected = "Contract already initialized")]
fn test_initialize_twice_panics() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = create_admin(&env);
    let contract_id = env.register_contract(None, TycoonMainGame);
    let client = TycoonMainGameClient::new(&env, &contract_id);
    client.initialize(&admin, &None, &0);
    client.initialize(&admin, &None, &0);
}

// ============================================================
// Pause Tests - Admin Authorization
// ============================================================

#[test]
fn test_admin_can_pause() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = create_admin(&env);
    let contract_id = env.register_contract(None, TycoonMainGame);
    let client = TycoonMainGameClient::new(&env, &contract_id);
    client.initialize(&admin, &None, &0);

    let reason = Symbol::new(&env, "SEC");
    client.pause(&admin, &reason, &1000);

    assert!(client.is_paused());
}

#[test]
#[should_panic(expected = "Contract is already paused")]
fn test_pause_twice_panics() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = create_admin(&env);
    let contract_id = env.register_contract(None, TycoonMainGame);
    let client = TycoonMainGameClient::new(&env, &contract_id);
    client.initialize(&admin, &None, &0);

    let reason = Symbol::new(&env, "SEC");
    client.pause(&admin, &reason, &1000);
    client.pause(&admin, &reason, &1000);
}

// ============================================================
// Unpause Tests
// ============================================================

#[test]
fn test_admin_can_unpause() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = create_admin(&env);
    let contract_id = env.register_contract(None, TycoonMainGame);
    let client = TycoonMainGameClient::new(&env, &contract_id);
    client.initialize(&admin, &None, &0);

    let reason = Symbol::new(&env, "SEC");
    client.pause(&admin, &reason, &1000);
    assert!(client.is_paused());

    client.unpause(&admin);
    assert!(!client.is_paused());
}

#[test]
#[should_panic(expected = "Contract is not paused")]
fn test_unpause_when_not_paused_panics() {
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
        assert!(retrieved_settings.auction);
    });
}

    let admin = create_admin(&env);
    let contract_id = env.register_contract(None, TycoonMainGame);
    let client = TycoonMainGameClient::new(&env, &contract_id);
    client.initialize(&admin, &None, &0);

    client.unpause(&admin);
}

// ============================================================
// Unauthorized Access Tests
// ============================================================

#[test]
#[should_panic(expected = "Unauthorized")]
fn test_unauthorized_user_cannot_pause() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = create_admin(&env);
    let user = create_user(&env);
    let contract_id = env.register_contract(None, TycoonMainGame);
    let client = TycoonMainGameClient::new(&env, &contract_id);
    client.initialize(&admin, &None, &0);

    let reason = Symbol::new(&env, "SEC");
    client.pause(&user, &reason, &1000);
}

#[test]
#[should_panic(expected = "Unauthorized")]
fn test_unauthorized_user_cannot_unpause() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = create_admin(&env);
    let user = create_user(&env);
    let contract_id = env.register_contract(None, TycoonMainGame);
    let client = TycoonMainGameClient::new(&env, &contract_id);
    client.initialize(&admin, &None, &0);

    let reason = Symbol::new(&env, "SEC");
    client.pause(&admin, &reason, &1000);
    client.unpause(&user);
}

// ============================================================
// Guarded Operations Tests - Core Acceptance Criteria
// ============================================================

#[test]
#[should_panic(expected = "blocked")]
fn test_user_calls_blocked_while_paused() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = create_admin(&env);
    let user = create_user(&env);
    let contract_id = env.register_contract(None, TycoonMainGame);
    let client = TycoonMainGameClient::new(&env, &contract_id);
    client.initialize(&admin, &None, &0);

    // Admin pauses
    let reason = Symbol::new(&env, "SEC");
    client.pause(&admin, &reason, &1000);

    // User call should be blocked
    client.register_player(&user);
}

#[test]
fn test_admin_unpause_restores_functionality() {
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
            &make_game_with_stake(
                &env,
                id,
                creator.clone(),
                0,
                core::slice::from_ref(&player2),
            ),
        );
    });

    let admin = create_admin(&env);
    let user = create_user(&env);
    let contract_id = env.register_contract(None, TycoonMainGame);
    let client = TycoonMainGameClient::new(&env, &contract_id);
    client.initialize(&admin, &None, &0);

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
            &make_game_with_stake(
                &env,
                id,
                creator.clone(),
                stake,
                core::slice::from_ref(&player2),
            ),
        );
    });
    // Pause
    let reason = Symbol::new(&env, "SEC");
    client.pause(&admin, &reason, &1000);

    // Unpause
    client.unpause(&admin);

    // User call should now work
    client.register_player(&user);
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
            &make_game_with_stake(
                &env,
                id,
                creator.clone(),
                stake,
                core::slice::from_ref(&player2),
            ),
        );
    });

    let before = client.get_game(&1).unwrap().total_staked;
    client.leave_pending_game(&1, &player2);
    let after = client.get_game(&1).unwrap().total_staked;

    assert_eq!(before - after, stake);
}
// ============================================================
// Pause Expiry Tests
// ============================================================

#[test]
fn test_auto_unpause_on_expiry() {
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
            &make_game_with_stake(
                &env,
                id,
                creator.clone(),
                0,
                core::slice::from_ref(&player2),
            ),
        );
    });

    let admin = create_admin(&env);
    let contract_id = env.register_contract(None, TycoonMainGame);
    let client = TycoonMainGameClient::new(&env, &contract_id);
    client.initialize(&admin, &None, &0);

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
            &make_game_with_stake(&env, id, creator, 0, core::slice::from_ref(&player2)),
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
    let reason = Symbol::new(&env, "MAINT");
    client.pause(&admin, &reason, &10);

    assert!(client.is_paused());

    env.ledger().with_mut(|li| {
        li.sequence_number += 15;
    });

    assert!(!client.is_paused());
}

// ============================================================
// Multisig Tests
// ============================================================

#[test]
fn test_multisig_signer_can_pause() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = create_admin(&env);
    let signer1 = create_user(&env);

    let contract_id = env.register_contract(None, TycoonMainGame);
    let client = TycoonMainGameClient::new(&env, &contract_id);
    client.initialize(&admin, &Some(signer1.clone()), &1);

    let reason = Symbol::new(&env, "SEC");
    client.pause(&signer1, &reason, &1000);

    assert!(client.is_paused());
}

#[test]
fn test_multisig_signer_can_unpause() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = create_admin(&env);
    let signer1 = create_user(&env);

    let contract_id = env.register_contract(None, TycoonMainGame);
    let client = TycoonMainGameClient::new(&env, &contract_id);
    client.initialize(&admin, &Some(signer1.clone()), &1);

    let reason = Symbol::new(&env, "SEC");
    client.pause(&admin, &reason, &1000);
    client.unpause(&signer1);

    assert!(!client.is_paused());
}
