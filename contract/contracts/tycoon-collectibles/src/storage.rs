use soroban_sdk::{Address, Env};

const ADMIN_KEY: &str = "ADMIN";
const BALANCE_PREFIX: &str = "BAL";

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
