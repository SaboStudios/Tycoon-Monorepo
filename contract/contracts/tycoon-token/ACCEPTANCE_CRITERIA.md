# Acceptance Criteria — tycoon-token (SW-CT-004)

Stellar Wave · Contract (Soroban / Stellar)
Issue: SW-CT-004

---

## Functional Acceptance Criteria

### Initialization

- [x] `initialize` sets the admin, mints `initial_supply` to admin, and stores `TotalSupply`.
  - A second call panics with `"Already initialized"`.
  - Rejects a negative `initial_supply` with `"Initial supply cannot be negative"`.
  - Emits `MintEvent { to: admin, amount: initial_supply }`.

### Admin Functions

- [x] `mint` creates new tokens and credits them to `to`.
  - Requires admin authorization (`require_auth()`); non-admin callers are rejected.
  - Rejects `amount <= 0` with `"Amount must be positive"`.
  - Increments `total_supply` by exactly `amount` (`checked_add`; panics on overflow).
  - Emits `MintEvent { to, amount }`.
- [x] `set_admin` transfers the admin role to `new_admin`.
  - Requires current admin authorization.
  - Emits `SetAdminEvent { old_admin, new_admin }`.
- [x] `admin` returns the current admin address (read-only, no auth required).
- [x] `total_supply` returns the current total supply (read-only, no auth required).

### SEP-41 Token Operations

- [x] `transfer` moves `amount` from `from` to `to`.
  - Requires `from` authorization.
  - Rejects negative `amount` with `"Amount cannot be negative"`.
  - Zero-amount transfer is a documented no-op (returns without state change).
  - Fails with `"Insufficient balance"` when `from` holds fewer tokens than `amount`.
  - Recipient balance updated with `checked_add` (panics on overflow).
  - Emits `TransferEvent { from, to, amount }`.
- [x] `transfer_from` moves `amount` on behalf of `from` using spender's allowance.
  - Requires `spender` authorization.
  - Rejects negative `amount` with `"Amount cannot be negative"`.
  - Zero-amount is a no-op.
  - Fails with `"Allowance expired"` when `expiration_ledger > 0` and current ledger exceeds it.
  - Fails with `"Insufficient allowance"` when allowance is less than `amount`.
  - Fails with `"Insufficient balance"` when `from` balance is less than `amount`.
  - Decrements allowance by exactly `amount` after a successful transfer.
  - Emits `TransferEvent { from, to, amount }`.
- [x] `approve` sets a spending allowance for `spender` on behalf of `from`.
  - Requires `from` authorization.
  - Rejects negative `amount` with `"Amount cannot be negative"`.
  - `expiration_ledger = 0` is treated as a permanent (non-expiring) allowance.
  - Emits `ApproveEvent { from, spender, amount, expiration_ledger }`.
- [x] `allowance` returns the current allowance for `(from, spender)`.
  - Returns `0` for expired entries (no stale reads).
  - Returns `0` when no allowance has been set.
- [x] `balance` returns the token balance for `id` (defaults to `0` if never set).
- [x] `burn` destroys `amount` tokens held by `from`.
  - Requires `from` authorization.
  - Rejects `amount <= 0` with `"Amount must be positive"`.
  - Fails with `"Insufficient balance"` when balance is less than `amount`.
  - Decrements `total_supply` by exactly `amount` (`checked_sub`; panics on underflow).
  - Emits `BurnEvent { from, amount }`.
- [x] `burn_from` destroys `amount` tokens from `from` using spender's allowance.
  - Requires `spender` authorization.
  - Rejects `amount <= 0` with `"Amount must be positive"`.
  - Fails with `"Allowance expired"` when allowance has expired.
  - Fails with `"Insufficient allowance"` when allowance is less than `amount`.
  - Fails with `"Insufficient balance"` when `from` balance is less than `amount`.
  - Decrements both allowance and balance by exactly `amount`.
  - Decrements `total_supply` by exactly `amount`.
  - Emits `BurnEvent { from, amount }`.

### Metadata

- [x] `name` returns `"Tycoon"` (read-only).
- [x] `symbol` returns `"TYC"` (read-only).
- [x] `decimals` returns `18` (read-only).

### Legacy / Deprecated Entrypoints

- [x] `legacy_mint` panics with `"legacy_mint is deprecated; use mint instead"`.
- [x] `legacy_burn` panics with `"legacy_burn is deprecated; use burn instead"`.
- [x] `legacy_transfer` panics with `"legacy_transfer is deprecated; use transfer instead"`.

---

## Invariants

| ID     | Invariant |
|--------|-----------|
| INV-01 | `total_supply` always equals the sum of all individual balances |
| INV-02 | `total_supply` increases by exactly `amount` on every successful `mint` |
| INV-03 | `total_supply` decreases by exactly `amount` on every successful `burn` / `burn_from` |
| INV-04 | `total_supply` is never negative |
| INV-05 | Minting zero or a negative amount is rejected (`"Amount must be positive"`) |
| INV-06 | Burning zero or a negative amount is rejected (`"Amount must be positive"`) |
| INV-07 | Burning more than a holder's balance is rejected (`"Insufficient balance"`) |
| INV-08 | `burn_from` is rejected when allowance is insufficient (`"Insufficient allowance"`) |
| INV-09 | Arithmetic overflow on `mint` is caught and panics — no silent wrap (`checked_add`) |
| INV-10 | Sequential mint → burn round-trip restores the original `total_supply` |
| INV-11 | Multiple independent mints accumulate correctly in `total_supply` |
| INV-12 | Multiple independent burns reduce `total_supply` correctly |
| INV-13 | Burning the entire supply of a holder reduces `total_supply` to zero |
| INV-14 | `burn_from` reduces both the holder's balance and the spender's allowance |
| INV-15 | Only the admin can mint; non-admin callers are rejected by `require_auth()` |
| INV-16 | `MintEvent` is emitted with correct `to` and `amount` on every mint (including init) |
| INV-17 | `BurnEvent` is emitted with correct `from` and `amount` on every burn / `burn_from` |

---

## Non-Functional Acceptance Criteria

- [x] `cargo check --package tycoon-token` passes with no errors or warnings.
- [x] `cargo test --package tycoon-token` passes (all tests green).
- [x] No unaudited oracle or privileged off-chain price feed in production paths.
- [x] CEI pattern is not applicable here — no cross-contract calls are made within this contract.
- [x] All admin functions use `require_auth()`.
- [x] All arithmetic uses `checked_add` / `checked_sub` — no silent integer overflow or underflow.
- [x] `AllowanceValue` stores `amount` and `expiration_ledger` together — expiry cannot be stripped from the allowance record.

---

## Test Coverage Checklist

| Area | Test(s) |
|---|---|
| Initialize / metadata | `test_initialization` |
| Double-init guard | `test_cannot_reinitialize` |
| Admin mint (positive) | `test_admin_can_mint` |
| Admin mint (zero rejected) | `test_cannot_mint_zero` |
| Transfer (success) | `test_transfer` |
| Transfer (insufficient balance) | `test_transfer_insufficient_balance` |
| Approve + transfer_from | `test_approve_and_transfer_from` |
| transfer_from (insufficient allowance) | `test_transfer_from_insufficient_allowance` |
| Burn (success) | `test_burn` |
| Burn (insufficient balance) | `test_burn_insufficient_balance` |
| burn_from (success) | `test_burn_from` |
| burn_from (insufficient allowance) | `test_burn_from_insufficient_allowance` |
| set_admin | `test_set_admin` |
| New admin can mint | `test_new_admin_can_mint` |
| Supply invariants | `invariant_tests` module |
| Error branches | `error_branch_tests` module |
| Access control | `access_control_tests` module |
| Deprecation guards | `deprecation_tests` module |
| Security review | `security_review_tests` module |

---

## Rollout / Migration Notes

1. **No schema migration required** for this PR — only documentation and acceptance criteria are added; no on-chain state is modified.
2. If deploying a fresh instance:
   - Call `initialize(admin, initial_supply)` once.
   - The admin address receives the full `initial_supply`.
   - Admin key must be secured; it holds unlimited minting power.
3. If upgrading an existing deployment:
   - No `migrate` entrypoint is required for this change.
   - Existing balances, allowances, and `total_supply` are unaffected.
4. Legacy entrypoints (`legacy_mint`, `legacy_burn`, `legacy_transfer`) are retained in the ABI to surface a clear deprecation panic rather than a silent "function not found" error. Remove them only after all integrators have migrated.
5. There is intentionally no hard supply cap. The practical ceiling is `i128::MAX` (~1.7 × 10³⁸), enforced by `checked_add` overflow guards.

---

## References

- Stellar Wave batch issue: SW-CT-004
- Related contracts: `tycoon-reward-system` (consumes `TycoonTokenClient::mint`), `tycoon-collectibles` (uses TYC as payment currency)
- Related docs: `SECURITY_REVIEW_CHECKLIST.md`, `README.md`, `contract/docs/STORAGE_ECONOMICS.md`
