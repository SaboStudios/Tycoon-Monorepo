# Tycoon Contracts

This directory is the Cargo workspace root for the Tycoon smart contracts.

## Running tests

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
