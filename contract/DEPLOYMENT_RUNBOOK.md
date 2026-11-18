# Deployment Runbook

This runbook walks an operator through building, deploying, and initializing the
Tycoon Soroban contracts. Every crate path below is a real workspace member
(see `contract/Cargo.toml`).

## Prerequisites

- Rust toolchain matching `rust-version` in `contract/Cargo.toml`
- Stellar CLI (`stellar contract ...`)
- A funded deployer account on the target network

## 1. Build the contracts

Build the token contract:

```bash
cargo build --release --manifest-path contracts/tycoon-token/Cargo.toml --target wasm32-unknown-unknown
```

Build the reward contract:

```bash
cargo build --release --manifest-path contracts/tycoon-reward-system/Cargo.toml --target wasm32-unknown-unknown
```

Build the main game contract:

```bash
cargo build --release --manifest-path contracts/tycoon-main-game/Cargo.toml --target wasm32-unknown-unknown
```

The resulting Wasm artifacts live under each crate's
`target/wasm32-unknown-unknown/release/` directory.

## 2. Deploy the contracts

Deploy the token contract:

```bash
stellar contract deploy \
  --wasm contracts/tycoon-token/target/wasm32-unknown-unknown/release/tycoon_token.wasm \
  --source <DEPLOYER_SECRET_KEY> \
  --network <NETWORK>
```

Deploy the reward contract:

```bash
stellar contract deploy \
  --wasm contracts/tycoon-reward-system/target/wasm32-unknown-unknown/release/tycoon_reward_system.wasm \
  --source <DEPLOYER_SECRET_KEY> \
  --network <NETWORK>
```

Deploy the main game contract:

```bash
stellar contract deploy \
  --wasm contracts/tycoon-main-game/target/wasm32-unknown-unknown/release/tycoon_main_game.wasm \
  --source <DEPLOYER_SECRET_KEY> \
  --network <NETWORK>
```

Record each returned contract ID; they are needed for initialization.

## 3. Initialize the contracts

Initialize the token contract:

```bash
stellar contract invoke \
  --id <TOKEN_CONTRACT_ID> \
  --source <DEPLOYER_SECRET_KEY> \
  --network <NETWORK> \
  -- initialize \
  --admin <ADMIN_ADDRESS>
```

Initialize the reward contract:

```bash
stellar contract invoke \
  --id <REWARD_CONTRACT_ID> \
  --source <DEPLOYER_SECRET_KEY> \
  --network <NETWORK> \
  -- initialize \
  --admin <ADMIN_ADDRESS>
```

Initialize the main game contract:

```bash
stellar contract invoke \
  --id <MAIN_GAME_CONTRACT_ID> \
  --source <DEPLOYER_SECRET_KEY> \
  --network <NETWORK> \
  -- initialize \
  --admin <ADMIN_ADDRESS>
```

## 4. Verify

Confirm each contract responds to a read-only call before handing off:

```bash
stellar contract invoke \
  --id <CONTRACT_ID> \
  --source <DEPLOYER_SECRET_KEY> \
  --network <NETWORK> \
  -- <READ_ONLY_FN>
```

## Notes

- Never commit secret keys or account seeds. Pass them via environment or the
  CLI prompt only.
- Crate names: `tycoon-token` (token), `tycoon-reward-system` (rewards),
  `tycoon-main-game` (game logic).
