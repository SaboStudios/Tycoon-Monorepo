use soroban_sdk::{Address, Env, symbol_short};
use crate::types::Perk;

/// Emit a transfer event
/// Similar to ERC-1155's TransferSingle event
pub fn emit_transfer_event(
    env: &Env,
    from: &Address,
    to: &Address,
    token_id: u128,
    amount: u64,
) {
    env.events().publish(
        (symbol_short!("transfer"),),
        (from.clone(), to.clone(), token_id, amount),
    );
}

/// Emit a batch transfer event (for future use)
#[allow(dead_code)]
pub fn emit_batch_transfer_event(
    env: &Env,
    from: &Address,
    to: &Address,
    token_ids: &soroban_sdk::Vec<u128>,
    amounts: &soroban_sdk::Vec<u64>,
) {
    env.events().publish(
        (symbol_short!("batch_tx"),),
        (from.clone(), to.clone(), token_ids.clone(), amounts.clone()),
    );
}

/// Emit a collectible burned event
pub fn emit_collectible_burned_event(
    env: &Env,
    burner: &Address,
    token_id: u128,
    perk: Perk,
    strength: u32,
) {
    env.events().publish(
        (symbol_short!("coll_burn"),),
        (burner.clone(), token_id, perk, strength),
    );
}

/// Emit a cash perk activated event
pub fn emit_cash_perk_activated_event(
    env: &Env,
    activator: &Address,
    token_id: u128,
    cash_value: u64,
) {
    env.events().publish(
        (symbol_short!("cash_perk"),),
        (activator.clone(), token_id, cash_value),
    );
}
