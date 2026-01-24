use soroban_sdk::{Address, Env, Vec};
use crate::storage::{
    get_owned_tokens_vec, 
    set_owned_tokens_vec, 
    get_token_index, 
    set_token_index, 
    remove_token_index
};

/// Add a token to an address's owned tokens list using indexed storage
/// Only call this when balance transitions from 0 to > 0
pub fn _add_token_to_enumeration(env: &Env, owner: &Address, token_id: u128) {
    // Check if token is already tracked
    if get_token_index(env, owner, token_id).is_some() {
        return; // Already present, no action needed
const OWNED_TOKENS_PREFIX: &str = "OWNED";

/// Add a token to an address's owned tokens list
pub fn add_token_to_owner(env: &Env, owner: &Address, token_id: u128) {
    let key = (OWNED_TOKENS_PREFIX, owner.clone());
    let mut tokens: Vec<u128> = env
        .storage()
        .persistent()
        .get(&key)
        .unwrap_or(Vec::new(env));

    // Only add if not already present
    if !tokens.contains(token_id) {
        tokens.push_back(token_id);
        env.storage().persistent().set(&key, &tokens);
    }
    
    let mut tokens = get_owned_tokens_vec(env, owner);
    let new_index = tokens.len();
    
    // Add token to the end of the Vec
    tokens.push_back(token_id);
    
    // Store the Vec and index mapping
    set_owned_tokens_vec(env, owner, &tokens);
    set_token_index(env, owner, token_id, new_index);
}

/// Remove a token from an address's owned tokens list using swap-remove
/// Only call this when balance transitions to 0
pub fn _remove_token_from_enumeration(env: &Env, owner: &Address, token_id: u128) {
    // Get the index of the token to remove
    let token_index = match get_token_index(env, owner, token_id) {
        Some(idx) => idx,
        None => return, // Token not in list, nothing to remove
    };
    
    let mut tokens = get_owned_tokens_vec(env, owner);
    let last_index = tokens.len().saturating_sub(1);
    
    if tokens.is_empty() {
        return;
    }
    
    // If this is not the last element, swap it with the last element
    if token_index != last_index {
        let last_token_id = tokens.get(last_index).unwrap();
        
        // Swap: move last element to the position of removed element
        tokens.set(token_index, last_token_id);
        
        // Update the index of the swapped token
        set_token_index(env, owner, last_token_id, token_index);
/// Remove a token from an address's owned tokens list
pub fn remove_token_from_owner(env: &Env, owner: &Address, token_id: u128) {
    let key = (OWNED_TOKENS_PREFIX, owner.clone());
    let tokens: Vec<u128> = env
        .storage()
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
    
    // Remove the last element (which is now either the token we want to remove
    // or has been swapped to the token's original position)
    tokens.pop_back();
    
    // Clean up index for the removed token
    remove_token_index(env, owner, token_id);
    
    // Update storage
    set_owned_tokens_vec(env, owner, &tokens);
}

/// Get all tokens owned by an address
pub fn get_owned_tokens(env: &Env, owner: &Address) -> Vec<u128> {
    get_owned_tokens_vec(env, owner)
}

/// Get the count of owned tokens for an address
pub fn owned_token_count(env: &Env, owner: &Address) -> u32 {
    let tokens = get_owned_tokens_vec(env, owner);
    tokens.len()
}

/// Get token ID at a specific index for an owner
/// Returns None if index is out of bounds
pub fn token_of_owner_by_index(env: &Env, owner: &Address, index: u32) -> Option<u128> {
    let tokens = get_owned_tokens_vec(env, owner);
    tokens.get(index)
}

// Re-export for backward compatibility
pub use _add_token_to_enumeration as add_token_to_owner;
pub use _remove_token_from_enumeration as remove_token_from_owner;
