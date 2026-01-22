use soroban_sdk::{Address, Env, Vec};

const ADMIN_KEY: &str = "ADMIN";
const BALANCE_PREFIX: &str = "BAL";
const OWNED_TOKENS_PREFIX: &str = "OWNED";
const TOKEN_INDEX_PREFIX: &str = "TIDX";

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
