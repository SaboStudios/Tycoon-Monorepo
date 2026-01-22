use soroban_sdk::{symbol_short, Address, Env};

/// Emit a transfer event
/// Similar to ERC-1155's TransferSingle event
pub fn emit_transfer_event(env: &Env, from: &Address, to: &Address, token_id: u128, amount: u64) {
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
