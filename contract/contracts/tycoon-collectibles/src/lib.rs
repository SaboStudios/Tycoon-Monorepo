#![no_std]

mod storage;
mod types;
mod enumeration;
mod transfer;
mod events;
mod errors;

pub use types::*;
pub use storage::*;
pub use enumeration::*;
pub use transfer::*;
pub use events::*;
pub use errors::CollectibleError;

use soroban_sdk::{contract, contractimpl, Address, Env};

#[contract]
pub struct TycoonCollectibles;

#[contractimpl]
impl TycoonCollectibles {
    /// Initialize the contract with an admin
    pub fn initialize(env: Env, admin: Address) -> Result<(), CollectibleError> {
        if has_admin(&env) {
            return Err(CollectibleError::AlreadyInitialized);
        }
        set_admin(&env, &admin);
        Ok(())
    }

    /// Buy a collectible (mints to buyer)
    pub fn buy_collectible(
        env: Env,
        buyer: Address,
        token_id: u128,
        amount: u64,
    ) -> Result<(), CollectibleError> {
        buyer.require_auth();
        
        // Mint to buyer - we use a special mint flag instead of zero address
        _safe_mint(&env, &buyer, token_id, amount)
    }

    /// Transfer a collectible from one address to another
    pub fn transfer(
        env: Env,
        from: Address,
        to: Address,
        token_id: u128,
        amount: u64,
    ) -> Result<(), CollectibleError> {
        from.require_auth();
        
        _safe_transfer(&env, &from, &to, token_id, amount)
    }

    /// Burn a collectible
    pub fn burn(env: Env, owner: Address, token_id: u128, amount: u64) -> Result<(), CollectibleError> {
        owner.require_auth();
        
        _safe_burn(&env, &owner, token_id, amount)
    }

    /// Get balance of a specific token for an address
    pub fn balance_of(env: Env, owner: Address, token_id: u128) -> u64 {
        get_balance(&env, &owner, token_id)
    }

    /// Get all token IDs owned by an address
    pub fn tokens_of(env: Env, owner: Address) -> soroban_sdk::Vec<u128> {
        get_owned_tokens(&env, &owner)
    }
}

mod test;
