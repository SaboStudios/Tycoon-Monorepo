use soroban_sdk::{Address, Env, Vec};

const OWNED_TOKENS_PREFIX: &str = "OWNED";

/// Add a token to an address's owned tokens list
pub fn add_token_to_owner(env: &Env, owner: &Address, token_id: u128) {
    let key = (OWNED_TOKENS_PREFIX, owner.clone());
    let mut tokens: Vec<u128> = env.storage()
        .persistent()
        .get(&key)
        .unwrap_or(Vec::new(env));
    
    // Only add if not already present
    if !tokens.contains(&token_id) {
        tokens.push_back(token_id);
        env.storage().persistent().set(&key, &tokens);
    }
}

/// Remove a token from an address's owned tokens list
pub fn remove_token_from_owner(env: &Env, owner: &Address, token_id: u128) {
    let key = (OWNED_TOKENS_PREFIX, owner.clone());
    let tokens: Vec<u128> = env.storage()
        .persistent()
        .get(&key)
        .unwrap_or(Vec::new(env));
    
    let mut new_tokens = Vec::new(env);
    for token in tokens.iter() {
        if token != token_id {
            new_tokens.push_back(token);
        }
    }
    
    if new_tokens.is_empty() {
        env.storage().persistent().remove(&key);
    } else {
        env.storage().persistent().set(&key, &new_tokens);
    }
}

/// Get all tokens owned by an address
pub fn get_owned_tokens(env: &Env, owner: &Address) -> Vec<u128> {
    let key = (OWNED_TOKENS_PREFIX, owner.clone());
    env.storage()
        .persistent()
        .get(&key)
        .unwrap_or(Vec::new(env))
}
