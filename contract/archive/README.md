# Archive Directory

This directory contains archived/experimental contracts that are **not** part of the main workspace.

## Contents

- **hello-world**: Sample Soroban contract (archived for reference only)

## Note

These contracts are marked as experimental/archived and are excluded from:
- Default workspace builds
- CI/CD pipelines
- Production deployments

They are kept here for reference and educational purposes only.

For production contracts, see the `contracts/` directory.

## CI exclusion

Archive crates are intentionally **excluded from CI**. The contract CI workflow
(`.github/workflows/contract-ci.yml`) scopes its build, test, clippy, and fmt
steps to the main workspace only, so nothing under `contract/archive/` is
compiled, linted, or tested on pull requests. This keeps CI fast and avoids
failing the pipeline on experimental code that is not shipped.

Exclusion is enforced purely through CI configuration; the crates remain valid
workspace members in `contract/Cargo.toml` so they can still be built locally.

### Building and testing archive crates locally

Run these from the `contract/` directory. They are **not** executed by CI, so
run them manually before touching archived code:

```bash
# Build the archive crate
cargo build -p hello-world

# Run its tests
cargo test -p hello-world

# Lint and format-check it
cargo clippy -p hello-world --all-targets -- -D warnings
cargo fmt -p hello-world -- --check
```

If you add a new archive crate, keep it out of the CI workflow's scope and add
its package name to the commands above so contributors can still exercise it
locally.
