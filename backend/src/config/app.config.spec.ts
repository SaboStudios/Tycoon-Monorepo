import { appConfig } from './app.config';

describe('appConfig', () => {
  const originalEnv = process.env;

  afterEach(() => {
    process.env = originalEnv;
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
