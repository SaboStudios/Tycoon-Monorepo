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
 * Step-up methods the recent-auth guard understands. Keep in sync with
 * `backend/src/modules/privacy/recent-auth.guard.ts`.
 */
export const DATA_EXPORT_STEP_UP_METHODS = ['pwd', 'wallet'] as const;

// ---------------------------------------------------------------------------
// #1928 – parsePositiveInt
// Parses an integer env var; throws on NaN or negative values so bad config
// is caught at startup (mirrors the CORS_MAX_AGE guard pattern).
// ---------------------------------------------------------------------------
export function parsePositiveInt(
  name: string,
  raw: string | undefined,
  fallback: number,
): number {
  if (raw === undefined || raw === '') return fallback;
  const value = parseInt(raw, 10);
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(
      `${name} must be a non-negative integer, got: ${JSON.stringify(raw)}`,
    );
  }
  return value;
}

// ---------------------------------------------------------------------------
// #1929 – parseBoolean
// Accepts true/false/1/0/yes/no (case-insensitive); throws on any other
// non-empty value so security-relevant flags fail loudly at startup.
// ---------------------------------------------------------------------------
const TRUTHY = new Set(['true', '1', 'yes']);
const FALSY = new Set(['false', '0', 'no']);

export function parseBoolean(
  name: string,
  raw: string | undefined,
  fallback: boolean,
): boolean {
  if (raw === undefined || raw === '') return fallback;
  const lower = raw.toLowerCase();
  if (TRUTHY.has(lower)) return true;
  if (FALSY.has(lower)) return false;
  throw new Error(
    `${name} must be one of true/false/1/0/yes/no (case-insensitive), got: ${JSON.stringify(raw)}`,
  );
}

// ---------------------------------------------------------------------------
// #1930 – isValidOrigin (tightened)
// A valid CORS origin is strictly http: or https: with no path, query or
// fragment (e.g. 'https://app.example.com'). ftp://, file://, and URLs that
// carry a path are all rejected.
// ---------------------------------------------------------------------------
export function isValidOrigin(origin: string): boolean {
  try {
    const url = new URL(origin);
    return (
      (url.protocol === 'http:' || url.protocol === 'https:') &&
      url.pathname === '/' &&
      url.search === '' &&
      url.hash === ''
    );
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
 * Parse and validate the comma-separated `DATA_EXPORT_STEP_UP_METHODS` value.
 */
export function parseStepUpMethods(
  raw: string | undefined = process.env.DATA_EXPORT_STEP_UP_METHODS,
): string[] {
  const methods = (raw || 'pwd,wallet')
    .split(',')
    .map((m) => m.trim())
    .filter(Boolean);

  const invalid = methods.filter(
    (m) => !(DATA_EXPORT_STEP_UP_METHODS as readonly string[]).includes(m),
  );
  if (invalid.length > 0) {
    throw new Error(
      `DATA_EXPORT_STEP_UP_METHODS contains unsupported method(s): ${invalid.join(
        ', ',
      )}. Allowed values: ${DATA_EXPORT_STEP_UP_METHODS.join(', ')}.`,
    );
  }

  if (methods.length === 0) {
    throw new Error(
      'DATA_EXPORT_STEP_UP_METHODS must resolve to at least one method.',
    );
  }

  return methods;
}

export function parseCorsOrigins(
  raw: string | undefined = process.env.CORS_ALLOWED_ORIGINS,
): string[] {
  return (raw || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

export function validateCorsOrigins(
  originsArg?: string[],
  corsMaxAgeArg?: number,
): void {
  const origins = originsArg ?? parseCorsOrigins();
  const corsMaxAge = corsMaxAgeArg ?? parsePositiveInt('CORS_MAX_AGE', process.env.CORS_MAX_AGE, 86400);

  const nodeEnv = process.env.NODE_ENV || 'development';
  if (nodeEnv === 'production' && origins.length === 0) {
    throw new Error('CORS_ALLOWED_ORIGINS must be configured in production');
  }

  const invalid = origins.filter((origin) => !isValidOrigin(origin));
  if (invalid.length > 0) {
    throw new Error(
      `CORS_ALLOWED_ORIGINS contains invalid origin(s): ${invalid.join(', ')}. ` +
        'Origins must be http:// or https:// with no path, query, or fragment.',
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

  if (!Number.isFinite(corsMaxAge) || corsMaxAge < 0) {
    throw new Error('CORS_MAX_AGE must be a non-negative integer');
  }
}

export const appConfig = registerAs('app', () => {
  const corsOrigins = parseCorsOrigins(process.env.CORS_ALLOWED_ORIGINS);
  const corsMaxAge = parsePositiveInt('CORS_MAX_AGE', process.env.CORS_MAX_AGE, 86400);
  validateCorsOrigins(corsOrigins, corsMaxAge);

  return {
    port: Number(process.env.PORT ?? 3000),
    corsOrigins,
    corsMaxAge,
    // #1929 – boolean flags with strict parsing
    corsCredentials: parseBoolean('CORS_CREDENTIALS', process.env.CORS_CREDENTIALS, true),
    corsDevWildcard: parseBoolean('CORS_DEV_WILDCARD', process.env.CORS_DEV_WILDCARD, true),
    dataExportDir: process.env.DATA_EXPORT_DIR || './storage/data-exports',
    // #1928 – numeric data-export settings with NaN/negative guards
    dataExportTtlHours: parsePositiveInt('DATA_EXPORT_TTL_HOURS', process.env.DATA_EXPORT_TTL_HOURS, 24),
    dataExportStepUpMaxAgeSeconds: parsePositiveInt(
      'DATA_EXPORT_STEP_UP_MAX_AGE_SECONDS',
      process.env.DATA_EXPORT_STEP_UP_MAX_AGE_SECONDS,
      300,
    ),
    dataExportEnqueueTimeoutMs: parsePositiveInt(
      'DATA_EXPORT_ENQUEUE_TIMEOUT_MS',
      process.env.DATA_EXPORT_ENQUEUE_TIMEOUT_MS,
      5000,
    ),
    // #1929 – dataExportEnabled with strict boolean parsing
    dataExportEnabled: parseBoolean('DATA_EXPORT_ENABLED', process.env.DATA_EXPORT_ENABLED, true),
    dataExportStepUpMethods: parseStepUpMethods(),
  };
});
