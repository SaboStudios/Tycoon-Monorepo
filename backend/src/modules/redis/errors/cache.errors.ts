import { BadRequestException, HttpException, HttpStatus } from '@nestjs/common';

export enum CacheErrorCode {
  INVALID_KEY      = 'CACHE_INVALID_KEY',
  INVALID_TTL      = 'CACHE_INVALID_TTL',
  INVALID_PATTERN  = 'CACHE_INVALID_PATTERN',
  OPERATION_FAILED = 'CACHE_OPERATION_FAILED',
  SERIALIZATION    = 'CACHE_SERIALIZATION_ERROR',
}

interface CacheErrorBody {
  errorCode: CacheErrorCode;
  message: string;
  detail?: string;
}

export class CacheValidationException extends BadRequestException {
  constructor(code: CacheErrorCode, message: string, detail?: string) {
    const body: CacheErrorBody = {
      errorCode: code,
      message,
      ...(detail ? { detail } : {}),
    };
    super(body);
  }
}

export class CacheOperationException extends HttpException {
  constructor(message: string, detail?: string) {
    const body: CacheErrorBody = {
      errorCode: CacheErrorCode.OPERATION_FAILED,
      message,
      ...(detail ? { detail } : {}),
    };
    super(body, HttpStatus.INTERNAL_SERVER_ERROR);
  }
}

/**
 * Maps a raw Redis / cache-manager error to a structured CacheOperationException.
 * Strips internal connection strings and credentials from the message so nothing
 * sensitive reaches the response body or logs.
 */
export function mapCacheError(err: unknown, operation: string): CacheOperationException {
  const raw = err instanceof Error ? err.message : String(err);
  const safe = raw
    .replace(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}(:\d+)?\b/g, '[host]')
    .replace(/password[^,}\s]*/gi, '[redacted]')
    .replace(/:[^@]+@/g, ':[redacted]@');
  return new CacheOperationException(`Cache ${operation} failed`, safe);
}
