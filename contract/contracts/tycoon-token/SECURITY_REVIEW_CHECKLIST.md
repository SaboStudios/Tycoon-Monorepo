# Security Review Checklist — tycoon-token (SW-CON-TOKEN-001)

**Issue:** #1028
**Contract:** `contract/contracts/tycoon-token/src/lib.rs`
**SDK:** soroban-sdk 23
**Reviewer:** (assign before merge)
**Status:** All checklist items below verified against current source.

## Authorization & Access Control

- [x] `initialize` — one-time guard via `Initialized` key; no auth required by design
- [x] `mint` — admin-only via `admin.require_auth()`
- [x] `set_admin` — admin-only via `admin.require_auth()`; emits `SetAdminEvent`
- [x] `transfer` — caller-only via `from.require_auth()`
- [x] `transfer_from` — spender-only via `spender.require_auth()`
- [x] `approve` — owner-only via `from.require_auth()`
- [x] `burn` — owner-only via `from.require_auth()`
- [x] `burn_from` — spender-only via `spender.require_auth()`
- [x] `balance`, `allowance`, `total_supply`, `admin`, `decimals`, `name`, `symbol` — public read-only, no auth needed
- [x] Admin rotation via `set_admin` is atomic — old admin loses rights immediately after the call
- [x] No privileged back-door: only `admin` can mint; no secondary minter role exists

## Input Validation

- [x] `initialize` — rejects negative `initial_supply`
- [x] `initialize` — rejects re-initialization (`Already initialized`)
- [x] `mint` — rejects zero and negative amounts (`Amount must be positive`)
- [x] `transfer` / `transfer_from` — rejects negative amounts; zero is a documented no-op
- [x] `approve` — rejects negative amounts; zero clears the allowance
- [x] `burn` / `burn_from` — rejects zero and negative amounts (`Amount must be positive`)
- [x] All balance-deducting operations check for sufficient balance before mutating state
- [x] `transfer_from` / `burn_from` — rejects calls when allowance is zero (no implicit approval)
- [x] `transfer` with `from == to` is a no-op (zero-amount guard exits early; positive amount is a self-transfer that conserves balance)

## Allowance Expiry

- [x] `AllowanceValue` stores `amount` + `expiration_ledger` together — expiry cannot be stripped
- [x] `allowance()` returns 0 for expired entries (no stale reads)
- [x] `transfer_from` enforces expiry before deducting allowance (`Allowance expired`)
- [x] `burn_from` enforces expiry before deducting allowance (`Allowance expired`)
- [x] `expiration_ledger = 0` is treated as "no expiry" (permanent allowance)
- [x] Allowance set at ledger N with `expiration_ledger = N` is still valid at ledger N (boundary: `> expiration_ledger`, not `>=`)
- [x] Allowance is expired at ledger N+1 when `expiration_ledger = N`

## Arithmetic Safety

- [x] `mint` — `checked_add` on both balance and total supply (`Balance overflow`, `Supply overflow`)
- [x] `transfer` / `transfer_from` — `checked_add` on recipient balance
- [x] `burn` / `burn_from` — `checked_sub` on total supply (`Supply underflow`)
- [x] Balance deductions use plain subtraction only after an explicit `>= amount` guard (no underflow possible)
- [x] `total_supply` invariant: sum of all balances always equals `total_supply` (verified by INV-01 test)
- [x] Minting `i128::MAX - current_supply + 1` triggers `Supply overflow` (no silent wrap)

## Event Emission

- [x] `initialize` emits `MintEvent` for the initial supply
- [x] `mint` emits `MintEvent`
- [x] `transfer` / `transfer_from` emit `TransferEvent`
- [x] `approve` emits `ApproveEvent` (includes `expiration_ledger`)
- [x] `burn` / `burn_from` emit `BurnEvent`
- [x] `set_admin` emits `SetAdminEvent` (old + new admin in topics)
- [x] All events are emitted **after** state mutations (CEI pattern respected)

## Reentrancy / CEI

- Soroban contracts execute atomically with no mid-call re-entry; no cross-contract calls are made in this contract, so CEI ordering is not a concern here.
- [x] State is mutated before any external call (no external calls exist in this contract)

## Oracle & Privileged Patterns

- [x] No external oracle or price feed — no unaudited privileged pattern in production
- [x] Admin key is the only privileged role; rotation is covered by `set_admin`
- [x] Legacy entrypoints (`legacy_mint`, `legacy_burn`, `legacy_transfer`) panic with a clear migration message — no silent fallback

## Stale / Disconnected / Invalid State

- [x] Uninitialized contract: all entrypoints that read `Admin` will panic with `unwrap()` if called before `initialize` — no silent default admin
- [x] Double-initialize is rejected (`Already initialized`) — state cannot be reset by a second caller
- [x] Expired allowance entries remain in storage but are treated as 0 — no ghost approvals can be exploited
- [x] Burning the full balance of a holder removes the balance entry (storage cleaned up, no zero-value ghost entries)

## No Unresolved Issues

| ID | Finding | Status |
|----|---------|--------|
| SEC-01 | `initialize` accepted negative `initial_supply` | Fixed — validation added |
| SEC-02 | `approve` stored `expiration_ledger` but it was never enforced | Fixed — `AllowanceValue` struct + expiry checks in `transfer_from` / `burn_from` / `allowance` |
| SEC-03 | `burn` / `burn_from` used unchecked subtraction on `total_supply` | Fixed — `checked_sub` |
| SEC-04 | `set_admin` emitted no event, making admin rotation unauditable | Fixed — `SetAdminEvent` added |
| SEC-05 | Allowance boundary: `expiration_ledger = current_ledger` should still be valid | Verified — condition is `> expiration_ledger` (strict greater-than) |
| SEC-06 | Legacy entrypoints could be called silently with no error | Fixed — all legacy entrypoints panic with explicit deprecation message |
| SEC-07 | No test for `transfer_from` / `burn_from` with zero allowance | Fixed — covered by `test_inv_08b` and `test_spending_without_approval_fails` |
