import { registerAs } from '@nestjs/config';

/**
 * Parse and validate CORS allowed origins from environment variables
 */
function parseCorsOrigins(): string[] {
  // Support new CORS_ALLOWED_ORIGINS (comma-separated list)
  if (process.env.CORS_ALLOWED_ORIGINS) {
    return process.env.CORS_ALLOWED_ORIGINS
      .split(',')
      .map(origin => origin.trim())
      .filter(origin => origin.length > 0);
  }
  
  // Backward compatibility: support legacy CORS_ORIGIN
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
  try {
    const url = new URL(origin);
    // Must have protocol and host
    return !!(url.protocol && url.host);
  } catch {
    return false;
  }
}

/**
 * Validate CORS origins at startup
 */
function validateCorsOrigins(origins: string[]): void {
  const nodeEnv = process.env.NODE_ENV || 'development';
  
  // Require at least one origin in production
  if (nodeEnv === 'production' && origins.length === 0) {
    throw new Error('CORS_ALLOWED_ORIGINS must be configured in production');
  }
  
  // Validate each origin is a valid URL
  const invalidOrigins = origins.filter(origin => !isValidOrigin(origin));
  if (invalidOrigins.length > 0) {
    throw new Error(
      `Invalid CORS origins detected: ${invalidOrigins.join(', ')}. ` +
      'Origins must be valid URLs (e.g., http://localhost:3000, https://app.example.com)'
    );
  }
}

export const appConfig = registerAs('app', () => {
  const corsAllowedOrigins = parseCorsOrigins();
  validateCorsOrigins(corsAllowedOrigins);
  
  const corsMaxAge = parseInt(process.env.CORS_MAX_AGE || '86400', 10);
  if (corsMaxAge < 0) {
    throw new Error('CORS_MAX_AGE must be a positive integer');
  }
  
  return {
    nodeEnv: process.env.NODE_ENV || 'development',
    port: parseInt(process.env.PORT || '3000', 10),
    apiPrefix: process.env.API_PREFIX || 'api',
    defaultApiVersion: process.env.API_DEFAULT_VERSION || '1',
    enableLegacyUnversionedRoutes:
      process.env.API_ENABLE_LEGACY_UNVERSIONED !== 'false',
    legacyUnversionedSunset: process.env.API_LEGACY_UNVERSIONED_SUNSET,
    
    // CORS Configuration
    corsAllowedOrigins,
    corsCredentials: process.env.CORS_CREDENTIALS !== 'false', // default: true
    corsMaxAge,
    corsDevWildcard: process.env.CORS_DEV_WILDCARD !== 'false', // default: true
    
    // Legacy (deprecated but supported for backward compatibility)
    corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    
    trustProxy: process.env.TRUST_PROXY === 'true' || process.env.TRUST_PROXY === '1',
    /** Directory for async JSON user data exports (see privacy module). */
    dataExportDir: process.env.DATA_EXPORT_DIR || './storage/data-exports',
    dataExportTtlHours: parseInt(process.env.DATA_EXPORT_TTL_HOURS || '24', 10),
  };
});
