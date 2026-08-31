import { registerAs } from '@nestjs/config';

/**
 * Parse and validate WebSocket CORS allowed origins from environment variables
 */
function parseWsCorsOrigins(): string[] {
  const nodeEnv = process.env.NODE_ENV || 'development';

  // Use WS_CORS_ORIGINS if set
  if (process.env.WS_CORS_ORIGINS) {
    const origins = process.env.WS_CORS_ORIGINS.split(',')
      .map((origin) => origin.trim())
      .filter((origin) => origin.length > 0);

    // In production, reject wildcard
    if (nodeEnv === 'production' && origins.includes('*')) {
      throw new Error('WS_CORS_ORIGINS cannot contain wildcard (*) in production');
    }

    return origins;
  }

  // Fall back to HTTP CORS configuration if available
  if (process.env.CORS_ALLOWED_ORIGINS) {
    return process.env.CORS_ALLOWED_ORIGINS.split(',')
      .map((origin) => origin.trim())
      .filter((origin) => origin.length > 0);
  }

  if (process.env.CORS_ORIGIN) {
    return [process.env.CORS_ORIGIN.trim()];
  }

  // Default for development
  return ['http://localhost:3000'];
}

/**
 * Validate that a string is a valid URL origin
 */
function isValidOrigin(origin: string): boolean {
  if (origin === '*') {
    return false; // Wildcard not allowed for WS in any environment
  }
  try {
    const url = new URL(origin);
    return !!(url.protocol && url.host);
  } catch {
    return false;
  }
}

/**
 * Validate WebSocket CORS origins at startup
 */
function validateWsCorsOrigins(origins: string[]): void {
  const nodeEnv = process.env.NODE_ENV || 'development';

  // Require at least one origin in production
  if (nodeEnv === 'production' && origins.length === 0) {
    throw new Error('WS_CORS_ORIGINS must be configured in production');
  }

  // Validate each origin is a valid URL (wildcard not allowed)
  const invalidOrigins = origins.filter((origin) => !isValidOrigin(origin));
  if (invalidOrigins.length > 0) {
    throw new Error(
      `Invalid WebSocket CORS origins detected: ${invalidOrigins.join(', ')}. ` +
        'Origins must be valid URLs (e.g., http://localhost:3000, https://app.example.com), wildcard (*) not allowed',
    );
  }
}

/**
 * Get WebSocket CORS configuration suitable for socket.io decorator
 * This can be called at module initialization time to get the CORS config
 */
export function getWsCorsConfig(): { origin: string[] | string } {
  const corsOrigins = parseWsCorsOrigins();
  validateWsCorsOrigins(corsOrigins);
  return {
    origin: corsOrigins,
  };
}

export const wsConfig = registerAs('ws', () => {
  const corsOrigins = parseWsCorsOrigins();
  validateWsCorsOrigins(corsOrigins);

  return {
    corsOrigins,
  };
});
