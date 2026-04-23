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