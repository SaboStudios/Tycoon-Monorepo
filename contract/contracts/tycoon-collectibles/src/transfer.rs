use soroban_sdk::{Address, Env};

use crate::enumeration::{add_token_to_owner, remove_token_from_owner};
use crate::errors::CollectibleError;
use crate::events::{emit_mint_event, emit_transfer_event};
use crate::storage::{get_balance, set_balance};

/// Safely mint `amount` of `token_id` to `to`.
///
/// Uses checked arithmetic so a balance near `u64::MAX` returns
/// `CollectibleError::Overflow` instead of wrapping. On overflow no
/// balance is written and enumeration is left untouched.
pub fn _safe_mint(
    env: &Env,
    to: &Address,
    token_id: u128,
    amount: u64,
) -> Result<(), CollectibleError> {
    let current = get_balance(env, to, token_id);
    let new_balance = current
        .checked_add(amount)
        .ok_or(CollectibleError::Overflow)?;

    set_balance(env, to, token_id, new_balance);

    if current == 0 {
        add_token_to_owner(env, to, token_id);
    }

    emit_mint_event(env, to, token_id, amount);
    Ok(())
}

/// Safely transfer `amount` of `token_id` from `from` to `to`.
///
/// The recipient balance is computed with `checked_add`; on overflow the
/// function returns `CollectibleError::Overflow` before any balance is
/// written, so the sender is not debited and enumeration is unchanged.
pub fn _safe_transfer(
    env: &Env,
    from: &Address,
    to: &Address,
    token_id: u128,
    amount: u64,
) -> Result<(), CollectibleError> {
    let from_balance = get_balance(env, from, token_id);
    if from_balance < amount {
        return Err(CollectibleError::InsufficientBalance);
    }

    let to_balance = get_balance(env, to, token_id);
    let new_to_balance = to_balance
        .checked_add(amount)
        .ok_or(CollectibleError::Overflow)?;

    let new_from_balance = from_balance - amount;

    set_balance(env, from, token_id, new_from_balance);
    set_balance(env, to, token_id, new_to_balance);

    if new_from_balance == 0 {
        remove_token_from_owner(env, from, token_id);
    }
    if to_balance == 0 {
        add_token_to_owner(env, to, token_id);
    }

    emit_transfer_event(env, from, to, token_id, amount);
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::testutils::Address as _;

    #[test]
    fn mint_overflow_leaves_balance_unchanged() {
        let env = Env::default();
        let owner = Address::generate(&env);
        let token_id = 1u128;

        set_balance(&env, &owner, token_id, u64::MAX - 1);

        let result = _safe_mint(&env, &owner, token_id, 2);
        assert_eq!(result, Err(CollectibleError::Overflow));
        assert_eq!(get_balance(&env, &owner, token_id), u64::MAX - 1);
    }

    #[test]
    fn transfer_overflow_does_not_debit_sender() {
        let env = Env::default();
        let from = Address::generate(&env);
        let to = Address::generate(&env);
        let token_id = 1u128;

        set_balance(&env, &from, token_id, 10);
        set_balance(&env, &to, token_id, u64::MAX - 1);

        let result = _safe_transfer(&env, &from, &to, token_id, 2);
        assert_eq!(result, Err(CollectibleError::Overflow));
        assert_eq!(get_balance(&env, &from, token_id), 10);
        assert_eq!(get_balance(&env, &to, token_id), u64::MAX - 1);
    }

    #[test]
    fn transfer_within_bounds_updates_both_balances() {
        let env = Env::default();
        let from = Address::generate(&env);
        let to = Address::generate(&env);
        let token_id = 1u128;

        set_balance(&env, &from, token_id, 10);
        set_balance(&env, &to, token_id, 5);

        _safe_transfer(&env, &from, &to, token_id, 3).unwrap();
        assert_eq!(get_balance(&env, &from, token_id), 7);
        assert_eq!(get_balance(&env, &to, token_id), 8);
    }
}
