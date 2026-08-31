export type ApiErrorCode =
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'VALIDATION_ERROR'
  | 'CONFLICT'
  | 'RATE_LIMIT'
  | 'INTERNAL_SERVER_ERROR'
  | 'NETWORK_ERROR'
  | 'TIMEOUT'
  | 'UNKNOWN';

/**
 * Standard API error interface matching the canonical backend error shape.
 *
 * All backend errors conform to:
 * {
 *   statusCode: number;
 *   message: string;
 *   errors: Record<string, string[]> | null;  // Only for 400 validation errors
 *   correlationId: string;                     // For debugging/tracing
 * }
 */
export interface ApiError {
  code: ApiErrorCode;
  message: string;
  statusCode: number;
  errors?: Record<string, string[]> | null;
  correlationId?: string;
}

/**
 * TycoonApiError - Normalized API error for frontend consumption.
 *
 * Extracts relevant fields from backend canonical error response and
 * provides type-safe error handling across the application.
 */
export class TycoonApiError extends Error {
  readonly code: ApiErrorCode;
  readonly statusCode: number;
  readonly errors?: Record<string, string[]> | null;
  readonly correlationId?: string;

  constructor(error: ApiError) {
    super(error.message);
    this.name = 'TycoonApiError';
    this.code = error.code;
    this.statusCode = error.statusCode;
    this.errors = error.errors;
    this.correlationId = error.correlationId;
  }
}

export function isApiError(err: unknown): err is TycoonApiError {
  return err instanceof TycoonApiError;
}

export function isValidationError(
  err: unknown,
): err is TycoonApiError & { code: 'VALIDATION_ERROR' } {
  return isApiError(err) && err.code === 'VALIDATION_ERROR';
}

export function isUnauthorized(err: unknown): err is TycoonApiError {
  return isApiError(err) && err.code === 'UNAUTHORIZED';
}

/**
 * Map HTTP status code to API error code for frontend classification.
 */
function statusToCode(status: number): ApiErrorCode {
  switch (status) {
    case 400:
    case 422: // Unprocessable Entity (also validation errors)
      return 'VALIDATION_ERROR';
    case 401:
      return 'UNAUTHORIZED';
    case 403:
      return 'FORBIDDEN';
    case 404:
      return 'NOT_FOUND';
    case 409:
      return 'CONFLICT';
    case 429:
      return 'RATE_LIMIT';
    case 500:
    case 502:
    case 503:
    case 504:
      return 'INTERNAL_SERVER_ERROR';
    default:
      return 'UNKNOWN';
  }
}

/**
 * Parse error response from API and convert to TycoonApiError.
 *
 * Handles the canonical backend error shape:
 * { statusCode, message, errors, correlationId }
 *
 * Extracts all fields for proper error handling and debugging.
 */
export async function parseErrorResponse(res: Response): Promise<TycoonApiError> {
  let body: {
    statusCode?: number;
    message?: string;
    errors?: Record<string, string[]> | null;
    correlationId?: string;
  } = {};

  try {
    body = await res.json();
  } catch {
    // Non-JSON or empty body - use status text as fallback
  }

  return new TycoonApiError({
    code: statusToCode(res.status),
    statusCode: body.statusCode ?? res.status,
    message: body.message ?? res.statusText ?? 'An error occurred',
    errors: body.errors ?? null,
    correlationId: body.correlationId,
  });
}
