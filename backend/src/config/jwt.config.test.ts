import { resolveJwtSecret, parseExpiresIn } from './jwt.config';

const PLACEHOLDER_SECRET = 'your-secret-key-change-this-in-production';

describe('resolveJwtSecret', () => {
  it('throws in production when JWT_SECRET is missing', () => {
    expect(() =>
      resolveJwtSecret({ NODE_ENV: 'production' } as NodeJS.ProcessEnv),
    ).toThrow(/JWT_SECRET must be set in production/);
  });

  it('throws in production when JWT_SECRET is the placeholder', () => {
    expect(() =>
      resolveJwtSecret({
        NODE_ENV: 'production',
        JWT_SECRET: PLACEHOLDER_SECRET,
      } as NodeJS.ProcessEnv),
    ).toThrow(/placeholder/);
  });

  it('accepts a real custom secret in production', () => {
    const secret = 'a-real-production-secret-value';
    expect(
      resolveJwtSecret({
        NODE_ENV: 'production',
        JWT_SECRET: secret,
      } as NodeJS.ProcessEnv),
    ).toBe(secret);
  });

  it('falls back to a local default outside production', () => {
    const secret = resolveJwtSecret({ NODE_ENV: 'development' } as NodeJS.ProcessEnv);
    expect(secret).toBeTruthy();
    expect(secret).not.toBe(PLACEHOLDER_SECRET);
  });
});

describe('parseExpiresIn', () => {
  const originalEnv = process.env;

  afterEach(() => {
    process.env = originalEnv;
  });

  it.each([
    ['15s', 15],
    ['15m', 900],
    ['1h', 3600],
    ['1d', 86400],
  ])('parses %s as %i seconds', (value, expected) => {
    expect(parseExpiresIn(value)).toBe(expected);
  });

  it('keeps the default lifetime when JWT_EXPIRES_IN is unset', () => {
    process.env = { ...originalEnv };
    delete process.env.JWT_EXPIRES_IN;
    expect(parseExpiresIn(process.env.JWT_EXPIRES_IN || '7d')).toBe(604800);
  });
});
