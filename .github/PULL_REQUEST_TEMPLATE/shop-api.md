## Description

<!-- What does this PR change and why? Link the issue: Closes #NNNN -->

## CI Summary

<!--
Paste the output of the relevant CI command (e.g. npm test, npm run build).
All checks must be green before requesting review.
-->

```
$ npm test
<output here>
```

## Idempotency / Money-Path Checklist

> Required for any PR touching `shop-api/src/purchases/` or `shop-api/src/idempotency/`.

- [ ] `Idempotency-Key` header is validated before the handler runs (`IdempotencyKeyGuard`)
- [ ] Duplicate key returns `409` — no second write is attempted
- [ ] Replay path returns the cached response body verbatim (no re-execution)
- [ ] `FAILED` keys are cleaned up so the client can retry with the same key
- [ ] No secrets, stack traces, or raw DB errors reach HTTP responses
- [ ] No secret values are printed to logs (keys masked as `****xxxx`)
- [ ] Transaction wraps the purchase insert; idempotency key marked `COMPLETED` only after commit

## General Checklist

- [ ] CI passes locally (output pasted above)
- [ ] Tests added or updated for changed behaviour
- [ ] No regressions in related purchase/idempotency flows
- [ ] Documentation updated where APIs or contracts changed
- [ ] PR title follows `feat|fix|chore|docs(scope): summary [#issue]`

## Links

- Idempotency design: [`shop-api/PR-NOTES.md`](../shop-api/PR-NOTES.md)
- Operational runbook: [`backend/docs/SHOP_PURCHASES_RUNBOOK.md`](../backend/docs/SHOP_PURCHASES_RUNBOOK.md)
- Architecture decision: [`backend/docs/ADR-001-shop-purchase-ownership.md`](../backend/docs/ADR-001-shop-purchase-ownership.md)
