#![no_std]

mod storage;

#[cfg(test)]
mod test;

use soroban_sdk::{contract, contractimpl, Address, Env};

/// # TycoonMainGame
///
/// Entry point for core Tycoon game logic: player registration, lobby
/// management, and game lifecycle. This contract references the same
/// on-chain structures described in `Tycoon.sol`.
///
/// ## Integration Plan
///
/// - **Reward system**: The `reward_system` address stored during
///   `initialize` will be used to call `mint_voucher(player, amount)`
///   on the reward contract when a player registers or wins a game.
///   This mirrors the voucher minting in `tycoon-game`'s
///   `mint_registration_voucher`.
///
/// - **tycoon-lib**: Shared types (`GameStatus`, `GameType`,
///   `PlayerSymbol`) defined in `contracts/tycoon-lib` will be
///   imported here once lobby and game creation logic is implemented.
///
/// - **tycoon-token / tycoon-reward-system**: Future functions such as
///   `create_game` and `end_game` will interact with these contracts
///   for staking and prize distribution respectively.
///
/// ## Planned functions (not yet implemented)
///
/// - `create_game(creator, game_type, symbol, players, stake)` — create a lobby.
/// - `join_game(game_id, player, symbol, code)` — join an existing lobby.
/// - `start_game(game_id)` — transition lobby to in-progress.
/// - `end_game(game_id, winner)` — settle stakes and mint rewards.
#[contract]
pub struct TycoonMainGame;

#[contractimpl]
impl TycoonMainGame {
    /// Initialize the contract, storing the admin owner and reward system address.
    ///
    /// Must be called exactly once. The `owner` must sign the transaction.
    /// The `reward_system` address is stored for future voucher minting
    /// calls — it is expected to implement a `mint_voucher(player, amount)`
    /// function compatible with the existing `tycoon-reward-system` contract.
    ///
    /// # Panics
    ///
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
    /// Currently a no-op placeholder. Full implementation will:
    /// - Require the caller to sign (`caller.require_auth()`).
    /// - Validate and store a username (3–20 characters).
    /// - Prevent duplicate registrations.
    /// - Call the reward system to mint a registration voucher.
    ///
    /// # Future signature
    /// ```ignore
    /// pub fn register_player(env: Env, caller: Address, username: String)
    /// ```
    pub fn register_player(_env: Env) {
        // TODO: implement full registration logic
        // 1. caller.require_auth()
        // 2. validate username length (3-20 chars)
        // 3. panic if already registered
        // 4. store User { id, username, address, registered_at, games_played, games_won }
        // 5. call reward_system.mint_voucher(caller, REGISTRATION_VOUCHER_AMOUNT)
    }

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
}
