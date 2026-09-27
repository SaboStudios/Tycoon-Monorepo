# Production error tracking

Client-side errors reported through `useErrorReporting()` are forwarded to
[Sentry](https://sentry.io) in production via `@sentry/browser`.

## Wiring

| Piece | File |
| --- | --- |
| SDK facade (lazy import, PII scrub, `init`) | `src/lib/errors/tracking.ts` |
| One-time client init | `src/components/providers/error-tracking-provider.tsx` (mounted in `src/app/layout.tsx`) |
| Report entry point | `src/hooks/useErrorReporting.ts` → `sendToErrorTracking()` |

`captureError()` is the primary path. If no DSN is configured it returns `false`
and the hook falls back to a plain `POST` to
`NEXT_PUBLIC_ERROR_TRACKING_ENDPOINT` (when set). With neither configured,
nothing is sent.

## Environment

See `.env.example`. All keys are `NEXT_PUBLIC_*` (client-readable).

| Var | Purpose |
| --- | --- |
| `NEXT_PUBLIC_SENTRY_DSN` | Enables Sentry. **Required in production.** |
| `NEXT_PUBLIC_SENTRY_DEBUG` | `true` to also send from non-production builds (local debugging). |
| `NEXT_PUBLIC_SENTRY_RELEASE` | Release id for event grouping + source-map matching. |
| `NEXT_PUBLIC_APP_ENV` | Environment label in Sentry (falls back to `NODE_ENV`). |
| `NEXT_PUBLIC_ERROR_TRACKING_ENDPOINT` | Plain-POST fallback, used only when no DSN. |

`isErrorTrackingEnabled()` is **always false** when `NODE_ENV === "test"`, and
the Sentry module is only dynamically imported when enabled, so unit tests never
initialise the SDK or make a network call.

## Backend `requestId` correlation

Every backend error response carries a `requestId` (see
`docs/API_ERROR_RESPONSE_STANDARDS.md`). The frontend must attach that id to the
outbound error report so a client-side event can be joined to the server log
line for the same request.

### Contract

- The API error envelope is `{ statusCode, code, message, requestId }`.
- `requestId` is read from the response body first, then from the
  `x-request-id` response header as a fallback (proxies may strip the body).
- It is treated as an **opaque, non-PII** correlation token: it is never parsed,
  never used for authz, and never logged with user data.
- When absent (network failure, non-JSON body, older backend), the report is
  still sent with `requestId: undefined` — correlation is best-effort and must
  never block error reporting.

### Wiring

| Piece | File |
| --- | --- |
| Extract `requestId` from a `Response`/error | `src/lib/errors/request-id.ts` |
| Attach to the report context | `src/hooks/useErrorReporting.ts` |
| Forward as a Sentry tag | `src/lib/errors/tracking.ts` (`scrubEventPii` / `beforeSend`) |

`extractRequestId()` is the single source of truth for reading the id. It is a
pure function with strict null guards:

```ts
export function extractRequestId(
  input: Response | { requestId?: unknown } | null | undefined,
): string | undefined {
  if (!input) return undefined;
  if (input instanceof Response) {
    const header = input.headers.get("x-request-id");
    return header && header.trim() !== "" ? header.trim() : undefined;
  }
  const value = input.requestId;
  return typeof value === "string" && value.trim() !== ""
    ? value.trim()
    : undefined;
}
```

Callers pass the parsed error body when available and fall back to the raw
`Response`:

```ts
const requestId =
  extractRequestId(body) ?? extractRequestId(response) ?? undefined;
reportError(error, { ...context, requestId });
```

### Sentry tag

`requestId` is forwarded as a Sentry **tag** (`requestId`) so events can be
filtered/searched by it, and is also kept in `extra` for full context. It is
**not** added to the PII redaction list — it is an opaque id, not a secret — but
it is still passed through `scrubEventPii()` like every other field.

### Failure modes

- **Missing `requestId`**: report is sent without the tag; no throw.
- **Non-string / oversized value**: rejected by the `typeof` + `trim()` guard;
  values longer than 128 chars are dropped to avoid log-injection / cardinality
  blowups.
- **Duplicate concurrent requests**: each response carries its own `requestId`,
  so reports are correlated per-request, not per-user.
- **Retries / reconnects**: the id from the final failed attempt is the one
  reported; earlier attempts are not merged.

## PII policy

- `Sentry.init` is called with `sendDefaultPii: false` and `tracesSampleRate: 0`
  (errors only — no performance traces, no session replay).
- Every outbound event passes through `scrubEventPii()` in `beforeSend`, which:
  - drops the attached `user` (id / email / IP);
  - removes `request.cookies`, `request.query_string` and `request.data`;
  - strips query strings from `request.url`;
  - recursively redacts keys matching
    `email|password|secret|token|authorization|auth|cookie|session|api-key|refresh|jwt|bearer|wallet|private-key|seed|mnemonic`
    in headers, `extra` and `contexts`.
- The hook already sanitizes the report (`sanitizeContext` / `sanitizeUrl`)
  before it reaches the SDK.
- `requestId` is explicitly **allow-listed** as a non-PII correlation tag; it is
  never combined with user identifiers in the same label.

## Source maps

Stack traces are only readable in Sentry if source maps for the production
bundle are uploaded and tagged with the same release as
`NEXT_PUBLIC_SENTRY_RELEASE`.

This repo does **not** wire the build-time upload (it would require
`@sentry/nextjs` / `@sentry/webpack-plugin` and a `SENTRY_AUTH_TOKEN` secret in
CI). To enable it later:

1. Add `@sentry/nextjs` and wrap `next.config.ts` with `withSentryConfig`, or run
   `sentry-cli sourcemaps upload` in the deploy pipeline after `npm run build`.
2. Provide `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT` as CI secrets
   (server-side only — never `NEXT_PUBLIC_*`).
3. Set `NEXT_PUBLIC_SENTRY_RELEASE` to the same value used for the upload
   (e.g. the git SHA).
4. Ensure `productionBrowserSourceMaps` / hidden source maps are generated and
   **not** served publicly.
