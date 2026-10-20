# Metrics & Health - Operational Runbook

## Overview
This runbook provides operational procedures for monitoring and managing the Metrics and Health modules in the Tycoon backend.

## Table of Contents
1. [System Architecture](#system-architecture)
2. [Health Checks](#health-checks)
3. [Metrics Collection](#metrics-collection)
4. [Monitoring & Alerting](#monitoring--alerting)
5. [Common Issues & Troubleshooting](#common-issues--troubleshooting)
6. [Emergency Procedures](#emergency-procedures)

## System Architecture

### Components
- **HealthController**: Provides health status of critical dependencies (e.g., Redis).
- **MetricsController**: Exposes Prometheus-compatible metrics.
- **HttpMetricsService**: Collects and formats HTTP-related metrics.
- **AuditTrailInterceptor**: Logs access to health and metrics endpoints for audit purposes.

### Data Flow
```
External Monitor -> /health/redis -> Redis Check -> Audit Log -> Response
Prometheus -> /metrics -> HttpMetricsService -> Audit Log -> Metrics Text
```

## Health Checks

### Redis Health
- **Endpoint**: `GET /health/redis`
- **Logic**: Performs a simple SET/GET operation on Redis.
- **Success Response**: `{ status: "healthy", redis: "connected", ... }`
- **Failure Response**: `{ status: "unhealthy", redis: "disconnected", error: "...", ... }`

## Metrics Collection

### Prometheus Scrape
- **Endpoint**: `GET /metrics`
- **Content-Type**: `text/plain; version=0.0.4`
- **Metrics Included**:
  - HTTP request duration
  - HTTP request count
  - System memory/CPU (if configured in HttpMetricsService)

## Monitoring & Alerting

### Key Performance Indicators (KPIs)
- **Health Status**: Should be "healthy" 100% of the time.
- **Metrics Availability**: Scrape success rate > 99.9%.

### Alert Thresholds
- **Health Failure**: Alert immediately if `/health/redis` returns "unhealthy".
- **Metrics Latency**: Alert if `/metrics` takes > 2 seconds to respond.

## Common Issues & Troubleshooting

### Issue 1: Redis Unhealthy
**Symptoms**: `/health/redis` returns "unhealthy".
**Resolution**:
1. Check Redis service status: `systemctl status redis`
2. Verify Redis connectivity from the backend container.
3. Restart Redis if necessary.

### Issue 2: Metrics Scrape Timeout
**Symptoms**: Prometheus fails to scrape `/metrics`.
**Resolution**:
1. Check backend service CPU/Memory usage.
2. Verify `HttpMetricsService` is not blocked by heavy operations.
3. Check network latency between Prometheus and Backend.

## Emergency Procedures

### Complete Health Failure
1. Verify if the issue is a false positive (check other services).
2. If real, identify the failing dependency (e.g., Redis).
3. Notify the infrastructure team.
4. If a recent deployment caused this, consider a rollback.

## Audit Logging
Access to health and metrics endpoints is audited with:
- `HEALTH_CHECK_ACCESSED`
- `METRICS_SCRAPED`
Check the `audit_trails` table for suspicious access patterns.

---
Last updated: 2026-04-23
Next review: 2026-05-23
