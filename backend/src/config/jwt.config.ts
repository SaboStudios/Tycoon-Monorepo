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

const DEFAULT_EXPIRES_IN = '7d';
const EXPIRES_IN_PATTERN = /^(\d+)(s|m|h|d|w|y)$/;
const UNIT_SECONDS: Record<string, number> = {
  s: 1,
  m: 60,
  h: 3600,
  d: 86400,
  w: 604800,
  y: 31536000,
};

export function parseExpiresIn(
  env: NodeJS.ProcessEnv = process.env,
): number {
  const raw = env.JWT_EXPIRES_IN;

  if (raw === undefined || raw.trim() === '') {
    return parseExpiresInValue(DEFAULT_EXPIRES_IN);
  }

  const value = raw.trim();
  const match = EXPIRES_IN_PATTERN.exec(value);

  if (!match) {
    throw new Error(
      `Invalid JWT_EXPIRES_IN value "${raw}". Expected a positive integer followed by a unit (s, m, h, d, w, y), e.g. "15m" or "7d".`,
    );
  }

  return Number(match[1]) * UNIT_SECONDS[match[2]];
}

function parseExpiresInValue(value: string): number {
  const match = EXPIRES_IN_PATTERN.exec(value) as RegExpExecArray;
  return Number(match[1]) * UNIT_SECONDS[match[2]];
}

export default registerAs('jwt', () => ({
  secret: resolveJwtSecret(),
  expiresIn: parseExpiresIn(),
}));
