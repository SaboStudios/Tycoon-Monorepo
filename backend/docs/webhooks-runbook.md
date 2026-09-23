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
- `webhook_sig_fail` — signature verification failure counter by source (metric name: `webhook_sig_fail`, labels: `source`)
- Idempotency hit rate (duplicate webhook detection)
- Processing latency

### Observability Checklist
- [x] Signature verification integration test coverage (invalid-signature path proven rejected with 401)
- [x] Idempotent replay test coverage (same event ID replayed as safe no-op)
- [x] `webhook_sig_fail` metric added for signature verification failures by source
- [x] No raw secrets logged (sanitized context, constant-time comparison)
- [x] OpenTelemetry instrumentation in place (prom-client Histogram/Counter metrics)

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

## Monetization Webhook Idempotency

### Overview
The monetization payment webhook (`POST /monetization/webhooks/payment`) enforces event idempotency using the `webhook_events` table with a composite unique constraint on `(eventId, source)`. This ensures duplicate provider deliveries (e.g., Stripe retries) cannot double-credit a user's wallet.

### Mechanism
1. **Check and Insert**: On each payment webhook delivery, before processing, the system attempts to insert a record into `webhook_events` with the provider's event ID and source.
2. **Unique Constraint Enforcement**: If the event ID + source already exists, the database unique constraint triggers, and the application catches this specific error (PostgreSQL error code 23505).
3. **Graceful Dedupe**: A duplicate event returns `{ ok: true, status: 'idempotent' }` without calling the reward engine or updating purchase status.
4. **Race Safety**: The DB-level constraint handles concurrent duplicate deliveries atomically — the second insert attempt will fail, not both succeeding and causing double-processing.

### Separate Mechanism: Shop Purchase Idempotency
Shop purchases use a separate idempotency mechanism via the `Idempotency-Key` HTTP header (interceptor-based) at `POST /shop/purchase`. This is completely independent of webhook event deduplication and continues to work unchanged.

### Troubleshooting Duplicate Events
If a wallet is credited twice despite this mechanism:
1. Check `webhook_events` table for the event ID — if present, the duplicate detection worked.
2. Check purchase status and `transaction_id` — if `status='completed'` with two different transaction IDs, the webhook was processed twice despite our guards.
3. Verify the unique constraint exists: `SELECT constraint_name FROM information_schema.table_constraints WHERE table_name='webhook_events' AND constraint_type='UNIQUE';`

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

### Secret Management
- Webhook secrets stored in secure environment variables
- No secrets logged in application logs
- Regular secret rotation procedure

### Rate Limiting
- Implement rate limiting at infrastructure level
- Monitor for abuse patterns
- Block suspicious IP addresses

### Audit Logging
- All webhook attempts logged with request ID
- Sensitive data redacted from logs
- Logs retained for security analysis