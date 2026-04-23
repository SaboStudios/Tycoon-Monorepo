use crate::errors::CollectibleError;
use crate::storage::{
    get_owned_tokens_vec, get_token_index, remove_token_index, set_owned_tokens_vec,
    set_token_index,
};
use soroban_sdk::{Address, Env, Vec};

// Maximum page size for pagination to stay within gas limits
// Each u128 is 16 bytes, 100 tokens = 1600 bytes, well under 16.4KB return value limit
pub const MAX_PAGE_SIZE: u32 = 100;

/// Add a token to an address's owned tokens list using indexed storage
/// Only call this when balance transitions from 0 to > 0
pub fn _add_token_to_enumeration(env: &Env, owner: &Address, token_id: u128) {
    // Check if token is already tracked
    if get_token_index(env, owner, token_id).is_some() {
        return; // Already present, no action needed
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

/// Get a page of tokens owned by an address with pagination
/// Returns a Vec of token IDs for the specified page
/// Page size is limited to MAX_PAGE_SIZE for gas safety
pub fn tokens_of_owner_page(
    env: &Env,
    owner: &Address,
    page: u32,
    page_size: u32,
) -> Result<Vec<u128>, CollectibleError> {
    // Validate page size
    if page_size > MAX_PAGE_SIZE {
        return Err(crate::errors::CollectibleError::InvalidPageSize);
    }
    if page_size == 0 {
        return Err(crate::errors::CollectibleError::InvalidPageSize);
    }

    let tokens = get_owned_tokens_vec(env, owner);
    let total_tokens = tokens.len();
    let start_index = page * page_size;

    // Check if page is out of bounds
    if start_index >= total_tokens {
        return Ok(Vec::new(env)); // Return empty vec for out of bounds pages
    }

    let end_index = (start_index + page_size).min(total_tokens);
    let mut result = Vec::new(env);

    for i in start_index..end_index {
        if let Some(token_id) = tokens.get(i) {
            result.push_back(token_id);
        }
    }

    Ok(result)
}

/// Iterator-like function to get the next batch of tokens
/// This implements an iterator pattern for gas-safe enumeration
/// Returns the tokens for the current batch and whether there are more
pub fn iterate_owned_tokens(
    env: &Env,
    owner: &Address,
    start_index: u32,
    batch_size: u32,
) -> Result<(Vec<u128>, bool), CollectibleError> {
    // Validate batch size
    if batch_size > MAX_PAGE_SIZE {
        return Err(crate::errors::CollectibleError::InvalidPageSize);
    }
    if batch_size == 0 {
        return Err(crate::errors::CollectibleError::InvalidPageSize);
    }

    let tokens = get_owned_tokens_vec(env, owner);
    let total_tokens = tokens.len();

    // Check if start_index is out of bounds
    if start_index >= total_tokens {
        return Ok((Vec::new(env), false)); // No more tokens
    }

    let end_index = (start_index + batch_size).min(total_tokens);
    let mut result = Vec::new(env);
    let has_more = end_index < total_tokens;

    for i in start_index..end_index {
        if let Some(token_id) = tokens.get(i) {
            result.push_back(token_id);
        }
    }

    Ok((result, has_more))
}

// Re-export for backward compatibility
pub use _add_token_to_enumeration as add_token_to_owner;
pub use _remove_token_from_enumeration as remove_token_from_owner;
