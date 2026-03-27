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

        // Batch all instance writes together — single storage round-trip
        storage::set_owner(&env, &owner);
        storage::set_reward_system(&env, &reward_system);
        storage::set_usdc_token(&env, &usdc_token);
        storage::set_initialized(&env);
    }

    /// Stub: Register a player for the main game.
    pub fn register_player(_env: Env) {
        // TODO: implement full registration logic
    }

    /// Allow a player to leave a pending (not yet started) game.
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
    /// - `"Game not found"` — game ID does not exist.
    /// - `"Game is not pending"` — game has already started or ended.
    /// - `"Player is not in this game"` — caller has not joined.
    pub fn leave_pending_game(env: Env, game_id: u64, player: Address) {
        player.require_auth();

        let mut game: Game =
            storage::get_game(&env, game_id).unwrap_or_else(|| panic!("Game not found"));

        if !matches!(game.status, GameStatus::Pending) {
            panic!("Game is not pending");
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

        if !found {
            panic!("Player is not in this game");
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

        let remaining = game.joined_players.len() as u32;

        if remaining == 0 {
            game.status = GameStatus::Ended;
            game.ended_at = env.ledger().timestamp();
        }

        // Single persistent write covers all mutations above
        storage::set_game(&env, &game);

        events::emit_player_left_pending(
            &env,
            &events::PlayerLeftPendingData {
                game_id,
                player: player.clone(),
                stake_refunded: game.stake_per_player,
                remaining_players: remaining,
            },
        );

        if remaining == 0 {
            events::emit_pending_game_ended(&env, &events::PendingGameEndedData { game_id });
        }
    }

    // -----------------------------------------------------------------------
    // View functions
    // -----------------------------------------------------------------------

    pub fn get_owner(env: Env) -> Address {
        storage::get_owner(&env)
    }

    pub fn get_reward_system(env: Env) -> Address {
        storage::get_reward_system(&env)
    }

    pub fn is_registered(env: Env, address: Address) -> bool {
        storage::is_registered(&env, &address)
    }

    pub fn get_game(env: Env, game_id: u64) -> Option<Game> {
        storage::get_game(&env, game_id)
    }

    pub fn get_game_settings(env: Env, game_id: u64) -> Option<GameSettings> {
        storage::get_game_settings(&env, game_id)
    }
}
