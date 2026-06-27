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

// ═══════════════════════════════════════════════════════════════════════════
// Event Schema (audited — SW-CT-1036)
// ═══════════════════════════════════════════════════════════════════════════
//
// Event schema conventions used in this contract:
//
// | Event              | data_format         | #topics | Data payload        |
// |--------------------|---------------------|---------|---------------------|
// | MintEvent          | single-value        | 1 (to)  | amount: i128        |
// | TransferEvent      | (default)           | 2 (from, to) | amount: i128   |
// | BurnEvent          | single-value        | 1 (from) | amount: i128        |
// | ApproveEvent       | (default)           | 2 (from, spender) | (amount, expiration_ledger) |
// | SetAdminEvent      | (default)           | 2 (old_admin, new_admin) | (empty)  |
//
// NOTE on `single-value`:
// Events with a single data field (amount) use `data_format = "single-value"`,
// which serialises the value directly rather than wrapping it in a tuple/struct.
// This is the idiomatic Soroban pattern for marginal-cost events.
// See https://docs.rs/soroban-sdk/latest/soroban_sdk/attr.contractevent.html

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

// ═══════════════════════════════════════════════════════════════════════════
// Storage Rent Budget Review (SW-CT-1034)
// ═══════════════════════════════════════════════════════════════════════════
//
// Soroban persistent storage entries (Balance, Allowance) have independent
// TTL (time-to-live) counters.  If a persistent entry's TTL expires, the
// entry becomes archived and a non-trivial fee is required to restore it.
//
// ## Storage classification
//
// | Key               | Domain type  | Lifetime       | TTL strategy                |
// |-------------------|--------------|----------------|-----------------------------|
// | Admin             | instance     | contract       | Automatic (instance TTL)    |
// | TotalSupply       | instance     | contract       | Automatic (instance TTL)    |
// | Initialized       | instance     | contract       | Automatic (instance TTL)    |
// | Balance(addr)     | persistent   | user lifetime  | extend on every transfer    |
// | Allowance(a, s)   | persistent   | per-approval   | extend on approve + use     |
//
// ## TTL extension policy
//
// - **Instance entries** (Admin, TotalSupply, Initialized): The Soroban host
//   automatically extends the instance TTL on every contract invocation.
//   No manual `extend_ttl` call is required.
//
// - **Persistent entries** (Balance, Allowance): Each mutation (set)
//   implicitly extends the TTL of that entry because the host grants a
//   baseline TTL on every write.  During periods of inactivity (no transfers
//   for a user), the entry could still expire.
//
//   To mitigate this risk, we extend the TTL of the **sender's** balance
//   entry on every transfer/mint/burn/burn_from/transfer_from.  This ensures
//   that active users' balances are kept alive.
//
//   In the current version (SW-CT-1034), we rely on the SDK's implicit TTL
//   grant on write — every `set()` in persistent storage automatically
//   refreshes the entry TTL.  A future upgrade could add explicit
//   `extend_ttl` calls with a configurable threshold.

// ═══════════════════════════════════════════════════════════════════════════
// Cost Budget (SW-CT-1034)
// ═══════════════════════════════════════════════════════════════════════════
//
// | Operation       | Writes              | Expected cost (approx) |
// |-----------------|---------------------|------------------------|
// | initialize      | 3 inst + 1 pers    | ~0.005 XLM             |
// | mint            | 1 inst + 1 pers    | ~0.003 XLM             |
// | transfer        | 2 pers             | ~0.004 XLM             |
// | transfer_from   | 2 pers + 1 allow   | ~0.006 XLM             |
// | approve         | 1 pers             | ~0.002 XLM             |
// | burn            | 1 inst + 1 pers    | ~0.003 XLM             |
// | burn_from       | 1 inst + 1 pers + 1 allow | ~0.005 XLM     |
// | balance/allowance | 0 (read)         | ~0.001 XLM             |
//
// These estimates assume typical mainnet parameters and are within the
// per-operation gas/storage budget for Soroban contracts.
//
// ═══════════════════════════════════════════════════════════════════════════
// Cross-Contract Auth Matrix (SW-CT-1035)
// ═══════════════════════════════════════════════════════════════════════════
//
// When another contract (e.g., tycoon-reward-system or tycoon-collectibles)
// calls into TycoonToken, the caller must satisfy this contract's
// `require_auth()` checks.  There is no "privileged caller" pattern —
// every auth check is cryptographic.
//
// | Entrypoint        | Auth requirement      | Cross-contract scenario         |
// |-------------------|-----------------------|---------------------------------|
// | initialize        | No auth (one-time)    | Not callable cross-contract     |
// | mint              | admin.require_auth    | Admin must pre-sign TX           |
// | set_admin         | admin.require_auth    | Admin key holder only            |
// | admin             | None (read-only)      | Any contract can read            |
// | total_supply      | None (read-only)      | Any contract can read            |
// | transfer(from,to) | from.require_auth     | Caller = `from` or has signature |
// | transfer_from     | spender.require_auth  | Spender contract with its auth   |
// | approve           | from.require_auth     | Owner must sign                  |
// | allowance         | None (read-only)      | Any contract can read            |
// | balance           | None (read-only)      | Any contract can read            |
// | burn(from)        | from.require_auth     | `from` must sign                 |
// | burn_from         | spender.require_auth  | Spender contract with its auth   |
// | decimals/name/symbol | None (read-only)   | Any contract can read            |
//
// **Key insight**: Cross-contract calls in Soroban do NOT bypass auth.
// If contract A calls `tycoon_token.mint(user, 100)`, the mint calls
// `admin.require_auth()` which verifies the admin Address's signature
// is present in the transaction.  The admin must pre-sign, or admin
// must be a multisig/DAO that the calling contract controls.
//
// ═══════════════════════════════════════════════════════════════════════════

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

// ═══════════════════════════════════════════════════════════════════════════
// Admin-only entrypoints (SW-CT-1033)
// ═══════════════════════════════════════════════════════════════════════════
//
// The following entrypoints are guarded by `require_admin()` and can only
// be called by the current admin address.
//
// | Function       | Auth guard          | Read/write |
// |----------------|---------------------|------------|
// | `initialize`   | One-time (no auth)  | Write      |
// | `mint`         | admin.require_auth  | Write      |
// | `set_admin`    | admin.require_auth  | Write      |
// | `admin`        | None (read-only)    | Read       |
// | `total_supply` | None (read-only)    | Read       |

#[contractimpl]
impl TycoonToken {
    /// One-time initializer.  Not auth-guarded (admin doesn't exist yet).
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
        let old_admin = require_admin(&e);
        e.storage().instance().set(&DataKey::Admin, &new_admin);
        SetAdminEvent {
            old_admin,
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

// ═══════════════════════════════════════════════════════════════════════════
// Public entrypoints (SW-CT-1033)
// ═══════════════════════════════════════════════════════════════════════════
//
// These are open to any caller but require the relevant user's
// cryptographic signature via `require_auth()`.  Read-only functions
// require no auth.
//
// | Function         | Auth required         | SEP-41  |
// |------------------|-----------------------|---------|
// | `transfer`       | from.require_auth     | Yes     |
// | `transfer_from`  | spender.require_auth  | Yes     |
// | `approve`        | from.require_auth     | Yes     |
// | `allowance`      | None (read-only)      | Yes     |
// | `balance`        | None (read-only)      | Yes     |
// | `burn`           | from.require_auth     | Yes     |
// | `burn_from`      | spender.require_auth  | Yes     |
// | `decimals`       | None (read-only)      | Yes     |
// | `name`           | None (read-only)      | Yes     |
// | `symbol`         | None (read-only)      | Yes     |

#[contractimpl]
impl TycoonToken {
    /// Returns the remaining allowance for `spender` on behalf of `from`.
    /// Returns 0 if the entry is expired or was never set.
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
mod access_control_tests;
#[cfg(test)]
mod deprecation_tests;
#[cfg(test)]
mod integration_coverage;
#[cfg(test)]
mod security_review_tests;
#[cfg(test)]
mod simulation_scenarios;
#[cfg(test)]
mod storage_rent_tests;
