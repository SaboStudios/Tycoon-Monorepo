# Games & Matchmaking Audit Trail - Migration Guide

This guide provides step-by-step instructions for rolling out the Games & Matchmaking Audit Trail feature to production.

## Overview

The audit trail system is designed for **zero-downtime deployment** with **feature flags** for gradual rollout. The system is backward-compatible and can be enabled/disabled without code changes.

## Prerequisites

- [ ] PostgreSQL database with `audit_trails` table (already exists)
- [ ] Redis instance for caching (already configured)
- [ ] Prometheus metrics endpoint configured
- [ ] Environment variables configured in deployment system

## Rollout Strategy

We recommend a **4-phase staged rollout** with monitoring at each stage:

1. **Development**: Full testing with audit enabled
2. **Staging**: Smoke tests and performance validation
3. **Production Canary**: 10% traffic with audit enabled
4. **Production Full**: 100% traffic with audit enabled

## Phase 1: Development Environment

### Step 1: Update Environment Variables

Add the following to your `.env` file:

```bash
# Games Audit Configuration
GAMES_AUDIT_ENABLED=true
GAMES_AUDIT_LOG_LEVEL=debug
GAMES_AUDIT_REDACT_SENSITIVE=false  # For local debugging only
GAMES_AUDIT_LOG_VIEWS=true
GAMES_AUDIT_ASYNC_TIMEOUT_MS=5000
```

### Step 2: Verify Database Schema

The `audit_trails` table should already exist. Verify it has the required indexes:

```sql
-- Check indexes
SELECT indexname, indexdef FROM pg_indexes
WHERE tablename = 'audit_trails';

-- Expected indexes:
-- - audit_trails_pkey (PRIMARY KEY on id)
-- - IDX_audit_trails_userId (on userId)
-- - IDX_audit_trails_action (on action)
-- - IDX_audit_trails_createdAt (on createdAt)
-- - IDX_audit_trails_userId_action (on userId, action)
```

If indexes are missing, they will be created automatically by TypeORM synchronization (development only).

### Step 3: Start Application

```bash
npm run start:dev
```

### Step 4: Verify Audit Logging

1. **Create a game**:
   ```bash
   curl -X POST http://localhost:3000/api/v1/games \
     -H "Authorization: Bearer YOUR_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"mode": "PUBLIC", "numberOfPlayers": 4}'
   ```

2. **Check audit trail**:
   ```sql
   SELECT * FROM audit_trails
   WHERE action = 'GAME_CREATED'
   ORDER BY created_at DESC
   LIMIT 1;
   ```

3. **Check application logs**:
   ```bash
   # Look for audit log entries
   grep "Game created successfully" logs/app.log
   ```

4. **Check Prometheus metrics**:
   ```bash
   curl http://localhost:3000/metrics | grep tycoon_games_audit
   ```

### Step 5: Test Error Scenarios

1. **Simulate database failure**:
   - Stop PostgreSQL temporarily
   - Create a game
   - Verify request succeeds (audit fails gracefully)
   - Check fallback logging in observability service

2. **Test sensitive data redaction**:
   - Enable redaction: `GAMES_AUDIT_REDACT_SENSITIVE=true`
   - Join a game with wallet address
   - Verify address is redacted in audit log

## Phase 2: Staging Environment

### Step 1: Deploy to Staging

1. **Update environment variables** in your deployment system (e.g., Kubernetes ConfigMap, AWS Parameter Store):

```yaml
# Kubernetes ConfigMap example
apiVersion: v1
kind: ConfigMap
metadata:
  name: tycoon-backend-config
data:
  GAMES_AUDIT_ENABLED: "true"
  GAMES_AUDIT_LOG_LEVEL: "info"
  GAMES_AUDIT_REDACT_SENSITIVE: "true"
  GAMES_AUDIT_LOG_VIEWS: "false"
  GAMES_AUDIT_ASYNC_TIMEOUT_MS: "5000"
```

2. **Deploy application**:
   ```bash
   # Example: Kubernetes deployment
   kubectl apply -f k8s/backend-deployment.yaml
   kubectl rollout status deployment/tycoon-backend
   ```

### Step 2: Run Smoke Tests

```bash
# Run automated smoke tests
npm run test:e2e

# Or manual smoke tests:
# 1. Create game
# 2. Join game
# 3. Roll dice
# 4. Pay rent
# 5. Leave game
```

### Step 3: Performance Validation

1. **Run load tests**:
   ```bash
   # Example: k6 load test
   k6 run --vus 100 --duration 5m load-tests/games.js
   ```

2. **Monitor key metrics**:
   - Request latency (p50, p95, p99)
   - Error rate
   - Database connection pool usage
   - Audit log duration

3. **Verify no performance degradation**:
   - Compare metrics with baseline (before audit enabled)
   - Audit operations should add < 5ms to p99 latency
   - No increase in error rate

### Step 4: Verify Audit Data Quality

```sql
-- Check audit log volume
SELECT action, COUNT(*) as count
FROM audit_trails
WHERE created_at > NOW() - INTERVAL '1 hour'
GROUP BY action
ORDER BY count DESC;

-- Check for missing required fields
SELECT * FROM audit_trails
WHERE user_id IS NULL
OR action IS NULL
OR created_at IS NULL
LIMIT 10;

-- Check sensitive data redaction
SELECT * FROM audit_trails
WHERE changes::text LIKE '%password%'
OR changes::text LIKE '%token%'
LIMIT 10;
```

## Phase 3: Production Canary (10% Traffic)

### Step 1: Enable Audit for Canary Deployment

**Option A: Feature Flag (Recommended)**

Use a feature flag service (e.g., LaunchDarkly, Unleash) to enable audit for 10% of users:

```typescript
// Example: LaunchDarkly integration
const auditEnabled = await ldClient.variation('games-audit-enabled', user, false);
if (auditEnabled) {
  await this.gamesAuditService.logGameCreation(context);
}
```

**Option B: Environment Variable per Pod**

Deploy with two pod groups:
- 90% with `GAMES_AUDIT_ENABLED=false`
- 10% with `GAMES_AUDIT_ENABLED=true`

```yaml
# Kubernetes example: Canary deployment
apiVersion: apps/v1
kind: Deployment
metadata:
  name: tycoon-backend-canary
spec:
  replicas: 1  # 10% of total replicas
  template:
    spec:
      containers:
      - name: backend
        env:
        - name: GAMES_AUDIT_ENABLED
          value: "true"
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: tycoon-backend-stable
spec:
  replicas: 9  # 90% of total replicas
  template:
    spec:
      containers:
      - name: backend
        env:
        - name: GAMES_AUDIT_ENABLED
          value: "false"
```

### Step 2: Monitor Canary Metrics

**Key Metrics to Watch** (first 24 hours):

1. **Error Rate**:
   ```promql
   # Should remain stable
   rate(http_requests_total{status=~"5.."}[5m])
   ```

2. **Request Latency**:
   ```promql
   # Should not increase significantly
   histogram_quantile(0.99, rate(http_request_duration_seconds_bucket[5m]))
   ```

3. **Audit Log Volume**:
   ```promql
   # Should increase linearly with game operations
   rate(tycoon_games_audit_logs_total[5m])
   ```

4. **Audit Log Failures**:
   ```promql
   # Should remain at 0 or very low
   rate(tycoon_games_audit_log_failures_total[5m])
   ```

5. **Database Connection Pool**:
   ```promql
   # Should not spike
   pg_stat_database_numbackends
   ```

### Step 3: Set Up Alerts

```yaml
# Prometheus alert rules
groups:
- name: games_audit
  rules:
  - alert: HighAuditLogFailureRate
    expr: rate(tycoon_games_audit_log_failures_total[5m]) > 0.01
    for: 5m
    annotations:
      summary: "High audit log failure rate"
      description: "Audit log failure rate is {{ $value }} per second"

  - alert: HighAuditLogLatency
    expr: histogram_quantile(0.99, rate(tycoon_games_audit_log_duration_seconds_bucket[5m])) > 0.1
    for: 5m
    annotations:
      summary: "High audit log latency"
      description: "Audit log p99 latency is {{ $value }} seconds"

  - alert: GameOperationLatencyIncrease
    expr: |
      histogram_quantile(0.99, rate(tycoon_game_operations_duration_seconds_bucket[5m]))
      > 1.2 * histogram_quantile(0.99, rate(tycoon_game_operations_duration_seconds_bucket[1h] offset 1d))
    for: 10m
    annotations:
      summary: "Game operation latency increased"
      description: "Game operation p99 latency increased by > 20%"
```

### Step 4: Validate Canary Success

After 24-48 hours, verify:
- [ ] No alerts triggered
- [ ] Error rate stable
- [ ] Latency increase < 5%
- [ ] Audit logs appearing correctly
- [ ] No database connection pool exhaustion
- [ ] No customer complaints

## Phase 4: Production Full Rollout (100% Traffic)

### Step 1: Gradual Rollout

Increase traffic gradually over 3-5 days:

| Day | Traffic % | Action |
|-----|-----------|--------|
| 1 | 10% | Canary (already done) |
| 2 | 25% | Increase canary replicas |
| 3 | 50% | Half traffic with audit enabled |
| 4 | 75% | Most traffic with audit enabled |
| 5 | 100% | Full rollout |

### Step 2: Enable for All Pods

```yaml
# Kubernetes: Update all pods
apiVersion: apps/v1
kind: Deployment
metadata:
  name: tycoon-backend
spec:
  template:
    spec:
      containers:
      - name: backend
        env:
        - name: GAMES_AUDIT_ENABLED
          value: "true"
        - name: GAMES_AUDIT_LOG_LEVEL
          value: "info"
        - name: GAMES_AUDIT_REDACT_SENSITIVE
          value: "true"
        - name: GAMES_AUDIT_LOG_VIEWS
          value: "false"
        - name: GAMES_AUDIT_ASYNC_TIMEOUT_MS
          value: "5000"
```

### Step 3: Monitor Full Rollout

Continue monitoring for 7 days:
- Daily review of metrics
- Weekly review of audit data quality
- Monthly review of storage usage

## Rollback Procedures

If issues are detected during rollout, follow these procedures:

### Immediate Rollback (< 5 minutes)

**Disable audit logging via environment variable**:

```bash
# Kubernetes: Update ConfigMap
kubectl patch configmap tycoon-backend-config -p '{"data":{"GAMES_AUDIT_ENABLED":"false"}}'

# Restart pods to pick up new config
kubectl rollout restart deployment/tycoon-backend
```

**Or use feature flag** (if implemented):

```bash
# LaunchDarkly example
ldcli flag-update games-audit-enabled --variation false
```

### Partial Rollback (< 15 minutes)

**Reduce traffic percentage**:

```bash
# Kubernetes: Scale down canary
kubectl scale deployment/tycoon-backend-canary --replicas=1
kubectl scale deployment/tycoon-backend-stable --replicas=9
```

### Full Rollback (< 30 minutes)

**Revert to previous deployment**:

```bash
# Kubernetes: Rollback deployment
kubectl rollout undo deployment/tycoon-backend

# Verify rollback
kubectl rollout status deployment/tycoon-backend
```

## Post-Rollout Tasks

### Week 1: Monitoring

- [ ] Review audit log volume and growth rate
- [ ] Check for any performance degradation
- [ ] Verify audit data quality
- [ ] Review customer feedback

### Week 2: Optimization

- [ ] Analyze slow audit operations
- [ ] Optimize database queries if needed
- [ ] Adjust timeout settings if needed
- [ ] Review and adjust log levels

### Month 1: Data Retention

- [ ] Implement audit log retention policy
- [ ] Set up automated cleanup jobs
- [ ] Archive old audit logs if needed
- [ ] Review storage costs

### Ongoing: Maintenance

- [ ] Monthly review of audit metrics
- [ ] Quarterly review of audit data usage
- [ ] Update documentation as needed
- [ ] Train team on audit log querying

## Troubleshooting

### Issue: High Audit Log Failure Rate

**Symptoms**: `tycoon_games_audit_log_failures_total` increasing

**Diagnosis**:
```sql
-- Check recent audit errors in application logs
SELECT * FROM logs WHERE message LIKE '%Failed to log%audit%' ORDER BY timestamp DESC LIMIT 10;
```

**Solutions**:
1. Check database connectivity
2. Increase connection pool size
3. Increase audit timeout
4. Temporarily disable audit logging

### Issue: High Latency

**Symptoms**: Request latency increased after audit enabled

**Diagnosis**:
```promql
# Check audit log duration
histogram_quantile(0.99, rate(tycoon_games_audit_log_duration_seconds_bucket[5m]))
```

**Solutions**:
1. Verify async execution (audit shouldn't block)
2. Check database indexes
3. Increase timeout
4. Disable view logging

### Issue: Database Connection Pool Exhaustion

**Symptoms**: `ECONNREFUSED` or `connection pool exhausted` errors

**Diagnosis**:
```sql
-- Check active connections
SELECT count(*) FROM pg_stat_activity WHERE datname = 'tycoon_db';
```

**Solutions**:
1. Increase `DB_POOL_SIZE`
2. Decrease `DB_POOL_IDLE_TIMEOUT_MS`
3. Optimize slow queries
4. Scale database vertically

## Support

For issues during rollout:
1. Check this migration guide
2. Review application logs and metrics
3. Contact DevOps team for infrastructure issues
4. Contact backend team for application issues

## Rollback Decision Matrix

| Metric | Threshold | Action |
|--------|-----------|--------|
| Error rate increase | > 1% | Immediate rollback |
| Latency increase | > 20% | Partial rollback |
| Audit failure rate | > 5% | Investigate, consider rollback |
| Database CPU | > 80% | Partial rollback |
| Customer complaints | > 5 | Investigate, consider rollback |

## Success Criteria

The rollout is considered successful when:
- [ ] Audit logs appearing for all game operations
- [ ] Error rate stable (< 0.1% increase)
- [ ] Latency increase < 5%
- [ ] Audit failure rate < 1%
- [ ] No database connection pool issues
- [ ] No customer complaints
- [ ] Prometheus metrics healthy
- [ ] Audit data quality validated

## Next Steps

After successful rollout:
1. Enable view logging if needed for compliance
2. Implement audit log retention policies
3. Set up automated audit log analysis
4. Train support team on audit log querying
5. Document common audit log queries
6. Consider adding more audit actions as needed
