import { registerAs } from '@nestjs/config';

const PLACEHOLDER_SECRET = 'your-secret-key-change-this-in-production';
const DEV_DEFAULT_SECRET = 'dev-only-insecure-jwt-secret';

export function resolveJwtSecret(
  env: NodeJS.ProcessEnv = process.env,
): string {
  const secret = env.JWT_SECRET;
  const isProduction = env.NODE_ENV === 'production';

  if (isProduction) {
    if (!secret || secret.trim() === '') {
      throw new Error(
        'JWT_SECRET must be set in production. Refusing to start with an empty secret.',
      );
    }
    if (secret === PLACEHOLDER_SECRET) {
      throw new Error(
        'JWT_SECRET is set to the insecure placeholder value. Refusing to start in production.',
      );
    }
    return secret;
  }

  if (!secret || secret.trim() === '') {
    return DEV_DEFAULT_SECRET;
  }

  return secret;
}

const EXPIRES_IN_UNITS: Record<string, number> = {
  s: 1,
  m: 60,
  h: 60 * 60,
  d: 24 * 60 * 60,
};

/**
 * Parses a JWT lifetime string (e.g. `15s`, `15m`, `1h`, `1d`) into seconds.
 * Returns the input unchanged when it is not a supported duration string.
 */
export function parseExpiresIn(value: string): number | string {
  const match = /^(\d+)([smhd])$/.exec(value.trim());
  if (!match) {
    return value;
  }
  return Number(match[1]) * EXPIRES_IN_UNITS[match[2]];
}

export default registerAs('jwt', () => ({
  secret: resolveJwtSecret(),
  expiresIn: parseExpiresIn(process.env.JWT_EXPIRES_IN || '7d'),
}));
