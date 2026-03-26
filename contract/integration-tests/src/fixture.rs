/// # Shared test fixtures for cross-contract integration tests (#411)
///
/// Every test module imports `Fixture::new()` to get a fully-wired environment
/// with all contracts deployed and initialised, plus a set of named accounts.
///
/// ## Fixture accounts
///
/// | Name            | Role |
/// |-----------------|------|
/// | `admin`         | Owns / administers all contracts |
/// | `backend`       | Backend minter / game controller |
/// | `player_a`      | First test player |
/// | `player_b`      | Second test player |
/// | `player_c`      | Third test player (used in multi-player tests) |
///
/// ## Deployed contracts
///
/// | Field              | Contract |
/// |--------------------|----------|
/// | `tyc_id`           | TYC token (SEP-41) |
/// | `usdc_id`          | USDC mock token (SEP-41) |
/// | `reward_id`        | TycoonRewardSystem |
/// | `game_id`          | TycoonContract (tycoon-game) |
///
/// ## Cleanup
///
/// Each test creates its own `Fixture` — the Soroban `Env::default()` is
/// completely isolated per instance, so there is no shared state between tests.
#[cfg(test)]
pub use inner::Fixture;
#[cfg(test)]
pub use inner::{GAME_FUND, REWARD_FUND};

#[cfg(test)]
mod inner {
    use soroban_sdk::{
        testutils::Address as _,
        token::{Client as TokenClient, StellarAssetClient},
        Address, Env,
    };
    use tycoon_game::TycoonContractClient;
    use tycoon_reward_system::{TycoonRewardSystem, TycoonRewardSystemClient};
    use tycoon_token::TycoonToken as _;

    /// Initial TYC supply minted to the reward contract so it can pay out vouchers.
    pub const REWARD_FUND: i128 = 1_000_000_000_000_000_000_000_000; // 1 000 000 TYC

    /// Initial TYC supply minted to the game contract for withdrawal tests.
    pub const GAME_FUND: i128 = 500_000_000_000_000_000_000_000; // 500 000 TYC

    pub struct Fixture<'a> {
        pub env: Env,

        // Accounts
        pub admin: Address,
        pub backend: Address,
        pub player_a: Address,
        pub player_b: Address,
        pub player_c: Address,

        // Token addresses
        pub tyc_id: Address,
        pub usdc_id: Address,

        // Contract addresses
        pub reward_id: Address,
        pub game_id: Address,

        // Clients
        pub tyc: TokenClient<'a>,
        pub reward: TycoonRewardSystemClient<'a>,
        pub game: TycoonContractClient<'a>,
    }

    impl<'a> Fixture<'a> {
        /// Build a fully-wired fixture.
        ///
        /// All contracts are deployed and initialised. The reward contract is
        /// funded with `REWARD_FUND` TYC and the game contract with `GAME_FUND` TYC.
        pub fn new() -> Self {
            let env = Env::default();
            env.mock_all_auths();

            // ── Accounts ──────────────────────────────────────────────────────
            let admin = Address::generate(&env);
            let backend = Address::generate(&env);
            let player_a = Address::generate(&env);
            let player_b = Address::generate(&env);
            let player_c = Address::generate(&env);

            // ── Token contracts ───────────────────────────────────────────────
            let tyc_admin = Address::generate(&env);
            let usdc_admin = Address::generate(&env);

            let tyc_id = env
                .register_stellar_asset_contract_v2(tyc_admin.clone())
                .address();
            let usdc_id = env
                .register_stellar_asset_contract_v2(usdc_admin.clone())
                .address();

            // ── TycoonToken (SEP-41 native token) ─────────────────────────────
            // We use the Stellar asset contract as TYC for cross-contract calls.
            // The TycoonToken contract is registered separately for unit-level
            // mint/burn tests; here we use the asset contract so token::Client works.
            let tyc = TokenClient::new(&env, &tyc_id);

            // ── Reward system ─────────────────────────────────────────────────
            let reward_id = env.register(TycoonRewardSystem, ());
            let reward = TycoonRewardSystemClient::new(&env, &reward_id);
            reward.initialize(&admin, &tyc_id, &usdc_id);

            // Fund reward contract with TYC so it can pay out vouchers
            StellarAssetClient::new(&env, &tyc_id).mint(&reward_id, &REWARD_FUND);

            // Set backend minter on reward system
            reward.set_backend_minter(&admin, &backend);

            // ── Game contract ─────────────────────────────────────────────────
            let game_id = env.register(tycoon_game::TycoonContract, ());
            let game = TycoonContractClient::new(&env, &game_id);
            game.initialize(&tyc_id, &usdc_id, &admin, &reward_id);

            // Fund game contract with TYC for withdrawal tests
            StellarAssetClient::new(&env, &tyc_id).mint(&game_id, &GAME_FUND);

            // Set backend game controller
            game.set_backend_game_controller(&backend);

            Fixture {
                env,
                admin,
                backend,
                player_a,
                player_b,
                player_c,
                tyc_id,
                usdc_id,
                reward_id,
                game_id,
                tyc,
                reward,
                game,
            }
        }

        /// Convenience: TYC balance of an address.
        pub fn tyc_balance(&self, addr: &Address) -> i128 {
            self.tyc.balance(addr)
        }

        /// Convenience: mint TYC directly to an address (uses asset admin).
        pub fn mint_tyc(&self, to: &Address, amount: i128) {
            StellarAssetClient::new(&self.env, &self.tyc_id).mint(to, &amount);
        }
    }
}
