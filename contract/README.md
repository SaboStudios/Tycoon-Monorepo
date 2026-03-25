# Tycoon Smart Contracts

Soroban smart contracts for the Tycoon gaming platform on Stellar blockchain.

## 🎮 Production Contracts

The following production contracts are part of the main workspace:

| Contract                 | Description                                   | Path                              |
| ------------------------ | --------------------------------------------- | --------------------------------- |
| **tycoon-main-game**     | Main game logic — players, games, and lobbies | `contracts/tycoon-main-game/`     |
| **tycoon-game**          | Core game mechanics and state management      | `contracts/tycoon-game/`          |
| **tycoon-token**         | ERC-20 style token for in-game currency       | `contracts/tycoon-token/`         |
| **tycoon-reward-system** | Reward distribution and achievements          | `contracts/tycoon-reward-system/` |
| **tycoon-collectibles**  | NFT collectibles and items                    | `contracts/tycoon-collectibles/`  |
| **tycoon-boost-system**  | Power-ups and boost mechanics                 | `contracts/tycoon-boost-system/`  |
| **tycoon-lib**           | Shared library with common utilities          | `contracts/tycoon-lib/`           |

## 📁 Project Structure

```text
contract/
├── Cargo.toml              # Workspace configuration
├── README.md               # This file
├── archive/                # Archived/experimental contracts (excluded from workspace)
│   ├── README.md
│   └── hello-world/        # Sample contract (reference only)
└── contracts/              # Production contracts
    ├── tycoon-main-game/
    ├── tycoon-game/
    ├── tycoon-token/
    ├── tycoon-reward-system/
    ├── tycoon-collectibles/
    ├── tycoon-boost-system/
    └── tycoon-lib/
```

## 🚀 Quick Start

### Prerequisites

- [Rust](https://www.rust-lang.org/tools/install) (stable)
- [Stellar CLI](https://developers.stellar.org/docs/build/smart-contracts/getting-started/install)
- wasm32-unknown-unknown target

### Build All Contracts

```bash
cd contract

# Build for WASM (production)
cargo build --target wasm32-unknown-unknown --release

# Build for testing (native)
cargo build
```

### Run Tests

```bash
# Run all tests
cargo test --all

# Run tests for a specific contract
cargo test --package tycoon-main-game
```

### Build Specific Contract

```bash
# Build a specific contract
cargo build --package tycoon-main-game --target wasm32-unknown-unknown --release

# Output will be in:
# target/wasm32-unknown-unknown/release/tycoon_main_game.wasm
```

## 🧪 Testing

Each contract includes unit tests. Run them with:

```bash
cargo test --all
```

For test output with logs:

```bash
cargo test --all -- --nocapture
```

## 📦 Deployment

See the [Tycoon Deployment Guide](../../docs/CONTRACT_DEPLOYMENT.md) for deployment instructions.

## 🗄️ Archived Contracts

The `archive/` directory contains experimental or sample contracts that are **not** part of the production workspace. These are kept for reference and educational purposes only.

- **hello-world**: Basic Soroban contract example (archived)

## 🔗 Dependencies

All contracts use Soroban SDK v23 as specified in the workspace `Cargo.toml`.

## 📝 License

MIT
