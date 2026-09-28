// Analytics provider configuration (repo-root shim).
//
// The allowlist lives in exactly one place:
//   frontend/src/lib/analytics/allowlist.ts
// This module re-exports it so root-level tooling and the frontend can never
// disagree about which providers exist (#1761). Previously this file listed
// `google-analytics` while the frontend used `ga4`, so a value accepted here
// was silently dropped at runtime.
//
// NEXT_PUBLIC_ANALYTICS_PROVIDERS is a comma-separated list of enabled
// analytics providers. An empty value disables analytics entirely.
// Unknown provider names are rejected so typos fail fast instead of
// silently disabling analytics; next.config.ts runs the same check so an
// unknown provider fails `next build`.
//
// Consent-aware telemetry (SW-FE-039): analytics must only be emitted after
// the user has granted explicit consent. The runtime consent store is
// frontend/src/lib/analytics/consent.ts.

import {
  ANALYTICS_PROVIDER_IDS,
  parseAnalyticsProviders,
  type AnalyticsProviderName,
} from '../../frontend/src/lib/analytics/allowlist';

export { parseAnalyticsProviders };

export const ALLOWED_ANALYTICS_PROVIDERS = ANALYTICS_PROVIDER_IDS;

export type AnalyticsProvider = AnalyticsProviderName;

// Keys that must never appear in telemetry labels or payloads. Consent-aware
// telemetry scrubs PII before events leave the client.
const PII_KEY_PATTERN =
  /(email|e[-_]?mail|phone|address|wallet|secret|token|password|ssn|dob|birth|ip|user[-_]?id|player[-_]?id|name)/i;

const PII_VALUE_PATTERN =
  /([\w.+-]+@[\w-]+\.[\w.-]+)|(\b0x[a-f0-9]{6,}\b)|(\bG[A-Z2-7]{20,}\b)/i;

export const analyticsProviders = parseAnalyticsProviders(
  process.env.NEXT_PUBLIC_ANALYTICS_PROVIDERS,
);

/**
 * Whether analytics may emit at all. Requires at least one registered provider
 * and an explicit consent grant. Deny-by-default: absent consent means no
 * telemetry is sent.
 */
export function isAnalyticsEnabled(consentGranted: boolean): boolean {
  return consentGranted === true && analyticsProviders.length > 0;
}

/**
 * Scrub PII from a telemetry label. Returns a redacted placeholder when the
 * label looks like an email, wallet address, or other identifier so raw PII
 * never reaches an analytics provider.
 */
export function scrubTelemetryLabel(label: string): string {
  if (typeof label !== 'string' || label === '') {
    return '';
  }
  return PII_VALUE_PATTERN.test(label) ? '[redacted]' : label;
}

/**
 * Scrub PII from a telemetry payload. Keys matching known PII patterns are
 * dropped and string values that look like identifiers are redacted. Nested
 * objects are scrubbed recursively; arrays are mapped element-wise.
 */
export function scrubTelemetryPayload(
  payload: Record<string, unknown>,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(payload)) {
    if (PII_KEY_PATTERN.test(key)) {
      continue;
    }
    if (typeof value === 'string') {
      result[key] = scrubTelemetryLabel(value);
    } else if (Array.isArray(value)) {
      result[key] = value.map((item) =>
        typeof item === 'string' ? scrubTelemetryLabel(item) : item,
      );
    } else if (value !== null && typeof value === 'object') {
      result[key] = scrubTelemetryPayload(value as Record<string, unknown>);
    } else {
      result[key] = value;
    }
  }
  return result;
}
