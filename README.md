# Tycoon Monorepo

Tycoon is a Monorepo containing the frontend (Next.js 16 / React 19), backend
(NestJS 11), shop-api (NestJS purchases source of truth), and Soroban contract
scaffolding. NEAR wallet is the only supported chain UI per ADR-003 until Stellar
is gated ready.

## Visual regression (Chromatic)

Chromatic baselines cover the wallet, join, and shop stories. Stories for these
surfaces must use deterministic props and mocks so snapshots stay stable across
runs.

### Configuration

- The Chromatic project token is provided via the `CHROMATIC_PROJECT_TOKEN`
  environment variable / CI secret. Never commit the token to the repository.
- Chromatic runs as part of the frontend CI workflow on pull requests and on the
  main branch.

### Baseline approval workflow

1. Open the Chromatic build linked from the pull request checks.
2. Review each visual diff for the wallet, join, and shop stories.
3. Accept changes that are intentional; reject (or fix the story) when the diff
   is unintended.
4. Accepted changes become the new baseline for subsequent builds.

See `frontend/docs/CHROMATIC_BASELINES.md` for the authoritative baseline
guidance.
