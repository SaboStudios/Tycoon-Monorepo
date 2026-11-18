import dotenv from 'dotenv';

dotenv.config();

/**
 * Resolve the JWT secret using the same rules as the main API:
 * the secret must be provided explicitly and must not be empty.
 * There is intentionally no fallback value.
 */
export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;

  if (!secret || secret.trim() === '') {
    throw new Error(
      'JWT_SECRET is not set. The Admin Shop API refuses to start without a JWT secret.'
    );
  }

  return secret;
}

export const JWT_ALGORITHM = 'HS256' as const;
