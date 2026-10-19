import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockIsStaging = vi.fn();

vi.mock('@/lib/metadata', () => ({
  siteConfig: { url: 'https://example.com' },
  isStaging: () => mockIsStaging(),
}));

import robots from './robots';

describe('robots', () => {
  beforeEach(() => {
    mockIsStaging.mockReset();
  });

  it('disallows all crawlers in staging', () => {
    mockIsStaging.mockReturnValue(true);

    const result = robots();

    expect(result.rules).toEqual({ userAgent: '*', disallow: '/' });
    expect(result.sitemap).toBe('https://example.com/sitemap.xml');
  });

  it('allows crawlers with a per-bot allow list in production', () => {
    mockIsStaging.mockReturnValue(false);

    const result = robots();

    const rules = Array.isArray(result.rules) ? result.rules : [result.rules];

    const googlebot = rules.find((rule) => rule.userAgent === 'Googlebot');
    expect(googlebot).toBeDefined();
    expect(googlebot?.allow).toBe('/');

    const wildcard = rules.find((rule) => rule.userAgent === '*');
    expect(wildcard).toBeDefined();
    expect(wildcard?.crawlDelay).toBe(1);

    expect(result.sitemap).toBe('https://example.com/sitemap.xml');
  });
});
