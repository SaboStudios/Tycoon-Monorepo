#![no_std]

mod events;
mod storage;

use soroban_sdk::{contract, contractimpl, token, Address, Env, IntoVal, String, Symbol, Vec};
use storage::{
    get_owner, get_tyc_token, get_usdc_token, get_user, is_registered, next_game_id, set_game,
    set_game_players, CollectibleInfo, Game, GameSettings, GameStatus, GameType, User,
};

#[contract]
pub struct TycoonContract;

#[contractimpl]
impl TycoonContract {
    /// Initialize the contract with token addresses and owner
    pub fn initialize(env: Env, tyc_token: Address, usdc_token: Address, initial_owner: Address, reward_system: Address) {
        if storage::is_initialized(&env) {
            panic!("Contract already initialized");
        }

        initial_owner.require_auth();

        storage::set_tyc_token(&env, &tyc_token);
        storage::set_usdc_token(&env, &usdc_token);
        storage::set_owner(&env, &initial_owner);
        storage::set_reward_system(&env, &reward_system);
        storage::set_initialized(&env);
    }

    pub fn withdraw_funds(env: Env, token: Address, to: Address, amount: u128) {
        let owner = get_owner(&env);
        owner.require_auth();

        // Validate token address (must be TYC or USDC)
        let tyc_token = get_tyc_token(&env);
        let usdc_token = get_usdc_token(&env);

        if token != tyc_token && token != usdc_token {
            panic!("Invalid token address");
        }

        // Create token client and check balance
        let token_client = token::Client::new(&env, &token);
        let contract_address = env.current_contract_address();
        let balance = token_client.balance(&contract_address);

        if balance < amount as i128 {
            panic!("Insufficient contract balance");
        }

        token_client.transfer(&contract_address, &to, &(amount as i128));

        events::emit_funds_withdrawn(&env, &token, &to, amount);
    }

    pub fn get_collectible_info(env: Env, token_id: u128) -> (u32, u32, u128, u128, u64) {
        match storage::get_collectible(&env, token_id) {
            Some(info) => (
                info.perk,
                info.strength,
                info.tyc_price,
                info.usdc_price,
                info.shop_stock,
            ),
            None => panic!("Collectible does not exist"),
        }
    }

    pub fn get_cash_tier_value(env: Env, tier: u32) -> u128 {
        match storage::get_cash_tier(&env, tier) {
            Some(value) => value,
            None => panic!("Cash tier does not exist"),
        }
    }

    pub fn set_collectible_info(
        env: Env,
        token_id: u128,
        perk: u32,
        strength: u32,
        tyc_price: u128,
        usdc_price: u128,
        shop_stock: u64,
    ) {
        // In a production contract, this would require owner authorization
        let owner = get_owner(&env);
        owner.require_auth();

        let info = CollectibleInfo {
            perk,
            strength,
            tyc_price,
            usdc_price,
            shop_stock,
        };
        storage::set_collectible(&env, token_id, &info);
    }

    pub fn set_cash_tier_value(env: Env, tier: u32, value: u128) {
        let owner = get_owner(&env);
        owner.require_auth();

        storage::set_cash_tier(&env, tier, value);
    }

    pub fn register_player(env: Env, username: String, caller: Address) {
        caller.require_auth();

        // Check if already registered
        if storage::is_registered(&env, &caller) {
            panic!("Address already registered");
        }

        // Validate username length (3-20 chars)
        let len = username.len();
        if len < 3 || len > 20 {
            panic!("Username must be 3-20 characters");
        }

        // Create user
        let user = User {
            id: env.ledger().sequence() as u64,
            username: username.clone(),
            address: caller.clone(),
            registered_at: env.ledger().timestamp(),
            games_played: 0,
            games_won: 0,
        };

        // Store user and mark as registered
        storage::set_user(&env, &caller, &user);
        storage::set_registered(&env, &caller);
    }

    pub fn mint_registration_voucher(env: Env, player: Address) {
        let owner = get_owner(&env);
        owner.require_auth();

        // Mint 2 TYC voucher via reward system
        let reward_system = storage::get_reward_system(&env);
        let _token_id: u128 = env.invoke_contract(
            &reward_system,
            &Symbol::new(&env, "mint_voucher"),
            soroban_sdk::vec![&env, player.into_val(&env), 2_0000000u128.into_val(&env)]
        );
    }

    pub fn get_user(env: Env, address: Address) -> Option<User> {
        storage::get_user(&env, &address)
    }

    /// Create a new human-vs-human game. Creator must be registered.
    /// For private games, code must be non-empty. number_of_players must be 2–8.
    /// If stake_amount > 0, USDC is transferred from creator to the contract.
    pub fn create_game(
        env: Env,
        creator: Address,
        creator_username: String,
        game_type: GameType,
        player_symbol: u32,
        number_of_players: u32,
        code: String,
        starting_balance: u128,
        stake_amount: u128,
    ) -> u64 {
        creator.require_auth();

        // Creator must be registered
        if !is_registered(&env, &creator) {
            panic!("Creator must be registered");
        }

        // Optional: verify username matches stored user
        if let Some(user) = get_user(&env, &creator) {
            if user.username != creator_username {
                panic!("Username does not match registered user");
            }
        }

        // Private game requires non-empty code
        if matches!(game_type, GameType::Private) && code.is_empty() {
            panic!("Private game requires a code");
        }

        // Validate number_of_players (2–8)
        if number_of_players < 2 || number_of_players > 8 {
            panic!("number_of_players must be between 2 and 8");
        }

        // If stake required, transfer USDC from creator to contract
        if stake_amount > 0 {
            let usdc_token = storage::get_usdc_token(&env);
            let token_client = token::Client::new(&env, &usdc_token);
            let contract_address = env.current_contract_address();
            token_client.transfer(&creator, &contract_address, &(stake_amount as i128));
        }

        let game_id = next_game_id(&env);
        let created_at = env.ledger().timestamp();

        let settings = GameSettings {
            game_type: game_type.clone(),
            number_of_players,
            starting_balance,
            stake_amount,
            code: code.clone(),
            player_symbol,
        };

        let game = Game {
            id: game_id,
            creator: creator.clone(),
            settings: settings.clone(),
            status: GameStatus::Waiting,
            created_at,
        };

        set_game(&env, game_id, &game);

        let mut players: Vec<Address> = Vec::new(&env);
        players.push_back(creator.clone());
        set_game_players(&env, game_id, &players);

        let event_data = events::GameCreatedData {
            game_id,
            creator: creator.clone(),
            game_type,
            number_of_players,
            starting_balance,
            stake_amount,
            code,
            player_symbol,
        };
        events::emit_game_created(&env, &event_data);

        game_id
    }

    /// Get game by id (for tests and clients)
    pub fn get_game(env: Env, game_id: u64) -> Option<Game> {
        storage::get_game(&env, game_id)
    }

    /// Get players for a game (creator is first)
    pub fn get_game_players(env: Env, game_id: u64) -> Vec<Address> {
        storage::get_game_players(&env, game_id)
    }
}

mod test;
