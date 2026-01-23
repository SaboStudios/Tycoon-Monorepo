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

    /// Burn a collectible to activate its perk
    pub fn burn_collectible_for_perk(
        env: Env,
        caller: Address,
        token_id: u128,
    ) -> Result<(), CollectibleError> {
        // Require caller authentication
        caller.require_auth();
        
        // Check if contract is paused
        if is_paused(&env) {
            return Err(CollectibleError::ContractPaused);
        }
        
        // Check caller owns at least 1 unit
        let balance = get_balance(&env, &caller, token_id);
        if balance < 1 {
            return Err(CollectibleError::InsufficientBalance);
        }
        
        // Get perk and strength
        let perk = get_perk(&env, token_id);
        let strength = get_strength(&env, token_id);
        
        // Validate perk is not None
        if matches!(perk, Perk::None) {
            return Err(CollectibleError::InvalidPerk);
        }
        
        // Special handling for CashTiered and TaxRefund
        if matches!(perk, Perk::CashTiered | Perk::TaxRefund) {
            // Validate strength is 1-5
            if strength < 1 || strength > 5 {
                return Err(CollectibleError::InvalidStrength);
            }
            
            // Get cash value from CASH_TIERS
            let cash_value = CASH_TIERS[(strength - 1) as usize];
            
            // Emit CashPerkActivated event
            emit_cash_perk_activated_event(&env, &caller, token_id, cash_value);
        }
        
        // Burn 1 unit
        _safe_burn(&env, &caller, token_id, 1)?;
        
        // Emit CollectibleBurned event
        emit_collectible_burned_event(&env, &caller, token_id, perk, strength);
        
        Ok(())
    }

    /// Set perk for a token (admin only)
    pub fn set_token_perk(
        env: Env,
        admin: Address,
        token_id: u128,
        perk: Perk,
        strength: u32,
    ) -> Result<(), CollectibleError> {
        admin.require_auth();
        
        // Verify admin
        let stored_admin = get_admin(&env);
        if admin != stored_admin {
            return Err(CollectibleError::Unauthorized);
        }
        
        set_perk(&env, token_id, perk);
        set_strength(&env, token_id, strength);
        
        Ok(())
    }

    /// Pause the contract (admin only)
    pub fn set_pause(env: Env, admin: Address, paused: bool) -> Result<(), CollectibleError> {
        admin.require_auth();
        
        // Verify admin
        let stored_admin = get_admin(&env);
        if admin != stored_admin {
            return Err(CollectibleError::Unauthorized);
        }
        
        set_paused(&env, paused);
        
        Ok(())
    }

    /// Get balance of a specific token for an address
    pub fn balance_of(env: Env, owner: Address, token_id: u128) -> u64 {
        get_balance(&env, &owner, token_id)
    }

    /// Get all token IDs owned by an address
    pub fn tokens_of(env: Env, owner: Address) -> soroban_sdk::Vec<u128> {
        get_owned_tokens(&env, &owner)
    }

    /// Get perk for a token
    pub fn get_token_perk(env: Env, token_id: u128) -> Perk {
        get_perk(&env, token_id)
    }

    /// Get strength for a token
    pub fn get_token_strength(env: Env, token_id: u128) -> u32 {
        get_strength(&env, token_id)
    }

    /// Check if contract is paused
    pub fn is_contract_paused(env: Env) -> bool {
        is_paused(&env)
    }
}

mod test;
