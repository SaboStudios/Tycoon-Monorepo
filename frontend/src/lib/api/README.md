# `src/lib/api` — Frontend API Client

Typed HTTP client, error model, and DTO types for all backend calls.

---

## Import surface

Always import from the barrel at `@/lib/api` (or from `@/lib/api.ts` for legacy
`apiRequest` callers):

```typescript
import { apiClient, TycoonApiError, isApiError } from "@/lib/api";
import type { ApiErrorCode } from "@/lib/api";
```

The barrel uses **named exports only** — no `export *` — so the public contract
is explicit and reviewable when new DTOs are added.

---

## Token convention

### Canonical key: `accessToken` (camelCase)

The access token lives in `localStorage` under the key **`accessToken`**,
matching the backend's `AuthTokensResponse` DTO field name exactly.

```typescript
// Read (internal to client.ts)
const token = localStorage.getItem("accessToken");
```

The `AuthProvider` (`src/components/providers/auth-provider.tsx`) writes the
token on login:

```typescript
localStorage.setItem("accessToken", accessToken);
localStorage.setItem("refreshToken", refreshToken);
```

### Migration fallback (temporary)

Older sessions stored the token under the **legacy key `access_token`**
(snake_case). The client includes a one-time migration:

```typescript
// In client.ts — getAuthHeaders()
let token = localStorage.getItem("accessToken");
if (!token) {
  token = localStorage.getItem("access_token"); // legacy key
  if (token) localStorage.setItem("accessToken", token); // migrate in place
}
```

If the canonical key is absent but the legacy key is present, the client
migrates the value automatically and proceeds without re-login.

**This fallback is temporary.** Once login success rates confirm all active
sessions have the canonical key, remove the fallback from `getAuthHeaders()`.
Monitor via your analytics provider: track `access_token migration hit` events.

### Do not do this

```typescript
// ❌ Wrong — will silently fail to attach auth on post-migration sessions
const token = localStorage.getItem("access_token");

// ✅ Right — let the client handle token lookup
import { apiClient } from "@/lib/api";
const data = await apiClient.get<MyType>("/some/path");
```

---

## Retry policy

Retries are built into `apiClient` and are **transparent** — callers do not need
to add their own retry loops.

| Parameter | Value |
|-----------|-------|
| Max retries | 2 (3 total attempts) |
| Retryable statuses | 408, 429, 502, 503, 504 |
| Backoff | Linear — `200ms × attempt` (200 ms, 400 ms) |
| Timeout per attempt | 10 000 ms (default); override via `RequestOptions.timeoutMs` |

```typescript
// Default behaviour — 2 retries, 10 s timeout
await apiClient.get("/games");

// Custom timeout, no retries
await apiClient.post("/shop/purchase", body, { timeoutMs: 5_000, retries: 0 });

// Public endpoint — no auth header attached
await apiClient.get("/waitlist/check", { public: true });
```

Non-retryable statuses (4xx except 408/429, 500) throw immediately without
retrying. Network failures and AbortController timeouts are converted to
`TycoonApiError` with codes `NETWORK_ERROR` and `TIMEOUT` respectively.

---

## Request cancellation

Pass an `AbortSignal` to cancel in-flight requests (e.g. on component unmount):

```typescript
const controller = new AbortController();

useEffect(() => {
  apiClient.get<GameState>(`/games/${id}`, { signal: controller.signal })
    .then(setGame)
    .catch((err) => {
      if (isApiError(err) && err.code === "TIMEOUT") return; // aborted
      setError(err);
    });

  return () => controller.abort();
}, [id]);
```

---

## Error handling

All API failures are thrown as `TycoonApiError`. Never check `res.ok` manually
— let the client do it.

### Error codes

| HTTP status | `ApiErrorCode` |
|-------------|----------------|
| 400, 422 | `VALIDATION_ERROR` |
| 401 | `UNAUTHORIZED` |
| 403 | `FORBIDDEN` |
| 404 | `NOT_FOUND` |
| 409 | `CONFLICT` |
| 429 | `RATE_LIMIT` |
| 500–504 | `INTERNAL_SERVER_ERROR` |
| Network failure | `NETWORK_ERROR` |
| Timeout | `TIMEOUT` |
| Other | `UNKNOWN` |

### Backend error envelope

The backend sends errors in this canonical shape:

```json
{
  "statusCode": 422,
  "message": "Validation failed",
  "errors": { "email": ["must be a valid email"] },
  "correlationId": "req-abc-123"
}
```

`parseErrorResponse` extracts all fields. `TycoonApiError` exposes:

```typescript
err.code          // ApiErrorCode
err.statusCode    // number (HTTP status)
err.message       // string
err.errors        // Record<string, string[]> | null — for VALIDATION_ERROR
err.correlationId // string | undefined — include in support tickets
```

### Handling errors in components

```typescript
import { apiClient, TycoonApiError, isApiError, isValidationError } from "@/lib/api";

async function submitForm(data: FormData) {
  try {
    const result = await apiClient.post<PurchaseResponse>("/shop/purchase", data);
    onSuccess(result);
  } catch (err) {
    if (!isApiError(err)) throw err; // unexpected — rethrow

    if (isValidationError(err)) {
      // err.errors contains field-level messages from the server
      setFieldErrors(err.errors ?? {});
      return;
    }

    if (err.code === "UNAUTHORIZED") {
      router.push("/login");
      return;
    }

    // Fallback: show generic error toast with correlation ID for support
    toast.error(`Something went wrong (${err.correlationId ?? "unknown"})`);
  }
}
```

---

## MSW — dev-only mocking

### ⚠️ MSW never runs in production

The `MSWProvider` (`src/components/providers/msw-provider.tsx`) starts the
Service Worker **only** when:

- `process.env.NODE_ENV === "development"`, **or**
- `process.env.NEXT_PUBLIC_API_MOCKING === "enabled"` (e.g. in Playwright E2E)

In production builds (`NODE_ENV=production`), the `import("@/mocks/browser")`
is never evaluated, the Service Worker is never registered, and all requests go
to the real backend at `NEXT_PUBLIC_API_URL`.

### Handler locations

| File | What it mocks |
|------|---------------|
| `src/mocks/handlers/auth.ts` | `POST /api/v1/auth/login`, `/auth/logout` |
| `src/mocks/handlers/hero.ts` | Hero section data endpoints |
| `src/mocks/handlers/shop.ts` | `GET /api/v1/shop/items`, `POST /shop/purchase` |
| `src/mocks/handlers/user.ts` | `GET /api/v1/users/me` |
| `src/mocks/joinRoomHandlers.ts` | Join room flow |

### Adding a new handler

```typescript
// src/mocks/handlers/games.ts
import { http, HttpResponse } from "msw";

export const gamesHandlers = [
  http.get("/api/v1/games", () => {
    return HttpResponse.json([{ id: 1, name: "Test Game" }]);
  }),
];
```

Then register it in `src/mocks/handlers/index.ts`.

### Do NOT import MSW outside mocks/

```typescript
// ❌ Never do this in application code
import { worker } from "@/mocks/browser";

// ✅ MSWProvider handles lifecycle automatically
```

---

## `RequestOptions` reference

```typescript
interface RequestOptions {
  timeoutMs?: number;   // default: 10 000 ms
  retries?: number;     // default: 2
  public?: boolean;     // skip Authorization header
  signal?: AbortSignal; // for request cancellation
}
```

---

## `apiClient` methods

```typescript
apiClient.get<T>(path, opts?)           // GET
apiClient.post<T>(path, body, opts?)    // POST
apiClient.patch<T>(path, body, opts?)   // PATCH
apiClient.put<T>(path, body, opts?)     // PUT
apiClient.delete<T>(path, opts?)        // DELETE
```

`T` is the expected success response type. For `204 No Content`, `T` should be
`void` or `undefined`.

---

## Base URL

```typescript
const BASE_URL = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000") + "/api/v1";
```

All `path` arguments to `apiClient` are appended to this base. Always include
the leading slash:

```typescript
// ✅
await apiClient.get("/shop/items");

// ❌ — will produce double-slash or wrong path
await apiClient.get("shop/items");
```

---

## Files in this module

| File | Purpose |
|------|---------|
| `client.ts` | `apiClient`, retry loop, timeout, auth headers |
| `errors.ts` | `TycoonApiError`, `ApiErrorCode`, `parseErrorResponse`, type guards |
| `index.ts` | Barrel — named re-exports of everything above |
| `types/dto.ts` | Shared request/response DTO types (GameResponse, PurchaseResponse, …) |
