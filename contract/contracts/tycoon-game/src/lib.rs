#![no_std]

mod events;
mod storage;

use soroban_sdk::{contract, contractimpl, token, Address, Env};
use storage::{get_owner, get_tyc_token, get_usdc_token, CollectibleInfo};

#[contract]
pub struct TycoonContract;

#[contractimpl]
impl TycoonContract {
    /// Initialize the contract with token addresses and owner
    pub fn initialize(env: Env, tyc_token: Address, usdc_token: Address, initial_owner: Address) {
        if storage::is_initialized(&env) {
            panic!("Contract already initialized");
        }

        initial_owner.require_auth();

        storage::set_tyc_token(&env, &tyc_token);
        storage::set_usdc_token(&env, &usdc_token);
        storage::set_owner(&env, &initial_owner);
        storage::set_initialized(&env);
    }

    pub fn withdraw_funds(env: Env, token: Address, to: Address, amount: u128) {
        let owner = get_owner(&env);
        owner.require_auth();

        // Validate token address (must be TYC or USDC)
        let tyc_token = get_tyc_token(&env);
        let usdc_token = get_usdc_token(&env);

        if token != tyc_token && token != usdc_token {
            panic!("Invalid token address");
        }

        // Create token client and check balance
        let token_client = token::Client::new(&env, &token);
        let contract_address = env.current_contract_address();
        let balance = token_client.balance(&contract_address);

        if balance < amount as i128 {
            panic!("Insufficient contract balance");
        }

        token_client.transfer(&contract_address, &to, &(amount as i128));

        events::emit_funds_withdrawn(&env, &token, &to, amount);
    }

    pub fn get_collectible_info(env: Env, token_id: u128) -> (u32, u32, u128, u128, u64) {
        match storage::get_collectible(&env, token_id) {
            Some(info) => (
                info.perk,
                info.strength,
                info.tyc_price,
                info.usdc_price,
                info.shop_stock,
            ),
            None => panic!("Collectible does not exist"),
        }
    }

    pub fn get_cash_tier_value(env: Env, tier: u32) -> u128 {
        match storage::get_cash_tier(&env, tier) {
            Some(value) => value,
            None => panic!("Cash tier does not exist"),
        }
    }

    pub fn set_collectible_info(
        env: Env,
        token_id: u128,
        perk: u32,
        strength: u32,
        tyc_price: u128,
        usdc_price: u128,
        shop_stock: u64,
    ) {
        // In a production contract, this would require owner authorization
        let owner = get_owner(&env);
        owner.require_auth();

        let info = CollectibleInfo {
            perk,
            strength,
            tyc_price,
            usdc_price,
            shop_stock,
        };
        storage::set_collectible(&env, token_id, &info);
    }

    pub fn set_cash_tier_value(env: Env, tier: u32, value: u128) {
        let owner = get_owner(&env);
        owner.require_auth();

        storage::set_cash_tier(&env, tier, value);
    }
}

mod test;
