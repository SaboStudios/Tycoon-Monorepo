# Backend Logging & Error Tracking

This document describes how the Tycoon backend (NestJS 11) emits structured logs and how
those logs correlate with the frontend ERROR_TRACKING pipeline.

See also:

- `frontend/docs/ERROR_TRACKING.md` — frontend error reporting contract
- `docs/API_ERROR_RESPONSE_STANDARDS.md` — canonical API error envelope

## Request ID correlation

Every inbound HTTP request is assigned a `requestId`. The backend is the source of truth
for this identifier and MUST return it to the client so the frontend can attach it to
error reports.

### Generation

- If the client sends an `x-request-id` header, the backend validates it (UUID v4 shape,
  max 128 chars) and reuses it. Invalid or oversized values are discarded and a fresh
  UUID v4 is generated.
- Otherwise the backend generates a UUID v4.
- The resolved `requestId` is stored on the request context and echoed back on the
  response as the `x-request-id` header for **all** responses, including errors.

### Error envelope

All error responses follow `docs/API_ERROR_RESPONSE_STANDARDS.md` and include the
`requestId` so the frontend can correlate a user-visible failure with backend logs:

```json
{
  "statusCode": 500,
  "error": "Internal Server Error",
  "message": "Something went wrong",
  "requestId": "3f1c2b7a-9d4e-4c1a-8b2f-6a0e5d9c1f23"
}
```

- `requestId` is always present on error responses (4xx and 5xx).
- `requestId` is never derived from user input beyond the validated `x-request-id` header.
- The same `requestId` appears in the corresponding structured log line.

### Structured log fields

Each request log line includes at minimum:

| Field       | Description                                             |
| ----------- | ------------------------------------------------------- |
| `requestId` | Correlation id (matches `x-request-id` response header) |
| `method`    | HTTP method                                             |
| `path`      | Route path (no query string)                            |
| `status`    | Response status code                                    |
| `durationMs`| Handler duration in milliseconds                        |

Error log lines additionally include `errorName` and `errorMessage`. Stack traces are
logged server-side only and are never returned to clients.

## PII and secret handling

- Never log tokens, cookies, `Authorization` headers, wallet secrets, or raw request
  bodies that may contain credentials.
- Redact known-sensitive keys (`authorization`, `cookie`, `set-cookie`, `password`,
  `token`, `secret`) before serialization.
- Telemetry labels must not contain PII; use `requestId` for correlation instead of
  user identifiers.

## Frontend correlation

When the frontend receives an error response, it reads `requestId` from the body (or the
`x-request-id` header as a fallback) and includes it in the ERROR_TRACKING report. This
lets support and on-call engineers pivot from a user report directly to the backend log
line via `requestId`.

If `requestId` is missing or malformed, the frontend reports the error without a
correlation id rather than fabricating one.
