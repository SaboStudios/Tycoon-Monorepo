import { registerAs } from '@nestjs/config';

/**
 * Step-up methods the recent-auth guard understands. Keep in sync with
 * `backend/src/modules/privacy/recent-auth.guard.ts`.
 */
export const DATA_EXPORT_STEP_UP_METHODS = ['pwd', 'wallet'] as const;

/**
 * Parse and validate the comma-separated `DATA_EXPORT_STEP_UP_METHODS` value.
 *
 * Rejects unknown identifiers (e.g. a `walet` typo) and an empty resolved
 * list, mirroring the CORS validation style used below.
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

function parseCorsOrigins(raw: string | undefined): string[] {
  return (raw || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function isValidOrigin(origin: string): boolean {
  try {
    const url = new URL(origin);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function validateCorsOrigins(origins: string[]): void {
  const invalid = origins.filter((origin) => !isValidOrigin(origin));
  if (invalid.length > 0) {
    throw new Error(
      `CORS_ORIGINS contains invalid origin(s): ${invalid.join(', ')}`,
    );
  }
}

export const appConfig = registerAs('app', () => {
  const corsOrigins = parseCorsOrigins(process.env.CORS_ORIGINS);
  validateCorsOrigins(corsOrigins);

  const corsMaxAge = Number(process.env.CORS_MAX_AGE ?? 86400);
  if (Number.isNaN(corsMaxAge) || corsMaxAge < 0) {
    throw new Error('CORS_MAX_AGE must be a non-negative number');
  }

  return {
    port: Number(process.env.PORT ?? 3000),
    corsOrigins,
    corsMaxAge,
    dataExportDir: process.env.DATA_EXPORT_DIR || './storage/data-exports',
    dataExportTtlHours: Number(process.env.DATA_EXPORT_TTL_HOURS ?? 24),
    dataExportEnabled: (process.env.DATA_EXPORT_ENABLED ?? 'true') === 'true',
    dataExportStepUpMaxAgeSeconds: Number(
      process.env.DATA_EXPORT_STEP_UP_MAX_AGE_SECONDS ?? 300,
    ),
    dataExportStepUpMethods: parseStepUpMethods(),
    dataExportEnqueueTimeoutMs: Number(
      process.env.DATA_EXPORT_ENQUEUE_TIMEOUT_MS ?? 5000,
    ),
  };
});
