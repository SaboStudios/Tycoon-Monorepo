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
