#![allow(dead_code)]
use soroban_sdk::{contracttype, Address, Env, Symbol};

/// Emit a FundsWithdrawn event
pub fn emit_funds_withdrawn(env: &Env, token: &Address, to: &Address, amount: u128) {
    let topics = (Symbol::new(env, "FundsWithdrawn"), token, to);
    #[allow(deprecated)]
    env.events().publish(topics, amount);
}

/// Data payload for GameCreated event
#[derive(Clone, Debug, Eq, PartialEq)]
#[contracttype]
pub struct GameCreatedData {
    pub game_id: u64,
    pub creator: Address,
    pub game_type: crate::storage::GameType,
    pub number_of_players: u32,
    pub starting_balance: u128,
    pub stake_amount: u128,
    pub code: soroban_sdk::String,
    pub player_symbol: u32,
}

/// Emit GameCreated event
pub fn emit_game_created(env: &Env, data: &GameCreatedData) {
    let topics = (Symbol::new(env, "GameCreated"), data.creator.clone());
    #[allow(deprecated)]
    env.events().publish(topics, data);
}

/// Data payload for PlayerJoined event
#[derive(Clone, Debug, Eq, PartialEq)]
#[contracttype]
pub struct PlayerJoinedData {
    pub game_id: u64,
    pub player: Address,
    pub player_symbol: u32,
    pub joined_count: u32,
}

/// Emit PlayerJoined event
pub fn emit_player_joined(env: &Env, data: &PlayerJoinedData) {
    let topics = (Symbol::new(env, "PlayerJoined"), data.player.clone());
    #[allow(deprecated)]
    env.events().publish(topics, data);
}
/// Data payload for GameStarted event
#[derive(Clone, Debug, Eq, PartialEq)]
#[contracttype]
pub struct GameStartedData {
    pub game_id: u64,
    pub player_count: u32,
}

/// Emit GameStarted event
pub fn emit_game_started(env: &Env, data: &GameStartedData) {
    let topics = (Symbol::new(env, "GameStarted"), data.game_id);
    #[allow(deprecated)]
    env.events().publish(topics, data);
}

/// Data payload for PlayerLeft event
#[derive(Clone, Debug, Eq, PartialEq)]
#[contracttype]
pub struct PlayerLeftData {
    pub game_id: u64,
    pub player: Address,
}

/// Emit PlayerLeft event
pub fn emit_player_left(env: &Env, data: &PlayerLeftData) {
    let topics = (Symbol::new(env, "PlayerLeft"), data.player.clone());
    #[allow(deprecated)]
    env.events().publish(topics, data);
}

/// Data payload for PlayerExited event
#[derive(Clone, Debug, Eq, PartialEq)]
#[contracttype]
pub struct PlayerExitedData {
    pub game_id: u64,
    pub player: Address,
}

/// Emit PlayerExited event
pub fn emit_player_exited(env: &Env, data: &PlayerExitedData) {
    let topics = (Symbol::new(env, "PlayerExited"), data.player.clone());
    #[allow(deprecated)]
    env.events().publish(topics, data);
}

/// Data payload for GameEnded event
#[derive(Clone, Debug, Eq, PartialEq)]
#[contracttype]
pub struct GameEndedData {
    pub game_id: u64,
    pub winner: Option<Address>,
}

/// Emit GameEnded event
pub fn emit_game_ended(env: &Env, data: &GameEndedData) {
    let topics = (Symbol::new(env, "GameEnded"), data.game_id);
    #[allow(deprecated)]
    env.events().publish(topics, data);
}

/// Data payload for PlayerRemoved event
#[derive(Clone, Debug, Eq, PartialEq)]
#[contracttype]
pub struct PlayerRemovedData {
    pub game_id: u64,
    pub player: Address,
}

/// Emit PlayerRemoved event
pub fn emit_player_removed(env: &Env, data: &PlayerRemovedData) {
    let topics = (Symbol::new(env, "PlayerRemoved"), data.player.clone());
    #[allow(deprecated)]
    env.events().publish(topics, data);
}
