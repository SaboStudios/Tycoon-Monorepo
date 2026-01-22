#![no_std]

mod enumeration;
mod errors;
mod events;
mod storage;
mod transfer;
mod types;

pub use enumeration::*;
pub use errors::CollectibleError;
pub use events::*;
pub use storage::*;
pub use transfer::*;
pub use types::*;

use soroban_sdk::{contract, contractimpl, symbol_short, Address, Env};

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
    pub fn burn(
        env: Env,
        owner: Address,
        token_id: u128,
        amount: u64,
    ) -> Result<(), CollectibleError> {
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

    pub fn get_backend_minter(env: Env) -> Option<Address> {
        // We call the internal storage helper we wrote earlier
        get_minter(&env)
    }

    /// Set the backend minter address (Admin only)
    pub fn set_backend_minter(env: Env, new_minter: Address) -> Result<(), CollectibleError> {
        if new_minter == env.current_contract_address() {
            return Err(CollectibleError::Unauthorized); // Or a new InvalidAddress error
        }
        // Only owner can set backend minter
        let admin = get_admin(&env);
        admin.require_auth();

        set_minter(&env, &new_minter);

        env.events()
            .publish((symbol_short!("minter"), symbol_short!("set")), new_minter);

        Ok(())
    }

    // Reusable Auth Helper (Requirement: require_backend_or_owner)
    pub fn backend_mint(
        env: Env,
        caller: Address,
        to: Address,
        token_id: u128,
        amount: u64,
    ) -> Result<(), CollectibleError> {
        caller.require_auth(); // Requirement: Use Address::require_auth()

        let admin = get_admin(&env);
        let minter = get_minter(&env);

        // Implementation of "require_backend_or_owner"
        let is_admin = caller == admin;
        let is_minter = minter.is_some() && Some(caller) == minter;

        if !(is_admin || is_minter) {
            return Err(CollectibleError::Unauthorized); // Requirement: Clear error
        }

        _safe_mint(&env, &to, token_id, amount)
    }
}
mod test;
