import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockIsStaging = vi.fn();

vi.mock('@/lib/metadata', () => ({
  siteConfig: { url: 'https://example.com' },
  isStaging: () => mockIsStaging(),
}));

import sitemap from './sitemap';

describe('sitemap', () => {
  beforeEach(() => {
    mockIsStaging.mockReset();
  });

  it('returns an empty sitemap in staging', () => {
    mockIsStaging.mockReturnValue(true);

    expect(sitemap()).toEqual([]);
  });

  it('returns the five documented routes with their priorities in production', () => {
    mockIsStaging.mockReturnValue(false);

    const entries = sitemap();

    expect(entries).toHaveLength(5);

    const byUrl = new Map(entries.map((entry) => [entry.url, entry.priority]));

    expect(byUrl.get('https://example.com/')).toBe(1);
    expect(byUrl.get('https://example.com/play-ai')).toBe(0.8);
    expect(byUrl.get('https://example.com/trade-demo')).toBe(0.7);
    expect(byUrl.get('https://example.com/join-room')).toBe(0.6);
    expect(byUrl.get('https://example.com/game-settings')).toBe(0.5);
  });
});
