# Graceful Shutdown

**Issue:** #1444
**Status:** Implemented with CI verification and K8s alignment

## Overview

On `SIGTERM` (or `SIGINT`) the backend drains HTTP traffic, stops accepting new
queue work, and cleanly closes all connection pools before the process exits.
This prevents connection-error spikes during Kubernetes rolling deployments and
avoids data loss from in-flight purchases.

## The Problem (Without Graceful Shutdown)

**Scenario:** A Kubernetes rolling deployment sends SIGTERM to a pod.

**Without graceful shutdown:**
1. K8s immediately sends SIGTERM to the app process
2. App exits immediately without waiting for in-flight database transactions
3. Purchases that were mid-transaction are rolled back
4. Customer loses funds / inventory is not updated

**With graceful shutdown:**
1. K8s removes pod from Service (no new traffic)
2. App receives SIGTERM
3. App waits up to 15 seconds for in-flight work (DB transactions, queue jobs) to complete
4. App closes cleanly
5. Customer's purchase completes successfully

## Shutdown Sequence

```
SIGTERM received
│
├─ 1. Kubernetes removes pod from Service endpoints
│      No new traffic is routed to this pod.
│      (5 s delay via lifecycle.preStop in k8s/deployment.yaml)
│
├─ 2. NestJS app.close() → server.close()
│      HTTP connections are drained gracefully.
│      No new HTTP requests accepted.
│      Existing keep-alive connections allowed to complete (15 s max).
│
└─ 3. OnApplicationShutdown hooks (GracefulShutdownService)
       a. BullMQ queues paused
            Workers stop picking up new jobs.
            In-flight jobs continue to completion.
       b. TypeORM DataSource.destroy()
            PostgreSQL connection pool closed.
            All pending transactions committed or rolled back.
       c. ioredis quit()
            Redis connection closed gracefully.
       d. Process exits cleanly.
```

## Timeout Values and Alignment

| Variable | Default | Where set | Purpose |
|---|---|---|---|
| `SHUTDOWN_TIMEOUT_MS` | `15000` ms | `k8s/deployment.yaml` env | Max time for in-flight work before forced exit |
| `terminationGracePeriodSeconds` | `30` s | `k8s/deployment.yaml` spec | Total K8s grace window (must be > SHUTDOWN_TIMEOUT_MS + buffer) |
| `preStop sleep` | `5` s | `k8s/deployment.yaml` lifecycle | Delay before SIGTERM so Service removes endpoint first |

**Alignment Rule:**
```
SHUTDOWN_TIMEOUT_MS < (terminationGracePeriodSeconds × 1000 - buffer)
```

**With defaults:**
- `SHUTDOWN_TIMEOUT_MS` = 15,000 ms
- `terminationGracePeriodSeconds` = 30 s = 30,000 ms
- `preStop sleep` = 5 s

**Timeline:** preStop (5s) → SIGTERM arrives → app.close() + queues drain (15s) → process exit (≤10s)

**Verification:** `backend/test/graceful-shutdown.e2e-spec.ts` has a test that verifies this alignment.

## Kubernetes Configuration

See [`k8s/deployment.yaml`](../backend/k8s/deployment.yaml).

**Key settings:**
```yaml
spec:
  terminationGracePeriodSeconds: 30
  containers:
    - name: backend
      env:
        - name: SHUTDOWN_TIMEOUT_MS
          value: "15000"
      lifecycle:
        preStop:
          exec:
            command: ["/bin/sh", "-c", "sleep 5"]
```

**What each setting does:**
- `terminationGracePeriodSeconds: 30` — K8s waits max 30 seconds after SIGTERM before force-killing
- `SHUTDOWN_TIMEOUT_MS: 15000` — App waits max 15 seconds for in-flight work
- `preStop sleep 5` — Gives Service time to remove pod endpoints before SIGTERM arrives
- `strategy.rollingUpdate.maxUnavailable: 0` — Ensures zero-downtime rollouts

## Docker Compose Local Development

The local `docker-compose.yml` does not enforce shutdown order explicitly. During
local development, if you stop the app while Redis is shutting down, the app may
log connection-lost messages — this is expected and not a production issue because:

1. K8s enforces shutdown timing (preStop → SIGTERM → grace period → SIGKILL)
2. Local development does not replicate this timing guarantee
3. Production deployments use K8s, not Docker Compose

**To test locally with proper timing simulation:**
```bash
# 1. Start services
docker-compose up -d

# 2. In another terminal, send SIGTERM to app and monitor logs
kill -TERM $(docker-compose ps -q backend)
docker-compose logs backend --follow
```

Expected behavior: App logs "Graceful shutdown complete" without connection errors.

## Changing Timeout Values

If in-flight jobs require more than 15 seconds to complete:

1. **Increase `SHUTDOWN_TIMEOUT_MS` in `k8s/deployment.yaml`:**
   ```yaml
   - name: SHUTDOWN_TIMEOUT_MS
     value: "30000"  # 30 seconds
   ```

2. **Increase `terminationGracePeriodSeconds` in `k8s/deployment.yaml`:**
   ```yaml
   terminationGracePeriodSeconds: 50  # Must be > SHUTDOWN_TIMEOUT_MS / 1000 + buffer
   ```

3. **Rule of thumb:**
   ```
   terminationGracePeriodSeconds = (SHUTDOWN_TIMEOUT_MS / 1000) + 15
   ```
   This leaves ~15 seconds for preStop delay, HTTP drain, and process exit overhead.

4. **Update the test in `backend/test/graceful-shutdown.e2e-spec.ts`** to verify new values:
   ```typescript
   it('should have correctly aligned timeout values', () => {
     const SHUTDOWN_TIMEOUT_MS = 30000; // Updated
     const TERMINATION_GRACE_PERIOD_SECONDS = 50; // Updated
     // ... rest of test
   });
   ```

## CI Verification

The graceful shutdown sequence is verified in CI:

**File:** `backend/test/graceful-shutdown.e2e-spec.ts`

**Runs in:** `npm run test:e2e` (part of GitHub Actions backend CI)

**What it checks:**
- Queues are paused during shutdown
- Database connections are closed
- Redis connections are closed gracefully
- Shutdown completes even if individual steps fail (error resilience)
- Timeout values are correctly aligned (SHUTDOWN_TIMEOUT_MS < terminationGracePeriodSeconds)

**Local testing:**
```bash
cd backend
npm run test:e2e -- graceful-shutdown.e2e-spec.ts
```

## Manual Verification in Production

To verify graceful shutdown during a rolling deployment:

```bash
# 1. Watch for connection errors during rollout
kubectl rollout restart deployment/tycoon-backend

# 2. Monitor app logs for shutdown messages
kubectl logs -l app=tycoon-backend -f

# 3. Check for connection-error events
kubectl get events --watch --field-selector reason=Killing
```

**Expected logs:**
```
Shutdown signal received: SIGTERM
Queue paused: background-jobs
Queue paused: email-queue
Database connection pool closed.
Redis connection closed.
Graceful shutdown complete.
```

**Red flags (should not appear):**
- `Error: connect ECONNREFUSED`
- `Error: ECONNRESET`
- `Unhandled rejection`

If connection errors appear, the timeout values may need adjustment (see "Changing Timeout Values" above).

## Related Documentation

- `k8s/deployment.yaml` — K8s configuration with grace period and preStop hook
- `GracefulShutdownService` — Implementation in `backend/src/common/shutdown/graceful-shutdown.service.ts`
- GitHub Actions CI — `.github/workflows/backend-ci.yml` includes e2e test step
