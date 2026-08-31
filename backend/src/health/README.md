# Health Module

Provides health endpoints for monitoring the API and its critical dependencies.

## Endpoints

### GET /health/live
**Liveness probe** — checks if the process is alive and the event loop is responsive.

Response (always 200):
```json
{
  "status": "healthy",
  "timestamp": "2026-08-26T...",
  "uptime": 123.45
}
```

**Use case:** Kubernetes liveness probe. Returns immediately without dependency checks.

---

### GET /health/ready
**Readiness probe** — checks if the service is ready to accept traffic.

Response (200 if all deps OK, 503 if any fail):
```json
{
  "status": "healthy",
  "timestamp": "2026-08-26T...",
  "redis": "connected",
  "database": "connected",
  "near": "healthy"
}
```

**Dependencies checked:**
- **Database**: Verifies TypeORM connection via `SELECT 1`
- **Redis**: Writes and reads a test key
- **NEAR**: Checks the NearService circuit breaker state (only if `NEAR_HEALTH_ENABLED=true`)

**Behavior:**
- All dependencies must be healthy for readiness to pass (500 if any fail)
- NEAR check fails (returns 503) if the circuit breaker is OPEN, indicating RPC failures
- NEAR check can be disabled via `NEAR_HEALTH_ENABLED=false` (defaults to `true`)

**Use case:** Kubernetes readiness probe. Stops routing traffic when dependencies are unavailable.

---

### GET /health
**Full aggregate health check** — includes memory and detailed status.

Response:
```json
{
  "status": "healthy|degraded|unhealthy",
  "timestamp": "2026-08-26T...",
  "uptime": 123.45,
  "redis": "connected|disconnected",
  "database": "connected|disconnected",
  "memory": {
    "heapUsedMb": 150,
    "rssMb": 300
  }
}
```

Status calculation:
- `healthy`: all dependencies up
- `degraded`: at least one dependency up but not all
- `unhealthy`: no dependencies up

---

### GET /health/redis
**Redis-only check** — backward-compatible endpoint.

Response:
```json
{
  "status": "healthy|unhealthy",
  "redis": "connected|disconnected",
  "timestamp": "2026-08-26T..."
}
```

---

## Configuration

### NEAR_HEALTH_ENABLED
Controls whether the NEAR RPC circuit breaker is checked in readiness probes.

```bash
NEAR_HEALTH_ENABLED=true   # Enable (default) — fail readiness if NEAR circuit opens
NEAR_HEALTH_ENABLED=false  # Disable — ignore NEAR failures in readiness
```

**Default:** `true` (production fail-closed)

**Use cases:**
- **CI/unit tests:** Set to `false` to avoid mocking NearService
- **Production:** Leave as `true` to catch RPC outages
- **Graceful degradation:** Temporarily set to `false` during NEAR maintenancewindow

---

## NEAR Circuit Breaker Integration

The readiness check reflects the state of `NearService.circuit`:

| Circuit State | Readiness | Liveness | Effect |
|---|---|---|---|
| **CLOSED** | 200 (healthy) | 200 (unaffected) | Normal operation |
| **OPEN** | 503 (unhealthy) | 200 (unaffected) | RPC failing; K8s stops routing traffic |
| **HALF_OPEN** | 200 (healthy) | 200 (unaffected) | Recovery probe in progress |

**Fail-closed behavior:** If NEAR deposits/contract calls start failing at 3+ consecutive errors, the circuit opens and `/health/ready` immediately returns 503, signaling K8s to drain traffic.

**Liveness unaffected:** `/health/live` remains cheap and never blocks, ensuring K8s doesn't restart the pod just because NEAR is down.

---

## Testing

### Mocking NearService for unit tests

```typescript
const mockNearService = {
  circuit: 'CLOSED', // or 'OPEN', 'HALF_OPEN'
};

// In your test module:
providers: [
  { provide: NearService, useValue: mockNearService },
];

// Then update circuit state mid-test:
mockNearService.circuit = 'OPEN';
const result = await controller.readiness();
expect(result.status).toBe('unhealthy');
```

### Disabling NEAR for CI

In test environment or CI setup:
```bash
NEAR_HEALTH_ENABLED=false npm run test
```

---

## Monitoring

All health endpoints are skipped from rate limiting (`@SkipThrottle()`).
Health checks on `/health/ready` and `/health/live` do not log to audit trail.
Full `/health` and `/health/redis` checks are logged via `AuditTrailInterceptor`.
