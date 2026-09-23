// Analytics provider configuration.
//
// NEXT_PUBLIC_ANALYTICS_PROVIDERS is a comma-separated list of enabled
// analytics providers. An empty value disables analytics entirely.
// Unknown provider names are rejected so typos fail fast instead of
// silently disabling analytics.

export const ALLOWED_ANALYTICS_PROVIDERS = [
  'google-analytics',
  'plausible',
  'posthog',
] as const;

export type AnalyticsProvider = (typeof ALLOWED_ANALYTICS_PROVIDERS)[number];

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
