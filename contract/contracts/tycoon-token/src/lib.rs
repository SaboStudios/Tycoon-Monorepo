#![no_std]
use soroban_sdk::{contract, contractevent, contractimpl, contracttype, Address, Env, String};

// SW-CON-TOKEN-001: allowance entry stores amount + expiration together so
// transfer_from / burn_from can enforce the ledger-based expiry.
#[contracttype]
#[derive(Clone)]
pub struct AllowanceValue {
    pub amount: i128,
    pub expiration_ledger: u32,
}

#[contractevent(data_format = "single-value")]
pub struct MintEvent {
    #[topic]
    pub to: Address,
    pub amount: i128,
}

#[contractevent]
pub struct TransferEvent {
    #[topic]
    pub from: Address,
    #[topic]
    pub to: Address,
    pub amount: i128,
}

#[contractevent(data_format = "single-value")]
pub struct BurnEvent {
    #[topic]
    pub from: Address,
    pub amount: i128,
}

#[contractevent]
pub struct ApproveEvent {
    #[topic]
    pub from: Address,
    #[topic]
    pub spender: Address,
    pub amount: i128,
    pub expiration_ledger: u32,
}

#[contractevent]
pub struct SetAdminEvent {
    #[topic]
    pub old_admin: Address,
    #[topic]
    pub new_admin: Address,
}

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Admin,
    Balance(Address),
    Allowance(Address, Address),
    TotalSupply,
    Initialized,
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/// Reads the stored admin address and calls `require_auth()` on it.
///
/// Every admin-only entrypoint must call this function before mutating state.
/// Centralising the check here ensures the pattern is applied consistently and
/// makes the access-control boundary easy to audit.
fn require_admin(e: &Env) -> Address {
    let admin: Address = e.storage().instance().get(&DataKey::Admin).unwrap();
    admin.require_auth();
    admin
}

#[contract]
pub struct TycoonToken;

#[contractimpl]
impl TycoonToken {
    pub fn initialize(e: Env, admin: Address, initial_supply: i128) {
        if e.storage().instance().has(&DataKey::Initialized) {
            panic!("Already initialized");
        }
        if initial_supply < 0 {
            panic!("Initial supply cannot be negative");
        }
        e.storage().instance().set(&DataKey::Initialized, &true);
        e.storage().instance().set(&DataKey::Admin, &admin);
        e.storage()
            .instance()
            .set(&DataKey::TotalSupply, &initial_supply);
        e.storage()
            .persistent()
            .set(&DataKey::Balance(admin.clone()), &initial_supply);
        MintEvent {
            to: admin,
            amount: initial_supply,
        }
        .publish(&e);
    }

    pub fn mint(e: Env, to: Address, amount: i128) {
        require_admin(&e);

        if amount <= 0 {
            panic!("Amount must be positive");
        }

        let balance: i128 = e
            .storage()
            .persistent()
            .get(&DataKey::Balance(to.clone()))
            .unwrap_or(0);
        let new_balance = balance.checked_add(amount).expect("Balance overflow");
        e.storage()
            .persistent()
            .set(&DataKey::Balance(to.clone()), &new_balance);

        let supply: i128 = e.storage().instance().get(&DataKey::TotalSupply).unwrap();
        e.storage().instance().set(
            &DataKey::TotalSupply,
            &supply.checked_add(amount).expect("Supply overflow"),
        );

        MintEvent { to, amount }.publish(&e);
    }

    pub fn set_admin(e: Env, new_admin: Address) {
        require_admin(&e);
        e.storage().instance().set(&DataKey::Admin, &new_admin);
        SetAdminEvent {
            old_admin: admin,
            new_admin,
        }
        .publish(&e);
    }

    pub fn admin(e: Env) -> Address {
        e.storage().instance().get(&DataKey::Admin).unwrap()
    }

    pub fn total_supply(e: Env) -> i128 {
        e.storage()
            .instance()
            .get(&DataKey::TotalSupply)
            .unwrap_or(0)
    }
}

#[contractimpl]
impl TycoonToken {
    pub fn allowance(e: Env, from: Address, spender: Address) -> i128 {
        let entry: Option<AllowanceValue> = e
            .storage()
            .persistent()
            .get(&DataKey::Allowance(from, spender));
        match entry {
            None => 0,
            Some(v) => {
                if v.expiration_ledger > 0 && e.ledger().sequence() > v.expiration_ledger {
                    0
                } else {
                    v.amount
                }
            }
        }
    }

    pub fn approve(e: Env, from: Address, spender: Address, amount: i128, expiration_ledger: u32) {
        from.require_auth();
        if amount < 0 {
            panic!("Amount cannot be negative");
        }
        e.storage().persistent().set(
            &DataKey::Allowance(from.clone(), spender.clone()),
            &AllowanceValue {
                amount,
                expiration_ledger,
            },
        );
        ApproveEvent {
            from,
            spender,
            amount,
            expiration_ledger,
        }
        .publish(&e);
    }

    pub fn balance(e: Env, id: Address) -> i128 {
        e.storage()
            .persistent()
            .get(&DataKey::Balance(id))
            .unwrap_or(0)
    }

    pub fn transfer(e: Env, from: Address, to: Address, amount: i128) {
        from.require_auth();
        if amount < 0 {
            panic!("Amount cannot be negative");
        }
        if amount == 0 {
            return;
        }

        let from_balance: i128 = e
            .storage()
            .persistent()
            .get(&DataKey::Balance(from.clone()))
            .unwrap_or(0);
        if from_balance < amount {
            panic!("Insufficient balance");
        }
        e.storage()
            .persistent()
            .set(&DataKey::Balance(from.clone()), &(from_balance - amount));

        let to_balance: i128 = e
            .storage()
            .persistent()
            .get(&DataKey::Balance(to.clone()))
            .unwrap_or(0);
        e.storage().persistent().set(
            &DataKey::Balance(to.clone()),
            &to_balance.checked_add(amount).expect("Balance overflow"),
        );

        TransferEvent { from, to, amount }.publish(&e);
    }

    pub fn transfer_from(e: Env, spender: Address, from: Address, to: Address, amount: i128) {
        spender.require_auth();
        if amount < 0 {
            panic!("Amount cannot be negative");
        }
        if amount == 0 {
            return;
        }

        let entry: AllowanceValue = e
            .storage()
            .persistent()
            .get(&DataKey::Allowance(from.clone(), spender.clone()))
            .unwrap_or(AllowanceValue {
                amount: 0,
                expiration_ledger: 0,
            });
        if entry.expiration_ledger > 0 && e.ledger().sequence() > entry.expiration_ledger {
            panic!("Allowance expired");
        }
        if entry.amount < amount {
            panic!("Insufficient allowance");
        }
        e.storage().persistent().set(
            &DataKey::Allowance(from.clone(), spender),
            &AllowanceValue {
                amount: entry.amount - amount,
                expiration_ledger: entry.expiration_ledger,
            },
        );

        let from_balance: i128 = e
            .storage()
            .persistent()
            .get(&DataKey::Balance(from.clone()))
            .unwrap_or(0);
        if from_balance < amount {
            panic!("Insufficient balance");
        }
        e.storage()
            .persistent()
            .set(&DataKey::Balance(from.clone()), &(from_balance - amount));

        let to_balance: i128 = e
            .storage()
            .persistent()
            .get(&DataKey::Balance(to.clone()))
            .unwrap_or(0);
        e.storage().persistent().set(
            &DataKey::Balance(to.clone()),
            &to_balance.checked_add(amount).expect("Balance overflow"),
        );

        TransferEvent { from, to, amount }.publish(&e);
    }

    pub fn burn(e: Env, from: Address, amount: i128) {
        from.require_auth();
        if amount <= 0 {
            panic!("Amount must be positive");
        }

        let balance: i128 = e
            .storage()
            .persistent()
            .get(&DataKey::Balance(from.clone()))
            .unwrap_or(0);
        if balance < amount {
            panic!("Insufficient balance");
        }
        e.storage()
            .persistent()
            .set(&DataKey::Balance(from.clone()), &(balance - amount));

        let supply: i128 = e.storage().instance().get(&DataKey::TotalSupply).unwrap();
        e.storage().instance().set(
            &DataKey::TotalSupply,
            &supply.checked_sub(amount).expect("Supply underflow"),
        );

        BurnEvent { from, amount }.publish(&e);
    }

    pub fn burn_from(e: Env, spender: Address, from: Address, amount: i128) {
        spender.require_auth();
        if amount <= 0 {
            panic!("Amount must be positive");
        }

        let entry: AllowanceValue = e
            .storage()
            .persistent()
            .get(&DataKey::Allowance(from.clone(), spender.clone()))
            .unwrap_or(AllowanceValue {
                amount: 0,
                expiration_ledger: 0,
            });
        if entry.expiration_ledger > 0 && e.ledger().sequence() > entry.expiration_ledger {
            panic!("Allowance expired");
        }
        if entry.amount < amount {
            panic!("Insufficient allowance");
        }
        e.storage().persistent().set(
            &DataKey::Allowance(from.clone(), spender),
            &AllowanceValue {
                amount: entry.amount - amount,
                expiration_ledger: entry.expiration_ledger,
            },
        );

        let balance: i128 = e
            .storage()
            .persistent()
            .get(&DataKey::Balance(from.clone()))
            .unwrap_or(0);
        if balance < amount {
            panic!("Insufficient balance");
        }
        e.storage()
            .persistent()
            .set(&DataKey::Balance(from.clone()), &(balance - amount));

        let supply: i128 = e.storage().instance().get(&DataKey::TotalSupply).unwrap();
        e.storage().instance().set(
            &DataKey::TotalSupply,
            &supply.checked_sub(amount).expect("Supply underflow"),
        );

        BurnEvent { from, amount }.publish(&e);
    }

    pub fn decimals(_e: Env) -> u32 {
        18
    }

    pub fn name(e: Env) -> String {
        String::from_str(&e, "Tycoon")
    }

    pub fn symbol(e: Env) -> String {
        String::from_str(&e, "TYC")
    }
}

#[cfg(test)]
mod test;

#[cfg(test)]
mod invariant_tests;

#[cfg(test)]
mod error_branch_tests;

/// Legacy entrypoints — deprecated in SW-CT-005.
///
/// These functions existed in earlier versions of the contract under different
/// names.  They are retained in the ABI so that callers receive an explicit
/// panic message rather than a silent "function not found" error, giving
/// integrators a clear migration signal.
///
/// **Do not call these from new code.**  Use the canonical replacements listed
/// in each function's doc comment.
#[contractimpl]
impl TycoonToken {
    /// Deprecated alias for `mint`.
    ///
    /// Canonical replacement: `mint(e, to, amount)`
    pub fn legacy_mint(_e: Env, _to: Address, _amount: i128) {
        panic!("legacy_mint is deprecated; use mint instead");
    }

    /// Deprecated alias for `burn`.
    ///
    /// Canonical replacement: `burn(e, from, amount)`
    pub fn legacy_burn(_e: Env, _from: Address, _amount: i128) {
        panic!("legacy_burn is deprecated; use burn instead");
    }

    /// Deprecated alias for `transfer`.
    ///
    /// Canonical replacement: `transfer(e, from, to, amount)`
    pub fn legacy_transfer(_e: Env, _from: Address, _to: Address, _amount: i128) {
        panic!("legacy_transfer is deprecated; use transfer instead");
    }
}

#[cfg(test)]
mod deprecation_tests;
#[cfg(test)]
mod access_control_tests;
mod security_review_tests;
