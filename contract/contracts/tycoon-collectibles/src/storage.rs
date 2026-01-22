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
