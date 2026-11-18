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

export default registerAs('jwt', () => ({
  secret: resolveJwtSecret(),
  expiresIn: process.env.JWT_EXPIRES_IN || '7d',
}));
