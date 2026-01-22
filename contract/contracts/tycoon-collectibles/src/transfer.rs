use soroban_sdk::{Address, Env, symbol_short};
use crate::storage::{get_balance, set_balance};
use crate::enumeration::{add_token_to_owner, remove_token_from_owner};
use crate::events::emit_transfer_event;
use crate::errors::CollectibleError;

/// Internal safe transfer function
/// Handles balance updates, enumeration, and event emission
pub fn _safe_transfer(
    env: &Env,
    from: &Address,
    to: &Address,
    token_id: u128,
    amount: u64,
) -> Result<(), CollectibleError> {
    // Validate amount
    if amount == 0 {
        return Err(CollectibleError::InvalidAmount);
    }

    // Get current balances
    let from_balance = get_balance(env, from, token_id);
    
    // Check sufficient balance
    if from_balance < amount {
        return Err(CollectibleError::InsufficientBalance);
    }

    // Update sender balance
    let new_from_balance = from_balance - amount;
    set_balance(env, from, token_id, new_from_balance);
    
    // Remove from enumeration if balance becomes zero
    if new_from_balance == 0 {
        remove_token_from_owner(env, from, token_id);
    }

    // Update receiver balance
    let to_balance = get_balance(env, to, token_id);
    let new_to_balance = to_balance + amount;
    set_balance(env, to, token_id, new_to_balance);
    
    // Add to enumeration if this is a new token for the recipient
    if to_balance == 0 {
        add_token_to_owner(env, to, token_id);
    }

    // Emit transfer event
    emit_transfer_event(env, from, to, token_id, amount);
    
    Ok(())
}

/// Batch transfer stub for future implementation
/// This can be expanded later for gas-efficient multi-token transfers
#[allow(dead_code)]
pub fn _safe_batch_transfer(
    env: &Env,
    from: &Address,
    to: &Address,
    token_ids: &soroban_sdk::Vec<u128>,
    amounts: &soroban_sdk::Vec<u64>,
) -> Result<(), CollectibleError> {
    if token_ids.len() != amounts.len() {
        return Err(CollectibleError::TokenIdMismatch);
    }

    for i in 0..token_ids.len() {
        let token_id = token_ids.get(i).unwrap();
        let amount = amounts.get(i).unwrap();
        _safe_transfer(env, from, to, token_id, amount)?;
    }
    
    Ok(())
}

/// Mint tokens to an address
pub fn _safe_mint(
    env: &Env,
    to: &Address,
    token_id: u128,
    amount: u64,
) -> Result<(), CollectibleError> {
    if amount == 0 {
        return Err(CollectibleError::InvalidAmount);
    }

    // Update balance
    let to_balance = get_balance(env, to, token_id);
    let new_to_balance = to_balance + amount;
    set_balance(env, to, token_id, new_to_balance);
    
    // Add to enumeration if this is a new token for the recipient
    if to_balance == 0 {
        add_token_to_owner(env, to, token_id);
    }

    // Emit mint event (from zero address concept)
    env.events().publish(
        (symbol_short!("mint"),),
        (to.clone(), token_id, amount),
    );
    
    Ok(())
}

/// Burn tokens from an address
pub fn _safe_burn(
    env: &Env,
    from: &Address,
    token_id: u128,
    amount: u64,
) -> Result<(), CollectibleError> {
    if amount == 0 {
        return Err(CollectibleError::InvalidAmount);
    }

    let from_balance = get_balance(env, from, token_id);
    if from_balance < amount {
        return Err(CollectibleError::InsufficientBalance);
    }

    // Update balance
    let new_from_balance = from_balance - amount;
    set_balance(env, from, token_id, new_from_balance);
    
    // Remove from enumeration if balance becomes zero
    if new_from_balance == 0 {
        remove_token_from_owner(env, from, token_id);
    }

    // Emit burn event
    env.events().publish(
        (symbol_short!("burn"),),
        (from.clone(), token_id, amount),
    );
    
    Ok(())
}
