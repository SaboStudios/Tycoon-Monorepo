import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { LoggerService } from '../logger/logger.service';

/**
 * Canonical error envelope per docs/API_ERROR_RESPONSE_STANDARDS.md.
 * Every error response carries a stable machine-readable `code`, a
 * human-readable `message`, the propagated `requestId`, and optional
 * `details` for field-level validation failures.
 */
interface ErrorEnvelope {
  statusCode: number;
  code: string;
  message: string;
  requestId: string;
  timestamp: string;
  path: string;
  details?: unknown;
}

@Catch()
@Injectable()
export class AllExceptionsFilter implements ExceptionFilter {
  constructor(
    private readonly httpAdapterHost: HttpAdapterHost,
    private readonly logger: LoggerService,
  ) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const { httpAdapter } = this.httpAdapterHost;
    const ctx = host.switchToHttp();
    const request = ctx.getRequest();

    let httpStatus = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let code = 'INTERNAL_SERVER_ERROR';
    let details: unknown;
    let stack: string | undefined;

    if (exception instanceof HttpException) {
      httpStatus = exception.getStatus();
      const response = exception.getResponse();

      if (typeof response === 'string') {
        message = response;
      } else {
        const responseObj = response as Record<string, unknown>;
        // ValidationPipe emits message as string[] — preserve the array so
        // callers receive all constraint violations, not just the first one.
        const raw = responseObj.message;
        if (Array.isArray(raw)) {
          message = (raw as string[]).join('; ');
          details = raw;
        } else {
          message = (raw as string) || exception.message;
        }
        // Prefer an explicit machine-readable code from the thrown payload.
        if (typeof responseObj.code === 'string') {
          code = responseObj.code;
        }
      }
      stack = exception.stack;
    } else if (exception instanceof Error) {
      this.logger.error(
        `Unhandled Error: ${exception.message}`,
        exception.stack,
        'AllExceptionsFilter',
      );

      message = exception.message || 'Internal server error';
      stack = exception.stack;

      // Handle common database errors
      const dbError = exception as unknown as Record<string, unknown>;
      if (dbError.code) {
        switch (dbError.code as string) {
          case '23505': // Duplicate key
            httpStatus = HttpStatus.CONFLICT;
            message = 'Duplicate entry';
            code = 'DUPLICATE_ENTRY';
            break;
          case '23503': // Foreign key violation
            httpStatus = HttpStatus.BAD_REQUEST;
            message = 'Referenced record does not exist';
            code = 'REFERENCED_RECORD_NOT_FOUND';
            break;
          case '23502': // Not null violation
            httpStatus = HttpStatus.BAD_REQUEST;
            message = 'Required field is missing';
            code = 'REQUIRED_FIELD_MISSING';
            break;
        }
      }
    } else {
      const exceptionStr =
        typeof exception === 'object' && exception !== null
          ? JSON.stringify(exception)
          : String(exception);

      this.logger.error(
        'Unknown exception occurred',
        exceptionStr,
        'AllExceptionsFilter',
      );
    }

    // Derive a stable code from the status when none was supplied explicitly.
    if (code === 'INTERNAL_SERVER_ERROR' && httpStatus !== HttpStatus.INTERNAL_SERVER_ERROR) {
      code = this.codeFromStatus(httpStatus);
    }

    // Propagate the requestId assigned upstream (middleware/interceptor) so
    // clients and logs can correlate the same request across services.
    const requestId =
      (request.headers?.['x-request-id'] as string | undefined) ||
      (request.id as string | undefined) ||
      'unknown';

    // Log the error with context
    const logContext = {
      statusCode: httpStatus,
      code,
      requestId,
      method: request.method,
      url: request.url,
      ip: request.ip,
      userAgent: request.headers['user-agent'],
      errorMessage: message,
      stack,
    };

    if (httpStatus >= 500) {
      this.logger.logWithMeta('error', 'Server Error', logContext);
    } else if (httpStatus >= 400) {
      this.logger.logWithMeta('warn', 'Client Error', logContext);
    }

    const responseBody: ErrorEnvelope = {
      statusCode: httpStatus,
      code,
      message,
      requestId,
      timestamp: new Date().toISOString(),
      path: httpAdapter.getRequestUrl(ctx.getRequest()),
      ...(details !== undefined && { details }),
    };

    httpAdapter.reply(ctx.getResponse(), responseBody, httpStatus);
  }

  private codeFromStatus(status: number): string {
    switch (status) {
      case HttpStatus.BAD_REQUEST:
        return 'BAD_REQUEST';
      case HttpStatus.UNAUTHORIZED:
        return 'UNAUTHORIZED';
      case HttpStatus.FORBIDDEN:
        return 'FORBIDDEN';
      case HttpStatus.NOT_FOUND:
        return 'NOT_FOUND';
      case HttpStatus.CONFLICT:
        return 'CONFLICT';
      case HttpStatus.UNPROCESSABLE_ENTITY:
        return 'UNPROCESSABLE_ENTITY';
      case HttpStatus.TOO_MANY_REQUESTS:
        return 'TOO_MANY_REQUESTS';
      case HttpStatus.SERVICE_UNAVAILABLE:
        return 'SERVICE_UNAVAILABLE';
      case HttpStatus.GATEWAY_TIMEOUT:
        return 'GATEWAY_TIMEOUT';
      default:
        return `HTTP_${status}`;
    }
  }
}
