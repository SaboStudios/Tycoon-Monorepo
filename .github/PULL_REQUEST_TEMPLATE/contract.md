# Contract PR Checklist

> Scope: `contract/*` Soroban workspace (soroban-sdk v23). Complete every item or explain why it does not apply.

## Workspace & SDK alignment

- [ ] Crate APIs match the `contract/README.md` roadmap and target `soroban-sdk` v23 (no mixed SDK versions across `contract/*`).
- [ ] `contract/Cargo.toml` workspace members build together: `cargo build --workspace` succeeds (no partial workspace compile).
- [ ] `cargo test -p <crate>` passes for every touched crate.

## Auth & authorization

- [ ] `AUTH_MATRIX` rows updated for every new/changed entrypoint (caller, required auth, role, effect).
- [ ] Negative auth tests added that do **not** use `mock_all_auths` (missing/expired/forbidden auth must fail closed).
- [ ] Admin-only / sensitive entrypoints are deny-by-default and explicitly authorized.

## Storage & economics

- [ ] `STORAGE_ECONOMICS` respected: TTL bumps, rent, and entry sizes accounted for on new persistent/temporary storage.
- [ ] `contract/ci/wasm-size-budget.json` budget held; wasm size CI job green.
- [ ] All amount math uses checked arithmetic (no unchecked overflow on balances/payouts).

## Events

- [ ] Stable, versioned events emitted for any indexer/backend consumer (topics + payload documented).
- [ ] Event payloads avoid PII and secrets; no spoofable/unauthenticated event emission.

## Stellar UI gating

- [ ] No ungated Stellar UI claims; Stellar surfaces stay behind the deploy checklist / deny-list until gated ready (NEAR-only per ADR-003).

## CI & acceptance

- [ ] CI contract jobs green (build, `cargo test`, wasm size budget).
- [ ] Integration tests updated where applicable.
- [ ] No secrets or keys committed; logs/telemetry redacted.

## Rollback

- [ ] Risky changes landed behind a flag with rollback notes below.

<!-- Rollback notes: -->
