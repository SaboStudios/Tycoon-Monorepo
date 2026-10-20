/**
 * SW-BE-009 — Uploads observability env flag (Joi).
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

describe('env.validation — uploads observability (SW-BE-009)', () => {
  it('defaults UPLOADS_OBSERVABILITY_ENABLED to true', () => {
    const { error, value } = validationSchema.validate(minimalDevEnv());
    expect(error).toBeUndefined();
    expect(value.UPLOADS_OBSERVABILITY_ENABLED).toBe(true);
  });

  it('accepts explicit false', () => {
    const { error, value } = validationSchema.validate(
      minimalDevEnv({ UPLOADS_OBSERVABILITY_ENABLED: 'false' }),
    );
    expect(error).toBeUndefined();
    expect(value.UPLOADS_OBSERVABILITY_ENABLED).toBe(false);
  });
});
