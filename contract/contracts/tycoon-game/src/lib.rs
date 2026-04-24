#![no_std]

mod events;
pub(crate) mod storage;
mod treasury;

use soroban_sdk::{contract, contractimpl, token, Address, Env, IntoVal, String, Symbol};
use storage::{
    get_backend_game_controller, get_owner, get_tyc_token, get_usdc_token, CollectibleInfo, User,
};
pub use treasury::TreasurySnapshot;

#[contract]
pub struct TycoonContract;

// ── Internal helpers ──────────────────────────────────────────────────────────

impl TycoonContract {
    /// Load the stored owner and require their signature.
    /// Panics with `"Contract not initialized"` if the owner key is absent.
    fn require_admin(env: &Env) -> Address {
        let owner: Address = env
            .storage()
            .instance()
            .get(&storage::DataKey::Owner)
            .expect("Contract not initialized");
        owner.require_auth();
        owner
    }
}

// ── Admin-only entrypoints ────────────────────────────────────────────────────
//
// Every function in this block calls `Self::require_admin` before touching
// state. Callers must be the stored `owner` address.

#[contractimpl]
impl TycoonContract {
    /// Initialize the contract with token addresses and owner.
    ///
    /// Must be called exactly once. The `initial_owner` must authorize this call.
    ///
    /// # Errors
    /// - Panics with `"Contract already initialized"` if called more than once.
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
        storage::set_state_version(&env, 1);
        storage::set_initialized(&env);
    }

    /// Migrate the contract to a newer state version (admin only).
    ///
    /// Safe to call multiple times; already-current versions are no-ops.
    pub fn admin_migrate(env: Env) {
        Self::require_admin(&env);

        let current_version = storage::get_state_version(&env);

        if current_version == 0 {
            storage::set_state_version(&env, 1);
        } else if current_version == 1 {
            // Placeholder for future migration v1 -> v2
        }
    }

    /// Withdraw TYC or USDC tokens from the contract treasury (admin only).
    ///
    /// # Errors
    /// - Panics with `"Invalid token address"` if `token` is not TYC or USDC.
    /// - Panics with `"Insufficient contract balance"` if the contract holds less than `amount`.
    pub fn admin_withdraw_funds(env: Env, token: Address, to: Address, amount: u128) {
        Self::require_admin(&env);

        let tyc_token = get_tyc_token(&env);
        let usdc_token = get_usdc_token(&env);

        if token != tyc_token && token != usdc_token {
            panic!("Invalid token address");
        }

        let token_client = token::Client::new(&env, &token);
        let contract_address = env.current_contract_address();
        let balance = token_client.balance(&contract_address);

        if balance < amount as i128 {
            panic!("Insufficient contract balance");
        }

        token_client.transfer(&contract_address, &to, &(amount as i128));

        events::emit_funds_withdrawn(&env, &token, &to, amount);
    }

    /// Create or overwrite a collectible's on-chain metadata (admin only).
    pub fn admin_set_collectible_info(
        env: Env,
        token_id: u128,
        perk: u32,
        strength: u32,
        tyc_price: u128,
        usdc_price: u128,
        shop_stock: u64,
    ) {
        Self::require_admin(&env);

        let info = CollectibleInfo {
            perk,
            strength,
            tyc_price,
            usdc_price,
            shop_stock,
        };
        storage::set_collectible(&env, token_id, &info);
    }

    /// Set the token value for a cash tier (admin only).
    pub fn admin_set_cash_tier_value(env: Env, tier: u32, value: u128) {
        Self::require_admin(&env);
        storage::set_cash_tier(&env, tier, value);
    }

    /// Update the backend game controller address (admin only).
    ///
    /// The backend controller is a privileged off-chain service that may call
    /// `remove_player_from_game` without being the owner.
    pub fn admin_set_game_controller(env: Env, new_controller: Address) {
        Self::require_admin(&env);
        storage::set_backend_game_controller(&env, &new_controller);
    }

    /// Mint a 2-TYC registration voucher for a player via the reward system (admin only).
    pub fn admin_mint_registration_voucher(env: Env, player: Address) {
        Self::require_admin(&env);

        let reward_system = storage::get_reward_system(&env);
        let _token_id: u128 = env.invoke_contract(
            &reward_system,
            &Symbol::new(&env, "mint_voucher"),
            soroban_sdk::vec![&env, player.into_val(&env), 2_0000000u128.into_val(&env)],
        );
    }
}

// ── Public entrypoints ────────────────────────────────────────────────────────
//
// These functions are callable by any address (subject to their own auth
// requirements). No owner check is performed at the entrypoint level.

#[contractimpl]
impl TycoonContract {
    /// Register a new player. The `caller` must authorize this call.
    ///
    /// # Errors
    /// - Panics with `"Address already registered"` if `caller` is already registered.
    /// - Panics with `"Username must be 3-20 characters"` for invalid username length.
    pub fn register_player(env: Env, username: String, caller: Address) {
        caller.require_auth();

        if storage::is_registered(&env, &caller) {
            panic!("Address already registered");
        }

        let len = username.len();
        if !(3..=20).contains(&len) {
            panic!("Username must be 3-20 characters");
        }

        let user = User {
            id: env.ledger().sequence() as u64,
            username: username.clone(),
            address: caller.clone(),
            registered_at: env.ledger().timestamp(),
            games_played: 0,
            games_won: 0,
        };

        storage::set_user(&env, &caller, &user);
        storage::set_registered(&env, &caller);
    }

    /// Remove a player from an active game.
    ///
    /// Authorized callers: the stored `owner` **or** the `backend_game_controller`.
    /// The `caller` must authorize this call.
    ///
    /// # Errors
    /// - Panics with `"Unauthorized: caller must be owner or backend game controller"`
    ///   if `caller` is neither.
    pub fn remove_player_from_game(
        env: Env,
        caller: Address,
        game_id: u128,
        player: Address,
        turn_count: u32,
    ) {
        caller.require_auth();

        let owner = get_owner(&env);
        let backend_controller = get_backend_game_controller(&env);

        let is_owner = caller == owner;
        let is_backend_controller = backend_controller
            .as_ref()
            .is_some_and(|c| caller == *c);

        if !is_owner && !is_backend_controller {
            panic!("Unauthorized: caller must be owner or backend game controller");
        }

        events::emit_player_removed_from_game(&env, game_id, &player, turn_count);
    }

    /// Return the stored profile for `address`, or `None` if not registered.
    pub fn get_user(env: Env, address: Address) -> Option<User> {
        storage::get_user(&env, &address)
    }

    /// Return the metadata tuple `(perk, strength, tyc_price, usdc_price, shop_stock)`
    /// for a collectible.
    ///
    /// # Errors
    /// - Panics with `"Collectible does not exist"` if `token_id` is unknown.
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

    /// Return the token value for a cash tier.
    ///
    /// # Errors
    /// - Panics with `"Cash tier does not exist"` if `tier` is unknown.
    pub fn get_cash_tier_value(env: Env, tier: u32) -> u128 {
        match storage::get_cash_tier(&env, tier) {
            Some(value) => value,
            None => panic!("Cash tier does not exist"),
        }
    }

    /// Export a snapshot of critical contract state for debugging / support.
    ///
    /// This is a read-only view; no auth is required.
    pub fn export_state(env: Env) -> storage::ContractStateDump {
        storage::ContractStateDump {
            owner: get_owner(&env),
            tyc_token: get_tyc_token(&env),
            usdc_token: get_usdc_token(&env),
            reward_system: storage::get_reward_system(&env),
            state_version: storage::get_state_version(&env),
            is_initialized: storage::is_initialized(&env),
            backend_controller: storage::get_backend_game_controller(&env),
        }
    }
}

// ── Deprecated shims ──────────────────────────────────────────────────────────
//
// These thin wrappers preserve the old entrypoint names so that existing
// integrations continue to compile. They will be removed in the next major
// version. New code must use the `admin_*` variants above.

#[contractimpl]
impl TycoonContract {
    /// Deprecated — use `admin_migrate` instead.
    #[deprecated(since = "0.2.0", note = "Use admin_migrate instead")]
    pub fn migrate(env: Env) {
        Self::admin_migrate(env);
    }

    /// Deprecated — use `admin_withdraw_funds` instead.
    #[deprecated(since = "0.2.0", note = "Use admin_withdraw_funds instead")]
    pub fn withdraw_funds(env: Env, token: Address, to: Address, amount: u128) {
        Self::admin_withdraw_funds(env, token, to, amount);
    }

    /// Deprecated — use `admin_set_collectible_info` instead.
    #[deprecated(since = "0.2.0", note = "Use admin_set_collectible_info instead")]
    pub fn set_collectible_info(
        env: Env,
        token_id: u128,
        perk: u32,
        strength: u32,
        tyc_price: u128,
        usdc_price: u128,
        shop_stock: u64,
    ) {
        Self::admin_set_collectible_info(env, token_id, perk, strength, tyc_price, usdc_price, shop_stock);
    }

    /// Deprecated — use `admin_set_cash_tier_value` instead.
    #[deprecated(since = "0.2.0", note = "Use admin_set_cash_tier_value instead")]
    pub fn set_cash_tier_value(env: Env, tier: u32, value: u128) {
        Self::admin_set_cash_tier_value(env, tier, value);
    }

    /// Deprecated — use `admin_set_game_controller` instead.
    #[deprecated(since = "0.2.0", note = "Use admin_set_game_controller instead")]
    pub fn set_backend_game_controller(env: Env, new_controller: Address) {
        Self::admin_set_game_controller(env, new_controller);
    }

    /// Deprecated — use `admin_mint_registration_voucher` instead.
    #[deprecated(since = "0.2.0", note = "Use admin_mint_registration_voucher instead")]
    pub fn mint_registration_voucher(env: Env, player: Address) {
        Self::admin_mint_registration_voucher(env, player);
    }
}

mod test;

#[cfg(test)]
mod simulation_scenarios;

#[cfg(test)]
mod game_coverage_tests;

#[cfg(test)]
mod admin_access_control_tests;
