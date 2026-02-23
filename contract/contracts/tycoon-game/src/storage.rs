#![allow(dead_code)]
use soroban_sdk::{contracttype, Address, Env, String};

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
    User(Address),     // address -> User
    Registered(Address), // address -> bool
    RewardSystem,      // reward system contract address
    BackendGameController, // backend game controller address
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

/// User information
#[derive(Clone, Debug, Eq, PartialEq)]
#[contracttype]
pub struct User {
    pub id: u64,
    pub username: String,
    pub address: Address,
    pub registered_at: u64,
    pub games_played: u32,
    pub games_won: u32,
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

/// Get reward system address
pub fn get_reward_system(env: &Env) -> Address {
    env.storage()
        .instance()
        .get(&DataKey::RewardSystem)
        .unwrap()
}

/// Set reward system address
pub fn set_reward_system(env: &Env, address: &Address) {
    env.storage()
        .instance()
        .set(&DataKey::RewardSystem, address);
}

/// Check if address is registered
pub fn is_registered(env: &Env, address: &Address) -> bool {
    env.storage()
        .persistent()
        .get(&DataKey::Registered(address.clone()))
        .unwrap_or(false)
}

/// Set registered flag for address
pub fn set_registered(env: &Env, address: &Address) {
    env.storage()
        .persistent()
        .set(&DataKey::Registered(address.clone()), &true);
}

/// Get user by address
pub fn get_user(env: &Env, address: &Address) -> Option<User> {
    env.storage()
        .persistent()
        .get(&DataKey::User(address.clone()))
}

/// Set user data
pub fn set_user(env: &Env, address: &Address, user: &User) {
    env.storage()
        .persistent()
        .set(&DataKey::User(address.clone()), user);
}

/// Get backend game controller address
pub fn get_backend_game_controller(env: &Env) -> Option<Address> {
    env.storage().instance().get(&DataKey::BackendGameController)
}

/// Set backend game controller address
pub fn set_backend_game_controller(env: &Env, address: &Address) {
    env.storage().instance().set(&DataKey::BackendGameController, address);
}
