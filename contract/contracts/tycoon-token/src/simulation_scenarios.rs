/// # Tycoon Token — Simulation Scenarios (SW-CT-004)
///
/// End-to-end scenarios modeling realistic token usage patterns.
#[cfg(test)]
mod tests {
    use crate::{TycoonToken, TycoonTokenClient};
    use soroban_sdk::{testutils::Address as _, Address, Env};

    const SUPPLY: i128 = 1_000_000_000_000_000_000_000_000_000;

    fn setup() -> (Env, TycoonTokenClient<'static>, Address) {
        let e = Env::default();
        e.mock_all_auths();
        let id = e.register(TycoonToken, ());
        let client = TycoonTokenClient::new(&e, &id);
        let admin = Address::generate(&e);
        client.initialize(&admin, &SUPPLY);
        (e, client, admin)
    }

    #[test]
    fn sim_01_game_reward_cycle() {
        let (_, client, _admin) = setup();
        let pool = Address::generate(&client.env);
        let winner = Address::generate(&client.env);

        client.mint(&pool, &5_000_000_000_000_000_000_000);
        client.transfer(&pool, &winner, &4_000_000_000_000_000_000_000);
        client.burn(&winner, &400_000_000_000_000_000_000);

        assert_eq!(client.balance(&winner), 3_600_000_000_000_000_000_000);
    }

    #[test]
    fn sim_02_delegated_entry_stake() {
        let (_, client, admin) = setup();
        let player = Address::generate(&client.env);
        let game = Address::generate(&client.env);
        let treasury = Address::generate(&client.env);

        client.transfer(&admin, &player, &10_000_000_000_000_000_000_000);
        client.approve(&player, &game, &1_000_000_000_000_000_000_000, &0);
        client.transfer_from(&game, &player, &treasury, &1_000_000_000_000_000_000_000);

        assert_eq!(client.balance(&treasury), 1_000_000_000_000_000_000_000);
    }

    #[test]
    fn sim_03_multi_player_distribution() {
        let (_, client, admin) = setup();
        let players = [
            Address::generate(&client.env),
            Address::generate(&client.env),
            Address::generate(&client.env),
        ];

        for p in &players {
            client.transfer(&admin, p, &1_500_000_000_000_000_000_000);
        }

        assert_eq!(client.total_supply(), SUPPLY);
    }

    #[test]
    fn sim_04_admin_rotation() {
        let (_, client, _admin) = setup();
        let new_admin = Address::generate(&client.env);
        let user = Address::generate(&client.env);

        client.set_admin(&new_admin);
        client.mint(&user, &1_000_000_000_000_000_000_000);

        assert_eq!(client.balance(&user), 1_000_000_000_000_000_000_000);
    }

    #[test]
    fn sim_05_burn_from_fee_collection() {
        let (_, client, admin) = setup();
        let holder = Address::generate(&client.env);
        let protocol = Address::generate(&client.env);

        client.transfer(&admin, &holder, &2_000_000_000_000_000_000_000);
        client.approve(&holder, &protocol, &500_000_000_000_000_000_000, &0);
        client.burn_from(&protocol, &holder, &300_000_000_000_000_000_000);

        assert_eq!(client.balance(&holder), 1_700_000_000_000_000_000_000);
    }

    /// A full season: mint rewards into a pool, distribute to a player, the
    /// player spends via a delegated game contract, fees are burned from the
    /// proceeds, and the admin rotates out — verifying total_supply stays
    /// consistent across the whole chained flow (mint/transfer/approve/
    /// transfer_from/burn_from/set_admin all interacting on the same state).
    #[test]
    fn sim_06_full_season_lifecycle() {
        let (_, client, _admin) = setup();
        let pool = Address::generate(&client.env);
        let player = Address::generate(&client.env);
        let game = Address::generate(&client.env);
        let treasury = Address::generate(&client.env);
        let new_admin = Address::generate(&client.env);

        // Season rewards minted into the pool, then paid out to the player.
        client.mint(&pool, &8_000_000_000_000_000_000_000);
        client.transfer(&pool, &player, &8_000_000_000_000_000_000_000);
        assert_eq!(client.total_supply(), SUPPLY + 8_000_000_000_000_000_000_000);

        // Player delegates spend authority to the game for an in-game purchase.
        client.approve(&player, &game, &3_000_000_000_000_000_000_000, &0);
        client.transfer_from(&game, &player, &treasury, &3_000_000_000_000_000_000_000);
        assert_eq!(client.balance(&player), 5_000_000_000_000_000_000_000);
        assert_eq!(client.allowance(&player, &game), 0);

        // Treasury burns a protocol fee out of the proceeds via a delegated burn.
        client.approve(&treasury, &game, &1_000_000_000_000_000_000_000, &0);
        client.burn_from(&game, &treasury, &600_000_000_000_000_000_000);
        assert_eq!(client.balance(&treasury), 2_400_000_000_000_000_000_000);

        // Admin rotates at end of season; new admin can still mint.
        client.set_admin(&new_admin);
        client.mint(&player, &1_000_000_000_000_000_000_000);
        assert_eq!(client.admin(), new_admin);

        // Supply reflects every mint/burn across the whole chain, nothing lost.
        assert_eq!(
            client.total_supply(),
            SUPPLY + 8_000_000_000_000_000_000_000 - 600_000_000_000_000_000_000
                + 1_000_000_000_000_000_000_000
        );
    }
}
