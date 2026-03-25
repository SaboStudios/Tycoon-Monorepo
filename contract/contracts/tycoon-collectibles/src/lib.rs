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

    /// Stock new collectible type (admin only)
    /// Creates a new token_id and mints initial supply to contract
    pub fn stock_shop(
        env: Env,
        amount: u64,
        perk: u32,
        strength: u32,
        tyc_price: u128,
        usdc_price: u128,
    ) -> Result<u128, CollectibleError> {
        let admin = get_admin(&env);
        admin.require_auth();

        // Validate inputs
        if amount == 0 {
            return Err(CollectibleError::InvalidAmount);
        }

        // Validate perk (0-11 are valid enum values, 0 = None is not a valid perk)
        if perk > 11 {
            return Err(CollectibleError::InvalidPerk);
        }

        // Validate perk and convert to enum
        let perk_enum: Perk = match perk {
            0 => Perk::None,
            // Original perks (backward compatible)
            1 => Perk::CashTiered,
            2 => Perk::TaxRefund,
            3 => Perk::RentBoost,
            4 => Perk::PropertyDiscount,
            // New perks
            5 => Perk::ExtraTurn,
            6 => Perk::JailFree,
            7 => Perk::DoubleRent,
            8 => Perk::RollBoost,
            9 => Perk::Teleport,
            10 => Perk::Shield,
            11 => Perk::RollExact,
            _ => return Err(CollectibleError::InvalidPerk),
        };

        if matches!(perk_enum, Perk::CashTiered | Perk::TaxRefund) && !(1..=5).contains(&strength) {
            return Err(CollectibleError::InvalidStrength);
        }

        // Generate new token_id
        let token_id = increment_token_id(&env);

        // Store perk and strength
        set_perk(&env, token_id, perk_enum);
        set_strength(&env, token_id, strength);

        // Store prices
        let price = CollectiblePrice {
            tyc_price: tyc_price as i128,
            usdc_price: usdc_price as i128,
        };
        set_collectible_price(&env, token_id, &price);

        // Mint to contract address (shop inventory)
        let contract_address = env.current_contract_address();
        _safe_mint(&env, &contract_address, token_id, amount)?;

        // Set stock tracking
        set_shop_stock(&env, token_id, amount);

        // Emit event
        emit_collectible_stocked_event(
            &env, token_id, amount, perk, strength, tyc_price, usdc_price,
        );

        Ok(token_id)
    }

    /// Restock existing collectible (admin only)
    pub fn restock_collectible(
        env: Env,
        token_id: u128,
        additional_amount: u64,
    ) -> Result<(), CollectibleError> {
        let admin = get_admin(&env);
        admin.require_auth();

        if additional_amount == 0 {
            return Err(CollectibleError::InvalidAmount);
        }

        // Verify token exists by checking if it has a price
        if get_collectible_price(&env, token_id).is_none() {
            return Err(CollectibleError::TokenNotFound);
        }

        // Verify it's a collectible (has a perk)
        let perk = get_perk(&env, token_id);
        if matches!(perk, Perk::None) && get_shop_stock(&env, token_id) == 0 {
            return Err(CollectibleError::TokenNotFound);
        }

        // Mint additional units to contract address
        let contract_address = env.current_contract_address();
        _safe_mint(&env, &contract_address, token_id, additional_amount)?;

        // Update stock
        let current_stock = get_shop_stock(&env, token_id);
        let new_stock = current_stock + additional_amount;
        set_shop_stock(&env, token_id, new_stock);

        // Emit event
        emit_collectible_restocked_event(&env, token_id, additional_amount, new_stock);

        Ok(())
    }

    /// Update collectible prices (admin only)
    pub fn update_collectible_prices(
        env: Env,
        token_id: u128,
        new_tyc_price: u128,
        new_usdc_price: u128,
    ) -> Result<(), CollectibleError> {
        let admin = get_admin(&env);
        admin.require_auth();

        // Verify token exists
        if get_collectible_price(&env, token_id).is_none() {
            return Err(CollectibleError::TokenNotFound);
        }

        // Update prices
        let price = CollectiblePrice {
            tyc_price: new_tyc_price as i128,
            usdc_price: new_usdc_price as i128,
        };
        set_collectible_price(&env, token_id, &price);

        // Emit event
        emit_price_updated_event(&env, token_id, new_tyc_price, new_usdc_price);

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

        // Handle existing tiered cash perks
        if matches!(perk, Perk::CashTiered | Perk::TaxRefund) {
            if !(1..=5).contains(&strength) {
                return Err(CollectibleError::InvalidStrength);
            }
            let cash_value = CASH_TIERS[(strength - 1) as usize];
            emit_cash_perk_activated_event(&env, &caller, token_id, cash_value.into());
        }

        // Stub implementations for new perks (validation only, no logic yet)
        // RentBoost: Boost rent income - emit event for future implementation
        if matches!(perk, Perk::RentBoost) {
            // TODO: Implement rent boost logic
            emit_perk_activated_event(&env, &caller, token_id, perk.clone(), strength);
        }

        // ExtraTurn: Get an extra turn - emit event for future implementation
        if matches!(perk, Perk::ExtraTurn) {
            // TODO: Implement extra turn logic
            // Emit event for tracking
            emit_perk_activated_event(&env, &caller, token_id, perk.clone(), strength);
        }

        // JailFree: Free from jail - emit event for future implementation
        if matches!(perk, Perk::JailFree) {
            // TODO: Implement jail free logic
            emit_perk_activated_event(&env, &caller, token_id, perk.clone(), strength);
        }

        // DoubleRent: Double rent income - emit event for future implementation
        if matches!(perk, Perk::DoubleRent) {
            // TODO: Implement double rent logic
            emit_perk_activated_event(&env, &caller, token_id, perk.clone(), strength);
        }

        // RollBoost: Boost your dice roll - emit event for future implementation
        if matches!(perk, Perk::RollBoost) {
            // TODO: Implement roll boost logic
            // Strength could indicate the boost amount
            emit_perk_activated_event(&env, &caller, token_id, perk.clone(), strength);
        }

        // Teleport: Teleport to any property - emit event for future implementation
        if matches!(perk, Perk::Teleport) {
            // TODO: Implement teleport logic
            emit_perk_activated_event(&env, &caller, token_id, perk.clone(), strength);
        }

        // Shield: Protect against one attack - emit event for future implementation
        if matches!(perk, Perk::Shield) {
            // TODO: Implement shield logic
            emit_perk_activated_event(&env, &caller, token_id, perk.clone(), strength);
        }

        // PropertyDiscount: Discount on property purchases - emit event for future implementation
        if matches!(perk, Perk::PropertyDiscount) {
            // TODO: Implement property discount logic
            // Strength could indicate discount percentage
            emit_perk_activated_event(&env, &caller, token_id, perk.clone(), strength);
        }

        // RollExact: Roll exact number needed - emit event for future implementation
        if matches!(perk, Perk::RollExact) {
            // TODO: Implement roll exact logic
            emit_perk_activated_event(&env, &caller, token_id, perk.clone(), strength);
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

    /// Mint a new collectible as a backend reward
    /// Restricted to backend minter or admin only
    /// Returns the newly created token_id
    pub fn mint_collectible(
        env: Env,
        caller: Address,
        to: Address,
        perk: u32,
        strength: u32,
    ) -> Result<u128, CollectibleError> {
        caller.require_auth();

        // Authorization check - must be admin or backend minter
        let admin = get_admin(&env);
        let minter = get_minter(&env);

        let is_admin = caller == admin;
        let is_minter = minter.is_some() && Some(caller.clone()) == minter;

        if !(is_admin || is_minter) {
            return Err(CollectibleError::Unauthorized);
        }

        // Validate perk - cannot be None (0) or invalid value (max 11)
        if perk == 0 || perk > 11 {
            return Err(CollectibleError::InvalidPerk);
        }

        // Convert perk to enum (maintaining backward compatibility with original perks 1-4)
        let perk_enum: Perk = match perk {
            // Original perks (backward compatible)
            1 => Perk::CashTiered,
            2 => Perk::TaxRefund,
            3 => Perk::RentBoost,
            4 => Perk::PropertyDiscount,
            // New perks
            5 => Perk::ExtraTurn,
            6 => Perk::JailFree,
            7 => Perk::DoubleRent,
            8 => Perk::RollBoost,
            9 => Perk::Teleport,
            10 => Perk::Shield,
            11 => Perk::RollExact,
            _ => return Err(CollectibleError::InvalidPerk),
        };

        // Validate strength for tiered perks
        if matches!(perk_enum, Perk::CashTiered | Perk::TaxRefund) && !(1..=5).contains(&strength) {
            return Err(CollectibleError::InvalidStrength);
        }

        // Generate new collectible token_id (in 2e9+ range)
        let token_id = get_next_collectible_id(&env);

        // Store perk and strength
        set_perk(&env, token_id, perk_enum);
        set_strength(&env, token_id, strength);

        // Mint 1 unit to recipient
        _safe_mint(&env, &to, token_id, 1)?;

        // Emit CollectibleMinted event
        emit_collectible_minted_event(&env, token_id, &to, perk, strength);

        Ok(token_id)
    }

    /// Get the count of tokens owned by an address
    pub fn owned_token_count(env: Env, owner: Address) -> u32 {
        owned_token_count(&env, &owner)
    }

    /// Get token ID at a specific index for an owner
    /// Returns the token ID or panics if index is out of bounds
    pub fn token_of_owner_by_index(env: Env, owner: Address, index: u32) -> u128 {
        token_of_owner_by_index(&env, &owner, index)
            .unwrap_or_else(|| panic!("Index out of bounds"))
    }

<<<<<<< Updated upstream
    /// Get a page of tokens owned by an address
    /// Returns a Vec of token IDs for the specified page (0-indexed)
    /// Page size is limited to prevent gas limit issues
    pub fn tokens_of_owner_page(
        env: Env,
        owner: Address,
        page: u32,
        page_size: u32,
    ) -> Result<Vec<u128>, CollectibleError> {
        crate::enumeration::tokens_of_owner_page(&env, &owner, page, page_size)
    }

    /// Iterator pattern for gas-safe enumeration
    /// Returns a batch of tokens starting from start_index, and a boolean indicating if more tokens exist
    /// Use this for iterating through all tokens without hitting gas limits
    pub fn iterate_owned_tokens(
        env: Env,
        owner: Address,
        start_index: u32,
        batch_size: u32,
    ) -> Result<(Vec<u128>, bool), CollectibleError> {
        crate::enumeration::iterate_owned_tokens(&env, &owner, start_index, batch_size)
    }

    /// Get the maximum allowed page size for pagination
    /// This ensures operations stay within gas limits
    pub fn max_page_size(env: Env) -> u32 {
        crate::enumeration::MAX_PAGE_SIZE
    }

    // ========================
    // Metadata Functions
    // ========================

    /// Set base URI for token metadata (admin only)
    /// This establishes the base URI policy for all tokens
    pub fn set_base_uri(
        env: Env,
        base_uri: soroban_sdk::String,
        uri_type: u32,
        frozen: bool,
    ) -> Result<(), CollectibleError> {
        let admin = get_admin(&env);
        admin.require_auth();

        // Validate URI type
        let uri_type_enum = match uri_type {
            0 => crate::types::URIType::HTTPS,
            1 => crate::types::URIType::IPFS,
            _ => return Err(CollectibleError::InvalidURIType),
        };

        // Check if already frozen
        if is_metadata_frozen(&env) {
            return Err(CollectibleError::MetadataFrozen);
        }

        let config = crate::types::BaseURIConfig {
            base_uri,
            frozen,
            uri_type: uri_type_enum,
        };

        set_base_uri_config(&env, &config);
        Ok(())
    }

    /// Get the base URI configuration
    pub fn base_uri_config(env: Env) -> Option<crate::types::BaseURIConfig> {
        get_base_uri_config(&env)
    }

    /// Set metadata for a specific token (admin only)
    /// Creates marketplace-compliant JSON metadata
    pub fn set_token_metadata(
        env: Env,
        token_id: u128,
        name: soroban_sdk::String,
        description: soroban_sdk::String,
        image: soroban_sdk::String,
        animation_url: Option<soroban_sdk::String>,
        external_url: Option<soroban_sdk::String>,
        attributes: Vec<crate::types::MetadataAttribute>,
    ) -> Result<(), CollectibleError> {
        let admin = get_admin(&env);
        admin.require_auth();

        // Check if metadata is frozen
        if is_metadata_frozen(&env) {
            return Err(CollectibleError::MetadataFrozen);
        }

        // Validate token exists
        if get_perk(&env, token_id) == crate::types::Perk::None && !has_metadata(&env, token_id) {
            // For new tokens, ensure they have a perk set
            return Err(CollectibleError::TokenNotFound);
        }

        let metadata = crate::types::CollectibleMetadata {
            name,
            description,
            image,
            animation_url,
            external_url,
            attributes,
        };

        set_metadata(&env, token_id, &metadata);
        Ok(())
    }

    /// Get metadata for a specific token
    pub fn token_metadata(env: Env, token_id: u128) -> Option<crate::types::CollectibleMetadata> {
        get_metadata(&env, token_id)
    }

    /// Get the token URI for marketplace integration
    /// Returns the full URI for the token's metadata JSON
    /// Follows ERC-721 tokenURI standard
    pub fn token_uri(env: Env, token_id: u128) -> soroban_sdk::String {
        // Check if token exists
        if get_perk(&env, token_id) == crate::types::Perk::None && !has_metadata(&env, token_id) {
            panic!("Token does not exist");
        }

        match get_base_uri_config(&env) {
            Some(config) => {
                // Construct URI: base_uri + token_id
                let mut uri = config.base_uri;
                let token_id_str = soroban_sdk::String::from_str(&env, &token_id.to_string());
                uri.append(&token_id_str);
                uri
            }
            None => {
                // Fallback: return empty string if no base URI set
                soroban_sdk::String::from_str(&env, "")
            }
        }
    }

    /// Check if metadata is frozen (immutable)
    pub fn is_metadata_frozen(env: Env) -> bool {
        is_metadata_frozen(&env)
>>>>>>> Stashed changes
    }
}

#[cfg(test)]
mod test;
