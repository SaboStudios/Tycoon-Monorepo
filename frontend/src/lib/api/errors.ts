export type ApiErrorCode =
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'VALIDATION_ERROR'
  | 'CONFLICT'
  | 'INTERNAL_SERVER_ERROR'
  | 'NETWORK_ERROR'
  | 'TIMEOUT'
  | 'UNKNOWN';

export interface ApiError {
  code: ApiErrorCode;
  message: string;
  statusCode: number;
  details?: Record<string, string[]>;
}

export class TycoonApiError extends Error {
  readonly code: ApiErrorCode;
  readonly statusCode: number;
  readonly details?: Record<string, string[]>;

  constructor(error: ApiError) {
    super(error.message);
    this.name = 'TycoonApiError';
    this.code = error.code;
    this.statusCode = error.statusCode;
    this.details = error.details;
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

function statusToCode(status: number): ApiErrorCode {
  switch (status) {
    case 400: return 'VALIDATION_ERROR';
    case 401: return 'UNAUTHORIZED';
    case 403: return 'FORBIDDEN';
    case 404: return 'NOT_FOUND';
    case 409: return 'CONFLICT';
    case 500: return 'INTERNAL_SERVER_ERROR';
    default:  return 'UNKNOWN';
  }
}

export async function parseErrorResponse(res: Response): Promise<TycoonApiError> {
  let body: { message?: string; errors?: Record<string, string[]> } = {};
  try {
    body = await res.json();
  } catch {
    // non-JSON body
  }
  return new TycoonApiError({
    code: statusToCode(res.status),
    statusCode: res.status,
    message: body.message ?? res.statusText,
    details: body.errors,
  });
}
