use soroban_sdk::contracttype;

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct CollectibleMetadata {
    pub name: soroban_sdk::String,
    pub description: soroban_sdk::String,
    pub image_url: soroban_sdk::String,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum Perk {
    None = 0,
    CashTiered = 1,
    TaxRefund = 2,
    RentBoost = 3,
    PropertyDiscount = 4,
}

// Cash tier values based on strength (1-5)
pub const CASH_TIERS: [u64; 5] = [100, 250, 500, 1000, 2500];
