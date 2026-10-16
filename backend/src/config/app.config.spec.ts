import { appConfig, parseCorsOrigins, validateCorsOrigins } from './app.config';

describe('appConfig', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.CORS_ALLOWED_ORIGINS;
    delete process.env.CORS_ORIGIN;
    delete process.env.CORS_MAX_AGE;
    delete process.env.NODE_ENV;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

import { appConfig, parseCorsOrigins, validateCorsOrigins } from './app.config';

describe('CORS origin configuration', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.CORS_ALLOWED_ORIGINS;
    delete process.env.CORS_ORIGIN;
    delete process.env.CORS_MAX_AGE;
    delete process.env.NODE_ENV;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('parseCorsOrigins', () => {
    it('splits comma-separated origins, trims whitespace and drops empty entries', () => {
      process.env.CORS_ALLOWED_ORIGINS =
        'https://app.example.com, https://admin.example.com ,, https://api.example.com ';

      expect(parseCorsOrigins()).toEqual([
        'https://app.example.com',
        'https://admin.example.com',
        'https://api.example.com',
      ]);
    });

    it('honours the legacy CORS_ORIGIN variable', () => {
      process.env.CORS_ORIGIN = 'https://legacy.example.com';

      expect(parseCorsOrigins()).toEqual(['https://legacy.example.com']);
    });

    it('prefers CORS_ALLOWED_ORIGINS over the legacy CORS_ORIGIN variable', () => {
      process.env.CORS_ALLOWED_ORIGINS = 'https://app.example.com';
      process.env.CORS_ORIGIN = 'https://legacy.example.com';

      expect(parseCorsOrigins()).toEqual(['https://app.example.com']);
    });

    it('falls back to the development default when nothing is configured', () => {
      process.env.NODE_ENV = 'development';

      expect(parseCorsOrigins()).toEqual(['http://localhost:3000']);
    });
  });

  describe('validateCorsOrigins', () => {
    it('throws in production when no origins are configured', () => {
      process.env.NODE_ENV = 'production';

      expect(() => validateCorsOrigins()).toThrow();
    });

    it('throws for an invalid origin and names the offending origin', () => {
      process.env.CORS_ALLOWED_ORIGINS = 'not-a-valid-url';

      expect(() => validateCorsOrigins()).toThrow(/not-a-valid-url/);
    });

    it('throws when CORS_MAX_AGE is below zero', () => {
      process.env.CORS_ALLOWED_ORIGINS = 'https://app.example.com';
      process.env.CORS_MAX_AGE = '-1';

      expect(() => validateCorsOrigins()).toThrow();
    });

    it('accepts valid origins', () => {
      process.env.CORS_ALLOWED_ORIGINS = 'https://app.example.com,https://admin.example.com';

      expect(() => validateCorsOrigins()).not.toThrow();
    });
  });

  describe('CORS_MAX_AGE', () => {
    it('throws when CORS_MAX_AGE is non-numeric', () => {
      process.env = { ...originalEnv, CORS_MAX_AGE: 'abc' };

      expect(() => appConfig()).toThrow(
        'CORS_MAX_AGE must be a non-negative integer',
      );
    });

    it('throws when CORS_MAX_AGE is negative', () => {
      process.env = { ...originalEnv, CORS_MAX_AGE: '-1' };

      expect(() => appConfig()).toThrow(
        'CORS_MAX_AGE must be a non-negative integer',
      );
    });

    it('returns the parsed value when CORS_MAX_AGE is a non-negative integer', () => {
      process.env = { ...originalEnv, CORS_MAX_AGE: '3600' };

      expect(appConfig().corsMaxAge).toBe(3600);
    });
  });
});
    });
  });
});
