# Tycoon Soroban Contracts

Soroban smart contracts for the Tycoon monorepo, built against **soroban-sdk v23**.

## Workspace layout

```
contract/
├── Cargo.toml                 # workspace manifest (soroban-sdk v23)
├── README.md                  # this file
├── ci/
│   └── wasm-size-budget.json  # per-crate wasm size budget enforced in CI
└── contracts/
    └── <crate>/               # one crate per contract
```

Each crate under `contracts/*` is a workspace member. Crate APIs are expected to
track the roadmap below and the `soroban-sdk` v23 surface; do not pin older SDK
lines or vendor SDK types into crate public APIs.

## Roadmap / API alignment

- Target `soroban-sdk = "23"` for every crate; keep the workspace dependency
  single-sourced in `contract/Cargo.toml`.
- Public entrypoints use SDK-native types (`Address`, `Env`, `Symbol`, `Bytes`,
  `i128`/`u128`) and return `Result<T, ContractError>` rather than panicking.
- All arithmetic on balances, payouts, and counters uses checked operations
  (`checked_add`, `checked_sub`, `checked_mul`, `checked_div`) and maps overflow
  to an explicit error variant.
- Storage keys are explicit enums/structs with `#[contracttype]`; no ad-hoc
  string keys.
- Events are emitted through `env.events().publish(...)` with stable topic
  tuples (see *Events* below) so indexers and backend consumers can rely on them.

## AUTH_MATRIX

Every state-changing entrypoint must be authorized. The matrix below is the
source of truth; update it in the same PR that adds or changes an entrypoint.

| Entrypoint            | Caller            | Auth mechanism                          | Notes                                             |
| --------------------- | ----------------- | --------------------------------------- | ------------------------------------------------- |
| `initialize`          | deployer / admin  | `admin.require_auth()`                  | Callable once; re-init must fail closed.          |
| `set_admin`           | current admin     | `admin.require_auth()`                  | Admin-only; emits `admin_changed`.                |
| `mint` / `issue`      | admin             | `admin.require_auth()`                  | Admin-only; checked supply arithmetic.            |
| `transfer`            | token holder      | `from.require_auth()`                   | Holder-authorized; checked balance arithmetic.    |
| `payout`              | admin / treasury  | `admin.require_auth()`                  | Admin-only; unauthorized payout must fail closed. |
| `pause` / `unpause`   | admin             | `admin.require_auth()`                  | Admin-only; gates all writes while paused.        |
| read-only views       | anyone            | none                                    | Must not mutate storage or emit events.           |

Rules:

- Deny by default: a new entrypoint without an explicit matrix row and an
  `require_auth()` call is a review blocker.
- Negative tests must exercise the unauthorized path **without**
  `env.mock_all_auths()`, asserting the call fails with the expected auth error.
- Auth expiry mid-flow and forbidden-role access are covered by the same
  negative tests; do not rely on mocked auth to prove authorization.

## Events

Events are part of the public contract surface. Keep topics stable; additive
changes only, and document any new event in this section.

| Event            | Topics                          | Data                          |
| ---------------- | ------------------------------- | ----------------------------- |
| `admin_changed`  | `(Symbol("admin_changed"),)`    | `(old: Address, new: Address)`|
| `transfer`       | `(Symbol("transfer"), from)`   | `(to: Address, amount: i128)` |
| `payout`         | `(Symbol("payout"), to)`       | `(amount: i128)`              |
| `paused`         | `(Symbol("paused"),)`          | `bool`                        |

Consumers (indexer, backend) must treat unknown topics as forward-compatible
and ignore them rather than failing.

## Storage economics

- Follow `STORAGE_ECONOMICS` guidance: minimize persistent entries, prefer
  `temporary` for short-lived data, and extend TTLs explicitly on hot keys.
- Avoid unbounded iteration over storage in a single invocation; cap collection
  sizes and fail closed when a cap would be exceeded.
- Reject oversized payloads (e.g. `Bytes`/`Vec` inputs) before writing storage.

## CI

Contract jobs must stay green:

- `cargo test -p <crate>` for each workspace member, including auth negatives.
- `cargo build --target wasm32-unknown-unknown --release` for the workspace.
- **wasm size job**: each crate's release wasm must stay within
  `contract/ci/wasm-size-budget.json`. A budget overrun fails CI; shrink the
  contract or raise the budget with justification in the PR.
- Partial workspace compile is not acceptable: the whole `contracts/*`
  workspace must build, not just the crate under change.

## Stellar UI gating

Per ADR-003, NEAR is the only supported chain UI until Stellar is gated ready.
Do **not** add or re-enable Stellar-facing UI claims (buttons, copy, feature
flags) from contract work. Contract changes land behind the deploy checklist;
UI exposure is a separate, gated change and is deny-listed here.

## PR checklist

- [ ] Crate APIs align with this roadmap and `soroban-sdk` v23.
- [ ] `AUTH_MATRIX` updated for any new/changed entrypoint.
- [ ] Negative auth tests added **without** `env.mock_all_auths()`.
- [ ] Checked arithmetic on all money/counter paths; overflow maps to an error.
- [ ] Events documented above and topics kept stable.
- [ ] `STORAGE_ECONOMICS` respected; no unbounded storage iteration.
- [ ] wasm size within `contract/ci/wasm-size-budget.json`.
- [ ] No secrets or keys committed; no PII in event data.
- [ ] No ungated Stellar UI claims introduced.
- [ ] Rollback notes included if the change is risky.
