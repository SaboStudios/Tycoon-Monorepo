#![allow(dead_code)]
use soroban_sdk::{contracttype, Address, Env, Symbol};

/// Emit a FundsWithdrawn events
pub fn emit_funds_withdrawn(env: &Env, token: &Address, to: &Address, amount: u128) {
    let topics = (Symbol::new(env, "FundsWithdrawn"), token, to);
    #[allow(deprecated)]
    env.events().publish(topics, amount);
}

/// Emit a PlayerRemovedFromGame event
pub fn emit_player_removed_from_game(env: &Env, game_id: u128, player: &Address, turn_count: u32) {
    let topics = (Symbol::new(env, "PlayerRemovedFromGame"), game_id, player);
    #[allow(deprecated)]
    env.events().publish(topics, turn_count);
}
