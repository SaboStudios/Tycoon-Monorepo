#![no_std]

mod events;
#[allow(dead_code)]
mod storage;

#[cfg(test)]
mod test;

use soroban_sdk::{contract, contractimpl, token, Address, Env, Vec};
use storage::{Game, GameSettings, GameStatus};

#[contract]
pub struct TycoonMainGame;

#[contractimpl]
impl TycoonMainGame {
    /// Initialize the contract, storing the admin owner, reward system address,
    /// and USDC token address used for stake refunds.
    ///
    /// Must be called exactly once. `owner` must sign the transaction.
    ///
    /// # Panics
    /// - `"Contract already initialized"` if called more than once.
    pub fn initialize(env: Env, owner: Address, reward_system: Address, usdc_token: Address) {
        if storage::is_initialized(&env) {
            panic!("Contract already initialized");
        }

        owner.require_auth();

        storage::set_owner(&env, &owner);
        storage::set_reward_system(&env, &reward_system);
        storage::set_usdc_token(&env, &usdc_token);
        storage::set_initialized(&env);
    }

    /// Stub: Register a player for the main game.
    ///
    /// Full implementation will require auth, validate username,
    /// prevent duplicates, and call the reward system for a registration voucher.
    pub fn register_player(_env: Env) {
        // TODO: implement full registration logic
    }

    /// Allow a player to leave a pending (not yet started) game.
    ///
    /// Validates:
    /// - Game exists.
    /// - Game status is `Pending`.
    /// - Caller (`player`) is in `joined_players`.
    ///
    /// On success:
    /// - Refunds `stake_per_player` in USDC to the leaving player (if stake > 0).
    /// - Removes the player from `joined_players`.
    /// - Decrements `total_staked` by `stake_per_player`.
    /// - If no players remain, sets game status to `Ended` with current timestamp.
    /// - Emits `PlayerLeftPending` event always.
    /// - Emits `PendingGameEnded` event if the lobby is now empty.
    ///
    /// # Panics
    /// - `"Game not found"` — game ID does not exist.
    /// - `"Game is not pending"` — game has already started or ended.
    /// - `"Player is not in this game"` — caller has not joined.
    pub fn leave_pending_game(env: Env, game_id: u64, player: Address) {
        player.require_auth();

        let mut game = storage::get_game(&env, game_id).unwrap_or_else(|| panic!("Game not found"));

        if !matches!(game.status, GameStatus::Pending) {
            panic!("Game is not pending");
        }

        // Find and remove the player from joined_players
        let mut new_players: Vec<Address> = Vec::new(&env);
        let mut found = false;

        for p in game.joined_players.iter() {
            if p == player {
                found = true;
            } else {
                new_players.push_back(p);
            }
        }

        if !found {
            panic!("Player is not in this game");
        }

        // Refund stake if applicable — transfer from contract to player
        if game.stake_per_player > 0 {
            let usdc_token = storage::get_usdc_token(&env);
            let token_client = token::Client::new(&env, &usdc_token);
            let contract_address = env.current_contract_address();
            token_client.transfer(&contract_address, &player, &(game.stake_per_player as i128));
        }

        // Update game state
        game.total_staked = game.total_staked.saturating_sub(game.stake_per_player);
        game.joined_players = new_players;

        let remaining = game.joined_players.len() as u32;

        // If no players remain, end the game automatically
        if remaining == 0 {
            game.status = GameStatus::Ended;
            game.ended_at = env.ledger().timestamp();
        }

        storage::set_game(&env, &game);

        // Emit PlayerLeftPending
        events::emit_player_left_pending(
            &env,
            &events::PlayerLeftPendingData {
                game_id,
                player: player.clone(),
                stake_refunded: game.stake_per_player,
                remaining_players: remaining,
            },
        );

        // Emit PendingGameEnded if lobby is now empty
        if remaining == 0 {
            events::emit_pending_game_ended(&env, &events::PendingGameEndedData { game_id });
        }
    }

    // -----------------------------------------------------------------------
    // View functions
    // -----------------------------------------------------------------------

    /// Returns the owner address stored during initialization.
    pub fn get_owner(env: Env) -> Address {
        storage::get_owner(&env)
    }

    /// Returns the reward system contract address stored during initialization.
    pub fn get_reward_system(env: Env) -> Address {
        storage::get_reward_system(&env)
    }

    /// Returns true if the given address has been registered as a player.
    pub fn is_registered(env: Env, address: Address) -> bool {
        storage::is_registered(&env, &address)
    }

    /// Retrieves a game by ID. Returns `None` if not found.
    pub fn get_game(env: Env, game_id: u64) -> Option<Game> {
        storage::get_game(&env, game_id)
    }

    /// Retrieves settings for a game by ID. Returns `None` if not found.
    pub fn get_game_settings(env: Env, game_id: u64) -> Option<GameSettings> {
        storage::get_game_settings(&env, game_id)
    }
}
