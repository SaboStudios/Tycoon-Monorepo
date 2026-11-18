# Tycoon Contracts

# Tycoon Contracts

Soroban smart contracts for the Tycoon game, built with `soroban-sdk` v23.

This directory is the Cargo workspace root for the Tycoon smart contracts.

## Workspace members

The workspace is defined in [`Cargo.toml`](./Cargo.toml). Every member is listed
once below, with whether it is meant to be deployed and where its `lib.rs` lives.

| Crate | Deploy or library | `lib.rs` path |
| --- | --- | --- |
| `tycoon-token` | Deploy | `contracts/tycoon-token/src/lib.rs` |
| `tycoon-reward-system` | Deploy | `contracts/tycoon-reward-system/src/lib.rs` |
| `tycoon-main-game` | Deploy | `contracts/tycoon-main-game/src/lib.rs` |
| `tycoon-collectibles` | Deploy | `contracts/tycoon-collectibles/src/lib.rs` |
| `tycoon-boost-system` | Deploy | `contracts/tycoon-boost-system/src/lib.rs` |
| `tycoon-game` | Deploy | `contracts/tycoon-game/src/lib.rs` |
| `tycoon-lib` | Library (not deployed) | `contracts/tycoon-lib/src/lib.rs` |
| `integration-tests` | Library (not deployed) | `integration-tests/src/lib.rs` |
| `hello-world` (archive) | Archived (not deployed) | `archive/hello-world/src/lib.rs` |

Notes:

- `tycoon-lib` is a shared library crate consumed by the deployable contracts; it
  is not deployed on its own.
- `integration-tests` is a test-only crate and is not deployed.
- The `hello-world` crate lives under `archive/` and is excluded from the
  workspace; it is kept for reference only and is **not deployed**.

## Building

```sh
cargo build --release --target wasm32-unknown-unknown
```

## Testing

Run the commands below from the `contract/` directory (the workspace root).

Test a single crate with `-p`:

```bash
# Token crate
cargo test -p tycoon-token

# Reward crate
cargo test -p tycoon-reward-system

# Main-game crate
cargo test -p tycoon-game
```

Running `cargo test` from the wrong directory can look empty or fail on a missing manifest, so make sure you are in `contract/` first.

```sh
cargo test
```
