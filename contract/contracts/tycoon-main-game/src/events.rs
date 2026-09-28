use soroban_sdk::{contracttype, symbol_short, Address, Env, Symbol};

/// Data payload for Pause event
#[derive(Clone, Debug, Eq, PartialEq)]
#[contracttype]
pub struct PauseEventData {
    /// Address that initiated the pause
    pub paused_by: Address,
    /// Ledger timestamp when paused
    pub paused_at: u64,
    /// Ledger sequence when pause expires (0 = no expiry)
    pub expiry: u32,
    /// Reason for pause
    pub reason: Symbol,
}

/// Emits Pause event when contract is paused
pub fn emit_paused(env: &Env, data: &PauseEventData) {
    let topics = (symbol_short!("Paused"),);
    #[allow(deprecated)]
    env.events().publish(topics, data);
}

/// Data payload for Unpause event
#[derive(Clone, Debug, Eq, PartialEq)]
#[contracttype]
pub struct UnpauseEventData {
    /// Address that initiated the unpause
    pub unpaused_by: Address,
    /// Ledger timestamp when unpaused
    pub unpaused_at: u64,
    /// Duration contract was paused (in seconds)
    pub paused_duration: u64,
    /// Address that originally paused
    pub original_paused_by: Address,
}

/// Emits Unpaused event when contract is unpaused
pub fn emit_unpaused(env: &Env, data: &UnpauseEventData) {
    let topics = (symbol_short!("Unpaused"),);
    #[allow(deprecated)]
    env.events().publish(topics, data);
}

/// Data payload for PlayerLeftPending event (stake refund)
#[derive(Clone, Debug, Eq, PartialEq)]
#[contracttype]
pub struct PlayerLeftPendingData {
    /// Game ID
    pub game_id: u64,
    /// Player that left
    pub player: Address,
    /// Amount refunded to the player
    pub stake_refunded: u128,
    /// Remaining players after leave
    pub remaining_players: u32,
}

/// Emits PlayerLeftPending event when a player leaves a pending game
pub fn emit_player_left_pending(env: &Env, data: &PlayerLeftPendingData) {
    let topics = (symbol_short!("PlayerLeft"),);
    #[allow(deprecated)]
    env.events().publish(topics, data);
}

/// Data payload for PendingGameEnded event (when last player leaves)
#[derive(Clone, Debug, Eq, PartialEq)]
#[contracttype]
pub struct PendingGameEndedData {
    /// Game ID that ended
    pub game_id: u64,
}

/// Emits PendingGameEnded event when last player leaves a pending game
pub fn emit_pending_game_ended(env: &Env, data: &PendingGameEndedData) {
    let topics = (symbol_short!("GameEnded"),);
    #[allow(deprecated)]
    env.events().publish(topics, data);
}