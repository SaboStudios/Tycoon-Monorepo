# Stellar Wave — Issue Backlog

This directory is a placeholder for the Stellar Wave issue tracking area.

## Where are the issues?

All Stellar Wave issues live on GitHub:

**[https://github.com/SaboStudios/Tycoon-Monorepo/issues](https://github.com/SaboStudios/Tycoon-Monorepo/issues)**

Filter by label to find issues by area:

| Label | Link |
|---|---|
| `frontend` | [issues?q=label%3Afrontend](https://github.com/SaboStudios/Tycoon-Monorepo/issues?q=is%3Aopen+label%3Afrontend) |
| `backend` | [issues?q=label%3Abackend](https://github.com/SaboStudios/Tycoon-Monorepo/issues?q=is%3Aopen+label%3Abackend) |
| `contract` | [issues?q=label%3Acontract](https://github.com/SaboStudios/Tycoon-Monorepo/issues?q=is%3Aopen+label%3Acontract) |
| `good first issue` | [issues?q=label%3A%22good+first+issue%22](https://github.com/SaboStudios/Tycoon-Monorepo/issues?q=is%3Aopen+label%3A%22good+first+issue%22) |

## Good-first-issue policy

Not every open issue is a good first issue. The `good first issue` label is reserved for
self-contained, low-risk work that a first-time contributor can complete without touching
money paths or security-sensitive surfaces.

**Qualifies as `good first issue`:**

- Docs, README, and comment-only fixes.
- Isolated UI copy, styling, or accessibility tweaks with no state or money impact.
- Test-only additions that do not change production behavior.
- Small, well-scoped refactors in non-money, non-auth modules.

**Never qualifies as `good first issue` (excluded):**

- Money-path code: payments, purchases, ledger/balance mutations, dice rolls, inventory
  mutations, and anything that changes the server as source of truth for value.
- Admin authorization, role checks, and deny-by-default surfaces.
- Security-sensitive work: auth, secrets handling, rate limiting, telemetry/PII.
- Hard or cross-cutting issues: migrations, infra/CI, contract (Soroban) changes, and
  anything requiring tribal knowledge or multi-service coordination.

These exclusions are enforced by CI (see below). If you are unsure whether an issue
qualifies, ask a maintainer before labeling it.

## Chain support (ADR-003)

NEAR wallet is the only supported chain UI until Stellar is gated ready per ADR-003.
Stellar Wave issues may target the `contract` (Soroban) scaffolding, but do **not** add or
advertise Stellar wallet UI in the frontend — that contradicts ADR-003. Any issue that
implies Stellar is a live, user-facing chain is out of policy and should be corrected.

## Enforcement (fail-closed)

A CI check fails closed when the `good first issue` label is applied to an issue that
touches a money-path or hard area. Run it locally with the same command CI uses:

```bash
# Requires the GitHub CLI (gh) authenticated against the repo.
# Fails (non-zero exit) if any open good-first-issue touches a denied path/label.
node scripts/check-good-first-issue-policy.mjs
```

Override the repo or token when testing:

```bash
GH_REPO=SaboStudios/Tycoon-Monorepo node scripts/check-good-first-issue-policy.mjs
```

## Operator notes: rollback / order of operations

1. Land the policy docs and the CI script together in one PR.
2. Enable the CI job as required on the default branch only after the script passes on
   the current backlog (remove the label from any offending issues first).
3. To roll back, revert the PR; the script is additive and does not mutate issues.
4. If the check blocks a legitimate issue, remove the `good first issue` label rather
   than weakening the deny-list.

## What this directory is not

There are no draft issue files in this directory. An earlier version of this README claimed 375 draft files split across `frontend/`, `backend/`, and `contract/` subfolders — that was inaccurate. No such files exist and no generator script is present in this repo.

If you are looking for the issue list to pick up work, use the GitHub issues link above.

## Contributing

See [CONTRIBUTING.md](../CONTRIBUTING.md) for how to pick up an issue and open a pull request.
See [SECURITY.md](../SECURITY.md) for how to report vulnerabilities.
