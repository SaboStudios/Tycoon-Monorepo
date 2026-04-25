# Webhooks & Signatures Observability

## Overview

This document describes the observability implementation for webhooks and signature verification in the Tycoon backend. The implementation provides comprehensive logging, metrics, and traces for webhook operations while maintaining security best practices.

## Features

### 1. Structured Logging

All webhook operations are logged with structured context:

- **Webhook Received**: Logs when a webhook is received with source and event type
- **Signature Verification**: Logs verification attempts with success/failure and duration
- **Idempotency Hits**: Logs when duplicate webhooks are detected
- **Processing Success**: Logs successful webhook processing with duration
- **Processing Failures**: Logs failures with error details and stack traces

**Security**: No secrets (signatures, webhook secrets, tokens) are logged.

### 2. Prometheus Metrics

The following metrics are exposed at `/webhooks/metrics`:

#### Counters

- `tycoon_webhook_events_total{source, event_type, status}`
  - Total webhook events by source, type, and status (received/processed/failed/idempotent)

- `tycoon_webhook_signature_verification_total{source, result, failure_reason}`
  - Total signature verification attempts with results and failure reasons

- `tycoon_webhook_idempotency_hits_total{source, event_type}`
  - Number of duplicate webhooks detected

#### Histograms

- `tycoon_webhook_signature_verification_duration_seconds{source, result}`
  - Time spent verifying signatures (buckets: 1ms to 500ms)

- `tycoon_webhook_processing_duration_seconds{source, event_type}`
  - End-to-end webhook processing time (buckets: 10ms to 10s)

### 3. Trace Context

Each webhook operation includes:

- Webhook ID (for correlation)
- Event type
- Source (e.g., 'stripe')
- Processing duration
- Failure reasons (if applicable)

## Usage

### Accessing Metrics

```bash
# Get Prometheus metrics
curl http://localhost:3000/webhooks/metrics

# Example output:
# HELP tycoon_webhook_events_total Total webhook events received by source and event type
# TYPE tycoon_webhook_events_total counter
tycoon_webhook_events_total{source="stripe",event_type="payment.succeeded",status="processed"} 42

# HELP tycoon_webhook_signature_verification_duration_seconds Time spent verifying webhook signatures
# TYPE tycoon_webhook_signature_verification_duration_seconds histogram
tycoon_webhook_signature_verification_duration_seconds_bucket{source="stripe",result="valid",le="0.001"} 35
tycoon_webhook_signature_verification_duration_seconds_bucket{source="stripe",result="valid",le="0.005"} 42
```

### Monitoring Queries

#### Signature Verification Failure Rate

```promql
# Alert when >5% of signature verifications fail in 5 minutes
rate(tycoon_webhook_signature_verification_total{result="invalid"}[5m]) 
/ 
rate(tycoon_webhook_signature_verification_total[5m]) 
> 0.05
```

#### Webhook Processing Latency (p95)

```promql
# p95 webhook processing latency by source
histogram_quantile(0.95, 
  rate(tycoon_webhook_processing_duration_seconds_bucket[5m])
)
```

#### Idempotency Hit Rate

```promql
# Percentage of duplicate webhooks
rate(tycoon_webhook_idempotency_hits_total[5m]) 
/ 
rate(tycoon_webhook_events_total{status="received"}[5m])
```

#### Webhook Processing Errors

```promql
# Rate of webhook processing failures
rate(tycoon_webhook_events_total{status="failed"}[5m])
```

## Log Examples

### Successful Webhook Processing

```json
{
  "level": "info",
  "message": "Webhook received: stripe - payment.succeeded",
  "context": "WebhooksObservability",
  "timestamp": "2024-04-24T10:30:00.000Z"
}

{
  "level": "debug",
  "message": "Signature verified for stripe in 3ms",
  "context": "WebhooksObservability",
  "timestamp": "2024-04-24T10:30:00.003Z"
}

{
  "level": "info",
  "message": "Webhook processed: wh_123 (stripe) in 145ms",
  "context": "WebhooksObservability",
  "event": "processed",
  "webhookId": "wh_123",
  "eventType": "payment.succeeded",
  "source": "stripe",
  "processingTimeMs": 145,
  "timestamp": "2024-04-24T10:30:00.145Z"
}
```

### Signature Verification Failure

```json
{
  "level": "warn",
  "message": "Signature verification failed for stripe: signature_mismatch",
  "context": "WebhooksObservability",
  "event": "signature_failed",
  "source": "stripe",
  "result": "invalid",
  "durationMs": 2,
  "failureReason": "signature_mismatch",
  "timestamp": "2024-04-24T10:31:00.000Z"
}
```

### Idempotency Hit

```json
{
  "level": "info",
  "message": "Duplicate webhook detected: wh_456 (stripe)",
  "context": "WebhooksObservability",
  "event": "idempotency_hit",
  "webhookId": "wh_456",
  "eventType": "charge.refunded",
  "source": "stripe",
  "timestamp": "2024-04-24T10:32:00.000Z"
}
```

### Processing Failure

```json
{
  "level": "error",
  "message": "Webhook processing failed: wh_789 (stripe) - Database connection failed",
  "context": "WebhooksObservability",
  "event": "processing_failed",
  "webhookId": "wh_789",
  "eventType": "payment.failed",
  "source": "stripe",
  "error": "Database connection failed",
  "errorStack": "Error: Database connection failed\n    at ...",
  "processingTimeMs": 5000,
  "timestamp": "2024-04-24T10:33:00.000Z"
}
```

## Grafana Dashboard

### Recommended Panels

1. **Webhook Processing Rate**
   - Query: `rate(tycoon_webhook_events_total{status="processed"}[5m])`
   - Type: Graph
   - Group by: source, event_type

2. **Signature Verification Success Rate**
   - Query: `rate(tycoon_webhook_signature_verification_total{result="valid"}[5m]) / rate(tycoon_webhook_signature_verification_total[5m])`
   - Type: Gauge
   - Alert: < 0.95

3. **Processing Latency Heatmap**
   - Query: `rate(tycoon_webhook_processing_duration_seconds_bucket[5m])`
   - Type: Heatmap

4. **Idempotency Hit Rate**
   - Query: `rate(tycoon_webhook_idempotency_hits_total[5m])`
   - Type: Graph

5. **Error Rate**
   - Query: `rate(tycoon_webhook_events_total{status="failed"}[5m])`
   - Type: Graph
   - Alert: > 0.01

## Alerting Rules

### Critical Alerts

```yaml
groups:
  - name: webhooks
    interval: 30s
    rules:
      - alert: HighWebhookSignatureFailureRate
        expr: |
          rate(tycoon_webhook_signature_verification_total{result="invalid"}[5m]) 
          / 
          rate(tycoon_webhook_signature_verification_total[5m]) 
          > 0.05
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "High webhook signature verification failure rate"
          description: "{{ $value | humanizePercentage }} of webhook signatures are failing verification"

      - alert: WebhookProcessingHighLatency
        expr: |
          histogram_quantile(0.95, 
            rate(tycoon_webhook_processing_duration_seconds_bucket[5m])
          ) > 5
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "Webhook processing latency is high"
          description: "p95 webhook processing latency is {{ $value }}s"

      - alert: WebhookProcessingErrors
        expr: |
          rate(tycoon_webhook_events_total{status="failed"}[5m]) > 0.01
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Webhook processing errors detected"
          description: "{{ $value }} webhooks per second are failing to process"
```

## Security Considerations

### No Secrets in Logs

The observability implementation ensures:

1. **Signatures are never logged** - Only verification results (valid/invalid) are logged
2. **Webhook secrets are never logged** - Configuration values are not exposed
3. **Tokens are sanitized** - Any token fields in context are removed before logging
4. **Authorization headers are redacted** - Standard logger redaction applies

### Sanitization

The `WebhooksObservabilityService` automatically sanitizes context before logging:

```typescript
private sanitizeContext(context: WebhookLogContext): WebhookLogContext {
  const sanitized = { ...context };
  
  // Remove sensitive fields
  delete (sanitized as any).signature;
  delete (sanitized as any).secret;
  delete (sanitized as any).token;
  delete (sanitized as any).authorization;
  
  return sanitized;
}
```

## Integration with Existing Systems

### Winston Logger

The observability service integrates with the existing Winston logger:

```typescript
constructor(private readonly logger: LoggerService) {
  // Uses existing LoggerService with Winston backend
}
```

### Prometheus Metrics

Metrics are exposed via a separate registry to avoid conflicts:

```typescript
readonly registry = new Registry();
```

### TypeORM & Redis

The service works alongside existing TypeORM and Redis integrations without modification.

## Testing

### Unit Tests

```bash
# Run observability service tests
npm test -- webhooks-observability.service.spec.ts
```

### Integration Tests

```bash
# Run full integration tests with metrics
npm test -- webhooks-observability.integration.spec.ts
```

### Manual Testing

```bash
# Send a test webhook
curl -X POST http://localhost:3000/webhooks/stripe \
  -H "x-stripe-signature: <signature>" \
  -H "x-stripe-timestamp: $(date +%s)" \
  -H "Content-Type: application/json" \
  -d '{"id":"evt_test","type":"test.event"}'

# Check metrics
curl http://localhost:3000/webhooks/metrics

# Check logs
tail -f logs/combined-$(date +%Y-%m-%d).log | grep WebhooksObservability
```

## Rollout Plan

### Phase 1: Deploy with Feature Flag (Week 1)

1. Deploy code with observability enabled
2. Monitor metrics endpoint for errors
3. Verify logs are being generated correctly
4. Check for any performance impact

### Phase 2: Enable Monitoring (Week 2)

1. Configure Prometheus to scrape `/webhooks/metrics`
2. Import Grafana dashboard
3. Set up alerting rules
4. Train team on new metrics

### Phase 3: Full Production (Week 3)

1. Enable all alerts
2. Document runbook procedures
3. Remove feature flag (if used)
4. Announce to team

## Backward Compatibility

This implementation is **fully backward compatible**:

- ✅ No breaking changes to existing webhook endpoints
- ✅ No changes to webhook payload format
- ✅ No changes to signature verification logic (only adds observability)
- ✅ Existing tests continue to pass
- ✅ New metrics endpoint is additive

## Performance Impact

Expected performance impact:

- **Signature verification**: +0.1-0.5ms (metric recording)
- **Webhook processing**: +1-2ms (logging and metrics)
- **Memory**: +5-10MB (Prometheus registry)

All impacts are negligible for typical webhook volumes (<1000/min).

## Troubleshooting

### High Signature Failure Rate

1. Check webhook secret configuration: `WEBHOOK_SECRET` env var
2. Verify clock synchronization on server
3. Check for malformed signature headers
4. Review logs for specific failure reasons

### Missing Metrics

1. Verify `/webhooks/metrics` endpoint is accessible
2. Check that webhooks are being processed
3. Ensure LoggerService is properly injected
4. Review application logs for errors

### High Latency

1. Check database connection pool metrics
2. Review Redis connectivity
3. Check for slow queries in webhook processing
4. Monitor system resources (CPU, memory)

## Future Enhancements

- [ ] Distributed tracing with OpenTelemetry
- [ ] Custom metrics for specific event types
- [ ] Webhook replay functionality with observability
- [ ] Real-time webhook dashboard
- [ ] Anomaly detection for webhook patterns
