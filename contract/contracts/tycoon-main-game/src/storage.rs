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
    env.storage()
        .instance()
        .set(&DataKey::StateVersion, &version);
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
    env.storage()
        .instance()
        .set(&DataKey::RewardSystem, address);
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

/// Persist the pause configuration.
///
/// Rejects configs whose `required_signatures` exceeds the number of
/// authorized signers, since such a threshold can never be satisfied.
pub fn set_pause_config(env: &Env, config: &PauseConfig) {
    if config.required_signatures > config.signers.len() {
        panic!("required_signatures exceeds signer count");
    }
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
    env.storage()
        .persistent()
        .set(&DataKey::PausedAt, &timestamp);
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
    env.storage()
        .persistent()
        .set(&DataKey::PauseReason, reason);
}

// ============================================================
// Pause authorization
// ============================================================

/// Returns true when `caller` is authorized to pause/unpause the contract.
///
/// The admin is always authorized. A non-admin caller is only authorized
/// when the configured threshold is exactly 1 and the caller is a listed
/// signer. Thresholds greater than 1 require a real multisig flow that is
/// not yet implemented, so a single signer cannot satisfy them.
pub fn is_authorized_to_pause(env: &Env, caller: &Address) -> bool {
    if let Some(admin) = env
        .storage()
        .instance()
        .get::<DataKey, Address>(&DataKey::Owner)
    {
        if &admin == caller {
            return true;
        }
    }

    let config = match get_pause_config(env) {
        Some(c) => c,
        None => return false,
    };

    // A single signer can only satisfy a threshold of exactly 1.
    if config.required_signatures != 1 {
        return false;
    }

    config.signers.iter().any(|s| &s == caller)
}
