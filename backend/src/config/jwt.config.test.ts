import {
  resolveJwtSecret,
  parseExpiresIn,
  parseClockSkewSeconds,
} from './jwt.config';

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
  it('converts a duration string to seconds', () => {
    expect(parseExpiresIn({ JWT_EXPIRES_IN: '15m' } as NodeJS.ProcessEnv)).toBe(900);
  });

  it('throws a config-load error for a bare number', () => {
    expect(() =>
      parseExpiresIn({ JWT_EXPIRES_IN: '900' } as NodeJS.ProcessEnv),
    ).toThrow(/JWT_EXPIRES_IN/);
  });

  it('uses the default when the value is empty', () => {
    expect(parseExpiresIn({ JWT_EXPIRES_IN: '' } as NodeJS.ProcessEnv)).toBe(
      7 * 86400,
    );
  });

  it('uses the default when the value is unset', () => {
    expect(parseExpiresIn({} as NodeJS.ProcessEnv)).toBe(7 * 86400);
  });
});

describe('parseClockSkewSeconds', () => {
  it('uses 60 when the value is unset', () => {
    expect(parseClockSkewSeconds({} as NodeJS.ProcessEnv)).toBe(60);
  });

  it('uses 60 when the value is empty', () => {
    expect(
      parseClockSkewSeconds({ JWT_CLOCK_SKEW_SECONDS: '  ' } as NodeJS.ProcessEnv),
    ).toBe(60);
  });

  it('parses an integer within the 0-300 range', () => {
    expect(
      parseClockSkewSeconds({ JWT_CLOCK_SKEW_SECONDS: '120' } as NodeJS.ProcessEnv),
    ).toBe(120);
  });

  it('accepts the range boundaries', () => {
    expect(
      parseClockSkewSeconds({ JWT_CLOCK_SKEW_SECONDS: '0' } as NodeJS.ProcessEnv),
    ).toBe(0);
    expect(
      parseClockSkewSeconds({ JWT_CLOCK_SKEW_SECONDS: '300' } as NodeJS.ProcessEnv),
    ).toBe(300);
  });

  it('throws a config-load error for a non-numeric value', () => {
    expect(() =>
      parseClockSkewSeconds({ JWT_CLOCK_SKEW_SECONDS: 'abc' } as NodeJS.ProcessEnv),
    ).toThrow(/JWT_CLOCK_SKEW_SECONDS/);
  });

  it('throws a config-load error above the maximum', () => {
    expect(() =>
      parseClockSkewSeconds({ JWT_CLOCK_SKEW_SECONDS: '301' } as NodeJS.ProcessEnv),
    ).toThrow(/JWT_CLOCK_SKEW_SECONDS/);
  });

  it('throws a config-load error for negative or fractional values', () => {
    expect(() =>
      parseClockSkewSeconds({ JWT_CLOCK_SKEW_SECONDS: '-1' } as NodeJS.ProcessEnv),
    ).toThrow(/JWT_CLOCK_SKEW_SECONDS/);
    expect(() =>
      parseClockSkewSeconds({ JWT_CLOCK_SKEW_SECONDS: '1.5' } as NodeJS.ProcessEnv),
    ).toThrow(/JWT_CLOCK_SKEW_SECONDS/);
  });
});
