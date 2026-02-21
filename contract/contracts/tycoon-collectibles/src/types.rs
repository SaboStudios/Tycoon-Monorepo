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
