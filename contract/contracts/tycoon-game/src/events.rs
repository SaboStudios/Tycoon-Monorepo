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
