# Webhooks Operational Runbook

## Overview
This runbook covers operational procedures for managing webhooks in the Tycoon backend system, including monitoring, troubleshooting, and maintenance tasks.

## Monitoring

### Health Checks
- Webhook endpoints are monitored via `/health` endpoint
- Redis connectivity is checked for idempotency storage
- Signature verification failures are logged and alerted

### Key Metrics
- Webhook processing rate
- Signature verification success/failure ratio
- Idempotency hit rate (duplicate webhook detection)
- Processing latency

### Alerts
- High rate of signature verification failures (>5% in 5 minutes)
- Redis connectivity issues
- Webhook processing queue backlog

## Troubleshooting

### Common Issues

#### Signature Verification Failures
**Symptoms:**
- 401 Unauthorized responses
- Logs showing "Invalid webhook signature"

**Causes:**
- Incorrect webhook secret configuration
- Clock skew between webhook provider and server
- Malformed signature header

**Resolution:**
1. Verify WEBHOOK_SECRET environment variable matches provider configuration
2. Check server time synchronization
3. Validate signature header format (hex-encoded HMAC)

#### Idempotency Failures
**Symptoms:**
- Duplicate processing of webhooks
- Redis connection errors in logs

**Causes:**
- Redis service unavailable
- Webhook payload missing ID field
- TTL expiration of idempotency keys

**Resolution:**
1. Check Redis service health
2. Ensure webhook payloads include unique ID
3. Monitor idempotency key TTL (7 days default)

#### High Latency
**Symptoms:**
- Webhook processing taking >5 seconds
- Queue backlog building

**Causes:**
- Database connection issues
- Heavy processing load
- Network latency to external services

**Resolution:**
1. Check database connection pool
2. Review webhook processing logic for optimizations
3. Scale webhook processing workers if needed

## Maintenance

### Secret Rotation
1. Generate new webhook secret
2. Update provider configuration with new secret
3. Update WEBHOOK_SECRET environment variable
4. Deploy changes
5. Verify webhook processing continues
6. Remove old secret after grace period

### Redis Maintenance
- Monitor Redis memory usage for idempotency keys
- Configure Redis persistence for webhook data
- Set up Redis cluster for high availability

### Log Analysis
- Review webhook processing logs for patterns
- Monitor for unusual webhook sources
- Track webhook event type distribution

## Rollout Procedures

### Feature Flag Deployment
Webhooks features use feature flags for gradual rollout:

1. Deploy code with feature flag checks
2. Enable feature flag in staging environment
3. Test webhook processing with flag enabled
4. Gradually enable in production (canary deployment)
5. Monitor metrics and error rates
6. Fully enable or rollback based on results

### Backward Compatibility
- All webhook changes maintain backward compatibility
- New validation rules are additive
- Idempotency is transparent to webhook providers

## Security Considerations

### Signature Verification and Replay-Window

Every inbound webhook is authenticated with an HMAC-SHA256 signature computed over `<timestamp>.<raw-body>`.

| Property | Value |
|---|---|
| Algorithm | HMAC-SHA256 |
| Header – signature | `X-Stripe-Signature` (hex-encoded) |
| Header – timestamp | `X-Stripe-Timestamp` (Unix seconds) |
| Replay window | **300 seconds (5 minutes)** |
| Comparison | `crypto.timingSafeEqual` (constant-time) |

Requests are rejected (HTTP 401) when:
1. Either header is missing or the raw body is empty.
2. The timestamp is non-numeric or `|now - timestamp| > 300 s` — this covers both *stale* replays and *future-dated* forgeries.
3. The signature length does not match the expected HMAC length.
4. The HMAC values do not match.

All rejections are logged via the observability service and written to the audit log, so failed signature attempts are fully traceable.

### Replay Protection (Nonce / Event-ID Idempotency)

Timestamp freshness alone is not sufficient: a captured request can be replayed within the 300 s window. Every accepted request must therefore also carry a unique identifier that is recorded and checked atomically.

| Property | Value |
|---|---|
| Header – event id | `X-Stripe-Event-Id` (or `id` field in the JSON body) |
| Store | Redis (`WEBHOOK_IDEMPOTENCY_*` keys) |
| TTL | 7 days (matches idempotency key retention) |
| Operation | `SET key 1 NX EX <ttl>` — atomic set-if-absent |

Behavior:
1. If the event id is missing, the request is rejected (HTTP 400) — deny-by-default.
2. If `SET NX` reports the key already exists, the request is a duplicate and is rejected (HTTP 409) without re-processing.
3. If Redis is unreachable, the request **fails closed** (HTTP 503) — never process a webhook whose replay status cannot be verified.
4. The key is written *before* side effects run, so concurrent duplicate deliveries race on a single atomic `SET NX` and only one wins.

### Fail-Closed Matrix

| Dependency | State | Webhook behavior |
|---|---|---|
| `WEBHOOK_SECRET` | unset/empty | Reject all (401); boot check fails in production |
| Redis | down | Reject writes (503); no side effects |
| Postgres | down | Reject writes (503); no side effects |
| shop-api | down | Reject writes (503); no side effects |

### Secret Management
- Webhook secrets stored in secure environment variables
- No secrets logged in application logs
- Regular secret rotation procedure
- `.env.example` contains placeholders only — never real secrets

### Rate Limiting
- Implement rate limiting at infrastructure level
- Monitor for abuse patterns
- Block suspicious IP addresses

### Audit Logging
- All webhook attempts logged with request ID
- Sensitive data redacted from logs
- Logs retained for security analysis

## Operator Quick Reference

### Verify a webhook signature locally

```bash
# Compute the expected signature for a captured request (no secrets echoed)
printf '%s.%s' "$TS" "$BODY" \
  | openssl dgst -sha256 -hmac "$WEBHOOK_SECRET" -hex
```

### Inspect replay-protection keys

```bash
# Count tracked event ids (should grow with traffic, never shrink within TTL)
redis-cli --scan --pattern 'WEBHOOK_IDEMPOTENCY_*' | wc -l

# Check a specific event id
redis-cli EXISTS "WEBHOOK_IDEMPOTENCY_<event-id>"
```

### Validate compose config before deploy

```bash
docker compose -f backend/docker-compose.yml config >/dev/null && echo "compose OK"
```

### Rollback / Order of Operations

1. **Disable** the webhook feature flag (stop new deliveries) before any rollback.
2. Drain in-flight requests; confirm queue backlog is zero.
3. Revert the deployment to the previous image.
4. If the replay store must be cleared, delete `WEBHOOK_IDEMPOTENCY_*` keys **only** after confirming no provider retries are pending — clearing keys re-opens the replay window for those events.
5. Re-enable the feature flag and watch signature-failure and duplicate-rejection metrics.
