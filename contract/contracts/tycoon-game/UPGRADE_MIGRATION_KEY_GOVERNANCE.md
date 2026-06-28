# Upgrade / Migration Key Governance — tycoon-game

**Issue:** #1007  
**Crate:** `contract/contracts/tycoon-game/`  
**Contract:** `TycoonContract`  
**SDK:** soroban-sdk 23  
**Version:** 0.2.0  

---

## Overview

This document defines the governance policy for contract upgrades, state migrations,
and key rotation in `TycoonContract`. It covers who is authorised to trigger each
operation, what on-chain evidence is produced, and the rollback posture for each
migration step.

---

## 1. Privileged Keys and Their Governance

### 1.1 Owner Key

| Property | Detail |
|---|---|
| Storage location | `DataKey::Owner` — instance storage |
| Set by | `initialize` (one-time) |
| Rotated by | `admin_transfer_ownership(new_owner: Address)` |
| Auth required for rotation | Current owner (`require_admin` → `owner.require_auth()`) |
| Event emitted on rotation | `OwnershipTransferred(old_owner, new_owner)` |
| Revocation | Replace with a known-safe address; there is no "lock" primitive |

**Governance rule:** The owner key is the root of all privileged operations. Rotation must be performed by the current owner and must be auditable via the `OwnershipTransferred` event. Key rotation should be coordinated off-chain with the Tech Lead and Security Reviewer before execution.

**Key rotation procedure:**
1. Prepare the new owner address (hardware wallet or multisig recommended for mainnet).
2. Verify the new address by performing a test signature on testnet.
3. Call `admin_transfer_ownership(new_owner)` from the current owner.
4. Confirm the `OwnershipTransferred` event on-chain.
5. Verify the new owner can call at least one admin function (e.g., `admin_migrate` as a no-op).
6. Revoke or archive the old key material.

---

### 1.2 Backend Game Controller Key

| Property | Detail |
|---|---|
| Storage location | `DataKey::BackendGameController` — instance storage |
| Set by | `admin_set_game_controller(new_controller: Address)` — owner only |
| Rotated by | Same entrypoint; overwrite with new address |
| Auth required for rotation | Owner |
| Event emitted on rotation | `ControllerUpdated(new_controller)` |
| Revocation | Call `admin_set_game_controller` with a known-safe burn address; no "clear" primitive |

**Governance rule:** The backend controller is a narrowly-scoped hot key used by the off-chain game service to call `remove_player_from_game`. It must never be granted additional privileges. If the backend service is compromised, the owner should immediately rotate this key.

**Key rotation procedure:**
1. Generate a new backend service key pair.
2. Call `admin_set_game_controller(new_controller)` from the owner.
3. Confirm the `ControllerUpdated` event on-chain.
4. Update the backend service configuration to use the new key.
5. Retire the old key material from the service.

---

### 1.3 Immutable Keys (Post-Initialize)

The following addresses are set during `initialize` and **cannot be changed** after deployment. This is by design — it limits the attack surface by preventing privilege escalation via token or reward system substitution.

| Key | Storage | Mutable after init? | Impact if compromised |
|---|---|---|---|
| `TycToken` | Instance | ❌ No | No direct impact (read-only reference for token operations) |
| `UsdcToken` | Instance | ❌ No | No direct impact (read-only reference for token operations) |
| `RewardSystem` | Instance | ❌ No | Owner could potentially redirect voucher minting to a malicious contract |

**Governance implication for `RewardSystem`:** Because this address is immutable, the reward system contract must be thoroughly audited before `initialize` is called on mainnet. Any vulnerability in the reward system will require a full contract replacement (redeploy + data migration).

---

## 2. State Schema Migration Governance

### 2.1 `StateVersion` Semantics

The `StateVersion` key in instance storage tracks the on-chain data schema version. It is managed by `admin_migrate` and `initialize`.

| Version | Schema | Migration path |
|---|---|---|
| 0 | Legacy (pre-`initialize`) | `admin_migrate` advances to 1 |
| 1 | Current (as of v0.2.0) | `admin_migrate` is a no-op at this version |
| 2+ | Reserved | Future migrations must add explicit `else if current_version == N` branches |

**Invariant:** `StateVersion` can only increase. There is no downgrade path.

### 2.2 Adding a New Migration Step

To add a migration from version N to version N+1:

1. **Define the schema change** — document what storage keys are added, removed, or transformed.
2. **Add the migration branch** in `admin_migrate`:

   ```rust
   } else if current_version == N {
       // Perform migration: e.g., populate new keys with defaults
       storage::set_new_key(&env, &default_value);
       storage::set_state_version(&env, N + 1);
   }
   ```

3. **Add a migration event** — emit `MigrationExecuted(from_version, to_version)` so indexers can detect the upgrade (see open item MKG-01 in §5).
4. **Write a test** that:
   - Manually sets `StateVersion` to N without calling the new paths.
   - Calls `admin_migrate`.
   - Asserts `StateVersion` is N+1 and new keys are populated correctly.
5. **Update this document** with the new version row in the table above.

### 2.3 WASM Upgrade

Soroban supports uploading a new WASM blob and updating the contract's code reference via `env.deployer().update_current_contract_wasm(new_wasm_hash)`. For `TycoonContract`:

- **Who can initiate a WASM upgrade:** Owner only (must be added as an explicit entrypoint; not currently implemented — see MKG-02 in §5).
- **State compatibility:** The new WASM must be compatible with the existing `DataKey` enum. Adding new variants is safe; removing or reordering existing variants is a breaking change.
- **Pre-upgrade checklist:**
  1. Run `cargo build --target wasm32-unknown-unknown --release` and capture the new WASM hash.
  2. Deploy and verify on testnet.
  3. Run all unit and integration tests against the testnet deployment.
  4. Coordinate with the Tech Lead and Security Reviewer.
  5. Execute `update_current_contract_wasm` from the owner address.
  6. Confirm the new WASM hash on-chain.
  7. Run smoke tests.

---

## 3. Migration Execution Governance

### 3.1 Who Can Execute Migrations

| Migration type | Authorized caller | Auth mechanism |
|---|---|---|
| State schema (`admin_migrate`) | Owner | `require_admin` |
| WASM upgrade (future) | Owner | To be implemented as `admin_upgrade_wasm` |
| Key rotation (owner) | Current owner | `admin_transfer_ownership` |
| Key rotation (controller) | Owner | `admin_set_game_controller` |

### 3.2 Migration Approval Process

For mainnet migrations:

1. **Proposal:** The developer opens a PR with the migration code, this document updated, and a testnet execution trace.
2. **Review:** Tech Lead and Security Reviewer approve the PR.
3. **Testnet dry run:** The migration is executed on testnet. State is verified before and after.
4. **Sign-off:** Security Reviewer signs off on the testnet results.
5. **Mainnet execution:** The migration is executed by the owner key holder. A second key holder witnesses the transaction.
6. **Post-migration verification:** `export_state` is called to verify the new state matches expectations.

### 3.3 Rollback Policy

Soroban contracts have no built-in rollback mechanism. Mitigation strategies:

| Scenario | Mitigation |
|---|---|
| Migration introduces a bug (pre-detection) | Re-deploy with a corrected WASM; the state written by the bad migration persists and must be explicitly corrected via a follow-up `admin_migrate` step. |
| Migration emits wrong events | Events are immutable; document the discrepancy and emit corrective events from the follow-up migration. |
| Owner key compromised during migration | Immediately rotate via `admin_transfer_ownership` if the key is still available; otherwise, the contract must be considered compromised and a replacement deployed. |

---

## 4. Deprecated Entrypoint Governance

The following shim entrypoints are kept for backward compatibility and **will be removed in v1.0.0**:

| Deprecated entrypoint | Replacement | Removal target |
|---|---|---|
| `migrate` | `admin_migrate` | v1.0.0 |
| `withdraw_funds` | `admin_withdraw_funds` | v1.0.0 |
| `set_collectible_info` | `admin_set_collectible_info` | v1.0.0 |
| `set_cash_tier_value` | `admin_set_cash_tier_value` | v1.0.0 |
| `set_backend_game_controller` | `admin_set_game_controller` | v1.0.0 |
| `mint_registration_voucher` | `admin_mint_registration_voucher` | v1.0.0 |

**Governance rule:** No new code should call deprecated entrypoints. All integrations must migrate to the `admin_*` variants before the v1.0.0 release.

---

## 5. Open Items

| ID | Severity | Description | Recommendation |
|---|---|---|---|
| MKG-01 | Low | `admin_migrate` emits no event; migration execution is silent | Add `MigrationExecuted(from_version: u32, to_version: u32)` event |
| MKG-02 | Medium | No `admin_upgrade_wasm` entrypoint; WASM upgrades require a separate deployer transaction | Implement `admin_upgrade_wasm(new_wasm_hash: BytesN<32>)` guarded by `require_admin` |
| MKG-03 | Low | `ControllerUpdated` does not include the previous controller address; partial audit trail | Add `old_controller: Option<Address>` to the event data (see also ESA-01 in `EVENT_SCHEMA_AUDIT.md`) |
| MKG-04 | Info | `admin_mint_registration_voucher` has no idempotency guard | Tracked as BLK-002 in `CEI_SECURITY_AUDIT.md`; add a per-player-per-epoch guard |

---

## 6. Validation Performed

- All privileged entrypoints in `src/lib.rs` enumerated and mapped to their storage keys.
- `StateVersion` increment logic verified in `admin_migrate` and `initialize`.
- Deprecation shims verified against `#[deprecated(since = "0.2.0")]` annotations.
- No code changes introduced; this is a governance documentation artefact.
