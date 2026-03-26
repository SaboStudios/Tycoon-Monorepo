use soroban_sdk::{contracttype, Address, Vec};

/// Standard ERC-721 compatible metadata structure
/// Follows OpenSea and other marketplace expectations
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct CollectibleMetadata {
    /// Name of the collectible
    pub name: soroban_sdk::String,
    /// Description of the collectible
    pub description: soroban_sdk::String,
    /// URL to the image (can be IPFS or HTTPS)
    pub image: soroban_sdk::String,
    /// Optional animation URL for videos/gifs
    pub animation_url: Option<soroban_sdk::String>,
    /// Optional external URL
    pub external_url: Option<soroban_sdk::String>,
    /// Attributes/traits for the collectible
    pub attributes: Vec<MetadataAttribute>,
}

/// Attribute structure for metadata traits
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct MetadataAttribute {
    /// Display type (optional)
    pub display_type: Option<soroban_sdk::String>,
    /// Trait type (e.g., "Perk", "Strength")
    pub trait_type: soroban_sdk::String,
    /// Value of the trait
    pub value: soroban_sdk::String,
}

/// Base URI configuration for token metadata
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct BaseURIConfig {
    /// Base URI for token metadata (e.g., "https://api.tycoon.com/metadata/")
    pub base_uri: soroban_sdk::String,
    /// Whether metadata is frozen (immutable once set)
    pub frozen: bool,
    /// URI type preference (ipfs or https)
    pub uri_type: URIType,
}

/// URI type preference for metadata hosting
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum URIType {
    HTTPS = 0,
    IPFS = 1,
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

/// Collectible perks available in Tycoon
/// These map to TycoonLib.sol CollectiblePerk enum
/// Values 0-10 (11 total perks)
/// - None: No perk (value 0)
/// - CashTiered: Cash reward based on tier (value 1) - MAPPED from original
/// - TaxRefund: Get a tax refund (value 2) - MAPPED from original
/// - RentBoost: Boost rent income (value 3) - MAPPED from original
/// - PropertyDiscount: Discount on property purchases (value 4) - MAPPED from original
/// - ExtraTurn: Get an extra turn (value 5)
/// - JailFree: Free from jail (value 6)
/// - DoubleRent: Double rent income (value 7)
/// - RollBoost: Boost your dice roll (value 8)
/// - Teleport: Teleport to any property (value 9)
/// - Shield: Protect against one attack (value 10)
/// - RollExact: Roll exact number needed (value 11)
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum Perk {
    None = 0,
    // Original 4 perks (backward compatible)
    CashTiered = 1,
    TaxRefund = 2,
    RentBoost = 3,
    PropertyDiscount = 4,
    // New perks
    ExtraTurn = 5,
    JailFree = 6,
    DoubleRent = 7,
    RollBoost = 8,
    Teleport = 9,
    Shield = 10,
    RollExact = 11,
}

// Cash tier values based on strength (1-5)
pub const CASH_TIERS: [u64; 5] = [100, 250, 500, 1000, 2500];
