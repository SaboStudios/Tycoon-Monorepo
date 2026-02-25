#![no_std]

mod events;
mod storage;

use soroban_sdk::{contract, contractimpl, token, Address, Env, IntoVal, String, Symbol};
use storage::{get_backend_game_controller, get_owner, get_tyc_token, get_usdc_token, CollectibleInfo, User};

#[contract]
pub struct TycoonContract;

#[contractimpl]
impl TycoonContract {
    /// Initialize the contract with token addresses and owner
    pub fn initialize(
        env: Env,
        tyc_token: Address,
        usdc_token: Address,
        initial_owner: Address,
        reward_system: Address,
    ) {
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
            soroban_sdk::vec![&env, player.into_val(&env), 2_0000000u128.into_val(&env)],
        );
    }

    pub fn get_user(env: Env, address: Address) -> Option<User> {
        storage::get_user(&env, &address)
    }

    pub fn set_backend_game_controller(env: Env, new_controller: Address) {
        let owner = get_owner(&env);
        owner.require_auth();

        storage::set_backend_game_controller(&env, &new_controller);
    }

    pub fn remove_player_from_game(env: Env, caller: Address, game_id: u128, player: Address, turn_count: u32) {
        // Require authentication from the caller
        caller.require_auth();

        // Get owner and backend controller
        let owner = get_owner(&env);
        let backend_controller = get_backend_game_controller(&env);

        // Check authorization: caller must be owner OR backend controller
        let is_owner = caller == owner;
        let is_backend_controller = backend_controller.map_or(false, |controller| caller == controller);

        if !is_owner && !is_backend_controller {
            panic!("Unauthorized: caller must be owner or backend game controller");
        }

        // Stub implementation - no payout logic yet
        // Future: Calculate payout based on turn_count and game state
        // Future: Transfer tokens to player
        // Future: Update game state

        // Emit event
        events::emit_player_removed_from_game(&env, game_id, &player, turn_count);
    }
}

mod test;
