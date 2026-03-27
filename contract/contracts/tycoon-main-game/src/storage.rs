use soroban_sdk::{contracttype, Address, Env, String, Vec};

// -----------------------------------------------------------------------
// DataKey
// -----------------------------------------------------------------------

/// Storage keys for the tycoon-main-game contract.
///
/// Packing notes:
/// - Singleton keys (Owner, RewardSystem, UsdcToken, IsInitialized,
///   NextGameId) live in `instance()` storage — one ledger entry for the
///   whole contract, cheaper to read/write than separate `persistent()`
///   entries.
/// - Per-entity keys (Registered, Game, GameSettings) stay in
///   `persistent()` storage so they can be individually expired/archived.
#[derive(Clone)]
#[contracttype]
pub enum DataKey {
    /// The contract admin/owner address.
    Owner,
    /// The reward system contract address used for voucher minting.
    RewardSystem,
    /// The USDC token contract address used for stake refunds.
    UsdcToken,
    /// Tracks whether the contract has been initialized.
    IsInitialized,
    /// Auto-incrementing game ID counter.
    NextGameId,
    /// Marks whether a given address has registered as a player.
    Registered(Address),
    /// Maps game_id -> Game.
    Game(u64),
    /// Maps game_id -> GameSettings.
    GameSettings(u64),
}

// -----------------------------------------------------------------------
// Enums
// -----------------------------------------------------------------------

/// Lifecycle state of a Tycoon game.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum GameStatus {
    Pending,
    Ongoing,
    Ended,
}

/// Who can join a Tycoon game.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum GameMode {
    Public,
    Private,
}

// -----------------------------------------------------------------------
// GameSettings struct
// -----------------------------------------------------------------------

/// Configuration parameters for a Tycoon game lobby.
///
/// Stored separately from `Game` so settings can be read without loading
/// the full game state (avoids deserialising the joined_players Vec).
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct GameSettings {
    pub max_players: u32,
    pub auction: bool,
    pub starting_cash: u128,
    pub private_room_code: String,
}

// -----------------------------------------------------------------------
// Game struct
// -----------------------------------------------------------------------

/// Full state of a Tycoon game instance.
///
/// `joined_players` is stored inline as a `Vec<Address>` — acceptable for
/// up to 8 players.  Fields are ordered largest → smallest to minimise
/// XDR padding.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Game {
    pub id: u64,
    pub code: String,
    pub creator: Address,
    pub status: GameStatus,
    pub winner: Option<Address>,
    pub number_of_players: u32,
    pub joined_players: Vec<Address>,
    pub mode: GameMode,
    pub ai: bool,
    pub stake_per_player: u128,
    pub total_staked: u128,
    pub created_at: u64,
    pub ended_at: u64,
}

// -----------------------------------------------------------------------
// Initialization helpers  (instance storage)
// -----------------------------------------------------------------------

pub fn is_initialized(env: &Env) -> bool {
    env.storage()
        .instance()
        .get(&DataKey::IsInitialized)
        .unwrap_or(false)
}

pub fn set_initialized(env: &Env) {
    env.storage().instance().set(&DataKey::IsInitialized, &true);
}

// -----------------------------------------------------------------------
// Owner helpers  (instance storage)
// -----------------------------------------------------------------------

pub fn get_owner(env: &Env) -> Address {
    env.storage()
        .instance()
        .get(&DataKey::Owner)
        .expect("Owner not set")
}

pub fn set_owner(env: &Env, owner: &Address) {
    env.storage().instance().set(&DataKey::Owner, owner);
}

// -----------------------------------------------------------------------
// Reward system helpers  (instance storage)
// -----------------------------------------------------------------------

pub fn get_reward_system(env: &Env) -> Address {
    env.storage()
        .instance()
        .get(&DataKey::RewardSystem)
        .expect("Reward system not set")
}

pub fn set_reward_system(env: &Env, address: &Address) {
    env.storage().instance().set(&DataKey::RewardSystem, address);
}

// -----------------------------------------------------------------------
// USDC token helpers  (instance storage)
// -----------------------------------------------------------------------

pub fn get_usdc_token(env: &Env) -> Address {
    env.storage()
        .instance()
        .get(&DataKey::UsdcToken)
        .expect("USDC token not set")
}

pub fn set_usdc_token(env: &Env, address: &Address) {
    env.storage().instance().set(&DataKey::UsdcToken, address);
}

// -----------------------------------------------------------------------
// Player registration helpers  (persistent storage)
// -----------------------------------------------------------------------

pub fn is_registered(env: &Env, address: &Address) -> bool {
    env.storage()
        .persistent()
        .get(&DataKey::Registered(address.clone()))
        .unwrap_or(false)
}

pub fn set_registered(env: &Env, address: &Address) {
    env.storage()
        .persistent()
        .set(&DataKey::Registered(address.clone()), &true);
}

// -----------------------------------------------------------------------
// Game ID counter  (instance storage)
// -----------------------------------------------------------------------

/// Increments and returns the next game ID, starting at 1.
pub fn next_game_id(env: &Env) -> u64 {
    let id: u64 = env
        .storage()
        .instance()
        .get(&DataKey::NextGameId)
        .unwrap_or(0);
    let next = id + 1;
    env.storage().instance().set(&DataKey::NextGameId, &next);
    next
}

// -----------------------------------------------------------------------
// Game storage helpers  (persistent storage)
// -----------------------------------------------------------------------

pub fn get_game(env: &Env, game_id: u64) -> Option<Game> {
    env.storage().persistent().get(&DataKey::Game(game_id))
}

pub fn set_game(env: &Env, game: &Game) {
    env.storage()
        .persistent()
        .set(&DataKey::Game(game.id), game);
}

// -----------------------------------------------------------------------
// GameSettings storage helpers  (persistent storage)
// -----------------------------------------------------------------------

pub fn get_game_settings(env: &Env, game_id: u64) -> Option<GameSettings> {
    env.storage()
        .persistent()
        .get(&DataKey::GameSettings(game_id))
}

pub fn set_game_settings(env: &Env, game_id: u64, settings: &GameSettings) {
    env.storage()
        .persistent()
        .set(&DataKey::GameSettings(game_id), settings);
}
