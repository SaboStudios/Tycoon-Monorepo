import { registerAs } from '@nestjs/config';

/**
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
