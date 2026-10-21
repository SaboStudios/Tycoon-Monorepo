import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe('metadata helpers', () => {
  it.each([
    ['staging', 'https://staging.example.com', false],
    ['production', 'https://example.com', true],
  ] as const)('composes defaults and page canonicals for %s', async (environment, base, index) => {
    vi.stubEnv('NEXT_PUBLIC_APP_ENV', environment);
    vi.stubEnv('NEXT_PUBLIC_APP_URL', base);
    vi.resetModules();
    const { siteConfig, getCanonicalUrl } = await import('./config');
    const { generateBaseMetadata, generatePageMetadata } = await import('./helpers');
    const defaults = generateBaseMetadata();
    expect(defaults.title).toEqual({ default: siteConfig.name, template: `%s | ${siteConfig.name}` });
    expect(defaults.description).toBe(siteConfig.description);
    expect(defaults.robots).toMatchObject({ index, follow: index });
    const page = generatePageMetadata({ title: 'Shop', description: 'Browse the shop', canonicalPath: '/shop' });
    expect(page.alternates?.canonical).toBe(getCanonicalUrl('/shop'));
    expect(page.alternates?.canonical).toBe(`${base}/shop`);
    expect(page.openGraph).toMatchObject({ url: `${base}/shop` });
    expect(page.robots).toEqual({ index, follow: index });
  });
});
