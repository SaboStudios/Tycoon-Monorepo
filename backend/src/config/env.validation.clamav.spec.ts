/**
 * ClamAV virus scan configuration validation (#1436).
 * Ensures production instances cannot boot without ClamAV configured,
 * preventing silent upload-scan failures that would leave unscanned files on S3.
 */
import { validationSchema } from './env.validation';

function minimalDevEnv(overrides: Record<string, unknown> = {}) {
  return {
    NODE_ENV: 'development',
    DB_USERNAME: 'tycoon',
    DB_PASSWORD: 'tycoon',
    DB_DATABASE: 'tycoon',
    ...overrides,
  };
}

describe('env.validation — ClamAV configuration (#1436)', () => {
  it('allows missing CLAMAV_HOST in development', () => {
    const { error, value } = validationSchema.validate(minimalDevEnv());
    expect(error).toBeUndefined();
    expect(value.CLAMAV_HOST).toBe('');
  });

  it('allows CLAMAV_HOST in development', () => {
    const { error, value } = validationSchema.validate(
      minimalDevEnv({ CLAMAV_HOST: 'localhost' }),
    );
    expect(error).toBeUndefined();
    expect(value.CLAMAV_HOST).toBe('localhost');
  });

  it('rejects missing CLAMAV_HOST in production', () => {
    const { error } = validationSchema.validate(
      minimalDevEnv({ NODE_ENV: 'production' }),
      { abortEarly: false },
    );
    expect(error).toBeDefined();
    expect(error?.message).toMatch(/CLAMAV_HOST/);
  });

  it('allows CLAMAV_HOST in production when set', () => {
    const { error, value } = validationSchema.validate(
      minimalDevEnv({
        NODE_ENV: 'production',
        CLAMAV_HOST: 'clamav.internal',
      }),
    );
    expect(error).toBeUndefined();
    expect(value.CLAMAV_HOST).toBe('clamav.internal');
  });

  it('accepts optional CLAMAV_PORT', () => {
    const { error, value } = validationSchema.validate(
      minimalDevEnv({ CLAMAV_PORT: '3311' }),
    );
    expect(error).toBeUndefined();
    expect(value.CLAMAV_PORT).toBe(3311);
  });

  it('rejects non-numeric CLAMAV_PORT', () => {
    const { error } = validationSchema.validate(
      minimalDevEnv({ CLAMAV_PORT: 'not-a-port' }),
      { abortEarly: false },
    );
    expect(error).toBeDefined();
    expect(error?.message).toMatch(/CLAMAV_PORT/);
  });
});
