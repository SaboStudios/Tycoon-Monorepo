use soroban_sdk::{contracttype, Address, Env, String, Vec};

// -----------------------------------------------------------------------
// DataKey
// -----------------------------------------------------------------------

/// Storage keys for the tycoon-main-game contract.
#[derive(Clone)]
#[contracttype]
pub enum DataKey {
    /// The contract admin/owner address.
    Owner,
    /// The reward system contract address used for voucher minting.
    RewardSystem,
    /// Tracks whether the contract has been initialized.
    IsInitialized,
    /// Marks whether a given address has registered as a player.
    Registered(Address),
    /// Maps game_id -> Game.
    Game(u64),
    /// Maps game_id -> GameSettings.
    GameSettings(u64),
    /// Auto-incrementing game ID counter.
    NextGameId,
}

// -----------------------------------------------------------------------
// Enums
// -----------------------------------------------------------------------

/// Lifecycle state of a Tycoon game.
///
/// Mirrors `TycoonLib.sol` GameStatus.
/// - `Pending`  — Game created, waiting for players.
/// - `Ongoing`  — Game is actively being played.
/// - `Ended`    — Game has concluded and a winner was determined.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum GameStatus {
    /// Game created, accepting players.
    Pending,
    /// Game is actively being played.
    Ongoing,
    /// Game has concluded.
    Ended,
}

/// Who can join a Tycoon game.
///
/// Mirrors `TycoonLib.sol` GameMode.
/// - `Public`  — Open to any registered player.
/// - `Private` — Requires a matching room code.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum GameMode {
    /// Open lobby — any registered player can join.
    Public,
    /// Private lobby — only players with the room code can join.
    Private,
}

// -----------------------------------------------------------------------
// GameSettings struct
// -----------------------------------------------------------------------

/// Configuration parameters for a Tycoon game lobby.
///
/// Mirrors `TycoonLib.sol` GameSettings struct.
/// Stored separately from `Game` so settings can be read without loading
/// the full game state (which includes the dynamic `joined_players` list).
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct GameSettings {
    /// Maximum number of players allowed in this game (2–8).
    pub max_players: u32,
    /// Whether auction mode is enabled for property purchases.
    pub auction: bool,
    /// Starting cash balance for each player in the game.
    pub starting_cash: u128,
    /// Room code required to join a private game. Empty string for public games.
    pub private_room_code: String,
}

// -----------------------------------------------------------------------
// Game struct
// -----------------------------------------------------------------------

/// Full state of a Tycoon game instance.
///
/// Mirrors `TycoonLib.sol` Game struct.
/// `joined_players` is stored inline as a `Vec<Address>` — on Soroban
/// this is serialized as part of the struct's XDR representation, which
/// is acceptable for up to 8 players (the game maximum).
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Game {
    /// Unique auto-incremented game identifier.
    pub id: u64,
    /// Short alphanumeric join code for sharing the lobby.
    pub code: String,
    /// Address of the player who created the game.
    pub creator: Address,
    /// Current lifecycle status of the game.
    pub status: GameStatus,
    /// Address of the winning player. `None` until the game ends.
    pub winner: Option<Address>,
    /// Total player slots for this game (mirrors `GameSettings.max_players`).
    pub number_of_players: u32,
    /// Ordered list of players who have joined (creator is first).
    pub joined_players: Vec<Address>,
    /// Whether this is a public or private lobby.
    pub mode: GameMode,
    /// Whether this is an AI-controlled game.
    pub ai: bool,
    /// Amount each player stakes to enter (in token units). Zero for free games.
    pub stake_per_player: u128,
    /// Total staked amount across all joined players (`stake_per_player * joined_players.len()`).
    pub total_staked: u128,
    /// Ledger timestamp when the game was created.
    pub created_at: u64,
    /// Ledger timestamp when the game ended. Zero until the game concludes.
    pub ended_at: u64,
}

// -----------------------------------------------------------------------
// Initialization helpers
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
// Owner helpers
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
// Reward system helpers
// -----------------------------------------------------------------------

pub fn get_reward_system(env: &Env) -> Address {
    env.storage()
        .instance()
        .get(&DataKey::RewardSystem)
        .expect("Reward system not set")
}

pub fn set_reward_system(env: &Env, address: &Address) {
    env.storage()
        .instance()
        .set(&DataKey::RewardSystem, address);
}

// -----------------------------------------------------------------------
// Player registration helpers
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
// Game ID counter
// -----------------------------------------------------------------------

/// Increments and returns the next game ID.
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
// Game storage helpers
// -----------------------------------------------------------------------

/// Retrieves a game by its ID. Returns `None` if not found.
pub fn get_game(env: &Env, game_id: u64) -> Option<Game> {
    env.storage().persistent().get(&DataKey::Game(game_id))
}

/// Persists a game by its ID.
pub fn set_game(env: &Env, game: &Game) {
    env.storage()
        .persistent()
        .set(&DataKey::Game(game.id), game);
}

// -----------------------------------------------------------------------
// GameSettings storage helpers
// -----------------------------------------------------------------------

/// Retrieves settings for a game by game ID. Returns `None` if not found.
pub fn get_game_settings(env: &Env, game_id: u64) -> Option<GameSettings> {
    env.storage()
        .persistent()
        .get(&DataKey::GameSettings(game_id))
}

/// Persists settings for a game by game ID.
pub fn set_game_settings(env: &Env, game_id: u64, settings: &GameSettings) {
    env.storage()
        .persistent()
        .set(&DataKey::GameSettings(game_id), settings);
}
