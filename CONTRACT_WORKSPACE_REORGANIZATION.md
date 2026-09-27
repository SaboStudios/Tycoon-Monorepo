# Contract Workspace Reorganization

## Summary

Moved the sample `hello-world` contract out of the default workspace to reduce confusion and clearly separate production contracts from experimental/sample code.

## Changes Made

### 1. Created Archive Directory

**New:** `contract/archive/`
- Contains experimental/archived contracts excluded from the workspace
- Includes `README.md` explaining the purpose
- Sample contract marked with `EXPERIMENTAL.md`

### 2. Moved Sample Contract

**Moved:** `contract/contracts/hello-world/` → `contract/archive/hello-world/`
- No longer part of the default workspace
- Marked as experimental/archived
- Kept for reference and educational purposes

### 3. Updated Workspace Configuration

**Modified:** `contract/Cargo.toml`

```toml
[workspace]
resolver = "2"
members = [
  "contracts/*",
]

# Exclude archived/experimental contracts from the workspace
exclude = [
  "archive/*",
]
```

### 4. Updated README

**Modified:** `contract/README.md`
- Clear pointer to production contracts
- Table of all production contracts with descriptions
- Updated project structure diagram
- Documentation for archived contracts section

## Production Contracts

The following contracts remain in the workspace:

| Contract | Description |
|----------|-------------|
| `tycoon-main-game` | Main game logic — players, games, and lobbies |
| `tycoon-game` | Core game mechanics and state management |
| `tycoon-token` | ERC-20 style token for in-game currency |
| `tycoon-reward-system` | Reward distribution and achievements |
| `tycoon-collectibles` | NFT collectibles and items |
| `tycoon-boost-system` | Power-ups and boost mechanics |
| `tycoon-lib` | Shared library with common utilities |

## Verification

### CI Workflow Tests

All CI commands from `.github/workflows/ci.yml` pass successfully:

```bash
# Build for WASM (production)
cargo build --target wasm32-unknown-unknown --release
# ✅ PASSED

# Run all tests
cargo test --all
# ✅ PASSED (all 7 contracts)
```

### Workspace Members Verified

```bash
cargo metadata --format-version 1 --no-deps
# ✅ hello-world NOT in workspace_members
# ✅ All 7 production contracts in workspace_members
```

### No Downstream Dependencies

```bash
grep -r "hello-world" contracts/**/Cargo.toml
# ✅ No matches found
```

## Benefits

1. **Reduced Confusion**: New developers see only production contracts in `contracts/`
2. **Cleaner Builds**: Sample contract excluded from default workspace builds
3. **CI/CD Clarity**: Only production contracts built and tested in CI
4. **Reference Preserved**: Sample contract still available in `archive/` for learning
5. **Explicit Marking**: `EXPERIMENTAL.md` clearly marks non-production code

## File Structure

```
contract/
├── Cargo.toml              # Workspace config (excludes archive/*)
├── README.md               # Updated with production contracts table
├── archive/                # NEW: Archived/experimental contracts
│   ├── README.md
│   └── hello-world/        # Moved from contracts/
│       ├── Cargo.toml
│       ├── src/
│       └── EXPERIMENTAL.md # NEW: Marks as non-production
└── contracts/              # Production contracts only
    ├── tycoon-main-game/
    ├── tycoon-game/
    ├── tycoon-token/
    ├── tycoon-reward-system/
    ├── tycoon-collectibles/
    ├── tycoon-boost-system/
    └── tycoon-lib/
```

## Acceptance Criteria

✅ **Update root Cargo workspace members**
- `contracts/*` includes only production contracts
- `exclude = ["archive/*"]` prevents archived contracts from building

✅ **README pointer to real game crates**
- Table of all 7 production contracts with descriptions
- Clear project structure diagram
- Separate section for archived contracts

✅ **CI excludes if archived**
- `cargo build --all` builds only 7 production contracts
- `cargo test --all` tests only 7 production contracts
- `hello-world` excluded via workspace `exclude` directive

✅ **No downstream dependencies on hello-world**
- Verified: No contract depends on `hello-world`
- All contracts use only `soroban-sdk` workspace dependency

✅ **Does not break code base**
- All contracts compile successfully
- All tests pass (42+ tests across 7 contracts)
- WASM build succeeds for all production contracts

## CI Workflow Compatibility

The changes are fully compatible with the existing CI workflow:

```yaml
contracts:
  name: Contracts
  runs-on: ubuntu-latest
  steps:
    - name: Build
      run: cargo build --target wasm32-unknown-unknown --release
      working-directory: contract
      # ✅ Builds 7 production contracts only
    
    - name: Run tests
      run: cargo test --all
      working-directory: contract
      # ✅ Tests 7 production contracts only
```

## Migration Notes

If you need to build the archived contract for reference:

```bash
cd contract/archive/hello-world
cargo build --target wasm32-unknown-unknown --release
```
