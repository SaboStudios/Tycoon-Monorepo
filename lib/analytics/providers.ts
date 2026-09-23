// Analytics provider configuration.
//
// NEXT_PUBLIC_ANALYTICS_PROVIDERS is a comma-separated list of enabled
// analytics providers. An empty value disables analytics entirely.
// Unknown provider names are rejected so typos fail fast instead of
// silently disabling analytics.
//
// Consent-aware telemetry (SW-FE-039): analytics must only be emitted after
// the user has granted explicit consent. The provider registry below is
// deny-by-default — any provider name that is not registered here fails the
// build rather than silently shipping unvetted telemetry.

export const ALLOWED_ANALYTICS_PROVIDERS = [
  'google-analytics',
  'plausible',
  'posthog',
] as const;

export type AnalyticsProvider = (typeof ALLOWED_ANALYTICS_PROVIDERS)[number];

// Keys that must never appear in telemetry labels or payloads. Consent-aware
// telemetry scrubs PII before events leave the client.
const PII_KEY_PATTERN =
  /(email|e[-_]?mail|phone|address|wallet|secret|token|password|ssn|dob|birth|ip|user[-_]?id|player[-_]?id|name)/i;

const PII_VALUE_PATTERN =
  /([\w.+-]+@[\w-]+\.[\w.-]+)|(\b0x[a-f0-9]{6,}\b)|(\bG[A-Z2-7]{20,}\b)/i;

export function parseAnalyticsProviders(
  raw: string | undefined,
): AnalyticsProvider[] {
  const value = (raw ?? '').trim();
  if (value === '') {
    return [];
  }

  const names = value
    .split(',')
    .map((name) => name.trim())
    .filter((name) => name !== '');

  const unknown = names.filter(
    (name) => !(ALLOWED_ANALYTICS_PROVIDERS as readonly string[]).includes(name),
  );
  if (unknown.length > 0) {
    throw new Error(
      `Unknown NEXT_PUBLIC_ANALYTICS_PROVIDERS value(s): ${unknown.join(', ')}. ` +
        `Allowed values: ${ALLOWED_ANALYTICS_PROVIDERS.join(', ')}.`,
    );
  }

  return names as AnalyticsProvider[];
}

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
