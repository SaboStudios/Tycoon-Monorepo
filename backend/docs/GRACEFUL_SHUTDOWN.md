# Graceful Shutdown

## Overview

On `SIGTERM` (or `SIGINT`) the backend drains HTTP traffic, stops accepting new
queue work, and cleanly closes all connection pools before the process exits.
This prevents connection-error spikes during Kubernetes rolling deployments.

## Shutdown Sequence

```
SIGTERM received
│
├─ 1. Kubernetes removes pod from Service endpoints (no new traffic routed in)
│
├─ 2. NestJS app.close() → server.close()
│      HTTP keep-alive connections are drained.
│      keepAliveTimeout = SHUTDOWN_TIMEOUT_MS (15 s)
│
└─ 3. OnApplicationShutdown hooks (GracefulShutdownService)
       a. BullMQ queues paused  — workers stop picking up new jobs;
                                   in-flight jobs run to completion.
       b. TypeORM DataSource.destroy() — PostgreSQL connection pool closed.
       c. ioredis quit()              — Redis connection closed gracefully.
```

## Timeout Values

| Variable | Default | Where set | Purpose |
|---|---|---|---|
| `SHUTDOWN_TIMEOUT_MS` | `15000` ms | `.env` / K8s env | Max time for in-flight work before forced exit |
| `keepAliveTimeout` | `SHUTDOWN_TIMEOUT_MS` | `main.ts` | HTTP server stops accepting keep-alive connections |
| `headersTimeout` | `SHUTDOWN_TIMEOUT_MS + 1000` | `main.ts` | Must be > keepAliveTimeout |
| `terminationGracePeriodSeconds` | `30` s | `k8s/deployment.yaml` | Total K8s grace window |
| `preStop sleep` | `5` s | `k8s/deployment.yaml` | Delay before SIGTERM so endpoint removal propagates |

**Rule:** `SHUTDOWN_TIMEOUT_MS` < `terminationGracePeriodSeconds × 1000`

With defaults: `15 000 ms` < `30 000 ms` ✓

The remaining ~15 s covers the `preStop` sleep (5 s), HTTP drain, and process
exit overhead.

## Kubernetes Alignment

See [`k8s/deployment.yaml`](../k8s/deployment.yaml).

Key settings:
- `terminationGracePeriodSeconds: 30`
- `lifecycle.preStop` exec sleep of 5 s (lets endpoint removal propagate before SIGTERM)
- `strategy.rollingUpdate.maxUnavailable: 0` — zero-downtime rollouts

## Changing the Timeout

1. Update `SHUTDOWN_TIMEOUT_MS` in your `.env` / K8s `env` block.
2. Ensure `terminationGracePeriodSeconds` in `k8s/deployment.yaml` is at least
   `SHUTDOWN_TIMEOUT_MS / 1000 + 10` seconds.

Example for longer-running jobs (30 s):
```yaml
# k8s/deployment.yaml
terminationGracePeriodSeconds: 50

# env
- name: SHUTDOWN_TIMEOUT_MS
  value: "30000"
```

## Testing

Unit tests covering the shutdown service live in
`backend/test/graceful-shutdown.spec.ts`.

To verify manually during a rolling deployment:
```bash
# Watch for connection errors while rolling out
kubectl rollout restart deployment/tycoon-backend
kubectl get events --watch --field-selector reason=Killing
```

No `Error: connect ECONNREFUSED` or `ECONNRESET` events should appear in
application logs during the rollout.
