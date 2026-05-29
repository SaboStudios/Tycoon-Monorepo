# Error Library

Shared helpers for safe user-facing error handling.

## Public Imports

Import from the barrel when using this library:

```typescript
import { sanitizeError, getApiErrorCategory } from "@/lib/errors";
```

The barrel uses named exports only. Submodules stay small and side-effect free so unused helpers can be tree-shaken.

## API Error Mapping

`getApiErrorCategory(code)` maps `ApiErrorCode` values from `@/lib/api` to UI categories:

- `UNAUTHORIZED`, `FORBIDDEN` -> `auth`
- `VALIDATION_ERROR`, `CONFLICT` -> `validation`
- `RATE_LIMIT` -> `rate_limit`
- `NETWORK_ERROR`, `TIMEOUT` -> `network`
- `INTERNAL_SERVER_ERROR` -> `server`
- `NOT_FOUND` -> `not_found`
- `UNKNOWN` -> `unknown`

`categorizeError(error)` also accepts stale or partially shaped API errors such as `{ statusCode: 503 }` or `{ code: "TIMEOUT" }` and falls back to `unknown` for invalid inputs.
