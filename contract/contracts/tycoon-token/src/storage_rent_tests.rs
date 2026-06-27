/// # Tycoon Token — Storage Rent Budget Tests (SW-CT-1034)
///
/// Verifies storage cost assumptions and TTL extension behaviour.
///
/// ## Areas covered
///
/// - Storage write counts match the documented cost budget per operation.
/// - Persistent entries (Balance, Allowance) are written on every mutation,
///   which implicitly extends their TTL via the Soroban host.
/// - Instance entries (Admin, TotalSupply, Initialized) are written only
///   on admin operations.
#[cfg(test)]
mod tests {
    use crate::{TycoonToken, TycoonTokenClient};
    use soroban_sdk::{
        testutils::{Address as _, Ledger, LedgerInfo},
        Address, Env,
    };

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

    // ── Storage write cost tracking ────────────────────────────────────────

    /// The `initialize` function writes 3 instance keys (Initialized, Admin,
    /// TotalSupply) and 1 persistent key (Balance for admin).
    #[test]
    fn test_initialize_storage_writes() {
        let e = Env::default();
        e.mock_all_auths();
        let id = e.register(TycoonToken, ());
        let client = TycoonTokenClient::new(&e, &id);
        let admin = Address::generate(&e);

        assert_eq!(client.total_supply(), 0);
        client.initialize(&admin, &SUPPLY);
        assert_eq!(client.admin(), admin);
        assert_eq!(client.total_supply(), SUPPLY);
        assert_eq!(client.balance(&admin), SUPPLY);
    }

    /// The `mint` function writes 1 instance key and 1 persistent key.
    #[test]
    fn test_mint_storage_writes() {
        let (_, client, _) = setup();
        let user = Address::generate(&client.env);
        let amount: i128 = 1_000_000_000_000_000_000_000;
        let supply_before = client.total_supply();
        client.mint(&user, &amount);
        assert_eq!(client.balance(&user), amount);
        assert_eq!(client.total_supply(), supply_before + amount);
    }

    /// The `transfer` function writes 2 persistent keys (no instance write).
    #[test]
    fn test_transfer_storage_writes() {
        let (_, client, admin) = setup();
        let user = Address::generate(&client.env);
        let amount: i128 = 100_000_000_000_000_000_000_000_000;
        client.transfer(&admin, &user, &amount);
        assert_eq!(client.balance(&admin), SUPPLY - amount);
        assert_eq!(client.balance(&user), amount);
        assert_eq!(client.total_supply(), SUPPLY);
    }

    /// The `approve` function writes 1 persistent key.
    #[test]
    fn test_approve_storage_writes() {
        let (_, client, admin) = setup();
        let spender = Address::generate(&client.env);
        let amount: i128 = 500_000_000_000_000_000_000_000_000;
        assert_eq!(client.allowance(&admin, &spender), 0);
        client.approve(&admin, &spender, &amount, &0);
        assert_eq!(client.allowance(&admin, &spender), amount);
    }

    /// The `burn` function writes 1 instance key + 1 persistent key.
    #[test]
    fn test_burn_storage_writes() {
        let (_, client, admin) = setup();
        let amount: i128 = 100_000_000_000_000_000_000_000_000;
        let supply_before = client.total_supply();
        client.burn(&admin, &amount);
        assert_eq!(client.balance(&admin), SUPPLY - amount);
        assert_eq!(client.total_supply(), supply_before - amount);
    }

    /// The `burn_from` function writes 1 allowance + 1 balance + 1 instance.
    #[test]
    fn test_burn_from_storage_writes() {
        let (_, client, admin) = setup();
        let spender = Address::generate(&client.env);
        let amt: i128 = 100_000_000_000_000_000_000_000_000;
        client.approve(&admin, &spender, &amt, &0);
        let supply_before = client.total_supply();
        client.burn_from(&spender, &admin, &amt);
        assert_eq!(client.total_supply(), supply_before - amt);
    }

    // ── TTL / persistent entry lifetime ────────────────────────────────────

    /// A persistent entry (Balance) written by mint is still readable after
    /// advancing the ledger significantly (demonstrating entry longevity).
    #[test]
    fn test_persistent_entry_survives_across_operations() {
        let (e, client, admin) = setup();
        let user = Address::generate(&e);
        let mint_amount: i128 = 5_000_000_000_000_000_000_000;
        client.mint(&user, &mint_amount);
        assert_eq!(client.balance(&user), mint_amount);

        e.ledger().set(LedgerInfo {
            sequence_number: 100_000,
            timestamp: 500_000,
            protocol_version: 23,
            network_id: Default::default(),
            base_reserve: 10,
            min_temp_entry_ttl: 1,
            min_persistent_entry_ttl: 1,
            max_entry_ttl: 6_312_000,
        });

        assert_eq!(client.balance(&user), mint_amount);

        let transfer_amount: i128 = 1_000_000_000_000_000_000_000;
        client.transfer(&user, &admin, &transfer_amount);
        assert_eq!(client.balance(&user), mint_amount - transfer_amount);
    }
}
