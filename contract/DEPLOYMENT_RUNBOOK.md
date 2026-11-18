# Deployment Runbook

This runbook describes how to deploy the Tycoon contracts and what operators must do after a deploy.

## Contracts

- `tycoon-reward-system`
- `tycoon-main-game`
- `tycoon-token`

## Deploy

1. Build the contracts with `cargo build --release --target wasm32-unknown-unknown`.
2. Deploy each contract and record its contract ID.
3. Call `initialize` on each contract exactly once with the admin address and initial configuration.

## Post-deploy

There is no `migrate` entry point on `tycoon-reward-system` or `tycoon-main-game`.
`initialize` writes the current storage version, so no post-deploy migration call is
required or possible. Do not schedule a `migrate` call after deploy; it does not exist
and would fail.

If a future release introduces a real storage-version step, this runbook will be
updated with the exact `migrate` invocation and the version it upgrades from.

## Upgrades

Upgrading a contract replaces its WASM. Because the current contracts have no
`migrate` entry point, only deploy an upgrade when the new WASM is storage-compatible
with the existing state. Otherwise, plan a state export/import instead of relying on a
migration call.
