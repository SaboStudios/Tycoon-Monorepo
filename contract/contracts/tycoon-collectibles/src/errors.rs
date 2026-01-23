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
    ContractPaused = 6,
    InvalidPerk = 7,
    InvalidStrength = 8,
}
