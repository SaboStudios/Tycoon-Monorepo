use soroban_sdk::contracterror;

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum CollectibleError {
    AlreadyInitialized = 1,
    InsufficientBalance = 2,
    InvalidAmount = 3,
    Unauthorized = 4,
    TokenIdMismatch = 5,
    ZeroPrice = 6,
    InsufficientStock = 7,
    ShopNotInitialized = 8,
    ContractPaused = 9,
    InvalidPerk = 10,
    InvalidStrength = 11,
    TokenNotFound = 12,
    InvalidTokenId = 13,
}
