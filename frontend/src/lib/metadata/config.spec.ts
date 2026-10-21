import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe('metadata config', () => {
  it.each([
    ['staging', true], ['preview', true], ['development', true], ['production', false], [undefined, false],
  ] as const)('detects environment %s', async (environment, expected) => {
    vi.stubEnv('NEXT_PUBLIC_APP_ENV', environment);
    const { isStaging } = await import('./config');
    expect(isStaging()).toBe(expected);
  });

  it.each(['https://staging.example.com', 'https://example.com', 'https://example.com/'])('joins paths to %s', async base => {
    vi.stubEnv('NEXT_PUBLIC_APP_URL', base);
    vi.resetModules();
    const { getCanonicalUrl } = await import('./config');
    for (const path of ['/shop', 'shop']) {
      expect(getCanonicalUrl(path)).toBe(`${base.replace(/\/$/, '')}/shop`);
    }
    expect(getCanonicalUrl()).toBe(base);
  });
});
