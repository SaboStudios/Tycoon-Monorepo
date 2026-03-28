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
├── Makefile                # Single entry: fmt, clippy, test, WASM release, CI parity
├── Cargo.toml              # Workspace configuration
├── README.md               # This file
├── deploy/                 # wasm-hashes.txt, wasm-size-report.md (pipeline / local make)
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

- [Rust](https://www.rust-lang.org/tools/install) (stable) with `wasm32-unknown-unknown`:
  `rustup target add wasm32-unknown-unknown`
- [GNU Make](https://www.gnu.org/software/make/)
- [jq](https://jqlang.org/) — required for `make ci` / `make wasm-check` (WASM size budget)
- Optional: [cargo-audit](https://github.com/rustsec/rustsec) for `make audit`
- [Stellar CLI](https://developers.stellar.org/docs/build/smart-contracts/getting-started/install) — for legacy per-crate `stellar contract build` flows only; CI and this Makefile use `cargo` only

From the `contract/` directory, use **one target** for local development (format, clippy, tests, release WASM):

```bash
cd contract
make dev
```

That runs the same **release WASM** build as GitHub Actions (`cargo build --target wasm32-unknown-unknown --release`). For **exact CI parity** (build + size check + tests):

```bash
make ci
```

Full parity with `contract-build.yml` (adds integration tests):

```bash
make ci-full
```

### Makefile reference

| Target | Purpose |
|--------|---------|
| `make help` | List all targets |
| `make dev` | `fmt` + `clippy` + `test` + `build-wasm` (quickstart) |
| `make ci` | Same commands as `.github/workflows/ci.yml` Contracts job |
| `make ci-full` | `ci` + `test-integration` (matches extra tests in `contract-build.yml`) |
| `make fmt` / `make clippy` / `make test` / `make build-wasm` | Workspace-wide |
| `make wasm-check` | `bash scripts/check-wasm-sizes.sh` |
| `make test-integration` | `cargo test --package tycoon-integration-tests -- --nocapture` |
| `make wasm-hashes` | Write `deploy/wasm-hashes.txt` (after `build-wasm`) |
| `make clean` | `cargo clean` |
| `make audit` | `cargo audit` (if installed) |
| `make fmt-PKG` …`wasm-PKG` | Per-crate, e.g. `make wasm-tycoon-game` |

### Build All Contracts (without Make)

```bash
cd contract

# Build for WASM (production) — same as `make build-wasm`
cargo build --target wasm32-unknown-unknown --release

# Build for testing (native)
cargo build
```

### Run Tests

```bash
# Run all tests — same as `make test`
cargo test --all

# Run tests for a specific contract
cargo test --package tycoon-main-game
```

### Build Specific Contract

```bash
# Same as: make wasm-tycoon-main-game
cargo build --package tycoon-main-game --target wasm32-unknown-unknown --release

# Output will be in:
# target/wasm32-unknown-unknown/release/tycoon_main_game.wasm
```

## 📦 Artifacts and deploy pipeline

Paths are stable for CI and local builds. Use these when wiring uploads or verifying deployments.

| Artifact | Path (relative to `contract/`) | Notes |
|----------|-------------------------------|--------|
| Release WASM (all binaries) | `target/wasm32-unknown-unknown/release/*.wasm` | Primary deploy inputs |
| WASM size report | `deploy/wasm-size-report.md` | Created by `make wasm-check` / CI |
| WASM SHA-256 list | `deploy/wasm-hashes.txt` | `make wasm-hashes` locally; CI generates in `contract-build.yml` |
| CI artifact upload | `contract/target/**/release/*.wasm`, `contract/deploy/wasm-hashes.txt`, `contract/deploy/wasm-size-report.md` | See `.github/workflows/contract-build.yml` |

Example filenames: `tycoon_main_game.wasm`, `tycoon_game.wasm`, `tycoon_token.wasm`, etc. (see `ci/wasm-size-budget.json`).

## 🧪 Testing

Each contract includes unit tests. Prefer `make test` (same as CI); or:

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

## ⏱️ Time-Based Logic

See [docs/TIME_BASED_LOGIC.md](docs/TIME_BASED_LOGIC.md) for:

- Which time source (ledger sequence vs timestamp) is authoritative for each contract
- Drift assumptions and when each is acceptable
- Game design alignment (how backend converts durations to ledger counts)
- Edge-case boundary conditions and where they are tested

## 🔗 Dependencies

All contracts use Soroban SDK v23 as specified in the workspace `Cargo.toml`.

## 📝 License

MIT
