# API Library

Typed frontend API client and API error model.

## Public Imports

Import from the barrel for shared API primitives:

```typescript
import { apiClient, TycoonApiError } from "@/lib/api";
import type { ApiErrorCode, GameResponse } from "@/lib/api";
```

The barrel uses explicit named exports. DTO types are listed individually instead of re-exported with `export type *`, which keeps the public contract reviewable when new DTOs are added.

`src/lib/api.ts` remains as a compatibility facade for existing `apiRequest` callers and re-exports the same typed client/error/DTO surface.

## Error Codes

`parseErrorResponse` maps HTTP failures to `ApiErrorCode`:

- `400` -> `VALIDATION_ERROR`
- `401` -> `UNAUTHORIZED`
- `403` -> `FORBIDDEN`
- `404` -> `NOT_FOUND`
- `409` -> `CONFLICT`
- `429` -> `RATE_LIMIT`
- `500` -> `INTERNAL_SERVER_ERROR`
- other statuses -> `UNKNOWN`

Network failures and timeouts are raised as `NETWORK_ERROR` and `TIMEOUT` by the client.
