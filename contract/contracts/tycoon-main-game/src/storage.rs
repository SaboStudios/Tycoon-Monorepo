use soroban_sdk::{contracttype, Address, Env, String, Symbol, Vec};

// ============================================================
// Pause-related types
// ============================================================

/// Configuration for pause authorization.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct PauseConfig {
    /// Primary admin address.
    pub admin: Option<Address>,
    /// Additional signers that can pause (multisig).
    pub signers: Vec<Address>,
    /// Number of signatures required for pause/unpause actions.
    pub required_signatures: u32,
}

/// Storage keys for the tycoon-main-game contract.
///
/// Packing notes:
/// - Singleton keys live in `instance()` storage — one ledger entry for the
///   whole contract, cheaper to read/write than separate `persistent()` entries.
/// - Per-entity keys stay in `persistent()` storage so they can be individually
///   expired/archived.
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
    /// The current version of the state schema.
    StateVersion,
    /// Auto-incrementing game ID counter.
    NextGameId,
    /// Marks whether a given address has registered as a player.
    Registered(Address),
    /// Maps game_id -> Game.
    Game(u64),
    /// Maps game_id -> GameSettings.
    GameSettings(u64),
    /// Whether the contract is currently paused.
    Paused,
    /// Address that paused the contract.
    PausedBy,
    /// Ledger timestamp when paused.
    PausedAt,
    /// Ledger sequence when pause expires.
    PauseExpiry,
    /// Reason for the pause.
    PauseReason,
    /// Pause configuration (multisig settings).
    PauseConfig,
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
// Initialization helpers (instance storage)
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

// ============================================================
// State Version helpers
// ============================================================

pub fn get_state_version(env: &Env) -> u32 {
    env.storage()
        .instance()
        .get(&DataKey::StateVersion)
        .unwrap_or(0)
}

pub fn set_state_version(env: &Env, version: u32) {
    env.storage().instance().set(&DataKey::StateVersion, &version);
}

// ============================================================
// Owner/Admin helpers (instance storage)
// ============================================================

pub fn get_owner(env: &Env) -> Address {
    env.storage()
        .instance()
        .get(&DataKey::Owner)
        .expect("Owner not set")
}

pub fn set_owner(env: &Env, owner: &Address) {
    env.storage().instance().set(&DataKey::Owner, owner);
}

/// Alias for get_owner to maintain backward-compatibility with test code.
pub fn get_admin(env: &Env) -> Address {
    get_owner(env)
}

pub fn set_admin(env: &Env, admin: &Address) {
    set_owner(env, admin);
}

// ============================================================
// Reward system helpers (instance storage)
// ============================================================

pub fn get_reward_system(env: &Env) -> Address {
    env.storage()
        .instance()
        .get(&DataKey::RewardSystem)
        .expect("Reward system not set")
}

pub fn set_reward_system(env: &Env, address: &Address) {
    env.storage().instance().set(&DataKey::RewardSystem, address);
}

// ============================================================
// USDC token helpers (instance storage)
// ============================================================

pub fn get_usdc_token(env: &Env) -> Address {
    env.storage()
        .instance()
        .get(&DataKey::UsdcToken)
        .expect("USDC token not set")
}

pub fn set_usdc_token(env: &Env, address: &Address) {
    env.storage().instance().set(&DataKey::UsdcToken, address);
}

// ============================================================
// Pause configuration helpers (persistent storage)
// ============================================================

pub fn set_pause_config(env: &Env, config: &PauseConfig) {
    env.storage()
        .persistent()
        .set(&DataKey::PauseConfig, config);
}

pub fn get_pause_config(env: &Env) -> Option<PauseConfig> {
    env.storage().persistent().get(&DataKey::PauseConfig)
}

// ============================================================
// Pause state helpers (persistent storage)
// ============================================================

pub fn is_paused(env: &Env) -> bool {
    env.storage()
        .persistent()
        .get(&DataKey::Paused)
        .unwrap_or(false)
}

pub fn set_paused(env: &Env, paused: bool) {
    env.storage().persistent().set(&DataKey::Paused, &paused);
}

pub fn get_paused_by(env: &Env) -> Option<Address> {
    env.storage().persistent().get(&DataKey::PausedBy)
}

pub fn set_paused_by(env: &Env, caller: &Address) {
    env.storage().persistent().set(&DataKey::PausedBy, caller);
}

pub fn get_paused_at(env: &Env) -> u64 {
    env.storage()
        .persistent()
        .get(&DataKey::PausedAt)
        .unwrap_or(0)
}

pub fn set_paused_at(env: &Env, timestamp: u64) {
    env.storage().persistent().set(&DataKey::PausedAt, &timestamp);
}

pub fn get_pause_expiry(env: &Env) -> u32 {
    env.storage()
        .persistent()
        .get(&DataKey::PauseExpiry)
        .unwrap_or(0)
}

pub fn set_pause_expiry(env: &Env, expiry: u32) {
    env.storage()
        .persistent()
        .set(&DataKey::PauseExpiry, &expiry);
}

pub fn get_pause_reason(env: &Env) -> Option<Symbol> {
    env.storage().persistent().get(&DataKey::PauseReason)
}

pub fn set_pause_reason(env: &Env, reason: &Symbol) {
    env.storage().persistent().set(&DataKey::PauseReason, reason);
}

/// Pause the contract with an expiry.
pub fn pause_with_expiry(env: &Env, caller: &Address, reason: &Symbol, duration_ledgers: u32) {
    let current_ledger = env.ledger().sequence();
    let expiry = current_ledger + duration_ledgers;

    set_paused(env, true);
    set_paused_by(env, caller);
    set_paused_at(env, env.ledger().timestamp());
    set_pause_expiry(env, expiry);
    set_pause_reason(env, reason);
}

/// Check if the pause has expired and clear pause state if so.
pub fn check_pause_expiry(env: &Env) {
    if is_paused(env) {
        let expiry = get_pause_expiry(env);
        if expiry > 0 && env.ledger().sequence() >= expiry {
            set_paused(env, false);
        }
    }
}

/// Panic if the contract is currently paused.
pub fn ensure_not_paused(env: &Env, operation: &Symbol) {
    check_pause_expiry(env);
    if is_paused(env) {
        panic!("Operation blocked: contract is paused");
    }
}

/// Check whether the caller is authorized to pause/unpause.
pub fn is_authorized_to_pause(env: &Env, caller: &Address, config: &PauseConfig) -> bool {
    // Admin is always authorized
    if let Some(ref admin) = config.admin {
        if caller == admin {
            return true;
        }
    }

    // Check multisig signers
    if config.required_signatures > 0 {
        for signer in config.signers.iter() {
            if &signer == caller {
                return true;
            }
        }
    }

    false
}

// ============================================================
// Player registration helpers (persistent storage)
// ============================================================

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

// ============================================================
// Game ID counter (instance storage)
// ============================================================

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

// ============================================================
// Game storage helpers (persistent storage)
// ============================================================

pub fn get_game(env: &Env, game_id: u64) -> Option<Game> {
    env.storage().persistent().get(&DataKey::Game(game_id))
}

pub fn set_game(env: &Env, game: &Game) {
    env.storage()
        .persistent()
        .set(&DataKey::Game(game.id), game);
}

// ============================================================
// GameSettings storage helpers (persistent storage)
// ============================================================

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