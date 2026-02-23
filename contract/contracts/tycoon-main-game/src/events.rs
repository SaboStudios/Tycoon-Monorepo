use soroban_sdk::{contracttype, Address, Env, Symbol};

/// Data payload for PlayerLeftPending event.
#[derive(Clone, Debug, Eq, PartialEq)]
#[contracttype]
pub struct PlayerLeftPendingData {
    pub game_id: u64,
    pub player: Address,
    pub stake_refunded: u128,
    pub remaining_players: u32,
}

/// Emits PlayerLeftPending when a player successfully leaves a pending game.
pub fn emit_player_left_pending(env: &Env, data: &PlayerLeftPendingData) {
    let topics = (Symbol::new(env, "PlayerLeftPending"), data.player.clone());
    #[allow(deprecated)]
    env.events().publish(topics, data);
}

/// Data payload for PendingGameEnded event — emitted when the last player
/// leaves and the lobby is automatically closed.
#[derive(Clone, Debug, Eq, PartialEq)]
#[contracttype]
pub struct PendingGameEndedData {
    pub game_id: u64,
}

/// Emits PendingGameEnded when the lobby becomes empty.
pub fn emit_pending_game_ended(env: &Env, data: &PendingGameEndedData) {
    let topics = (Symbol::new(env, "PendingGameEnded"), data.game_id);
    #[allow(deprecated)]
    env.events().publish(topics, data);
}
