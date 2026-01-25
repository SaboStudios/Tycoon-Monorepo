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

use soroban_sdk::{contract, contractimpl, symbol_short, token, Address, Env};

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

    /// Initialize the shop with TYC and USDC token addresses (admin only)
    pub fn init_shop(
        env: Env,
        tyc_token: Address,
        usdc_token: Address,
    ) -> Result<(), CollectibleError> {
        let admin = get_admin(&env);
        admin.require_auth();

        let config = ShopConfig {
            tyc_token,
            usdc_token,
        };
        set_shop_config(&env, &config);
        Ok(())
    }

    /// Set a collectible for sale in the shop (admin only)
    pub fn set_collectible_for_sale(
        env: Env,
        token_id: u128,
        tyc_price: i128,
        usdc_price: i128,
        stock: u64,
    ) -> Result<(), CollectibleError> {
        let admin = get_admin(&env);
        admin.require_auth();

        let price = CollectiblePrice {
            tyc_price,
            usdc_price,
        };
        set_collectible_price(&env, token_id, &price);
        set_shop_stock(&env, token_id, stock);
        Ok(())
    }

    /// Buy a collectible from the shop using TYC or USDC
    pub fn buy_collectible_from_shop(
        env: Env,
        buyer: Address,
        token_id: u128,
        use_usdc: bool,
    ) -> Result<(), CollectibleError> {
        buyer.require_auth();

        let shop_config = get_shop_config(&env).ok_or(CollectibleError::ShopNotInitialized)?;
        let price_config =
            get_collectible_price(&env, token_id).ok_or(CollectibleError::ZeroPrice)?;

        let (payment_token, price) = if use_usdc {
            (shop_config.usdc_token, price_config.usdc_price)
        } else {
            (shop_config.tyc_token, price_config.tyc_price)
        };

        if price <= 0 {
            return Err(CollectibleError::ZeroPrice);
        }

        let current_stock = get_shop_stock(&env, token_id);
        if current_stock < 1 {
            return Err(CollectibleError::InsufficientStock);
        }

        let contract_address = env.current_contract_address();
        let token_client = token::Client::new(&env, &payment_token);
        token_client.transfer(&buyer, &contract_address, &price);

        _safe_mint(&env, &buyer, token_id, 1)?;
        set_shop_stock(&env, token_id, current_stock - 1);
        emit_collectible_bought_event(&env, token_id, &buyer, price, use_usdc);

        Ok(())
    }

    pub fn buy_collectible(
        env: Env,
        buyer: Address,
        token_id: u128,
        amount: u64,
    ) -> Result<(), CollectibleError> {
        buyer.require_auth();
        _safe_mint(&env, &buyer, token_id, amount)
    }

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

    pub fn burn(
        env: Env,
        owner: Address,
        token_id: u128,
        amount: u64,
    ) -> Result<(), CollectibleError> {
        owner.require_auth();
        _safe_burn(&env, &owner, token_id, amount)
    }

    pub fn burn_collectible_for_perk(
        env: Env,
        caller: Address,
        token_id: u128,
    ) -> Result<(), CollectibleError> {
        caller.require_auth();

        if is_paused(&env) {
            return Err(CollectibleError::ContractPaused);
        }

        let balance = get_balance(&env, &caller, token_id);
        if balance < 1 {
            return Err(CollectibleError::InsufficientBalance);
        }

        let perk = get_perk(&env, token_id);
        let strength = get_strength(&env, token_id);

        if matches!(perk, Perk::None) {
            return Err(CollectibleError::InvalidPerk);
        }

        if matches!(perk, Perk::CashTiered | Perk::TaxRefund) {
            if !(1..=5).contains(&strength) {
                return Err(CollectibleError::InvalidStrength);
            }
            let cash_value = CASH_TIERS[(strength - 1) as usize];
            emit_cash_perk_activated_event(&env, &caller, token_id, cash_value.into());
        }

        _safe_burn(&env, &caller, token_id, 1)?;
        emit_collectible_burned_event(&env, &caller, token_id, perk, strength);

        Ok(())
    }

    pub fn set_token_perk(
        env: Env,
        admin: Address,
        token_id: u128,
        perk: Perk,
        strength: u32,
    ) -> Result<(), CollectibleError> {
        admin.require_auth();
        let stored_admin = get_admin(&env);
        if admin != stored_admin {
            return Err(CollectibleError::Unauthorized);
        }

        set_perk(&env, token_id, perk);
        set_strength(&env, token_id, strength);
        Ok(())
    }

    pub fn set_pause(env: Env, admin: Address, paused: bool) -> Result<(), CollectibleError> {
        admin.require_auth();
        let stored_admin = get_admin(&env);
        if admin != stored_admin {
            return Err(CollectibleError::Unauthorized);
        }

        set_paused(&env, paused);
        Ok(())
    }

    pub fn balance_of(env: Env, owner: Address, token_id: u128) -> u64 {
        get_balance(&env, &owner, token_id)
    }

    pub fn tokens_of(env: Env, owner: Address) -> soroban_sdk::Vec<u128> {
        get_owned_tokens(&env, &owner)
    }

    pub fn get_backend_minter(env: Env) -> Option<Address> {
        get_minter(&env)
    }

    pub fn set_backend_minter(env: Env, new_minter: Address) -> Result<(), CollectibleError> {
        if new_minter == env.current_contract_address() {
            return Err(CollectibleError::Unauthorized);
        }
        let admin = get_admin(&env);
        admin.require_auth();

        set_minter(&env, &new_minter);
        env.events()
            .publish((symbol_short!("minter"), symbol_short!("set")), new_minter);

        Ok(())
    }

    /// Get the current stock for a collectible
    pub fn get_stock(env: Env, token_id: u128) -> u64 {
        get_shop_stock(&env, token_id)
    }

    /// Check if the contract is paused
    pub fn is_contract_paused(env: Env) -> bool {
        is_paused(&env)
    }

    /// Get the perk for a specific token
    pub fn get_token_perk(env: Env, token_id: u128) -> Perk {
        get_perk(&env, token_id)
    }

    /// Get the strength for a specific token
    pub fn get_token_strength(env: Env, token_id: u128) -> u32 {
        get_strength(&env, token_id)
    }

    pub fn backend_mint(
        env: Env,
        caller: Address,
        to: Address,
        token_id: u128,
        amount: u64,
    ) -> Result<(), CollectibleError> {
        caller.require_auth();

        let admin = get_admin(&env);
        let minter = get_minter(&env);

        let is_admin = caller == admin;
        let is_minter = minter.is_some() && Some(caller) == minter;

        if !(is_admin || is_minter) {
            return Err(CollectibleError::Unauthorized);
        }

        _safe_mint(&env, &to, token_id, amount)
    }
}

#[cfg(test)]
mod test;
