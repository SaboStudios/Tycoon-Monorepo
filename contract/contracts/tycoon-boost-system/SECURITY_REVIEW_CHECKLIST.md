# Security Review Checklist — tycoon-boost-system (SW-CONTRACT-HYGIENE-001 / SW-CT-025)

**Stellar Wave batch** | **Issues:** SW-CONTRACT-HYGIENE-001, SW-CT-025 | **Status:** ✅ All items verified

---

## Authorization & Access Control

- [x] `initialize` — one-time guard via `DataKey::Admin` presence check; panics `"AlreadyInitialized"` on re-call. Admin must authorize the call via `admin.require_auth()`.
- [x] `add_boost` — admin-only via `require_admin()` (loads stored admin and calls `admin.require_auth()`). Panics `"NotInitialized"` if contract has not been initialized.
- [x] `clear_boosts` — admin-only via `require_admin()`.
- [x] `admin_grant_boost` — admin-only via `get_admin()` + `admin.require_auth()`.
- [x] `admin_revoke_boost` — admin-only via `get_admin()` + `admin.require_auth()`.
- [x] `prune_expired_boosts` (deprecated) — no auth required; read + write on caller's own data only. Acceptable: pruning is a public maintenance operation with no privileged effect.
- [x] `calculate_total_boost`, `get_active_boosts`, `get_boosts` (deprecated), `admin` — public read-only, no auth needed.
- [x] **SEC-01** — `admin_grant_boost` / `admin_revoke_boost` auth rejection tested without `mock_all_auths` in `security_review_tests.rs`.

## Input Validation

- [x] `add_boost` / `admin_grant_boost` — rejects `value == 0` (`"InvalidValue"`).
- [x] `add_boost` / `admin_grant_boost` — rejects `expires_at_ledger != 0 && expires_at_ledger <= current_ledger` (`"InvalidExpiry"`).
- [x] `add_boost` / `admin_grant_boost` — rejects duplicate `id` for the same player (`"DuplicateId"`).
- [x] `add_boost` / `admin_grant_boost` — rejects adding beyond `MAX_BOOSTS_PER_PLAYER` (`"CapExceeded"`). Expired boosts are pruned before the cap is checked (CAP-3).
- [x] `admin_revoke_boost` — silently succeeds (idempotent) when `boost_id` is not found; no panic on missing id.

## Arithmetic Safety

- [x] `apply_stacking_rules` — multiplicative chain uses `u64` intermediate: `multiplicative_total as u64 * boost.value as u64 / 10000`. Max intermediate value is `u32::MAX * u32::MAX ≈ 1.8 × 10¹⁹` which fits in `u64::MAX ≈ 1.8 × 10¹⁹`. Tight but safe for realistic values; the final `as u32` cast truncates silently if the chain product exceeds `u32::MAX`.
- [ ] **FINDING SEC-02** — `additive_total += boost.value` uses wrapping addition on `u32`. With 10 boosts each at `value = u32::MAX / 10 + 1` the sum wraps, producing a lower-than-expected total. Covered by test `test_additive_overflow_wraps` in `security_review_tests.rs` (documents current behavior; fix tracked separately).
- [ ] **FINDING SEC-03** — Final mixed formula `(multiplicative_total as u64 * (10000 + additive_total as u64) / 10000) as u32` silently truncates to `u32` if the result exceeds `u32::MAX`. Covered by test `test_mixed_overflow_truncates` (documents current behavior).
- [x] `prune_expired` — no arithmetic; only ledger sequence comparison.
- [x] `calculate_total_boost` — delegates entirely to `apply_stacking_rules`; no independent arithmetic.

## Expiry / Time Logic

- [x] All time comparisons use `env.ledger().sequence()` (ledger sequence), never wall-clock time. Consistent with `contract/docs/TIME_BASED_LOGIC.md`.
- [x] `expires_at_ledger == 0` is the "never expires" sentinel (EXP-1).
- [x] Expiry boundary: `expires_at_ledger <= current_ledger` → expired (EXP-3). A boost expiring at exactly the current ledger is treated as expired.
- [x] `calculate_total_boost` filters expired boosts inline without mutating storage (EXP-4).

## Event Emission

- [x] `add_boost` emits `BoostActivatedEvent` (player, boost_id, type, value, expires_at_ledger).
- [x] `admin_grant_boost` emits `AdminBoostGrantedEvent`.
- [x] `admin_revoke_boost` emits `AdminBoostRevokedEvent` only when the boost was actually found and removed (not on no-op).
- [x] `clear_boosts` emits `BoostsClearedEvent` with the count of removed boosts.
- [x] `prune_expired` (internal) emits `BoostExpiredEvent` per pruned boost.
- [x] `prune_expired_boosts` (deprecated public) emits `DeprecatedFunctionCalledEvent`.
- [x] `get_boosts` (deprecated) emits `DeprecatedFunctionCalledEvent`.

## Reentrancy / CEI

- Soroban contracts execute atomically; no cross-contract calls are made in this contract. CEI ordering is not a concern.

## Oracle & Privileged Patterns

- [x] No external oracle or price feed — no unaudited privileged pattern in production.
- [x] Single privileged role: `Admin`. Set once at `initialize`, never rotatable (no `set_admin`). **Note**: admin key is immutable — if the admin key is compromised there is no recovery path. Acceptable for current scope; rotation should be considered before mainnet.
- [x] No unaudited privileged pattern in production.

## Storage

- [x] Admin stored in `instance` storage (contract lifetime).
- [x] Per-player boost lists stored in `persistent` storage keyed by `DataKey::PlayerBoosts(Address)`.
- [x] No cross-player storage aliasing possible: each key includes the player `Address`.
- [x] Expired boosts are pruned on `add_boost` / `admin_grant_boost` — storage does not grow unboundedly.
- [x] `clear_boosts` removes the storage entry entirely (not a zero-write).

## Deprecation Safety

- [x] `prune_expired_boosts` marked `#[deprecated]` — emits `DeprecatedFunctionCalledEvent` on call.
- [x] `get_boosts` marked `#[deprecated]` — emits `DeprecatedFunctionCalledEvent` on call.
- [x] Deprecated functions remain in ABI to give integrators a clear migration signal rather than a silent "function not found" error.

## Findings Summary

| ID | Severity | Finding | Status |
|----|----------|---------|--------|
| SEC-01 | Low | `admin_grant_boost` / `admin_revoke_boost` auth rejection not tested without `mock_all_auths` | Tested in `security_review_tests.rs` |
| SEC-02 | Low | `additive_total += boost.value` wraps on `u32` overflow | Documented by test; fix tracked |
| SEC-03 | Low | Final mixed-stacking cast `as u32` silently truncates | Documented by test; fix tracked |
| SEC-04 | Info | Admin key is immutable — no rotation path | Accepted for current scope |
