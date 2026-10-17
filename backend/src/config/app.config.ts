import { registerAs } from '@nestjs/config';

/**
 * Parse PORT as a finite integer in [1, 65535].
 * Throws on NaN, non-integer, or out-of-range values.
 */
export function parsePort(raw: string | undefined): number {
  const value = parseInt(raw ?? '3001', 10);
  if (!Number.isFinite(value) || !Number.isInteger(value) || value < 1 || value > 65535) {
    throw new Error(
      `PORT must be an integer between 1 and 65535 (received: ${JSON.stringify(raw)})`,
    );
  }
  return value;
}

/**
 * Validate a non-empty, non-whitespace-only string config value.
 * Throws with a message naming the variable when the value is blank.
 */
export function requireNonBlank(value: string | undefined, varName: string): string {
  const trimmed = (value ?? '').trim();
  if (trimmed.length === 0) {
    throw new Error(`${varName} must not be empty or whitespace-only`);
  }
  return trimmed;
}

/**
 * Parse a boolean environment variable with a documented set of spellings.
 * Accepted truthy:  'true', 'TRUE', '1', 'yes'
 * Accepted falsy:   'false', 'FALSE', '0', 'no'
 * Unset / empty  →  returns defaultValue (no throw)
 * Anything else  →  throws with the variable name in the message
 */
export function parseStrictBoolean(
  raw: string | undefined,
  varName: string,
  defaultValue = false,
): boolean {
  if (raw === undefined || raw === '') return defaultValue;
  const lower = raw.toLowerCase();
  if (['true', '1', 'yes'].includes(lower)) return true;
  if (['false', '0', 'no'].includes(lower)) return false;
  throw new Error(
    `${varName} must be one of true/false/1/0/yes/no (received: ${JSON.stringify(raw)})`,
  );
}

/**
 * Parse and validate CORS allowed origins from environment variables
 */
export function parseCorsOrigins(): string[] {
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
 * Validate CORS origins at startup (reads from parseCorsOrigins + process.env).
 * Exported for testing.
 */
export function validateCorsOrigins(origins?: string[]): void {
  const resolvedOrigins = origins ?? parseCorsOrigins();
  const nodeEnv = process.env.NODE_ENV || 'development';
  
  // Require at least one origin in production
  if (nodeEnv === 'production' && resolvedOrigins.length === 0) {
    throw new Error('CORS_ALLOWED_ORIGINS must be configured in production');
  }
  
  // Validate each origin is a valid URL
  const invalidOrigins = resolvedOrigins.filter(origin => !isValidOrigin(origin));
  if (invalidOrigins.length > 0) {
    throw new Error(
      `Invalid CORS origins detected: ${invalidOrigins.join(', ')}. ` +
      'Origins must be valid URLs (e.g., http://localhost:3000, https://app.example.com)'
    );
  }
  
  const corsMaxAge = parseInt(process.env.CORS_MAX_AGE || '86400', 10);
  if (!Number.isInteger(corsMaxAge) || corsMaxAge < 0) {
    throw new Error('CORS_MAX_AGE must be a non-negative integer');
  }
}

export const appConfig = registerAs('app', () => {
  const corsAllowedOrigins = parseCorsOrigins();
  validateCorsOrigins(corsAllowedOrigins);
  
  const corsMaxAge = parseInt(process.env.CORS_MAX_AGE || '86400', 10);
  
  return {
    nodeEnv: process.env.NODE_ENV || 'development',
    port: parsePort(process.env.PORT),
    apiPrefix: requireNonBlank(process.env.API_PREFIX ?? 'api', 'API_PREFIX'),
    defaultApiVersion: requireNonBlank(process.env.API_DEFAULT_VERSION ?? '1', 'API_DEFAULT_VERSION'),
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
    
    trustProxy: parseStrictBoolean(process.env.TRUST_PROXY, 'TRUST_PROXY', false),
    /** Directory for async JSON user data exports (see privacy module). */
    dataExportDir: process.env.DATA_EXPORT_DIR || './storage/data-exports',
    dataExportTtlHours: parseInt(process.env.DATA_EXPORT_TTL_HOURS || '24', 10),
    /** Kill switch for new export requests (docs/support/user-data-export-runbook.md). */
    dataExportEnabled: process.env.DATA_EXPORT_ENABLED !== 'false',
    dataExportStepUpMaxAgeSeconds: parseInt(
      process.env.DATA_EXPORT_STEP_UP_MAX_AGE_SECONDS || '300',
      10,
    ),
    dataExportStepUpMethods: (process.env.DATA_EXPORT_STEP_UP_METHODS || 'pwd,wallet')
      .split(',')
      .map((m) => m.trim())
      .filter(Boolean),
    dataExportEnqueueTimeoutMs: parseInt(
      process.env.DATA_EXPORT_ENQUEUE_TIMEOUT_MS || '5000',
      10,
    ),
  };
});
