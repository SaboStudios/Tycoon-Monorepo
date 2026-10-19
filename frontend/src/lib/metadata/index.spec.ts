import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  siteConfig,
  isStaging,
  getCanonicalUrl,
  defaultPageMetadata,
  generatePageMetadata,
} from './index';

describe('metadata barrel', () => {
  const originalEnv = process.env.NEXT_PUBLIC_ENV;

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.NEXT_PUBLIC_ENV;
    } else {
      process.env.NEXT_PUBLIC_ENV = originalEnv;
    }
    vi.restoreAllMocks();
  });

  describe('getCanonicalUrl', () => {
    it('returns an absolute URL built from siteConfig origin', () => {
      const url = getCanonicalUrl('/some/path');
      expect(url).toContain(siteConfig.url);
      expect(url.startsWith('http')).toBe(true);
      expect(url).toContain('/some/path');
    });

    it('handles the root path', () => {
      const url = getCanonicalUrl('/');
      expect(url).toContain(siteConfig.url);
    });
  });

  describe('isStaging', () => {
    it('returns true when the staging environment flag is set', () => {
      process.env.NEXT_PUBLIC_ENV = 'staging';
      expect(isStaging()).toBe(true);
    });

    it('returns false for production', () => {
      process.env.NEXT_PUBLIC_ENV = 'production';
      expect(isStaging()).toBe(false);
    });
  });

  describe('generatePageMetadata', () => {
    it('includes default metadata fields when only a title is supplied', () => {
      const metadata = generatePageMetadata({ title: 'Test Page' });
      expect(metadata.title).toBe('Test Page');
      expect(metadata.description).toBe(defaultPageMetadata.description);
      expect(metadata.openGraph).toBeDefined();
      expect(metadata.twitter).toBeDefined();
    });
  });
});
