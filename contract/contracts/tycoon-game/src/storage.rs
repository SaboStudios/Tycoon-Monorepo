#![allow(dead_code)]
use soroban_sdk::{contracttype, Address, Env};

/// Storage keys for the contract
#[derive(Clone)]
#[contracttype]
pub enum DataKey {
    Owner,
    TycToken,
    UsdcToken,
    IsInitialized,
    Collectible(u128), // token_id -> CollectibleInfo
    CashTier(u32),     // tier -> value
}

/// Information about a collectible NFT
#[derive(Clone, Debug, Eq, PartialEq)]
#[contracttype]
pub struct CollectibleInfo {
    pub perk: u32,
    pub strength: u32,
    pub tyc_price: u128,
    pub usdc_price: u128,
    pub shop_stock: u64,
}

/// Get the owner address from storage
pub fn get_owner(env: &Env) -> Address {
    env.storage().instance().get(&DataKey::Owner).unwrap()
}

/// Set the owner address in storage
pub fn set_owner(env: &Env, owner: &Address) {
    env.storage().instance().set(&DataKey::Owner, owner);
}

/// Get the TYC token address from storage
pub fn get_tyc_token(env: &Env) -> Address {
    env.storage().instance().get(&DataKey::TycToken).unwrap()
}

/// Set the TYC token address in storage
pub fn set_tyc_token(env: &Env, token: &Address) {
    env.storage().instance().set(&DataKey::TycToken, token);
}

/// Get the USDC token address from storage
pub fn get_usdc_token(env: &Env) -> Address {
    env.storage().instance().get(&DataKey::UsdcToken).unwrap()
}

/// Set the USDC token address in storage
pub fn set_usdc_token(env: &Env, token: &Address) {
    env.storage().instance().set(&DataKey::UsdcToken, token);
}

/// Check if the contract is initialized
pub fn is_initialized(env: &Env) -> bool {
    env.storage()
        .instance()
        .get(&DataKey::IsInitialized)
        .unwrap_or(false)
}

/// Set the initialization flag
pub fn set_initialized(env: &Env) {
    env.storage().instance().set(&DataKey::IsInitialized, &true);
}

/// Get collectible info by token_id
pub fn get_collectible(env: &Env, token_id: u128) -> Option<CollectibleInfo> {
    env.storage()
        .persistent()
        .get(&DataKey::Collectible(token_id))
}

/// Set collectible info for a token_id
pub fn set_collectible(env: &Env, token_id: u128, info: &CollectibleInfo) {
    env.storage()
        .persistent()
        .set(&DataKey::Collectible(token_id), info);
}

/// Get cash tier value
pub fn get_cash_tier(env: &Env, tier: u32) -> Option<u128> {
    env.storage().persistent().get(&DataKey::CashTier(tier))
}

/// Set cash tier value
pub fn set_cash_tier(env: &Env, tier: u32, value: u128) {
    env.storage()
        .persistent()
        .set(&DataKey::CashTier(tier), &value);
}
