use crate::types::Perk;
use soroban_sdk::{symbol_short, Address, Env};

pub fn emit_transfer_event(env: &Env, from: &Address, to: &Address, token_id: u128, amount: u64) {
    // Standardizing on (symbol, from, to) for better indexing
    env.events().publish(
        (symbol_short!("transfer"), from.clone(), to.clone()),
        (token_id, amount),
    );
}

pub fn emit_collectible_burned_event(
    env: &Env,
    burner: &Address,
    token_id: u128,
    perk: Perk,
    strength: u32,
) {
    // Tests are looking for "burn" and "coll"
    env.events().publish(
        (symbol_short!("burn"), symbol_short!("coll"), burner.clone()),
        (token_id, perk, strength),
    );
}

pub fn emit_cash_perk_activated_event(
    env: &Env,
    activator: &Address,
    token_id: u128,
    cash_value: i128, // Changed to i128 to match price/balance types
) {
    env.events().publish(
        (
            symbol_short!("perk"),
            symbol_short!("cash"),
            activator.clone(),
        ),
        (token_id, cash_value),
    );
}

pub fn emit_collectible_bought_event(
    env: &Env,
    token_id: u128,
    buyer: &Address,
    price: i128,
    use_usdc: bool,
) {
    env.events().publish(
        (symbol_short!("coll_buy"), buyer.clone()),
        (token_id, price, use_usdc),
    );
}
