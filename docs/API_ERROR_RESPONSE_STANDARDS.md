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
npm test -- http-exception.filter.spec.ts
```

### E2E Tests

Verify all endpoints return canonical shape:

```bash
cd backend
npm run test:e2e -- api-error-response-shape.e2e-spec.ts
```

### Frontend Tests

Verify error parser handles all response shapes:

```bash
cd frontend
npm test -- errors.test.ts
```

---

## No Intentional Outliers

All API errors conform to the canonical shape. There are no documented exceptions or routes that deviate from this standard.

| Module | Status | Notes |
|--------|--------|-------|
| community-chest | ✅ Updated | Now uses canonical shape |
| uploads | ✅ Updated | Now uses canonical shape |
| audit-trail | ✅ Compliant | Uses HttpExceptionFilter |
| admin-analytics | ✅ Compliant | Uses HttpExceptionFilter |
| perks | ✅ Compliant | Uses HttpExceptionFilter |
| waitlist | ✅ Compliant | Uses HttpExceptionFilter |
| shop | ✅ Compliant | Uses HttpExceptionFilter |
| auth | ✅ Compliant | Uses HttpExceptionFilter |

---

## Security Notes

### Production Safety

- **Stack traces:** Never included in response body (logged server-side only)
- **Sensitive details:** Error messages sanitized to not leak file paths, system info, or internal errors
- **Validation errors:** Field-level constraints visible for UX, but no internal implementation details
- **Correlation IDs:** Safe to include in error responses (UUID, not sensitive data)

### Error Message Guidelines

When throwing errors, keep messages user-facing:

```typescript
// ❌ DON'T (internal details)
throw new BadRequestException(`Database constraint violation: unique_email`);

// ✅ DO (user-facing)
throw new BadRequestException('Email is already in use');
```

---

## References

- **Issue:** #1445
- **Implementation Checklist:**
  - ✅ HttpExceptionFilter emits canonical shape with correlationId
  - ✅ All module mappers updated or verified compliant
  - ✅ Frontend error parser handles canonical shape
  - ✅ Tests confirm 400/401/409 sample responses match canonical shape
  - ✅ No stack traces in production error bodies
  - ✅ Documentation complete
