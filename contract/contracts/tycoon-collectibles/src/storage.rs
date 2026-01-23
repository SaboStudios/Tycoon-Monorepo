use soroban_sdk::{Address, Env};
use crate::types::Perk;

const ADMIN_KEY: &str = "ADMIN";
const BALANCE_PREFIX: &str = "BAL";
const PAUSED_KEY: &str = "PAUSED";
const PERK_PREFIX: &str = "PERK";
const STRENGTH_PREFIX: &str = "STRENGTH";

/// Check if admin is set
pub fn has_admin(env: &Env) -> bool {
    env.storage().instance().has(&ADMIN_KEY)
}

/// Set the contract admin
pub fn set_admin(env: &Env, admin: &Address) {
    env.storage().instance().set(&ADMIN_KEY, admin);
}

/// Get the contract admin
pub fn get_admin(env: &Env) -> Address {
    env.storage().instance().get(&ADMIN_KEY).unwrap()
}

/// Check if contract is paused
pub fn is_paused(env: &Env) -> bool {
    env.storage().instance().get(&PAUSED_KEY).unwrap_or(false)
}

/// Set pause state
pub fn set_paused(env: &Env, paused: bool) {
    env.storage().instance().set(&PAUSED_KEY, &paused);
}

/// Get balance for a specific token
pub fn get_balance(env: &Env, owner: &Address, token_id: u128) -> u64 {
    let key = (BALANCE_PREFIX, owner.clone(), token_id);
    env.storage().persistent().get(&key).unwrap_or(0)
}

/// Set balance for a specific token
pub fn set_balance(env: &Env, owner: &Address, token_id: u128, amount: u64) {
    let key = (BALANCE_PREFIX, owner.clone(), token_id);
    if amount == 0 {
        env.storage().persistent().remove(&key);
    } else {
        env.storage().persistent().set(&key, &amount);
    }
}

/// Get perk for a token
pub fn get_perk(env: &Env, token_id: u128) -> Perk {
    let key = (PERK_PREFIX, token_id);
    env.storage().persistent().get(&key).unwrap_or(Perk::None)
}

/// Set perk for a token
pub fn set_perk(env: &Env, token_id: u128, perk: Perk) {
    let key = (PERK_PREFIX, token_id);
    env.storage().persistent().set(&key, &perk);
}

/// Get strength for a token
pub fn get_strength(env: &Env, token_id: u128) -> u32 {
    let key = (STRENGTH_PREFIX, token_id);
    env.storage().persistent().get(&key).unwrap_or(0)
}

/// Set strength for a token
pub fn set_strength(env: &Env, token_id: u128, strength: u32) {
    let key = (STRENGTH_PREFIX, token_id);
    env.storage().persistent().set(&key, &strength);
}
