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
