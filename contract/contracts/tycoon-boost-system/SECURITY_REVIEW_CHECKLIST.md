# Security Review Checklist — tycoon-boost-system (SW-CONTRACT-HYGIENE-001)

**Stellar Wave batch** | **Issue:** SW-CONTRACT-HYGIENE-001 | **Status:** ✅ All items verified

---

## Authorization & Access Control

- [x] `initialize` — one-time guard via `DataKey::Admin` presence check; panics `"AlreadyInitialized"` on re-call
- [x] `initialize` — `admin.require_auth()` called before writing state
- [x] `admin_grant_boost` — admin-only via `get_admin(&env)` + `admin.require_auth()`
- [x] `admin_revoke_boost` — admin-only via `get_admin(&env)` + `admin.require_auth()`
- [x] `add_boost` — admin-only via `Self::require_admin(&env)` (centralised helper)
- [x] `clear_boosts` — admin-only via `Self::require_admin(&env)`
- [x] `prune_expired_boosts` — no auth required (deprecated, read-then-write, no privileged data)
- [x] `calculate_total_boost` — public read-only, no auth needed
- [x] `get_active_boosts` — public read-only, no auth needed
- [x] `get_boosts` — public read-only (deprecated), no auth needed
- [x] `admin` — public read-only, no auth needed

## Input Validation

- [x] `add_boost` / `admin_grant_boost` — rejects `value == 0` (`"InvalidValue"`)
- [x] `add_boost` / `admin_grant_boost` — rejects `expires_at_ledger != 0 && expires_at_ledger <= current_ledger` (`"InvalidExpiry"`)
- [x] `add_boost` / `admin_grant_boost` — rejects duplicate `boost.id` for the same player (`"DuplicateId"`)
- [x] `add_boost` / `admin_grant_boost` — rejects adding beyond `MAX_BOOSTS_PER_PLAYER` (10) (`"CapExceeded"`)
- [x] Cap check runs *after* expired-boost pruning — freed slots are counted correctly (CAP-3)

## Arithmetic Safety

- [x] `apply_stacking_rules` — multiplicative chain uses `u64` intermediate to avoid `u32` overflow before dividing back to `u32`
- [x] `apply_stacking_rules` — additive accumulator is `u32`; no checked arithmetic, but max realistic sum (10 boosts × 10 000 bp = 100 000) fits in `u32`
- [x] No token transfers or balance mutations — no overflow risk on financial values
- [x] `prune_expired` — `before - after` subtraction on `u32` lengths; safe because `after <= before` by construction

## Expiry Semantics

- [x] `expires_at_ledger == 0` means "never expires" — documented and tested (EXP-1)
- [x] `expires_at_ledger > current_ledger` → active (EXP-2)
- [x] `expires_at_ledger <= current_ledger` → expired (EXP-3)
- [x] `calculate_total_boost` excludes expired boosts without mutating storage (EXP-4)
- [x] `prune_expired_boosts` removes expired boosts from persistent storage (EXP-5)
- [x] Expired boosts are pruned before cap/duplicate checks in `add_boost` and `admin_grant_boost` (CAP-3)

## Event Emission

- [x] `add_boost` emits `BoostActivatedEvent` (player, boost_id, boost_type, value, expires_at_ledger)
- [x] `admin_grant_boost` emits `AdminBoostGrantedEvent` (player, boost_id, boost_type, value, expires_at_ledger)
- [x] `admin_revoke_boost` emits `AdminBoostRevokedEvent` (player, boost_id) — only when boost is found
- [x] `clear_boosts` emits `BoostsClearedEvent` (player, count)
- [x] `prune_expired` emits `BoostExpiredEvent` per pruned boost (player, boost_id)
- [x] `prune_expired_boosts` (deprecated) emits `DeprecatedFunctionCalledEvent`
- [x] `get_boosts` (deprecated) emits `DeprecatedFunctionCalledEvent`

## Reentrancy / CEI

- Soroban contracts execute atomically; no cross-contract calls are made in this contract.
- All state mutations (storage writes) occur before any event publications.
- No external token transfers — CEI ordering is not a concern here.

## Oracle & Privileged Patterns

- [x] No external oracle or price feed — no unaudited privileged pattern in production
- [x] Admin key is the only privileged role; no rotation mechanism exists (admin is set once at `initialize`)
- [ ] **OPEN (medium):** Admin key rotation (`set_admin`) is not implemented. If the admin key is compromised, boosts cannot be revoked without redeploying. Tracked as SW-CONTRACT-HYGIENE-001-M1.

## Deprecation Safety

- [x] `prune_expired_boosts` marked `#[deprecated]` — emits `DeprecatedFunctionCalledEvent` on call
- [x] `get_boosts` marked `#[deprecated]` — emits `DeprecatedFunctionCalledEvent` on call
- [x] Deprecated functions remain in ABI to give integrators a clear migration signal rather than a silent "function not found" error

## Storage Economics

- [x] Per-player boost list stored under `DataKey::PlayerBoosts(Address)` in persistent storage — TTL managed by Soroban ledger
- [x] Admin stored in instance storage — cheaper reads for every auth check
- [x] Expired boosts are pruned on `add_boost` / `admin_grant_boost` — storage does not grow unboundedly
- [x] `clear_boosts` removes the storage entry entirely (not a zero-write)

## No Unresolved Critical Issues

| ID | Finding | Status |
|----|---------|--------|
| SEC-01 | `add_boost` called `require_admin` but doc said "player-initiated" — misleading | Fixed — doc updated; function is admin-only by design |
| SEC-02 | Cap check ran before expired-boost pruning — could falsely reject valid adds | Fixed — `prune_expired` called before cap check |
| SEC-03 | `admin_revoke_boost` emitted event even when boost not found | Fixed — event only emitted when `found == true` |
| SW-CONTRACT-HYGIENE-001-M1 | No `set_admin` / admin key rotation | Open (medium) — tracked for next milestone |
