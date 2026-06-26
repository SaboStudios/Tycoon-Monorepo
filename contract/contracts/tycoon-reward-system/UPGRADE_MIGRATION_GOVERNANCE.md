# Upgrade / Migration Key Governance — tycoon-reward-system

**Issue:** #1027
**Contract:** `contract/contracts/tycoon-reward-system/src/lib.rs`
**SDK:** soroban-sdk 23

This document defines who controls upgrades and state migrations of
`TycoonRewardSystem`, what those operations may touch, and the operational
policy for exercising and rotating the governing key.

---

## 1. Governing Keys

| Key | Storage | Set at | Authority |
|---|---|---|---|
| Admin | `DataKey::Admin` (persistent) | `initialize` (one-time) | Sole authority for migration, pausing, minter management, and withdrawals |
| State version | `DataKey::StateVersion` (persistent) | `initialize` (= `1u32`) | Tracks the on-chain state schema revision |

There is no separate "upgrade key": migration authority is bound to the **Admin
key**. The backend minter key (`DataKey::BackendMinter`) has no upgrade or
migration power.

---

## 2. Migration Surface

The only governance entrypoint is `migrate`:

```rust
pub fn migrate(e: Env) {
    let admin: Address = e.storage().persistent().get(&DataKey::Admin)
        .expect("Not initialized");
    admin.require_auth();

    let current_version: u32 = e.storage().persistent()
        .get(&DataKey::StateVersion).unwrap_or(0);

    if current_version == 0 {
        e.storage().persistent().set(&DataKey::StateVersion, &1u32);
    }
}
```

Guarantees:

- **Admin-gated.** `migrate` reads `Admin` and calls `admin.require_auth()`
  before any state change. An uninitialized contract panics (`Not initialized`)
  rather than silently migrating.
- **Idempotent / monotonic.** Migration only advances state version `0 → 1`. A
  contract already at version `1` (the value written by `initialize`) is a
  no-op, so repeated or concurrent `migrate` calls cannot corrupt state or skip
  versions.
- **State-only.** `migrate` adjusts persisted state schema bookkeeping. The
  contract does **not** expose an on-chain WASM code-upgrade entrypoint
  (`update_current_contract_wasm`); replacing contract code is therefore an
  out-of-band deployment decision, not a callable function.

---

## 3. Key Governance Policy

1. **Custody.** The Admin address SHOULD be a multisig or governance account,
   not a single hot key, since it can pause the contract, manage minters,
   migrate state, and withdraw funds.
2. **Migration runbook.** Before bumping `StateVersion`, snapshot persistent
   storage; after `migrate`, verify the new version via a read and confirm no
   balance or voucher entries were altered.
3. **Rotation gap (observation).** The contract currently exposes no
   `set_admin` entrypoint, so the Admin key is fixed at `initialize`. Operators
   must therefore treat the initial Admin account as the long-lived root of
   trust; if rotation is required it must be designed as part of a future
   migration that introduces an admin-rotation entrypoint. *(Documented as a
   governance observation; no code change is made under this issue.)*

---

## 4. Versioning Contract

- `StateVersion` is the single source of truth for the persisted-state schema
  revision. Any future change to storage layout or event schema MUST bump this
  value through `migrate` and be accompanied by the corresponding migration
  logic for the `current_version` branch.
- Off-chain consumers can read the version to detect schema-incompatible
  deployments before issuing writes.

---

## 5. Test Coverage

- `admin_access_control_tests.rs` — covers admin authorization on the
  privileged entrypoints, including the auth pattern `migrate` relies on.
- `test.rs` — exercises `initialize`, which seeds `StateVersion = 1` (the
  baseline that makes `migrate` a no-op on fresh deployments).

No API changed; this document audits and governs existing behavior only.
