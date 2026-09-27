import { parseAnalyticsProviders } from './providers';

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
});
