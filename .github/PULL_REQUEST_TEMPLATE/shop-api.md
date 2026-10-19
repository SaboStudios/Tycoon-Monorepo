# Shop API PR

<!-- Scope: shop-api/ (purchases source of truth, ADR-001). Money path: never a good first issue. Security issues: report privately per SECURITY.md. -->

## Summary

<!-- What changes and why. "Closes #123". -->

## Changelog

<!-- Entry added under "## [Unreleased]" in shop-api/CHANGELOG.md, or: No changelog: <reason of at least 10 characters> -->

## Test plan

<!-- Commands + results, e.g. cd shop-api && npm run build && npm test -- --runInBand -->

## Rollback

<!-- Revert / flag / migration down-path. Note any in-flight purchase or idempotency-record impact. -->

## Shop API checklist

- [ ] Single write path preserved: no dual writes; backend `POST /shop/purchase` still proxies here
- [ ] `Idempotency-Key` required; concurrent duplicates return 409 or replay, never double-charge
- [ ] Inventory and balance updates are atomic (one transaction) and fail closed on DB errors
- [ ] Idempotency keys and tokens masked in logs; no DB errors or stack traces in HTTP responses
- [ ] Endpoints authenticated, authorized, and rate-limited
- [ ] DTO and schema mappings documented; migrations reversible
