# SW-CON-001: Integration tests for legacy entrypoints deprecation

**Stellar Wave batch:** Contract (Soroban / Stellar)  
**Issue ID:** SW-CON-001  
**Type:** Test coverage + documentation

---

## Summary

This PR adds comprehensive integration test coverage for three legacy entrypoints in the Tycoon Soroban contract suite, documenting their deprecation paths and locking in the expected behaviour for future migrations.

**No contract source changes** — this is a test-only PR that establishes the baseline for follow-up hardening work.

---

## Changes

### 1. New integration test module

**File:** `contract/integration-tests/src/legacy_entrypoints.rs`

Adds 12 integration tests covering:

- **`redeem_voucher`** (hard-deprecated) — 3 tests
- **`test_mint` / `test_burn`** (unguarded test helpers) — 4 tests
- **`mint_registration_voucher`** (legacy untyped cross-contract call) — 3 tests
- **Cross-cutting state integrity** — 2 tests

All tests use the existing `Fixture` pattern (isolated `Env::default()` per test, no shared state).

### 2. Module registration

**File:** `contract/integration-tests/src/lib.rs`

Registers the new `legacy_entrypoints` module with a comment linking it to SW-CON-001.

### 3. Migration documentation

**File:** `contract/MIGRATION_LEGACY_ENTRYPOINTS.md`

Comprehensive rollout guide covering:

- Current state of each legacy entrypoint
- Security risk assessment
- Recommended fixes (with code examples)
- Migration steps and rollout plan
- CI acceptance criteria
- Security review notes

---

## Legacy Entrypoints Covered

### 1. `redeem_voucher` (TycoonRewardSystem)

**Status:** Hard-deprecated (always panics)  
**Risk:** Low — already enforced  
**Tests:**
- `legacy_redeem_voucher_always_panics` — primary acceptance gate
- `legacy_redeem_voucher_does_not_transfer_tokens` — no TYC movement
- `canonical_redeem_voucher_from_still_works_after_legacy_attempt` — state integrity

**Canonical replacement:** `redeem_voucher_from(redeemer, token_id)`

### 2. `test_mint` / `test_burn` (TycoonRewardSystem)

**Status:** Unguarded test helpers exposed as public entrypoints  
**Risk:** **High** — arbitrary caller can inflate/deflate balances  
**Tests:**
- `test_mint_entrypoint_is_unguarded_canary` — documents the risk
- `test_burn_entrypoint_is_unguarded_canary` — documents the risk
- `test_burn_insufficient_balance_still_panics` — underlying guard still active
- `test_mint_then_burn_leaves_zero_balance_no_token_movement` — no TYC movement

**Recommended fix:** Move to `#[cfg(test)]` (tracked in follow-up PR)

### 3. `mint_registration_voucher` (TycoonContract)

**Status:** Uses raw untyped `invoke_contract` (legacy cross-contract pattern)  
**Risk:** Medium — functional but not type-safe  
**Tests:**
- `legacy_mint_registration_voucher_owner_succeeds` — current behaviour
- `legacy_mint_registration_voucher_produces_redeemable_voucher` — end-to-end flow
- `legacy_mint_registration_voucher_non_owner_rejected` — auth guard present

**Recommended fix:** Replace with typed `TycoonRewardSystemClient` (tracked in follow-up PR)

---

## Test Coverage Summary

| Test | Purpose | Acceptance gate |
|------|---------|-----------------|
| `legacy_redeem_voucher_always_panics` | Deprecated entrypoint must panic | ✅ Primary |
| `legacy_redeem_voucher_does_not_transfer_tokens` | No TYC must move | ✅ Security |
| `canonical_redeem_voucher_from_still_works_after_legacy_attempt` | State integrity | ✅ Regression |
| `test_mint_entrypoint_is_unguarded_canary` | Documents unguarded risk | ⚠️ Canary |
| `test_burn_entrypoint_is_unguarded_canary` | Documents unguarded risk | ⚠️ Canary |
| `test_burn_insufficient_balance_still_panics` | Underlying guard active | ✅ Security |
| `test_mint_then_burn_leaves_zero_balance_no_token_movement` | No TYC movement | ✅ Security |
| `legacy_mint_registration_voucher_owner_succeeds` | Current behaviour | ✅ Baseline |
| `legacy_mint_registration_voucher_produces_redeemable_voucher` | End-to-end flow | ✅ Regression |
| `legacy_mint_registration_voucher_non_owner_rejected` | Auth guard present | ✅ Security |
| `deprecated_call_does_not_corrupt_subsequent_canonical_flow` | State integrity | ✅ Regression |
| `test_mint_voucher_has_no_value_entry_redeem_panics` | Semantic gap | ✅ Security |

---

## CI / Acceptance Criteria

### Checklist

- [x] PR references Stellar Wave and issue ID (SW-CON-001)
- [x] No contract source changes (test-only PR)
- [x] Integration tests added for all three legacy entrypoints
- [x] Migration documentation added (`MIGRATION_LEGACY_ENTRYPOINTS.md`)
- [x] No new privileged patterns introduced
- [x] All tests follow existing `Fixture` pattern (isolated `Env` per test)
- [ ] CI green (pending: `cargo check` + `make ci-full`)

### CI commands

```bash
cd contract
cargo check --workspace
make ci-full
```

Expected output:
- `cargo check` passes for all workspace members
- `make ci-full` passes (hygiene + build + wasm-check + test + integration tests)
- All 12 new tests in `legacy_entrypoints.rs` pass

---

## Security Review

### Privileged patterns

**None introduced** — this PR only adds tests.

### Existing risks documented

- **`test_mint` / `test_burn`:** Unguarded entrypoints that allow arbitrary balance inflation/deflation.  Documented as "canary tests" — must be fixed before mainnet (tracked in follow-up PR).
- **`mint_registration_voucher`:** Owner-gated (correct) but uses untyped cross-contract call (refactoring recommended, not a security issue).

### Oracle / external data

Not applicable — no external data sources involved.

---

## Rollout Plan

### Phase 1: This PR (integration tests + documentation)

- Add `legacy_entrypoints.rs` to the integration test suite
- Add `MIGRATION_LEGACY_ENTRYPOINTS.md` migration guide
- Merge to `main` (or `develop`)

### Phase 2: Fix `test_mint` / `test_burn` (follow-up PR)

- Move to `#[cfg(test)]` (recommended) or add admin guard (fallback)
- Update or remove canary tests
- Deploy to testnet → mainnet

### Phase 3: Refactor `mint_registration_voucher` (follow-up PR)

- Replace `env.invoke_contract` with typed `TycoonRewardSystemClient`
- Verify all tests still pass (regression guard)
- Deploy to testnet → mainnet

### Phase 4: Remove `redeem_voucher` (long-term)

- After all clients migrate to `redeem_voucher_from`, remove the deprecated entrypoint entirely
- Coordinate with major version bump (breaking ABI change)

---

## Testing

### Run integration tests locally

```bash
cd contract
make test-integration
```

### Run only legacy entrypoint tests

```bash
cargo test --package tycoon-integration-tests legacy_entrypoints -- --nocapture
```

### Expected output

```
running 12 tests
test legacy_entrypoints::tests::canonical_redeem_voucher_from_still_works_after_legacy_attempt ... ok
test legacy_entrypoints::tests::deprecated_call_does_not_corrupt_subsequent_canonical_flow ... ok
test legacy_entrypoints::tests::legacy_mint_registration_voucher_non_owner_rejected ... ok
test legacy_entrypoints::tests::legacy_mint_registration_voucher_owner_succeeds ... ok
test legacy_entrypoints::tests::legacy_mint_registration_voucher_produces_redeemable_voucher ... ok
test legacy_entrypoints::tests::legacy_redeem_voucher_always_panics ... ok
test legacy_entrypoints::tests::legacy_redeem_voucher_does_not_transfer_tokens ... ok
test legacy_entrypoints::tests::test_burn_entrypoint_is_unguarded_canary ... ok
test legacy_entrypoints::tests::test_burn_insufficient_balance_still_panics ... ok
test legacy_entrypoints::tests::test_mint_entrypoint_is_unguarded_canary ... ok
test legacy_entrypoints::tests::test_mint_then_burn_leaves_zero_balance_no_token_movement ... ok
test legacy_entrypoints::tests::test_mint_voucher_has_no_value_entry_redeem_panics ... ok

test result: ok. 12 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out
```

---

## References

- **Migration guide:** `contract/MIGRATION_LEGACY_ENTRYPOINTS.md`
- **Integration tests:** `contract/integration-tests/src/legacy_entrypoints.rs`
- **Soroban best practices:** [Contract Upgrades](https://soroban.stellar.org/docs/learn/contract-upgrades)
- **CEI pattern audit:** `contract/CEI_SECURITY_AUDIT.md`

---

## Follow-up Work

1. **SW-CON-002** (proposed): Fix `test_mint` / `test_burn` unguarded entrypoints
2. **SW-CON-003** (proposed): Refactor `mint_registration_voucher` to use typed client
3. **SW-CON-004** (proposed): Remove `redeem_voucher` after client migration complete

---

## Reviewer Notes

### What to look for

- [ ] All tests follow the existing `Fixture` pattern (no new test infrastructure)
- [ ] Test names clearly indicate intent (e.g., `*_canary`, `*_still_works`)
- [ ] Panic assertions use `std::panic::catch_unwind` + `assert!(res.is_err())`
- [ ] No new contract source changes (test-only PR)
- [ ] Migration guide is comprehensive and actionable

### What NOT to expect

- No contract source changes (this is test coverage only)
- No new dependencies (uses existing `soroban-sdk` testutils)
- No new fixture infrastructure (reuses existing `Fixture::new()`)

---

## Changelog

| Date | Author | Change |
|------|--------|--------|
| 2026-04-23 | Kiro (SW-CON-001) | Initial PR: integration tests + migration guide |
