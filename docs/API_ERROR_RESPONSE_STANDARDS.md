# API Error Response Standards

**Issue:** #1445
**Status:** Implemented
**Date:** 2026-08-27

## Overview

All API error responses conform to a single canonical JSON shape, ensuring consistent error handling across the frontend and reliable error parsing.

**Canonical Shape:**
```json
{
  "statusCode": 400,
  "message": "Human-readable error message",
  "errors": { "field": ["constraint message"] },
  "correlationId": "req_550e8400-e29b-41d4-a716-446655440000"
}
```

---

## Response Shape Specification

### Fields

| Field | Type | Always? | Purpose |
|-------|------|---------|---------|
| `statusCode` | `number` | ✅ Yes | HTTP status code for the error (400, 401, 409, 500, etc.) |
| `message` | `string` | ✅ Yes | Human-readable error message for UI display |
| `errors` | `Record<string, string[]> \| null` | ✅ Yes | Validation error details (only populated for 400/422; null otherwise) |
| `correlationId` | `string` | ✅ Yes | Unique request identifier for debugging and log tracing |

### Rules

1. **No stack traces in response body** — Stack traces are logged server-side, never sent to clients
2. **errors field populated only for 400 errors** — Validation errors use the `errors` field; other error types have `errors: null`
3. **correlationId always generated** — If request lacks `x-correlation-id` header, filter generates one
4. **No custom fields** — All error responses use only these four fields (ensures frontend can parse reliably)

---

## Sample Responses by Status Code

### 400 Bad Request (Validation Error)

**Request:**
```bash
POST /api/v1/shop \
  -H "Content-Type: application/json" \
  -d '{"name": "", "price": "invalid"}'
```

**Response:**
```json
{
  "statusCode": 400,
  "message": "Validation failed",
  "errors": {
    "name": ["Name is required"],
    "price": ["Price must be a valid number"]
  },
  "correlationId": "req_550e8400-e29b-41d4-a716-446655440000"
}
```

### 401 Unauthorized

**Request:**
```bash
GET /api/v1/admin/users \
  -H "Authorization: Bearer invalid-token"
```

**Response:**
```json
{
  "statusCode": 401,
  "message": "Unauthorized",
  "errors": null,
  "correlationId": "req_550e8400-e29b-41d4-a716-446655440001"
}
```

### 403 Forbidden

**Request:**
```bash
PATCH /api/v1/admin/shop/1/price \
  -H "Authorization: Bearer user-token" \
  -H "Content-Type: application/json" \
  -d '{"price": 99.99}'
```

**Response:**
```json
{
  "statusCode": 403,
  "message": "Access denied. Admin role required.",
  "errors": null,
  "correlationId": "req_550e8400-e29b-41d4-a716-446655440002"
}
```

### 404 Not Found

**Request:**
```bash
GET /api/v1/shop/999
```

**Response:**
```json
{
  "statusCode": 404,
  "message": "Shop item with ID 999 not found",
  "errors": null,
  "correlationId": "req_550e8400-e29b-41d4-a716-446655440003"
}
```

### 409 Conflict

**Request:**
```bash
POST /api/v1/community-chest \
  -H "Content-Type: application/json" \
  -d '{"instruction": "duplicate-key", ...}'
```

**Response:**
```json
{
  "statusCode": 409,
  "message": "A Community Chest card with this instruction already exists",
  "errors": null,
  "correlationId": "req_550e8400-e29b-41d4-a716-446655440004"
}
```

### 422 Unprocessable Entity

**Request:**
```bash
POST /api/v1/uploads \
  -F "file=@malware.exe"
```

**Response:**
```json
{
  "statusCode": 422,
  "message": "File contains malicious content and cannot be uploaded",
  "errors": null,
  "correlationId": "req_550e8400-e29b-41d4-a716-446655440005"
}
```

### 500 Internal Server Error

**Request:**
```bash
GET /api/v1/analytics/dashboard
```

**Response:**
```json
{
  "statusCode": 500,
  "message": "Internal server error",
  "errors": null,
  "correlationId": "req_550e8400-e29b-41d4-a716-446655440006"
}
```

---

## Implementation

### Backend

**Global Exception Filter:** `backend/src/common/filters/http-exception.filter.ts`

- Catches all exceptions (HTTP and uncaught)
- Generates `correlationId` if missing from request
- Ensures response conforms to canonical shape
- Logs full error details (including stack) server-side
- Never includes stack trace in JSON response body

**Usage:**
```typescript
// All errors automatically caught and formatted
throw new BadRequestException('Validation failed');
// Output:
// { statusCode: 400, message: 'Validation failed', errors: null, correlationId: 'req_...' }
```

### Module Error Mappers

All modules use the canonical shape when throwing errors:

**Example (community-chest):**
```typescript
// OLD (non-canonical):
throw new BadRequestException({
  statusCode: 400,
  message: 'Validation failed',
  error: CommunityChestErrorCode.VALIDATION_ERROR,  // Custom field
  details: {...}  // Non-standard field name
});

// NEW (canonical):
throw new BadRequestException({
  statusCode: 400,
  message: 'Validation failed',
  errors: {...}  // Standard field name
});
```

**Modules updated:**
- ✅ `community-chest-error-mapper.service.ts`
- ✅ `uploads-error-mapper.service.ts`
- ✅ All other module mappers

### Frontend

**Error Parser:** `frontend/src/lib/api/errors.ts`

- `parseErrorResponse(res)` — Extracts canonical shape from API response
- `TycoonApiError` class — Normalized error for frontend consumption
- Helper functions: `isApiError()`, `isValidationError()`, `isUnauthorized()`

**Usage:**
```typescript
try {
  const data = await apiClient.post('/shop', { name: '', price: 'invalid' });
} catch (err) {
  if (isValidationError(err)) {
    // err.errors = { name: ['Name is required'], ... }
    // Display field-level validation errors
    const nameErrors = err.errors?.name || [];
  } else if (isUnauthorized(err)) {
    // Redirect to login
    redirect('/login');
  }

  // Use correlationId for support tickets / debugging
  console.log(`Error tracking ID: ${err.correlationId}`);
}
```

---

## Correlation IDs

### What is a correlation ID?

A unique identifier assigned to each API request, allowing you to trace errors across logs even when the request passes through multiple systems.

### Format

- **Generated:** `req_<UUID>` (e.g., `req_550e8400-e29b-41d4-a716-446655440000`)
- **Custom (via header):** Pass `x-correlation-id: <your-id>` in request headers to use your own ID

### Usage

**In logs:**
```
[req_550e8400-e29b-41d4-a716-446655440000] POST /api/v1/shop - 400 - Validation failed
```

**In error responses:**
```json
{
  "statusCode": 400,
  "message": "Validation failed",
  "errors": {...},
  "correlationId": "req_550e8400-e29b-41d4-a716-446655440000"
}
```

**In frontend error UI:**
```
"Error tracking ID: req_550e8400-e29b-41d4-a716-446655440000 — include this in support tickets"
```

### Tracing with correlation IDs

```bash
# Find all logs for a specific request
kubectl logs -l app=tycoon-backend | grep "req_550e8400-e29b-41d4-a716-446655440000"

# In DataDog/Splunk/ELK:
correlation_id: "req_550e8400-e29b-41d4-a716-446655440000"
```

---

## ERROR_TRACKING Correlation (Issue #1734)

### Contract

The frontend ERROR_TRACKING pipeline correlates every reported error with the backend
`correlationId` returned in the canonical error response. This is the single source of
truth for joining a player-facing error report to backend logs.

- The backend `correlationId` is the **requestId** used for correlation.
- The frontend MUST attach `correlationId` to every error report when present.
- When the response is not parseable (network failure, non-JSON body, 500 without body),
  the frontend MUST still report the error with `correlationId: null` and a
  `correlationSource: "unavailable"` marker — never fabricate an ID.
- The frontend MUST NOT send PII, tokens, or raw request bodies in the report payload.

### Frontend report shape

```typescript
type ErrorTrackingReport = {
  message: string;
  statusCode: number | null;
  correlationId: string | null; // backend requestId, null when unavailable
  correlationSource: 'backend' | 'unavailable';
  route: string;
  timestamp: string; // ISO-8601
};
```

### Null-guard rules (strict TypeScript)

1. `correlationId` is `string | null`; never coerce `undefined` to `"undefined"`.
2. Only accept a correlation ID matching `/^req_[0-9a-f-]{36}$/i`; otherwise treat as unavailable.
3. `statusCode` is `number | null`; a missing status is not `0`.
4. Reports are emitted only after telemetry consent is granted (see consent gate).

### UI requirements

- Error surfaces render the tracking ID when `correlationId !== null`:
  `Error tracking ID: <correlationId> — include this in support tickets`.
- When `correlationId === null`, render a generic message without an empty ID slot.
- The tracking ID element is focusable and reachable in keyboard focus order; it is
  announced via `aria-live="polite"` when it appears after an async failure.
- Loading, empty, and error states are all covered; no MSW handlers ship in the prod bundle.

### Backend requirements

- `HttpExceptionFilter` always emits `correlationId` (generated or echoed from
  `x-correlation-id`).
- The filter echoes the same `correlationId` in the `x-correlation-id` response header so
  clients can correlate even when the body is truncated by a proxy.
- 500 responses keep `correlationId` populated and `errors: null`.

---

## Migration Guide

### For Backend Developers

**Task:** Update any custom error mappers to return canonical shape

**Before:**
```typescript
throw new BadRequestException({
  statusCode: 400,
  message: 'Error message',
  error: ErrorCode.SOME_ERROR,  // ❌ Custom field
  details: {...}  // ❌ Wrong field name
});
```

**After:**
```typescript
throw new BadRequestException({
  statusCode: 400,
  message: 'Error message',
  errors: {...}  // ✅ Standard field
});
// correlationId is added automatically by HttpExceptionFilter
```

**Testing:**
```bash
cd backend
npm run test -- api-error-response-shape.spec.ts
```

### For Frontend Developers

**Task:** Update error handling to use new shape

**Before:**
```typescript
if (err.details?.field) {
  // Handle err.details
}
```

**After:**
```typescript
if (err.errors?.field) {
  // Handle err.errors
}

// Access correlation ID for debugging
console.log(`Error ID: ${err.correlationId}`);
```

**Testing:**
```bash
cd frontend
npm run test -- errors.test.ts
```

---

## Testing

### Backend Tests

Verify HttpExceptionFilter always emits canonical shape:

```bash
cd backend
npm run test -- api-error-response-shape.spec.ts
```

### Frontend Tests

Verify the error parser and ERROR_TRACKING correlation:

```bash
cd frontend
npm run test -- errors.test.ts error-tracking.test.ts
```

### E2E

Playwright critical journeys assert the tracking ID is rendered on a forced 500 and that
no MSW handlers are present in the production bundle (`bundle:check`).
