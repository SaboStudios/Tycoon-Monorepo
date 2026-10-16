/// # Shared test fixtures for cross-contract integration tests (#411)
///
/// `Fixture::new()` deploys and wires all contracts in a single isolated
/// Soroban sandbox environment. Each test creates its own `Fixture` — the
/// `Env::default()` is completely isolated, so there is no shared state.
///
/// ## Fixture accounts
///
/// | Name       | Role                                      |
/// |------------|-------------------------------------------|
/// | `admin`    | Owns / administers all contracts          |
/// | `backend`  | Backend minter + game controller          |
/// | `player_a` | First test player                         |
/// | `player_b` | Second test player                        |
/// | `player_c` | Third test player (multi-player tests)    |
///
/// ## Deployed contracts
///
/// | Field       | Contract                          |
/// |-------------|-----------------------------------|
/// | `tyc_id`    | TYC token (Stellar asset / SEP-41)|
/// | `usdc_id`   | USDC mock token (SEP-41)          |
/// | `reward_id` | TycoonRewardSystem                |
/// | `game_id`   | TycoonContract (tycoon-game)      |
/// | `boost_id`  | TycoonBoostSystem                 |
/// | `collectibles_id` | TycoonCollectibles          |
#[cfg(test)]
pub use inner::{Fixture, GAME_FUND, REWARD_FUND};

#[cfg(test)]
mod inner {
    use soroban_sdk::{
        testutils::Address as _,
        token::{Client as TokenClient, StellarAssetClient},
        Address, Env,
    };
    use tycoon_boost_system::{TycoonBoostSystem, TycoonBoostSystemClient};
    use tycoon_collectibles::{TycoonCollectibles, TycoonCollectiblesClient};
    use tycoon_game::TycoonContractClient;
    use tycoon_reward_system::{TycoonRewardSystem, TycoonRewardSystemClient};

    /// TYC pre-funded to the reward contract (1 000 000 TYC, 18 decimals).
    pub const REWARD_FUND: i128 = 1_000_000_000_000_000_000_000_000;
    /// TYC pre-funded to the game contract (500 000 TYC, 18 decimals).
    pub const GAME_FUND: i128 = 500_000_000_000_000_000_000_000;

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
        pub boost_id: Address,
        pub collectibles_id: Address,
        // Clients
        pub tyc: TokenClient<'a>,
        pub reward: TycoonRewardSystemClient<'a>,
        pub game: TycoonContractClient<'a>,
        pub boost: TycoonBoostSystemClient<'a>,
        pub collectibles: TycoonCollectiblesClient<'a>,
    }

    impl<'a> Fixture<'a> {
        pub fn new() -> Self {
            let env = Env::default();
            env.mock_all_auths();

            // Accounts
            let admin = Address::generate(&env);
            let backend = Address::generate(&env);
            let player_a = Address::generate(&env);
            let player_b = Address::generate(&env);
            let player_c = Address::generate(&env);

            // Stellar asset contracts (SEP-41 compatible)
            let tyc_id = env
                .register_stellar_asset_contract_v2(Address::generate(&env))
                .address();
            let usdc_id = env
                .register_stellar_asset_contract_v2(Address::generate(&env))
                .address();

            let tyc = TokenClient::new(&env, &tyc_id);

            // Reward system
            let reward_id = env.register(TycoonRewardSystem, ());
            let reward = TycoonRewardSystemClient::new(&env, &reward_id);
            reward.initialize(&admin, &tyc_id, &usdc_id);
            StellarAssetClient::new(&env, &tyc_id).mint(&reward_id, &REWARD_FUND);
            reward.set_backend_minter(&admin, &backend);

            // Game contract
            let game_id = env.register(tycoon_game::TycoonContract, ());
            let game = TycoonContractClient::new(&env, &game_id);
            game.initialize(&tyc_id, &usdc_id, &admin, &reward_id);
            StellarAssetClient::new(&env, &tyc_id).mint(&game_id, &GAME_FUND);
            game.set_backend_game_controller(&backend);

            // Boost system
            let boost_id = env.register(TycoonBoostSystem, ());
            let boost = TycoonBoostSystemClient::new(&env, &boost_id);
            boost.initialize(&admin);

            // Collectibles
            let collectibles_id = env.register(TycoonCollectibles, ());
            let collectibles = TycoonCollectiblesClient::new(&env, &collectibles_id);
            collectibles.initialize(&admin);

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
                boost_id,
                collectibles_id,
                tyc,
                reward,
                game,
                boost,
                collectibles,
            }
        }

        /// TYC balance of any address.
        pub fn tyc_balance(&self, addr: &Address) -> i128 {
            self.tyc.balance(addr)
        }

        /// Mint TYC directly to an address via the asset admin.
        pub fn mint_tyc(&self, to: &Address, amount: i128) {
            StellarAssetClient::new(&self.env, &self.tyc_id).mint(to, &amount);
        }
    }
}
