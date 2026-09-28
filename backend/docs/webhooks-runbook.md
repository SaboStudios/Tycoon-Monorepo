# Webhooks & Agent-vs-Agent Callback Runbook

Operational guide for outbound webhook delivery and inbound agent-vs-agent
HMAC callbacks. Covers SSRF protections, signature verification, authz,
idempotency, fail-closed behavior, and rollback.

Related sources of truth:

- `docs/API_ERROR_RESPONSE_STANDARDS.md` — error codes and response shape.
- `backend/docs/ADR-002-games-realtime-transport.md` — realtime transport invariants.
- `backend/docs/GAMES_MATCHMAKING_RUNBOOK.md` — matchmaking/agent lifecycle.

## Invariants

1. The server is the source of truth for money, dice, inventory, and admin
   mutations. Callbacks never grant authority; they only notify.
2. Every inbound callback is authenticated (HMAC) and authorized (API-key/JWT/
   AdminGuard) before any state change. Deny-by-default for new surfaces.
3. Every outbound callback URL is validated against an SSRF deny-list before
   the request is sent, and the resolved IP is re-checked to prevent DNS
   rebinding.
4. Money-adjacent writes are idempotent and fail-closed on dependency outage.
5. No secrets in logs. Redact signatures, tokens, and PII from telemetry.

## Outbound callback SSRF protections

Outbound agent-vs-agent callbacks MUST pass URL validation before dispatch.
Deny-by-default rules:

- Scheme allowlist: `https` only in production; `http` permitted only when
  `WEBHOOKS_ALLOW_INSECURE_HTTP=true` in non-production environments.
- Block loopback: `127.0.0.0/8`, `::1`, `localhost`, `*.localhost`.
- Block private ranges: `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`,
  `fc00::/7`.
- Block link-local: `169.254.0.0/16`, `fe80::/10`.
- Block cloud metadata endpoints: `169.254.169.254`, `fd00:ec2::254`,
  `metadata.google.internal`, `metadata.goog`.
- Block unspecified/broadcast: `0.0.0.0/8`, `255.255.255.255`.
- Reject non-standard ports unless explicitly allowlisted per tenant.
- Resolve DNS and re-validate every resolved IP against the deny-list before
  connecting (prevents DNS rebinding). Pin the resolved IP for the request.
- Do not follow redirects to a different host; re-validate on any redirect.

On rejection, emit a structured log with `requestId`, `correlationId`,
`tenantId`, and the deny reason (never the raw URL if it may contain secrets).
Return error code `WEBHOOK_URL_FORBIDDEN` per
`docs/API_ERROR_RESPONSE_STANDARDS.md`.

## Inbound HMAC verification

Inbound agent-vs-agent callbacks MUST be verified before processing:

- Require the signature header (e.g. `X-Tycoon-Signature`). Missing header →
  `WEBHOOK_SIGNATURE_MISSING` (401).
- Compute HMAC over the raw request body using the per-agent shared secret.
- Compare with a timing-safe comparison (`crypto.timingSafeEqual`). Invalid →
  `WEBHOOK_SIGNATURE_INVALID` (401).
- Reject stale timestamps outside the replay window (default 5 minutes) →
  `WEBHOOK_TIMESTAMP_STALE` (401).
- Reject oversized payloads before HMAC (default 256 KiB) →
  `WEBHOOK_PAYLOAD_TOO_LARGE` (413).
- Never log the raw signature or shared secret.

## Authz on the callback entrypoint

- The callback route is deny-by-default. It requires a valid API key scoped to
  the agent, or a JWT with the `agent:callback` scope; admin-only operations
  additionally require `AdminGuard`.
- Untrusted clients cannot bypass server authority: the callback only triggers
  server-side reconciliation, never direct money/dice/inventory mutation.
- Forbidden role → `FORBIDDEN` (403). Expired auth mid-flow → `UNAUTHORIZED`
  (401) with `requestId` for correlation.

## Idempotency & fail-closed

- Every callback carries an idempotency key (`X-Idempotency-Key` or the agent
  event id). Duplicate/concurrent deliveries and reconnect retries are deduped
  in Redis with a TTL; the first writer wins and later duplicates return the
  cached result.
- Money-adjacent writes fail-closed: if Postgres/Redis/shop-api/RPC is
  unavailable, reject the write with `DEPENDENCY_UNAVAILABLE` (503) and do not
  partially apply state. Retries are safe due to idempotency keys.
- Partial migration/canary: when dual systems exist, route by feature flag and
  keep both paths idempotent.

## Observability

- Emit metrics: `webhook_outbound_total{result}`, `webhook_inbound_total{result}`,
  `webhook_ssrf_blocked_total{reason}`, `webhook_idempotent_replay_total`.
- Logs include `requestId`/`correlationId`; never include secrets or PII.

## Feature flags / kill switches

- `WEBHOOKS_AGENT_CALLBACKS_ENABLED` — master kill switch for agent-vs-agent
  callbacks. When off, inbound callbacks return `SERVICE_DISABLED` (503) and
  outbound dispatch is skipped.
- `WEBHOOKS_ALLOW_INSECURE_HTTP` — non-production only; never enable in prod.
- `WEBHOOKS_SSRF_STRICT` — when on, enforce the full deny-list and DNS
  re-validation (default on in production).

## Rollback

1. Flip `WEBHOOKS_AGENT_CALLBACKS_ENABLED=false` to stop inbound/outbound
   callback processing without a deploy.
2. If SSRF validation causes false positives, temporarily relax via
   `WEBHOOKS_SSRF_STRICT=false` only in non-production; production requires a
   follow-up allowlist entry instead.
3. Revert the PR if needed; idempotency keys make replay safe after rollback.

## Manual checklist (NEAR wallet / game flows)

- [ ] Agent-vs-agent match completes with callbacks delivered and verified.
- [ ] Duplicate callback delivery does not double-apply state.
- [ ] Callback to a private/metadata IP is blocked and logged.
- [ ] Missing/invalid signature is rejected with the documented error code.
- [ ] Dependency outage fails closed with `DEPENDENCY_UNAVAILABLE`.
