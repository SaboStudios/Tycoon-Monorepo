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

pub fn emit_collectible_stocked_event(
    env: &Env,
    token_id: u128,
    amount: u64,
    perk: u32,
    strength: u32,
    tyc_price: u128,
    usdc_price: u128,
) {
    env.events().publish(
        (symbol_short!("stock"), symbol_short!("new")),
        (token_id, amount, perk, strength, tyc_price, usdc_price),
    );
}

pub fn emit_collectible_restocked_event(
    env: &Env,
    token_id: u128,
    additional_amount: u64,
    new_total: u64,
) {
    env.events().publish(
        (symbol_short!("restock"),),
        (token_id, additional_amount, new_total),
    );
}

pub fn emit_price_updated_event(
    env: &Env,
    token_id: u128,
    new_tyc_price: u128,
    new_usdc_price: u128,
) {
    env.events().publish(
        (symbol_short!("price"), symbol_short!("update")),
        (token_id, new_tyc_price, new_usdc_price),
    );
}

pub fn emit_collectible_minted_event(
    env: &Env,
    token_id: u128,
    recipient: &Address,
    perk: u32,
    strength: u32,
) {
    env.events().publish(
        (symbol_short!("coll_mint"), recipient.clone()),
        (token_id, perk, strength),
    );
}

/// Emit event for non-cash perk activation (stubs for future implementation)
/// Used for: ExtraTurn, JailFree, DoubleRent, RollBoost, Teleport, Shield, PropertyDiscount, RollExact
pub fn emit_perk_activated_event(
    env: &Env,
    activator: &Address,
    token_id: u128,
    perk: Perk,
    strength: u32,
) {
    env.events().publish(
        (
            symbol_short!("perk"),
            symbol_short!("activate"),
            activator.clone(),
        ),
        (token_id, perk, strength),
    );
}
