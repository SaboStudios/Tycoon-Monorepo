# Error Library

Shared helpers for safe user-facing error handling.

## Public Imports

Always import from the barrel — never from submodules directly:

```typescript
import {
  sanitizeError,
  categorizeError,
  getApiErrorCategory,
  isNetworkError,
  isServerError,
  isRecoverableError,
  ErrorCategory,
  ERROR_MESSAGES,
  API_ERROR_CATEGORY,
  getApiErrorCategoryFromUnknown,
  getHttpStatusErrorCategory,
} from "@/lib/errors";
```

The barrel uses explicit named exports only — no `export *` — so bundlers can
tree-shake unused utilities. The public API is locked by
`src/lib/errors/index.test.ts` which asserts the exact export surface.

## Full Public API

| Export | Kind | Description |
|---|---|---|
| `ErrorCategory` | enum | Network, Auth, Validation, Server, NotFound, RateLimit, Unknown |
| `API_ERROR_CATEGORY` | const | Maps every `ApiErrorCode` to an `ErrorCategory` |
| `ERROR_MESSAGES` | const | User-facing title/message/action/supportLink per category |
| `getApiErrorCategory(code)` | fn | Looks up category for a known `ApiErrorCode` |
| `getApiErrorCategoryFromUnknown(error)` | fn | Safely extracts category from any unknown value |
| `getHttpStatusErrorCategory(status)` | fn | Maps an HTTP status number to a category |
| `categorizeError(error)` | fn | Categorizes any thrown value (Error, Response, object, unknown) |
| `sanitizeError(error)` | fn | Returns a `SanitizedError` safe for client display (no PII/tokens) |
| `isNetworkError(error)` | fn | Returns `true` when category is `network` |
| `isServerError(error)` | fn | Returns `true` when category is `server` |
| `isRecoverableError(error)` | fn | Returns `false` only for `not_found` errors |
| `SanitizedError` | type | Shape returned by `sanitizeError` |

## API Error Mapping

`getApiErrorCategory(code)` maps `ApiErrorCode` values from `@/lib/api`:

- `UNAUTHORIZED`, `FORBIDDEN` → `auth`
- `VALIDATION_ERROR`, `CONFLICT` → `validation`
- `RATE_LIMIT` → `rate_limit`
- `NETWORK_ERROR`, `TIMEOUT` → `network`
- `INTERNAL_SERVER_ERROR` → `server`
- `NOT_FOUND` → `not_found`
- `UNKNOWN` → `unknown`

## Stale / Disconnected / Invalid States

`categorizeError` and `getApiErrorCategoryFromUnknown` handle degraded inputs
without throwing:

```typescript
// Partial API payload (e.g. stale cached response)
getApiErrorCategoryFromUnknown({ statusCode: 503 }); // → "server"
getApiErrorCategoryFromUnknown({ code: "RATE_LIMIT" });  // → "rate_limit"

// Unknown code → falls back gracefully
getApiErrorCategoryFromUnknown({ code: "FUTURE_CODE" }); // → undefined
categorizeError({ code: "FUTURE_CODE" });                // → "unknown"

// Null / non-object → never throws
getApiErrorCategoryFromUnknown(null);                    // → undefined
```

## Related Test Coverage

| File | Issues |
|---|---|
| `src/lib/errors/index.test.ts` | #1250 — barrel strict-export contract |
| `src/lib/errors/api-error-map.test.ts` | #1250 — category mapping, stale states |
| `src/app/__tests__/layout.test.tsx` | #1249 — RootLayout arity, `isDev` export |
| `src/app/(home)/page.test.tsx` | #1249 — home page rendering suite |
| `test/RouteFocusProvider.test.tsx` | #1248 — import/mock resolution |
| `test/ShopGrid.test.tsx` | #1247 — null/undefined items guard |
