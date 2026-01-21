#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, symbol_short, Address, Env, Map, Symbol};

const VOUCHER_ID_START: u128 = 1_000_000_000;
const COLLECTIBLE_ID_START: u128 = 2_000_000_000;

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    // (Owner, TokenID) -> Amount
    Balance(Address, u128),
    // TokenID -> Value
    VoucherValue(u128),
    // TokenID -> Perk Enum (u32)
    CollectiblePerk(u128),
    // TokenID -> Strength
    CollectibleStrength(u128),
    // TokenID -> Price
    CollectibleTyc(u128),
    CollectibleUsdc(u128),
}

#[contract]
pub struct TycoonRewardSystem;

#[contractimpl]
impl TycoonRewardSystem {
    // Internal helper to mint tokens
    // Note: In a real contract, this would be private or protected by admin checks.
    // For this task, we expose it via internal helpers that 'would be reused'.
    // Since we can't export private functions easily in the contractimpl block for other contracts to usage
    // unless strictly internal, we'll keep them here.
    // However, the prompt asks for "internal mint, burn, and balance query helpers".
    // I will implement internal functions outside of the `[contractimpl]` where possible or private inside it.
    // But `contractimpl` doesn't support private methods effectively for on-chain exposure.
    // I will implement them as private Rust functions that the contract methods use.

    pub fn get_balance(e: Env, owner: Address, token_id: u128) -> u64 {
        Self::balance_of(&e, owner, token_id)
    }

    // Explicitly implementing the "Internal" logic as private functions or just standard functions
}

impl TycoonRewardSystem {
    fn _mint(e: &Env, to: Address, token_id: u128, amount: u64) {
        if amount == 0 {
            return;
        }
        let key = DataKey::Balance(to.clone(), token_id);
        let current_balance: u64 = e.storage().persistent().get(&key).unwrap_or(0);

        // Overflow check
        let new_balance = current_balance
            .checked_add(amount)
            .expect("Balance overflow");

        e.storage().persistent().set(&key, &new_balance);

        e.events()
            .publish((symbol_short!("Mint"), to, token_id), amount);
    }

    fn _burn(e: &Env, from: Address, token_id: u128, amount: u64) {
        if amount == 0 {
            return;
        }
        let key = DataKey::Balance(from.clone(), token_id);
        let current_balance: u64 = e.storage().persistent().get(&key).unwrap_or(0);

        if current_balance < amount {
            panic!("Insufficient balance");
        }

        let new_balance = current_balance - amount;
        e.storage().persistent().set(&key, &new_balance);

        e.events()
            .publish((symbol_short!("Burn"), from, token_id), amount);
    }

    fn balance_of(e: &Env, owner: Address, token_id: u128) -> u64 {
        let key = DataKey::Balance(owner, token_id);
        e.storage().persistent().get(&key).unwrap_or(0)
    }
}

// Exposing some functions for testing purposes within the contract
// (In a real scenario we'd have a public interface calling these)
#[contractimpl]
impl TycoonRewardSystem {
    // Public wrapper for testing mint
    pub fn test_mint(e: Env, to: Address, token_id: u128, amount: u64) {
        Self::_mint(&e, to, token_id, amount);
    }

    // Public wrapper for testing burn
    pub fn test_burn(e: Env, from: Address, token_id: u128, amount: u64) {
        Self::_burn(&e, from, token_id, amount);
    }
}

mod test;
