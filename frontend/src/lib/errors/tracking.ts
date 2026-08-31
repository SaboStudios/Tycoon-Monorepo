/**
 * Production error tracking.
 *
 * Wraps `@sentry/browser` behind a small, lazily-loaded facade so that:
 *   - the SDK is only downloaded/initialised when a DSN is configured;
 *   - nothing is sent from tests or (by default) local development;
 *   - every event is scrubbed of PII before it leaves the browser.
 *
 * Wiring:
 *   - `initErrorTracking()` is called once on the client by
 *     `components/providers/error-tracking-provider.tsx`.
 *   - `captureError()` is called by `hooks/useErrorReporting.ts` for every
 *     reported error, and falls back to a plain POST when no DSN is set.
 */

export interface ErrorTrackingReport {
  errorCode?: string;
  category: string;
  timestamp: string;
  component?: string;
  action?: string;
  context?: Record<string, string | number | boolean>;
  userAgent?: string;
  url?: string;
}

/** Minimal shape of the bits of `@sentry/browser` we use. */
interface SentryLike {
  init: (options: Record<string, unknown>) => void;
  captureException: (
    error: unknown,
    hint?: { captureContext?: Record<string, unknown> },
  ) => string;
}

/** Minimal shape of a Sentry event for the `beforeSend` scrubber. */
interface SentryEventLike {
  user?: unknown;
  request?: {
    url?: string;
    cookies?: unknown;
    headers?: Record<string, unknown>;
    query_string?: unknown;
    data?: unknown;
  };
  contexts?: Record<string, unknown>;
  extra?: Record<string, unknown>;
  [key: string]: unknown;
}

const SENSITIVE_KEY_PATTERN =
  /(email|e-mail|password|passwd|secret|token|authorization|auth|cookie|session|api[-_]?key|access[-_]?key|refresh|jwt|bearer|wallet|private[-_]?key|seed|mnemonic)/i;

let sentry: SentryLike | null = null;
let initPromise: Promise<void> | null = null;

// NEXT_PUBLIC_* vars must be referenced with a literal member expression so
// Next.js inlines them into the client bundle at build time.
const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN;
const SENTRY_DEBUG = process.env.NEXT_PUBLIC_SENTRY_DEBUG;
const SENTRY_RELEASE = process.env.NEXT_PUBLIC_SENTRY_RELEASE;
const APP_ENV = process.env.NEXT_PUBLIC_APP_ENV;

/** Not test, has a DSN, and either production or explicitly debugging. */
export function isErrorTrackingEnabled(): boolean {
  if (typeof window === "undefined") return false;
  if (process.env.NODE_ENV === "test") return false;
  if (!SENTRY_DSN) return false;
  return process.env.NODE_ENV === "production" || SENTRY_DEBUG === "true";
}

/**
 * Remove anything that could carry PII from an outbound event.
 * Exported for unit testing.
 */
export function scrubEventPii(event: SentryEventLike): SentryEventLike {
  // Sentry can attach the current user (IP, id, email) — never send it.
  delete event.user;

  if (event.request) {
    delete event.request.cookies;
    delete event.request.query_string;
    delete event.request.data;
    if (typeof event.request.url === "string") {
      event.request.url = stripUrl(event.request.url);
    }
    if (event.request.headers) {
      event.request.headers = scrubRecord(event.request.headers);
    }
  }

  if (event.extra) event.extra = scrubRecord(event.extra);
  if (event.contexts) {
    for (const key of Object.keys(event.contexts)) {
      const value = event.contexts[key];
      if (value && typeof value === "object") {
        event.contexts[key] = scrubRecord(value as Record<string, unknown>);
      }
    }
  }

  return event;
}

function scrubRecord(record: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(record)) {
    if (SENSITIVE_KEY_PATTERN.test(key)) {
      out[key] = "[redacted]";
      continue;
    }
    out[key] =
      value && typeof value === "object" && !Array.isArray(value)
        ? scrubRecord(value as Record<string, unknown>)
        : value;
  }
  return out;
}

function stripUrl(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.origin + parsed.pathname;
  } catch {
    return "[invalid-url]";
  }
}

/**
 * Initialise the tracking SDK. Safe to call more than once; a no-op when
 * tracking is disabled (no DSN / test / dev without the debug flag).
 */
export function initErrorTracking(): Promise<void> {
  if (initPromise) return initPromise;
  if (!isErrorTrackingEnabled()) {
    initPromise = Promise.resolve();
    return initPromise;
  }

  initPromise = import("@sentry/browser")
    .then((mod) => {
      const client = mod as unknown as SentryLike;
      client.init({
        dsn: SENTRY_DSN,
        environment: APP_ENV ?? process.env.NODE_ENV ?? "production",
        release: SENTRY_RELEASE,
        // Errors only — no session replay, no performance traces, no auto PII.
        sendDefaultPii: false,
        tracesSampleRate: 0,
        beforeSend: (event: SentryEventLike) => scrubEventPii(event),
      });
      sentry = client;
    })
    .catch(() => {
      // The SDK failed to load — degrade silently to the POST fallback.
      sentry = null;
    });

  return initPromise;
}

/**
 * Send a reported error to the tracking SDK.
 * Returns `true` when the SDK handled it, `false` when the caller should fall
 * back (e.g. to a plain endpoint POST).
 */
export function captureError(
  error: unknown,
  report: ErrorTrackingReport,
): boolean {
  if (!sentry) return false;
  try {
    sentry.captureException(error, {
      captureContext: {
        tags: {
          errorCode: report.errorCode ?? "unknown",
          category: report.category,
          component: report.component ?? "unknown",
          action: report.action ?? "unknown",
        },
        contexts: {
          report: {
            timestamp: report.timestamp,
            url: report.url,
            ...scrubRecord(report.context ?? {}),
          },
        },
      },
    });
    return true;
  } catch {
    return false;
  }
}

/** Test-only reset of module state. */
export function __resetErrorTrackingForTests(): void {
  sentry = null;
  initPromise = null;
}
