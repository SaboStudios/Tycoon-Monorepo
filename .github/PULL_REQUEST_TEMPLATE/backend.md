# Backend PR

<!-- Scope: backend/ (NestJS 11). Security issues: report privately per SECURITY.md. -->

## Summary

<!-- What changes and why. "Closes #123". -->

## Changelog

<!-- Entry added under "## Unreleased" in backend/CHANGELOG.md (breaking API changes need a new API version, see its Policy section), or: No changelog: <reason of at least 10 characters> -->

## Test plan

<!-- Commands + results, e.g. cd backend && npm test && npm run test:e2e -->

## Rollback

<!-- Revert / flag / migration down-path and order of operations. -->

## Backend checklist

- [ ] Every new or changed endpoint is authenticated, authorized (role checked), rate-limited, and deny-by-default
- [ ] Input validated with strict DTOs; oversized and enumeration-style input rejected
- [ ] Writes fail closed when Postgres, Redis, shop-api, or RPC is down; retries are idempotent
- [ ] Purchases still flow only through shop-api (ADR-001) with the `Idempotency-Key` passed through
- [ ] Error responses follow docs/API_ERROR_RESPONSE_STANDARDS.md; no stack traces or secrets in responses/logs
- [ ] Migrations are reversible and safe for partial or canary rollout
- [ ] Health and readiness probes still reflect real dependency state
