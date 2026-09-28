import { ALLOWED_ANALYTICS_PROVIDERS, parseAnalyticsProviders } from './providers';
import { ANALYTICS_PROVIDER_IDS } from '../../frontend/src/lib/analytics/allowlist';

describe('parseAnalyticsProviders', () => {
  it('returns an empty list when the value is empty (analytics off)', () => {
    expect(parseAnalyticsProviders('')).toEqual([]);
    expect(parseAnalyticsProviders(undefined)).toEqual([]);
  });

  it('accepts known providers', () => {
    expect(parseAnalyticsProviders('plausible')).toEqual(['plausible']);
    expect(parseAnalyticsProviders('plausible, posthog')).toEqual([
      'plausible',
      'posthog',
    ]);
  });

  it('throws on unknown providers', () => {
    expect(() => parseAnalyticsProviders('plausable')).toThrow(
      /Unknown NEXT_PUBLIC_ANALYTICS_PROVIDERS/,
    );
  });

  it('shares one allowlist with the frontend (no drift)', () => {
    expect(ALLOWED_ANALYTICS_PROVIDERS).toBe(ANALYTICS_PROVIDER_IDS);
    expect(parseAnalyticsProviders('ga4')).toEqual(['ga4']);
  });

  it('rejects the legacy google-analytics id instead of silently dropping it', () => {
    expect(() => parseAnalyticsProviders('google-analytics')).toThrow(
      /Unknown NEXT_PUBLIC_ANALYTICS_PROVIDERS/,
    );
  });
});
