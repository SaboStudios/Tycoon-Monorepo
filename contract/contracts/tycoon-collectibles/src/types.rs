use soroban_sdk::{contracttype, Address};

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct CollectibleMetadata {
    pub name: soroban_sdk::String,
    pub description: soroban_sdk::String,
    pub image_url: soroban_sdk::String,
}

/// Configuration for the shop's payment tokens
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ShopConfig {
    pub tyc_token: Address,
    pub usdc_token: Address,
}

/// Price configuration for a collectible in both currencies
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct CollectiblePrice {
    pub tyc_price: i128,
    pub usdc_price: i128,
}
