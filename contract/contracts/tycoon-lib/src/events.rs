use soroban_sdk::contracttype;

/// Identifies the category of a contract event emitted by Tycoon contracts.
///
/// Each variant corresponds to a distinct event published via
/// `Env::events().publish(...)`. Consumers filtering the event stream can match
/// the first topic against these discriminants to identify event types without
/// relying on raw symbol strings.
///
/// ## Event schema
///
/// | Variant               | Topics                                   | Data           |
/// |-----------------------|------------------------------------------|----------------|
/// | `Paused`              | `("Paused",)`                            | `true`         |
/// | `Unpaused`            | `("Unpaused",)`                          | `false`        |
/// | `VoucherMinted`       | `("V_Mint", to, token_id)`              | `tyc_value`    |
/// | `VoucherRedeemed`     | `("Redeem", redeemer, token_id)`        | `tyc_value`    |
/// | `FundsWithdrawn`      | `("FundsWithdrawn", token, to)`         | `amount`       |
/// | `TokenMinted`         | `("Mint", to, token_id)`                | `amount`       |
/// | `TokenBurned`         | `("Burn", from, token_id)`              | `amount`       |
/// | `TokenTransferred`    | `("Transfer", from, to, token_id)`      | `amount`       |
/// | `BackendMinterSet`    | `("set_min", new_minter)`               | `()`           |
/// | `BackendMinterCleared`| `("clr_min",)`                          | `()`           |
#[contracttype]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum ContractEvent {
    /// The contract was administratively paused.
    Paused,
    /// The contract was administratively unpaused.
    Unpaused,
    /// A reward voucher was minted to a recipient.
    VoucherMinted,
    /// A reward voucher was redeemed for TYC tokens.
    VoucherRedeemed,
    /// Funds were withdrawn from the contract treasury.
    FundsWithdrawn,
    /// An ERC-1155-style internal token mint was performed.
    TokenMinted,
    /// An ERC-1155-style internal token burn was performed.
    TokenBurned,
    /// Tokens were transferred between two addresses.
    TokenTransferred,
    /// The backend minter address was set or rotated.
    BackendMinterSet,
    /// The backend minter address was cleared.
    BackendMinterCleared,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_contract_event_variants_are_distinct() {
        let events = [
            ContractEvent::Paused,
            ContractEvent::Unpaused,
            ContractEvent::VoucherMinted,
            ContractEvent::VoucherRedeemed,
            ContractEvent::FundsWithdrawn,
            ContractEvent::TokenMinted,
            ContractEvent::TokenBurned,
            ContractEvent::TokenTransferred,
            ContractEvent::BackendMinterSet,
            ContractEvent::BackendMinterCleared,
        ];

        for (i, event) in events.iter().enumerate() {
            for (j, other) in events.iter().enumerate() {
                if i == j {
                    assert_eq!(event, other);
                } else {
                    assert_ne!(event, other, "variants {i} and {j} must differ");
                }
            }
        }
    }

    #[test]
    fn test_contract_event_can_be_cloned() {
        let e = ContractEvent::VoucherMinted;
        assert_eq!(e, e.clone());

        let e2 = ContractEvent::FundsWithdrawn;
        assert_eq!(e2, e2.clone());
    }

    #[test]
    fn test_contract_event_used_in_match() {
        let event = ContractEvent::VoucherRedeemed;
        let label = match event {
            ContractEvent::Paused => "paused",
            ContractEvent::Unpaused => "unpaused",
            ContractEvent::VoucherMinted => "voucher_minted",
            ContractEvent::VoucherRedeemed => "voucher_redeemed",
            ContractEvent::FundsWithdrawn => "funds_withdrawn",
            ContractEvent::TokenMinted => "token_minted",
            ContractEvent::TokenBurned => "token_burned",
            ContractEvent::TokenTransferred => "token_transferred",
            ContractEvent::BackendMinterSet => "backend_minter_set",
            ContractEvent::BackendMinterCleared => "backend_minter_cleared",
        };
        assert_eq!(label, "voucher_redeemed");
    }

    #[test]
    fn test_admin_events_cover_lifecycle() {
        // The pause/unpause pair must both be present for symmetry.
        let pause = ContractEvent::Paused;
        let unpause = ContractEvent::Unpaused;
        assert_ne!(pause, unpause);
        assert_eq!(pause, ContractEvent::Paused);
        assert_eq!(unpause, ContractEvent::Unpaused);
    }

    #[test]
    fn test_minter_events_are_paired() {
        let set = ContractEvent::BackendMinterSet;
        let clear = ContractEvent::BackendMinterCleared;
        assert_ne!(set, clear);
    }

    #[test]
    fn test_token_lifecycle_events_are_distinct() {
        let mint = ContractEvent::TokenMinted;
        let burn = ContractEvent::TokenBurned;
        let transfer = ContractEvent::TokenTransferred;
        assert_ne!(mint, burn);
        assert_ne!(burn, transfer);
        assert_ne!(mint, transfer);
    }
}
