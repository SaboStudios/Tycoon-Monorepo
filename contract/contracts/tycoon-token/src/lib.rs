#![no_std]
use soroban_sdk::{
    contract, contractevent, contractimpl, contracttype, Address, Env, String,
};

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

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Admin,
    Balance(Address),
    Allowance(Address, Address),
    TotalSupply,
    Initialized,
}

#[contract]
pub struct TycoonToken;

#[contractimpl]
impl TycoonToken {
    pub fn initialize(e: Env, admin: Address, initial_supply: i128) {
        if e.storage().instance().has(&DataKey::Initialized) {
            panic!("Already initialized");
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
        let admin: Address = e.storage().instance().get(&DataKey::Admin).unwrap();
        admin.require_auth();

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
        let admin: Address = e.storage().instance().get(&DataKey::Admin).unwrap();
        admin.require_auth();
        e.storage().instance().set(&DataKey::Admin, &new_admin);
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
        e.storage()
            .persistent()
            .get(&DataKey::Allowance(from, spender))
            .unwrap_or(0)
    }

    pub fn approve(e: Env, from: Address, spender: Address, amount: i128, expiration_ledger: u32) {
        from.require_auth();
        if amount < 0 {
            panic!("Amount cannot be negative");
        }
        e.storage()
            .persistent()
            .set(&DataKey::Allowance(from.clone(), spender.clone()), &amount);
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

        TransferEvent {
            from,
            to,
            amount,
        }
        .publish(&e);
    }

    pub fn transfer_from(e: Env, spender: Address, from: Address, to: Address, amount: i128) {
        spender.require_auth();
        if amount < 0 {
            panic!("Amount cannot be negative");
        }
        if amount == 0 {
            return;
        }

        let allowance: i128 = e
            .storage()
            .persistent()
            .get(&DataKey::Allowance(from.clone(), spender.clone()))
            .unwrap_or(0);
        if allowance < amount {
            panic!("Insufficient allowance");
        }
        e.storage().persistent().set(
            &DataKey::Allowance(from.clone(), spender),
            &(allowance - amount),
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
        e.storage()
            .instance()
            .set(&DataKey::TotalSupply, &(supply - amount));

        BurnEvent { from, amount }.publish(&e);
    }

    pub fn burn_from(e: Env, spender: Address, from: Address, amount: i128) {
        spender.require_auth();
        if amount <= 0 {
            panic!("Amount must be positive");
        }

        let allowance: i128 = e
            .storage()
            .persistent()
            .get(&DataKey::Allowance(from.clone(), spender.clone()))
            .unwrap_or(0);
        if allowance < amount {
            panic!("Insufficient allowance");
        }
        e.storage().persistent().set(
            &DataKey::Allowance(from.clone(), spender),
            &(allowance - amount),
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
        e.storage()
            .instance()
            .set(&DataKey::TotalSupply, &(supply - amount));

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
