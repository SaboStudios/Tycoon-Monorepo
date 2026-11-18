# Tycoon Reward System

Soroban contract that issues, redeems, and burns Tycoon reward vouchers.

## Build and test

```sh
cargo test -p tycoon-reward-system
```

## Production builds

Production builds must not export test entrypoints. The contract ABI intentionally
exposes only the real entrypoints (`mint_voucher`, `redeem_voucher_from`, `burn_voucher`,
and the admin/backend configuration functions). Helper functions such as `_mint` and
`_burn` are crate-private and are exercised only from unit tests inside the crate.

Do not add `test_mint`, `test_burn`, or any other unauthenticated test-only entrypoint
to a `#[contractimpl]` block. If a test needs to mint or burn directly, call the
private helpers from a `#[cfg(test)]` module instead of exposing a public entrypoint.
