#![no_std]

#[allow(dead_code)] // Remove when all planned functions are implemented.
mod storage;

#[cfg(test)]
mod test;

use soroban_sdk::{contract, contractimpl, Address, Env};
use storage::{Game, GameSettings};

/// # TycoonMainGame
///
/// Core game logic contract for Tycoon — players, lobbies, and game lifecycle.
/// References `Tycoon.sol` and `TycoonLib.sol`.
///
/// ## Integration Plan
///
/// - **Reward system**: The `reward_system` address stored during `initialize`
///   will be used to call `mint_voucher(player, amount)` on registration
///   and game completion.
/// - **tycoon-lib**: `GameStatus`, `GameType`, `PlayerSymbol` from
///   `contracts/tycoon-lib` will be re-exported or aliased once lobby
///   logic is implemented.
/// - **tycoon-token / tycoon-reward-system**: `create_game` and `end_game`
///   will interact with these for staking and prize distribution.
///
/// ## Planned functions (not yet implemented)
/// - `create_game(creator, mode, settings, stake)` — create a lobby.
/// - `join_game(game_id, player, code)` — join an existing lobby.
/// - `start_game(game_id)` — transition lobby to Ongoing.
/// - `end_game(game_id, winner)` — settle stakes and mint rewards.
#[contract]
pub struct TycoonMainGame;

#[contractimpl]
impl TycoonMainGame {
    /// Initialize the contract, storing the admin owner and reward system address.
    ///
    /// Must be called exactly once. `owner` must sign the transaction.
    ///
    /// # Panics
    /// - `"Contract already initialized"` if called more than once.
    pub fn initialize(env: Env, owner: Address, reward_system: Address) {
        if storage::is_initialized(&env) {
            panic!("Contract already initialized");
        }

        owner.require_auth();

        storage::set_owner(&env, &owner);
        storage::set_reward_system(&env, &reward_system);
        storage::set_initialized(&env);
    }

    /// Stub: Register a player for the main game.
    ///
    // TODO: implement full registration logic
    pub fn register_player(_env: Env) {
        todo!();
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
