use soroban_sdk::contracttype;

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct CollectibleMetadata {
    pub name: soroban_sdk::String,
    pub description: soroban_sdk::String,
    pub image_url: soroban_sdk::String,
}
