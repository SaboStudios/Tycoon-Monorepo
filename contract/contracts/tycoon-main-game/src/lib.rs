#![no_std]

mod events;
mod storage;

#[cfg(test)]
mod test;

use soroban_sdk::{contract, contractimpl, symbol_short, Address, Env, Symbol};
use storage::PauseConfig;

#[contract]
pub struct TycoonMainGame;

#[contractimpl]
impl TycoonMainGame {
    // ============================================================
    // Initialization
    // ============================================================

    /// Initialize the contract with admin and optional multisig configuration
    ///
    /// # Arguments
    /// * `admin` - Primary admin address
    /// * `multisig_signers` - Optional list of multisig signers
    /// * `multisig_threshold` - Required signatures for multisig (0 = single admin)
    pub fn initialize(
        env: Env,
        admin: Address,
        multisig_signers: Option<Address>,
        multisig_threshold: u32,
    ) {
        if storage::is_initialized(&env) {
            panic!("Contract already initialized");
        }

        admin.require_auth();

        storage::set_admin(&env, &admin);

        // Configure pause mechanism
        let signers = multisig_signers
            .map(|s| soroban_sdk::Vec::from_array(&env, [s]))
            .unwrap_or(soroban_sdk::Vec::new(&env));
        let config = PauseConfig {
            admin: Some(admin.clone()),
            signers,
            required_signatures: multisig_threshold,
        };
        storage::set_pause_config(&env, &config);
        storage::set_state_version(&env, 1);

        // Batch all instance writes together — single storage round-trip
        storage::set_owner(&env, &owner);
        storage::set_reward_system(&env, &reward_system);
        storage::set_usdc_token(&env, &usdc_token);
        storage::set_initialized(&env);

    /// Stub: Register a player for the main game.
    pub fn register_player(_env: Env) {
        // TODO: implement full registration logic
    }

    /// Migrate the contract to a newer state version (admin only)
    pub fn migrate(env: Env) {
        let admin = storage::get_admin(&env);
        admin.require_auth();

        let current_version = storage::get_state_version(&env);

        if current_version == 0 {
            storage::set_state_version(&env, 1);
        }
    }

    // ============================================================
    // Pause/Unpause (Guarded)
    // ============================================================

    /// Emergency pause contract (admin/multisig only)
    ///
    /// Optimisations vs. original:
    /// - `usdc_token` is read once and only when `stake_per_player > 0`.
    /// - Player search short-circuits on first match instead of always
    ///   scanning the full list.
    /// - `remaining` is derived from the already-mutated `joined_players`
    ///   length — no separate counter variable.
    /// - Single `set_game` write at the end covers all mutations.
    ///
    /// # Panics
    /// * If caller is not authorized
    /// * If already paused
    pub fn pause(env: Env, caller: Address, reason: Symbol, duration_ledgers: u32) {
        caller.require_auth();

        let mut game: Game =
            storage::get_game(&env, game_id).unwrap_or_else(|| panic!("Game not found"));

        // Verify authorization
        if !storage::is_authorized_to_pause(&env, &caller, &config) {
            panic!("Unauthorized: only admin or multisig can pause");
        }

        // Build new player list, short-circuiting once the player is found
        let mut new_players: Vec<Address> = Vec::new(&env);
        let mut found = false;

        for p in game.joined_players.iter() {
            if !found && p == player {
                found = true;
                // Skip this entry — effectively removes the player
            } else {
                new_players.push_back(p);
            }
        }

        // Cannot pause indefinitely without a path - require expiry for long pauses
        if duration_ledgers == 0 {
            // For indefinite pause, require a minimum expiry (e.g., 1000 ledgers ~ 1.5 hours)
            storage::pause_with_expiry(&env, &caller, &reason, 1000);
        } else {
            storage::pause_with_expiry(&env, &caller, &reason, duration_ledgers);
        }

        // Refund stake — read usdc_token only when a transfer is needed
        if game.stake_per_player > 0 {
            let usdc_token = storage::get_usdc_token(&env);
            token::Client::new(&env, &usdc_token).transfer(
                &env.current_contract_address(),
                &player,
                &(game.stake_per_player as i128),
            );
        }

        // Batch all game-state mutations before the single write
        game.total_staked = game.total_staked.saturating_sub(game.stake_per_player);
        game.joined_players = new_players;

        let config = storage::get_pause_config(&env).expect("Contract not initialized");

        // Verify authorization
        if !storage::is_authorized_to_pause(&env, &caller, &config) {
            panic!("Unauthorized: only admin or multisig can unpause");
        }

        if remaining == 0 {
            game.status = GameStatus::Ended;
            game.ended_at = env.ledger().timestamp();
        }

        // Single persistent write covers all mutations above
        storage::set_game(&env, &game);

        events::emit_player_left_pending(
            &env,
            &events::UnpauseEventData {
                unpaused_by: caller,
                unpaused_at: env.ledger().timestamp(),
                paused_duration: env.ledger().timestamp().saturating_sub(paused_at),
                original_paused_by: paused_by,
            },
        );
    }

        if remaining == 0 {
            events::emit_pending_game_ended(&env, &events::PendingGameEndedData { game_id });
        }
    }

    // ============================================================
    // View Functions
    // ============================================================

    pub fn get_owner(env: Env) -> Address {
        storage::get_owner(&env)
    }

    pub fn get_reward_system(env: Env) -> Address {
        storage::get_reward_system(&env)
    }

    pub fn is_registered(env: Env, address: Address) -> bool {
        storage::is_registered(&env, &address)
    }
}

    pub fn get_game(env: Env, game_id: u64) -> Option<Game> {
        storage::get_game(&env, game_id)
    }

    pub fn get_game_settings(env: Env, game_id: u64) -> Option<GameSettings> {
        storage::get_game_settings(&env, game_id)
    }
}
