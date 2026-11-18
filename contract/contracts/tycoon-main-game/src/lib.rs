#![no_std]

pub mod events;
pub mod storage;

#[cfg(test)]
mod test;

use soroban_sdk::{contract, contractimpl, token, Address, Env, Symbol};
use storage::PauseConfig;

#[contract]
pub struct TycoonMainGame;

#[contractimpl]
impl TycoonMainGame {
    // ============================================================
    // Initialization
    // ============================================================

    /// Initialize the contract with admin, reward system, and USDC token addresses.
    ///
    /// # Arguments
    /// * `admin` - Primary admin address (owner)
    /// * `reward_system` - Address of the TycoonRewardSystem contract
    /// * `usdc_token` - Address of the USDC token contract (used for stake refunds)
    pub fn initialize(env: Env, admin: Address, reward_system: Address, usdc_token: Address) {
        if storage::is_initialized(&env) {
            panic!("Contract already initialized");
        }

        admin.require_auth();

        storage::set_owner(&env, &admin);
        storage::set_reward_system(&env, &reward_system);
        storage::set_usdc_token(&env, &usdc_token);
        storage::set_state_version(&env, 1);

        // Configure pause mechanism with admin as the sole pause authority
        let config = PauseConfig {
            admin: Some(admin),
            signers: soroban_sdk::Vec::new(&env),
            required_signatures: 0,
        };
        storage::set_pause_config(&env, &config);

        storage::set_initialized(&env);
    }

    // ============================================================
    // Pause/Unpause
    // ============================================================

    /// Emergency pause the contract (admin only).
    ///
    /// When paused, all guarded operations are blocked until unpaused or
    /// the pause duration expires.
    ///
    /// # Panics
    /// * If caller is not authorized
    /// * If already paused
    pub fn pause(env: Env, caller: Address, reason: Symbol, duration_ledgers: u32) {
        caller.require_auth();

        if duration_ledgers == 0 {
            panic!("Pause duration must be greater than zero");
        }

        if storage::is_paused(&env) {
            panic!("Contract is already paused");
        }

        let config = storage::get_pause_config(&env).expect("Contract not initialized");

        if !storage::is_authorized_to_pause(&env, &caller, &config) {
            panic!("Unauthorized: only admin or multisig can pause");
        }

        let expiry = storage::pause_with_expiry(&env, &caller, &reason, duration_ledgers);

        // Emit Pause event
        let paused_at = env.ledger().timestamp();
        events::emit_paused(
            &env,
            &events::PauseEventData {
                paused_by: caller,
                paused_at,
                expiry,
                reason,
            },
        );
    }

    /// Unpause the contract (admin only).
    ///
    /// # Panics
    /// * If caller is not authorized
    /// * If not currently paused
    pub fn unpause(env: Env, caller: Address) {
        caller.require_auth();

        if !storage::is_paused(&env) {
            panic!("Contract is not paused");
        }

        let config = storage::get_pause_config(&env).expect("Contract not initialized");

        if !storage::is_authorized_to_pause(&env, &caller, &config) {
            panic!("Unauthorized: only admin or multisig can unpause");
        }

        // Collect data for event before clearing state
        let paused_by = storage::get_paused_by(&env).unwrap_or_else(|| caller.clone());
        let paused_at = storage::get_paused_at(&env);
        let paused_duration = env.ledger().timestamp().saturating_sub(paused_at);

        // Clear pause state
        storage::set_paused(&env, false);

        // Emit Unpaused event
        events::emit_unpaused(
            &env,
            &events::UnpauseEventData {
                unpaused_by: caller,
                unpaused_at: env.ledger().timestamp(),
                paused_duration,
                original_paused_by: paused_by,
            },
        );
    }

    /// Returns whether the contract is currently paused (respecting expiry).
    pub fn is_paused(env: Env) -> bool {
        storage::check_pause_expiry(&env);
        storage::is_paused(&env)
    }

    // ============================================================
    // Player registration
    // ============================================================

    /// Register a player for the main game.
    ///
    /// # Panics
    /// * If contract is paused
    pub fn register_player(env: Env, address: Address) {
        let op = Symbol::new(&env, "register_player");
        storage::ensure_not_paused(&env, &op);

        if storage::is_registered(&env, &address) {
            panic!("Address already registered");
        }

        storage::set_registered(&env, &address);
    }

    // ============================================================
    // Leave pending game (stake refund)
    // ============================================================

    /// Remove a player from a pending game and refund their stake (in USDC).
    ///
    /// If the leaving player was the last player, the game ends.
    ///
    /// # Panics
    /// * If contract is paused
    /// * If game not found
    /// * If player not in the game
    /// * If the recorded stake total would underflow the refund
    pub fn leave_pending_game(env: Env, game_id: u64, player: Address) {
        player.require_auth();

        let op = Symbol::new(&env, "leave_pending_game");
        storage::ensure_not_paused(&env, &op);

        let mut game = storage::get_game(&env, game_id).unwrap_or_else(|| panic!("Game not found"));

        // Build new player list, removing the specified player
        let mut new_players: soroban_sdk::Vec<Address> = soroban_sdk::Vec::new(&env);
        let mut found = false;

        for p in game.joined_players.iter() {
            if !found && p == player {
                found = true;
                // Skip this entry — effectively removes the player
            } else {
                new_players.push_back(p);
            }
        }

        if !found {
            panic!("Player not found in game");
        }

        // Compute the refund and the new total before any token movement so
        // that an accounting underflow fails the call without transferring.
        let refund_amount = game.stake_per_player;
        let new_total_staked = game
            .total_staked
            .checked_sub(refund_amount)
            .unwrap_or_else(|| panic!("Stake total underflow"));

        // Refund stake — read usdc_token only when a transfer is needed
        if refund_amount > 0 {
            let refund_i128 = i128::try_from(refund_amount)
                .unwrap_or_else(|_| panic!("Stake amount exceeds i128"));
            let usdc_token = storage::get_usdc_token(&env);
            token::Client::new(&env, &usdc_token).transfer(
                &env.current_contract_address(),
                &player,
                &refund_i128,
            );
        }

        // Update game state
        game.total_staked = new_total_staked;
        game.joined_players = new_players;

        let remaining = game.joined_players.len();
        if remaining == 0 {
            game.status = storage::GameStatus::Ended;
            game.ended_at = env.ledger().timestamp();
        }

        // Single persistent write covers all mutations above
        storage::set_game(&env, &game);

        // Emit player-left event
        events::emit_player_left_pending(
            &env,
            &e

/* … truncated 568 chars — edit only what you need near the top … */
