#![allow(dead_code)]
use soroban_sdk::{Address, Env, Symbol};

/// Emit a FundsWithdrawn event
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

/// Emit a ControllerUpdated event (OI-3)
pub fn emit_controller_updated(env: &Env, new_controller: &Address) {
    let topics = (Symbol::new(env, "ControllerUpdated"), new_controller);
    #[allow(deprecated)]
    env.events().publish(topics, ());
}

/// Emit a PlayerRegistered event (OI-4)
pub fn emit_player_registered(env: &Env, player: &Address) {
    let topics = (Symbol::new(env, "PlayerRegistered"), player);
    #[allow(deprecated)]
    env.events().publish(topics, ());
}

/// Emit an OwnershipTransferred event
pub fn emit_ownership_transferred(env: &Env, old_owner: &Address, new_owner: &Address) {
    let topics = (
        Symbol::new(env, "OwnershipTransferred"),
        old_owner,
        new_owner,
    );
    #[allow(deprecated)]
    env.events().publish(topics, ());
}
