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
