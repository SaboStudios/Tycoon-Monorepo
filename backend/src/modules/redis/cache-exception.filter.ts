import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import {
  CacheValidationException,
  CacheOperationException,
} from './errors/cache.errors';

/**
 * SW-BE-007 — Catches cache-layer exceptions and returns a consistent,
 * secret-free JSON response.  Registered locally on controllers that use
 * ValidatedCacheService; does not replace the global AllExceptionsFilter.
 */
@Catch(CacheValidationException, CacheOperationException)
export class CacheExceptionFilter implements ExceptionFilter {
  catch(
    exception: CacheValidationException | CacheOperationException,
    host: ArgumentsHost,
  ): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const status = exception.getStatus();
    const body = exception.getResponse() as Record<string, unknown>;

    res.status(status).json({
      statusCode: status,
      timestamp: new Date().toISOString(),
      errorCode: body['errorCode'],
      message: body['message'],
      ...(status === HttpStatus.BAD_REQUEST && body['detail']
        ? { detail: body['detail'] }
        : {}),
    });
  }
}
