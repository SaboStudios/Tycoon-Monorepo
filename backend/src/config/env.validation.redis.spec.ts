/**
 * SW-BE-007 — Redis / cache env validation regression tests.
 * Keeps Joi defaults for REDIS_* and CACHE_AUDIT_ENABLED aligned with redis.config.ts expectations.
 */
import { validationSchema } from './env.validation';

/** Minimal valid payload for development-shaped validation (required DB + JWT defaults). */
function minimalDevEnv(overrides: Record<string, unknown> = {}) {
  return {
    NODE_ENV: 'development',
    DB_USERNAME: 'tycoon',
    DB_PASSWORD: 'tycoon',
    DB_DATABASE: 'tycoon',
    ...overrides,
  };
}

describe('env.validation — Redis (SW-BE-007)', () => {
  it('applies Redis defaults when vars are omitted', () => {
    const { error, value } = validationSchema.validate(minimalDevEnv(), {
      abortEarly: false,
    });
    expect(error).toBeUndefined();
    expect(value.REDIS_HOST).toBe('localhost');
    expect(value.REDIS_PORT).toBe(6379);
    expect(value.REDIS_DB).toBe(0);
    expect(value.REDIS_TTL).toBe(300);
    expect(value.CACHE_AUDIT_ENABLED).toBe(false);
  });

  it('accepts explicit Redis connection settings', () => {
    const { error, value } = validationSchema.validate(
      minimalDevEnv({
        REDIS_HOST: 'redis.internal',
        REDIS_PORT: 6380,
        REDIS_DB: 2,
        REDIS_TTL: 120,
        REDIS_PASSWORD: 'not-for-logs',
      }),
    );
    expect(error).toBeUndefined();
    expect(value.REDIS_HOST).toBe('redis.internal');
    expect(value.REDIS_PORT).toBe(6380);
    expect(value.REDIS_DB).toBe(2);
    expect(value.REDIS_TTL).toBe(120);
    expect(value.REDIS_PASSWORD).toBe('not-for-logs');
  });

  it('coerces CACHE_AUDIT_ENABLED from string true', () => {
    const { error, value } = validationSchema.validate(
      minimalDevEnv({ CACHE_AUDIT_ENABLED: 'true' }),
    );
    expect(error).toBeUndefined();
    expect(value.CACHE_AUDIT_ENABLED).toBe(true);
  });

  it('rejects invalid REDIS_PORT', () => {
    const { error } = validationSchema.validate(
      minimalDevEnv({ REDIS_PORT: 'not-a-port' }),
      { abortEarly: false },
    );
    expect(error).toBeDefined();
    expect(error?.message).toMatch(/REDIS_PORT/i);
  });
});
