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

use soroban_sdk::{contract, contractimpl, token, Address, Env};

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

        // Get shop config
        let shop_config = get_shop_config(&env).ok_or(CollectibleError::ShopNotInitialized)?;

        // Get price for this collectible
        let price_config =
            get_collectible_price(&env, token_id).ok_or(CollectibleError::ZeroPrice)?;

        // Determine payment token and price
        let (payment_token, price) = if use_usdc {
            (shop_config.usdc_token, price_config.usdc_price)
        } else {
            (shop_config.tyc_token, price_config.tyc_price)
        };

        // Check price is valid
        if price <= 0 {
            return Err(CollectibleError::ZeroPrice);
        }

        // Check stock
        let current_stock = get_shop_stock(&env, token_id);
        if current_stock < 1 {
            return Err(CollectibleError::InsufficientStock);
        }

        // Transfer payment from buyer to contract
        let contract_address = env.current_contract_address();
        let token_client = token::Client::new(&env, &payment_token);
        token_client.transfer(&buyer, &contract_address, &price);

        // Mint 1 collectible to buyer
        _safe_mint(&env, &buyer, token_id, 1)?;

        // Decrement shop stock
        set_shop_stock(&env, token_id, current_stock - 1);

        // Emit event
        emit_collectible_bought_event(&env, token_id, &buyer, price, use_usdc);

        Ok(())
    }

    /// Buy a collectible (mints to buyer) - legacy function without payment
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

    /// Get shop stock for a collectible
    pub fn get_stock(env: Env, token_id: u128) -> u64 {
        get_shop_stock(&env, token_id)
    }
}

mod test;
