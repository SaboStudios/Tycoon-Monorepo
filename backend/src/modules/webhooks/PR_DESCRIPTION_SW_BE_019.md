# SW-BE-019: Webhooks & Signatures — Observability

## Summary

This change improves webhook observability for the backend by adding structured trace correlation for signature verification and webhook processing events. The goal is to make webhook failures and duplicate deliveries easier to investigate without exposing sensitive values in logs.

## What changed

- Added optional trace/request id propagation through webhook verification and processing flows.
- Extended webhook observability logging with request correlation metadata while preserving secret sanitization.
- Added regression tests covering successful and failed signature verification paths as well as idempotency and processing failures.
- Kept the change scoped to the backend webhook module and backward-compatible for existing callers.

## Why this matters

Webhook handlers are security-sensitive and operationally important. Better observability helps operators quickly answer:

- whether a webhook passed signature verification,
- how long verification and processing took,
- whether the webhook was a duplicate, and
- which request/trace identifier to correlate with upstream traffic.

## Testing

Verified with:

- `pnpm exec jest --runInBand src/modules/webhooks/webhooks.service.spec.ts src/modules/webhooks/webhooks-observability.service.spec.ts`

## Rollout / migration notes

- No schema changes are required.
- No secrets are logged; webhook payloads remain sanitized.
- Existing webhook consumers remain compatible. Optional trace headers such as `x-trace-id`, `x-request-id`, or `traceparent` are now used when present.

## Notes

closes #63
