# WASM size budget (Tycoon contracts)

## Why this exists

On Soroban/Stellar, **WASM bytecode size** contributes to **deployment cost** and **resource limits**. We track **release** artifact size per contract and **fail CI** when a contract grows more than the allowed percentage vs the last committed baseline—so regressions are visible on every PR.

## Threshold (documented)

| Setting | Value |
|--------|--------|
| **Regression limit** | **3%** over `baseline_bytes` per contract (see `ci/wasm-size-budget.json`) |
| **Baseline file** | `contract/ci/wasm-size-budget.json` |
| **Release profile** | Workspace `contract/Cargo.toml`: `opt-level = "z"`, `debug = 0`, `strip = "symbols"`, `lto = true` |

## PR expectations

- The **contract** workflow appends a **markdown table** to the GitHub Actions **job summary** (and PR comment where configured): baseline vs current, delta, and pass/fail.
- If you **intentionally** increase WASM size (new features), update **`baseline_bytes`** for that `.wasm` in `wasm-size-budget.json` in the **same PR** and note why in the PR description.

## Contracts tracked

One entry per deployable `cdylib` artifact under `target/wasm32-unknown-unknown/release/`:

- `tycoon_boost_system.wasm`
- `tycoon_token.wasm`
- `tycoon_reward_system.wasm`
- `tycoon_main_game.wasm`
- `tycoon_game.wasm`
- `tycoon_collectibles.wasm`

`tycoon-lib` is a shared **library** crate only (no WASM). Integration tests do not emit WASM.

## Local check

```bash
cd contract
cargo build --target wasm32-unknown-unknown --release
./scripts/check-wasm-sizes.sh
```

## Updating baselines after a deliberate shrink

If sizes **decrease**, you may lower `baseline_bytes` to lock in the improvement (optional but encouraged).
