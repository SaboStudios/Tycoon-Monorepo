# Security Review Checklist — tycoon-token (SW-CON-TOKEN-001)

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

## Input Validation

- [x] `initialize` — rejects negative `initial_supply`
- [x] `initialize` — rejects re-initialization (`Already initialized`)
- [x] `mint` — rejects zero and negative amounts (`Amount must be positive`)
- [x] `transfer` / `transfer_from` — rejects negative amounts; zero is a documented no-op
- [x] `approve` — rejects negative amounts; zero clears the allowance
- [x] `burn` / `burn_from` — rejects zero and negative amounts (`Amount must be positive`)
- [x] All balance-deducting operations check for sufficient balance before mutating state

## Allowance Expiry

- [x] `AllowanceValue` stores `amount` + `expiration_ledger` together — expiry cannot be stripped
- [x] `allowance()` returns 0 for expired entries (no stale reads)
- [x] `transfer_from` enforces expiry before deducting allowance (`Allowance expired`)
- [x] `burn_from` enforces expiry before deducting allowance (`Allowance expired`)
- [x] `expiration_ledger = 0` is treated as "no expiry" (permanent allowance)

## Arithmetic Safety

- [x] `mint` — `checked_add` on both balance and total supply (`Balance overflow`, `Supply overflow`)
- [x] `transfer` / `transfer_from` — `checked_add` on recipient balance
- [x] `burn` / `burn_from` — `checked_sub` on total supply (`Supply underflow`)
- [x] Balance deductions use plain subtraction only after an explicit `>= amount` guard (no underflow possible)

## Event Emission

- [x] `initialize` emits `MintEvent` for the initial supply
- [x] `mint` emits `MintEvent`
- [x] `transfer` / `transfer_from` emit `TransferEvent`
- [x] `approve` emits `ApproveEvent` (includes `expiration_ledger`)
- [x] `burn` / `burn_from` emit `BurnEvent`
- [x] `set_admin` emits `SetAdminEvent` (old + new admin in topics)

## Reentrancy / CEI

- Soroban contracts execute atomically with no mid-call re-entry; no cross-contract calls are made in this contract, so CEI ordering is not a concern here.

## Oracle & Privileged Patterns

- [x] No external oracle or price feed — no unaudited privileged pattern in production
- [x] Admin key is the only privileged role; rotation is covered by `set_admin`

## No Unresolved Issues

| ID | Finding | Status |
|----|---------|--------|
| SEC-01 | `initialize` accepted negative `initial_supply` | Fixed — validation added |
| SEC-02 | `approve` stored `expiration_ledger` but it was never enforced | Fixed — `AllowanceValue` struct + expiry checks in `transfer_from` / `burn_from` / `allowance` |
| SEC-03 | `burn` / `burn_from` used unchecked subtraction on `total_supply` | Fixed — `checked_sub` |
| SEC-04 | `set_admin` emitted no event, making admin rotation unauditable | Fixed — `SetAdminEvent` added |
