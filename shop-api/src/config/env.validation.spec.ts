import { validationSchema } from './env.validation';

const validEnv = {
  DB_HOST: 'localhost',
  DB_PORT: '5432',
  DB_USER: 'postgres',
  DB_PASSWORD: 'postgres',
  DB_NAME: 'shop',
};

describe('shop-api env validation schema', () => {
  it('accepts a fully specified environment', () => {
    const { error } = validationSchema.validate(validEnv, { abortEarly: false });

    expect(error).toBeUndefined();
  });

  it('rejects a non-numeric DB_PORT and names DB_PORT in the error', () => {
    const { error } = validationSchema.validate(
      { ...validEnv, DB_PORT: 'abc' },
      { abortEarly: false },
    );

    expect(error).toBeDefined();
    expect(error?.message).toContain('DB_PORT');
  });

  it('reports all missing required vars at once (abortEarly: false)', () => {
    const { error } = validationSchema.validate(
      { NODE_ENV: 'development' },
      { abortEarly: false },
    );

    expect(error).toBeDefined();
    const message = error?.message ?? '';
    for (const key of ['DB_HOST', 'DB_PORT', 'DB_USER', 'DB_PASSWORD', 'DB_NAME']) {
      expect(message).toContain(key);
    }
  });
});
