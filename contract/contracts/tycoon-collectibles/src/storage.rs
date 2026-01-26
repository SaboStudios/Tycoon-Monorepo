use soroban_sdk::{Address, Env, Vec};
use crate::types::Perk;

const ADMIN_KEY: &str = "ADMIN";
const MINTER_KEY: &str = "MINTER";
const BALANCE_PREFIX: &str = "BAL";
const PAUSED_KEY: &str = "PAUSED";
const PERK_PREFIX: &str = "PERK";
const STRENGTH_PREFIX: &str = "STRENGTH";
const OWNED_TOKENS_PREFIX: &str = "OWNED";
const TOKEN_INDEX_PREFIX: &str = "TIDX";
const NEXT_TOKEN_ID_KEY: &str = "NEXT_TID";

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

/// Set perk for a token
pub fn set_perk(env: &Env, token_id: u128, perk: Perk) {
    let key = (PERK_PREFIX, token_id);
    env.storage().persistent().set(&key, &perk);
}

/// Get perk for a token
pub fn get_perk(env: &Env, token_id: u128) -> Perk {
    let key = (PERK_PREFIX, token_id);
    env.storage().persistent().get(&key).unwrap_or(Perk::None)
}

/// Set strength for a token
pub fn set_strength(env: &Env, token_id: u128, strength: u32) {
    let key = (STRENGTH_PREFIX, token_id);
    env.storage().persistent().set(&key, &strength);
}

/// Get strength for a token
pub fn get_strength(env: &Env, token_id: u128) -> u32 {
    let key = (STRENGTH_PREFIX, token_id);
    env.storage().persistent().get(&key).unwrap_or(0)
}

/// Get the owned tokens Vec for an address
pub fn get_owned_tokens_vec(env: &Env, owner: &Address) -> Vec<u128> {
    let key = (OWNED_TOKENS_PREFIX, owner.clone());
    env.storage()
        .persistent()
        .get(&key)
        .unwrap_or(Vec::new(env))
}

/// Set the owned tokens Vec for an address
pub fn set_owned_tokens_vec(env: &Env, owner: &Address, tokens: &Vec<u128>) {
    let key = (OWNED_TOKENS_PREFIX, owner.clone());
    if tokens.is_empty() {
        env.storage().persistent().remove(&key);
    } else {
        env.storage().persistent().set(&key, tokens);
    }
}

/// Get the index of a token in an owner's token list
pub fn get_token_index(env: &Env, owner: &Address, token_id: u128) -> Option<u32> {
    let key = (TOKEN_INDEX_PREFIX, owner.clone(), token_id);
    env.storage().persistent().get(&key)
}

/// Set the index of a token in an owner's token list
pub fn set_token_index(env: &Env, owner: &Address, token_id: u128, index: u32) {
    let key = (TOKEN_INDEX_PREFIX, owner.clone(), token_id);
    env.storage().persistent().set(&key, &index);
}

/// Remove the index entry for a token
pub fn remove_token_index(env: &Env, owner: &Address, token_id: u128) {
    let key = (TOKEN_INDEX_PREFIX, owner.clone(), token_id);
    env.storage().persistent().remove(&key);
}

// ========================
// Shop Storage Functions
// ========================

use crate::types::{CollectiblePrice, ShopConfig};

const SHOP_CONFIG_KEY: &str = "SHOP_CFG";
const PRICE_PREFIX: &str = "PRICE";
const STOCK_PREFIX: &str = "STOCK";

/// Check if shop configuration is set
pub fn has_shop_config(env: &Env) -> bool {
    env.storage().instance().has(&SHOP_CONFIG_KEY)
}

/// Set shop configuration (token addresses)
pub fn set_shop_config(env: &Env, config: &ShopConfig) {
    env.storage().instance().set(&SHOP_CONFIG_KEY, config);
}

/// Get shop configuration
pub fn get_shop_config(env: &Env) -> Option<ShopConfig> {
    env.storage().instance().get(&SHOP_CONFIG_KEY)
}

/// Set price for a collectible
pub fn set_collectible_price(env: &Env, token_id: u128, price: &CollectiblePrice) {
    let key = (PRICE_PREFIX, token_id);
    env.storage().persistent().set(&key, price);
}

/// Get price for a collectible
pub fn get_collectible_price(env: &Env, token_id: u128) -> Option<CollectiblePrice> {
    let key = (PRICE_PREFIX, token_id);
    env.storage().persistent().get(&key)
}

/// Set shop stock for a collectible
pub fn set_shop_stock(env: &Env, token_id: u128, amount: u64) {
    let key = (STOCK_PREFIX, token_id);
    if amount == 0 {
        env.storage().persistent().remove(&key);
    } else {
        env.storage().persistent().set(&key, &amount);
    }
}

/// Get shop stock for a collectible
pub fn get_shop_stock(env: &Env, token_id: u128) -> u64 {
    let key = (STOCK_PREFIX, token_id);
    env.storage().persistent().get(&key).unwrap_or(0)
}

pub fn set_minter(env: &Env, minter: &Address) {
    env.storage().instance().set(&MINTER_KEY, minter);
}

pub fn get_minter(env: &Env) -> Option<Address> {
    env.storage().instance().get(&MINTER_KEY)
}

/// Get the next available token ID
pub fn get_next_token_id(env: &Env) -> u128 {
    env.storage().instance().get(&NEXT_TOKEN_ID_KEY).unwrap_or(1)
}

/// Set the next available token ID
pub fn set_next_token_id(env: &Env, token_id: u128) {
    env.storage().instance().set(&NEXT_TOKEN_ID_KEY, &token_id);
}

/// Increment and return the next token ID
pub fn increment_token_id(env: &Env) -> u128 {
    let current = get_next_token_id(env);
    set_next_token_id(env, current + 1);
    current
}
