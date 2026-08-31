import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { LoggerService } from '../logger/logger.service';
import { v4 as uuidv4 } from 'uuid';

/**
 * Canonical API error response shape (used across all modules).
 *
 * All error responses conform to:
 * {
 *   "statusCode": 400,
 *   "message": "Human-readable error message",
 *   "errors": { "field": ["constraint message"] } or null,
 *   "correlationId": "req_..." (unique per request for debugging)
 * }
 *
 * Rules:
 * - statusCode: Always included, maps to HTTP status
 * - message: Always included, user-facing message
 * - errors: Object<string, string[]> for 400/422 validation errors, null otherwise
 * - correlationId: Always included, generated if missing from request headers
 * - Stack traces: Never included in response body (logged server-side instead)
 */
export interface CanonicalErrorResponse {
  statusCode: number;
  message: string;
  errors: Record<string, string[]> | null;
  correlationId: string;
}

@Catch()
@Injectable()
export class HttpExceptionFilter implements ExceptionFilter {
  constructor(private readonly logger: LoggerService) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let statusCode: number;
    let message: string;
    let errors: Record<string, string[]> | null = null;
    let stack: string | undefined;

    if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else if (
        typeof exceptionResponse === 'object' &&
        exceptionResponse !== null
      ) {
        const responseObj = exceptionResponse as Record<string, unknown>;
        message =
          (responseObj.message as string) || exception.message || 'Error occurred';

        // Extract validation errors for 400 responses
        if (statusCode === 400) {
          // Support both 'errors' and 'error' fields (for backward compat during migration)
          errors = (responseObj.errors as Record<string, string[]>) ||
                   (responseObj.error && typeof responseObj.error === 'object'
                     ? (responseObj.error as Record<string, string[]>)
                     : null);
        }
      } else {
        message = exception.message || 'Error occurred';
      }
      stack = exception.stack;
    } else if (exception instanceof Error) {
      statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
      message = 'Internal server error';
      stack = exception.stack;
    } else {
      statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
      message = 'Internal server error';
      stack = undefined;
    }

    // Generate or retrieve correlationId from request headers
    const correlationId = this.getOrGenerateCorrelationId(request);

    // Log the error with full context (including stack on server side)
    const logContext = {
      statusCode,
      method: request.method,
      url: request.url,
      ip: request.ip,
      userAgent: request.headers['user-agent'],
      errorMessage: message,
      correlationId,
      stack,
    };

    if (statusCode >= 500) {
      this.logger.error(
        `[${correlationId}] ${request.method} ${request.url} - ${statusCode} - ${message}`,
        stack,
        'HttpExceptionFilter',
      );
      this.logger.logWithMeta('error', 'Server Error Details', logContext);
    } else if (statusCode >= 400) {
      this.logger.warn(
        `[${correlationId}] ${request.method} ${request.url} - ${statusCode} - ${message}`,
        'HttpExceptionFilter',
      );
      this.logger.logWithMeta('warn', 'Client Error Details', logContext);
    }

    // Build canonical error response (no stack trace in body)
    const errorResponse: CanonicalErrorResponse = {
      statusCode,
      message,
      errors,
      correlationId,
    };

    response.status(statusCode).json(errorResponse);
  }

  /**
   * Get correlationId from request headers or generate a new one.
   * Allows correlation of errors across client→server logs.
   */
  private getOrGenerateCorrelationId(request: Request): string {
    const headerValue = request.headers['x-correlation-id'];
    if (typeof headerValue === 'string' && headerValue.trim()) {
      return headerValue.trim();
    }

    // Generate new correlation ID with "req_" prefix for easy filtering
    return `req_${uuidv4()}`;
  }
}
