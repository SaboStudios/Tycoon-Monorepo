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

/// # Events Unit Tests
///
/// Verifies that each emit helper publishes exactly one event and that the
/// event data field contains the expected value.
///
/// | ID     | Scenario |
/// |--------|----------|
/// | EVT-01 | `emit_funds_withdrawn` publishes event with amount as data |
/// | EVT-02 | `emit_player_removed_from_game` publishes event with turn_count as data |
/// | EVT-03 | `emit_controller_updated` publishes one event |
/// | EVT-04 | `emit_player_registered` publishes one event |
/// | EVT-05 | `emit_ownership_transferred` publishes one event |
#[cfg(test)]
mod tests {
    extern crate std;

    use super::*;
    use soroban_sdk::{
        testutils::{Address as _, Events},
        Address, Env,
    };

    // ── EVT-01 ────────────────────────────────────────────────────────────────

    /// EVT-01: `emit_funds_withdrawn` publishes one event whose data equals the amount.
    #[test]
    fn evt_01_emit_funds_withdrawn_data_equals_amount() {
        let env = Env::default();
        let token = Address::generate(&env);
        let to = Address::generate(&env);

        emit_funds_withdrawn(&env, &token, &to, 1_500);

        let events = env.events().all();
        assert_eq!(events.len(), 1, "EVT-01: exactly one event must be emitted");

        let (_, _, data) = events.first().unwrap();
        let emitted_amount: u128 = soroban_sdk::FromVal::from_val(&env, &data);
        assert_eq!(emitted_amount, 1_500, "EVT-01: data must equal the amount");
    }

    // ── EVT-02 ────────────────────────────────────────────────────────────────

    /// EVT-02: `emit_player_removed_from_game` publishes one event whose data equals turn_count.
    #[test]
    fn evt_02_emit_player_removed_data_equals_turn_count() {
        let env = Env::default();
        let player = Address::generate(&env);

        emit_player_removed_from_game(&env, 42, &player, 7);

        let events = env.events().all();
        assert_eq!(events.len(), 1, "EVT-02: exactly one event must be emitted");

        let (_, _, data) = events.first().unwrap();
        let emitted_turns: u32 = soroban_sdk::FromVal::from_val(&env, &data);
        assert_eq!(emitted_turns, 7, "EVT-02: data must equal turn_count");
    }

    // ── EVT-03 ────────────────────────────────────────────────────────────────

    /// EVT-03: `emit_controller_updated` publishes exactly one event.
    #[test]
    fn evt_03_emit_controller_updated_publishes_event() {
        let env = Env::default();
        let controller = Address::generate(&env);

        emit_controller_updated(&env, &controller);

        let events = env.events().all();
        assert_eq!(events.len(), 1, "EVT-03: exactly one event must be emitted");
    }

    // ── EVT-04 ────────────────────────────────────────────────────────────────

    /// EVT-04: `emit_player_registered` publishes exactly one event.
    #[test]
    fn evt_04_emit_player_registered_publishes_event() {
        let env = Env::default();
        let player = Address::generate(&env);

        emit_player_registered(&env, &player);

        let events = env.events().all();
        assert_eq!(events.len(), 1, "EVT-04: exactly one event must be emitted");
    }

    // ── EVT-05 ────────────────────────────────────────────────────────────────

    /// EVT-05: `emit_ownership_transferred` publishes exactly one event.
    #[test]
    fn evt_05_emit_ownership_transferred_publishes_event() {
        let env = Env::default();
        let old_owner = Address::generate(&env);
        let new_owner = Address::generate(&env);

        emit_ownership_transferred(&env, &old_owner, &new_owner);

        let events = env.events().all();
        assert_eq!(events.len(), 1, "EVT-05: exactly one event must be emitted");
    }
}
