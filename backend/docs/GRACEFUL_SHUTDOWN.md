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

## Purchase Path (HTTP/WS) Drain Semantics

Purchases are written by **shop-api** (source of truth for money, inventory, and
idempotency). The backend only proxies reads/writes and must never be the
authoritative writer. During shutdown the following guarantees hold for the
purchase path:

### HTTP purchases

- `app.enableShutdownHooks()` is enabled in `main.ts`, so `SIGTERM`/`SIGINT`
  trigger `app.close()` and the `OnApplicationShutdown` hooks below.
- `server.close()` stops accepting **new** connections; in-flight purchase
  requests are allowed to finish within `SHUTDOWN_TIMEOUT_MS`.
- If a purchase request is still in flight when the drain window expires, the
  process exits and the client sees a connection reset. The client **must**
  retry with the **same `Idempotency-Key`** — see below.

### WebSocket purchases

- The WS gateway is closed as part of `app.close()`; the server sends a normal
  close frame so clients can distinguish a graceful drain from a crash.
- In-flight purchase-related WS messages are **not** silently dropped: the
  gateway waits for the current handler to settle before closing the socket.
- Clients that reconnect after a drain must resend the purchase with the same
  `Idempotency-Key`; the server replays the stored response instead of
  double-charging.

### Idempotency across shutdown/restart

Idempotency state lives in **shop-api** (Redis-backed, keyed by
`Idempotency-Key` + body hash), not in backend process memory. This means a
backend restart during a drain does **not** lose idempotency records:

- Replay with the same key + same body → stored response returned (no double
  purchase).
- Replay with the same key + different body → `409 Conflict`.
- Key TTL expiry → treated as a new request; clients must not reuse keys across
  logical purchases.

### Inventory atomicity

Inventory adjustments are performed atomically inside shop-api (DB constraint /
reservation TTL). The backend never mutates inventory directly, so a backend
drain cannot leave inventory in a partially-adjusted state. If shop-api,
Postgres, or Redis is unavailable during a write, the backend **fails closed**:
no purchase is acknowledged and the client receives a mapped error per
[`API_ERROR_RESPONSE_STANDARDS.md`](./API_ERROR_RESPONSE_STANDARDS.md).

### Operator checklist during a rollout

1. Confirm `SHUTDOWN_TIMEOUT_MS` < `terminationGracePeriodSeconds × 1000`.
2. Watch for `ECONNREFUSED` / `ECONNRESET` on the purchase path — none should
   appear for HTTP; WS clients should see a clean close frame.
3. Verify no `409` spikes from legitimate retries (a `409` means a client reused
   a key with a different body — investigate the client).
4. Confirm inventory never goes negative in shop-api metrics after the rollout.

See [`SHOP_PURCHASES_RUNBOOK.md`](./SHOP_PURCHASES_RUNBOOK.md) for the full
purchase runbook and [`ADR-001-shop-purchase-ownership.md`](./ADR-001-shop-purchase-ownership.md)
for the write-path ownership decision.

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
