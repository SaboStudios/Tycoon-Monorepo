#![no_std]

mod events;
mod storage;

#[cfg(test)]
mod test;

use soroban_sdk::{contract, contractimpl, symbol_short, Address, Env, Symbol};
use storage::PauseConfig;

#[contract]
pub struct TycoonMainGame;

#[contractimpl]
impl TycoonMainGame {
    // ============================================================
    // Initialization
    // ============================================================

    /// Initialize the contract with admin and optional multisig configuration
    ///
    /// # Arguments
    /// * `admin` - Primary admin address
    /// * `multisig_signers` - Optional list of multisig signers
    /// * `multisig_threshold` - Required signatures for multisig (0 = single admin)
    pub fn initialize(
        env: Env,
        admin: Address,
        multisig_signers: Option<Address>,
        multisig_threshold: u32,
    ) {
        if storage::is_initialized(&env) {
            panic!("Contract already initialized");
        }

        admin.require_auth();

        storage::set_admin(&env, &admin);

        // Configure pause mechanism
        let signers = multisig_signers
            .map(|s| soroban_sdk::Vec::from_array(&env, [s]))
            .unwrap_or(soroban_sdk::Vec::new(&env));
        let config = PauseConfig {
            admin: Some(admin.clone()),
            signers,
            required_signatures: multisig_threshold,
        };
        storage::set_pause_config(&env, &config);

        storage::set_initialized(&env);

        // Emit initialization event
        #[allow(deprecated)]
        env.events()
            .publish((symbol_short!("Init"),), (admin, multisig_threshold));
    }

    // ============================================================
    // Pause/Unpause (Guarded)
    // ============================================================

    /// Emergency pause contract (admin/multisig only)
    ///
    /// # Arguments
    /// * `caller` - Address requesting pause (must be admin or multisig signer)
    /// * `reason` - Reason code for transparency (e.g., "SEC" for security)
    /// * `duration_ledgers` - Optional duration in ledgers (0 = indefinite)
    ///
    /// # Events
    /// Emits `Paused` event with details
    ///
    /// # Panics
    /// * If caller is not authorized
    /// * If already paused
    pub fn pause(env: Env, caller: Address, reason: Symbol, duration_ledgers: u32) {
        caller.require_auth();

        let config = storage::get_pause_config(&env).expect("Contract not initialized");

        // Verify authorization
        if !storage::is_authorized_to_pause(&env, &caller, &config) {
            panic!("Unauthorized: only admin or multisig can pause");
        }

        // Check if already paused
        if storage::is_paused(&env) {
            panic!("Contract is already paused");
        }

        // Cannot pause indefinitely without a path - require expiry for long pauses
        if duration_ledgers == 0 {
            // For indefinite pause, require a minimum expiry (e.g., 1000 ledgers ~ 1.5 hours)
            storage::pause_with_expiry(&env, &caller, &reason, 1000);
        } else {
            storage::pause_with_expiry(&env, &caller, &reason, duration_ledgers);
        }

        // Emit pause event
        events::emit_paused(
            &env,
            &events::PauseEventData {
                paused_by: caller,
                paused_at: env.ledger().timestamp(),
                expiry: env.ledger().sequence() + duration_ledgers.max(1000),
                reason,
            },
        );
    }

    /// Emergency unpause contract (admin/multisig only)
    ///
    /// # Arguments
    /// * `caller` - Address requesting unpause (must be admin or multisig signer)
    ///
    /// # Events
    /// Emits `Unpaused` event with duration paused
    ///
    /// # Panics
    /// * If caller is not authorized
    /// * If not currently paused
    pub fn unpause(env: Env, caller: Address) {
        caller.require_auth();

        let config = storage::get_pause_config(&env).expect("Contract not initialized");

        // Verify authorization
        if !storage::is_authorized_to_pause(&env, &caller, &config) {
            panic!("Unauthorized: only admin or multisig can unpause");
        }

        // Check if paused
        if !storage::is_paused(&env) {
            panic!("Contract is not paused");
        }

        let paused_at: u64 = storage::get_paused_at(&env).unwrap_or(0);
        let paused_by: Address =
            storage::get_paused_by(&env).unwrap_or_else(|| Address::from_str(&env, ""));

        // Clear pause state
        storage::unpause(&env);

        // Emit unpause event
        events::emit_unpaused(
            &env,
            &events::UnpauseEventData {
                unpaused_by: caller,
                unpaused_at: env.ledger().timestamp(),
                paused_duration: env.ledger().timestamp().saturating_sub(paused_at),
                original_paused_by: paused_by,
            },
        );
    }

    /// Get current pause status
    pub fn get_pause_status(env: Env) -> storage::PauseStatus {
        storage::get_pause_status(&env)
    }

    // ============================================================
    // View Functions
    // ============================================================

    /// Returns the admin address
    pub fn get_admin(env: Env) -> Address {
        storage::get_admin(&env)
    }

    /// Returns the pause configuration
    pub fn get_pause_config(env: Env) -> PauseConfig {
        storage::get_pause_config(&env).expect("Contract not initialized")
    }

    /// Returns true if contract is currently paused
    pub fn is_paused(env: Env) -> bool {
        storage::is_paused(&env)
    }
}

// ============================================================
// Stub functions for game functionality (to be implemented)
// ============================================================

#[contractimpl]
impl TycoonMainGame {
    /// Stub: Register a player for the main game.
    ///
    /// This function is guarded by pause check.
    pub fn register_player(env: Env, player: Address) {
        player.require_auth();
        storage::require_not_paused(&env, symbol_short!("register"));
        // TODO: implement full registration logic
    }

    /// Stub: Create a new game
    ///
    /// This function is guarded by pause check.
    pub fn create_game(env: Env, creator: Address) {
        creator.require_auth();
        storage::require_not_paused(&env, symbol_short!("create"));
        // TODO: implement game creation
    }
}
