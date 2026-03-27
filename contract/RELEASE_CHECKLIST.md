# Soroban Contract Release Checklist

This guide covers the steps required for a safe deployment of the contract crates.

## Pre-Release Phase
1. [ ] All tests in `contract/integration-tests/` pass.
2. [ ] All contract crate unit tests pass (`cargo test`).
3. [ ] WASM size check (`contract/scripts/check-wasm-sizes.sh`) - within budget.
4. [ ] `CHANGELOG.md` updated for each crate.

## Deployment Phase (Testnet)
1. [ ] Build optimized WASM binaries (`make build`).
2. [ ] Deploy to Testnet using `contract/scripts/deploy.sh`.
3. [ ] Verify deployment using `contract/scripts/verify-deploy.sh`.
4. [ ] Capture WASM hash and update `contract/deploy/deployed-contracts-testnet.txt`.

## Post-Deployment Validation
1. [ ] Run integration tests against Testnet state.
2. [ ] Confirm frontend compatibility.
3. [ ] Perform state migration (if version has changed).

## Finalizing Release
1. [ ] Tag the commit with the format `v<major>.<minor>.<patch>-testnet` (e.g., `v0.1.0-testnet`).
2. [ ] Record the tag and corresponding WASM hashes in the release notes.
