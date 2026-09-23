# Contract WASM Bump — Environment Variables

This document is the source of truth for the environment variables consumed by the
contract WASM bump / release build process. The process is scripted in
[`contract/scripts/wasm-bump.sh`](../scripts/wasm-bump.sh) and is used both locally
and in CI (`.github/workflows/contract-build.yml`).

Run it from the `contract/` directory:

```bash
cd contract
./scripts/wasm-bump.sh
```

The script validates every variable below, builds the release WASM, and then
enforces the WASM size budget from [`ci/wasm-size-budget.json`](../ci/wasm-size-budget.json).
It **fails closed**: any missing required variable, build failure, or budget
overrun exits non-zero and blocks the bump.

## Variables

| Name | Required | Default | Purpose | Example |
|------|----------|---------|---------|---------|
| `WASM_BUMP_TARGET` | No | `wasm32-unknown-unknown` | Rust target triple used for the release build. | `wasm32-unknown-unknown` |
| `WASM_BUMP_PROFILE` | No | `release` | Cargo profile for the build. | `release` |
| `WASM_BUMP_BUDGET_FILE` | No | `ci/wasm-size-budget.json` | Path (relative to `contract/`) to the WASM size budget. | `ci/wasm-size-budget.json` |
| `WASM_BUMP_SIZE_REPORT` | No | `deploy/wasm-size-report.md` | Where the size report is written. | `deploy/wasm-size-report.md` |
| `WASM_BUMP_HASHES_FILE` | No | `deploy/wasm-hashes.txt` | Where the SHA-256 list is written. | `deploy/wasm-hashes.txt` |
| `WASM_BUMP_STRICT` | No | `1` | When `1`, budget overrun is a hard failure. Set `0` only for local exploration. | `1` |
| `WASM_BUMP_JOBS` | No | (cargo default) | Passed through as `--jobs` to `cargo build`. | `4` |
| `WASM_BUMP_VERBOSE` | No | `0` | When `1`, prints the resolved configuration before building. | `1` |

No secrets are required. Do not add tokens, keys, or credentials to this file or
the script; the bump process only reads public build inputs.

## Failure modes

- **Missing/invalid required input** — the script exits non-zero before building.
- **Build failure** — `cargo build` errors propagate; no artifacts are published.
- **Budget overrun** — when `WASM_BUMP_STRICT=1` (default) the script exits non-zero
  and prints the offending artifact(s), matching the CI wasm size job.
- **Missing budget file** — treated as a hard failure so CI cannot silently skip the check.

## CI parity

CI sets the same defaults and runs the same script, so a green local run implies a
green CI wasm size job. Keep this document and the script in sync when adding a
variable.
