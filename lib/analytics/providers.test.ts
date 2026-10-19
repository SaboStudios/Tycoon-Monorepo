import {
  ALLOWED_ANALYTICS_PROVIDERS,
  parseAnalyticsProviders,
  getAnalyticsProviders,
  isAnalyticsEnabled,
} from './providers';
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

describe('getAnalyticsProviders / isAnalyticsEnabled (lazy env resolution, #1971)', () => {
  const ORIGINAL_ENV = process.env.NEXT_PUBLIC_ANALYTICS_PROVIDERS;

  afterEach(() => {
    if (ORIGINAL_ENV === undefined) {
      delete process.env.NEXT_PUBLIC_ANALYTICS_PROVIDERS;
    } else {
      process.env.NEXT_PUBLIC_ANALYTICS_PROVIDERS = ORIGINAL_ENV;
    }
  });

  it('resolves to an empty provider list when the env var is unset', () => {
    delete process.env.NEXT_PUBLIC_ANALYTICS_PROVIDERS;
    expect(getAnalyticsProviders()).toEqual([]);
    expect(isAnalyticsEnabled(true)).toBe(false);
  });

  it('is disabled even with consent when no providers are configured', () => {
    process.env.NEXT_PUBLIC_ANALYTICS_PROVIDERS = '';
    expect(isAnalyticsEnabled(true)).toBe(false);
  });

  it('enables analytics once a known provider is configured and consent is granted', () => {
    process.env.NEXT_PUBLIC_ANALYTICS_PROVIDERS = 'plausible';
    expect(getAnalyticsProviders()).toEqual(['plausible']);
    expect(isAnalyticsEnabled(true)).toBe(true);
    expect(isAnalyticsEnabled(false)).toBe(false);
  });

  it('throws when the env var names an unknown provider', () => {
    process.env.NEXT_PUBLIC_ANALYTICS_PROVIDERS = 'bogus-provider';
    expect(() => getAnalyticsProviders()).toThrow(
      /Unknown NEXT_PUBLIC_ANALYTICS_PROVIDERS/,
    );
    expect(() => isAnalyticsEnabled(true)).toThrow(
      /Unknown NEXT_PUBLIC_ANALYTICS_PROVIDERS/,
    );
  });
});
