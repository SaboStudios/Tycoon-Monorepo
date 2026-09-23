import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { StandardResponse } from '../interfaces/standard-response.interface';
import { LoggerService } from '../logger/logger.service';

/**
 * Global exception filter that wraps all error responses in the standardized format.
 * Also logs all errors with contextual information.
 *
 * Response format (see docs/API_ERROR_RESPONSE_STANDARDS.md):
 * {
 *   "success": false,
 *   "message": "Error message",
 *   "data": null,
 *   "statusCode": 400,
 *   "code": "BAD_REQUEST",
 *   "requestId": "..."
 * }
 */
@Catch()
@Injectable()
export class HttpExceptionFilter implements ExceptionFilter {
  constructor(private readonly logger: LoggerService) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let statusCode: number;
    let message: string | string[];
    let stack: string | undefined;
    let code: string | undefined;
    let details: unknown;

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
        // Handle validation errors (which have an array of messages)
        message =
          (responseObj.message as string | string[]) || exception.message;
        // Preserve an explicit error code / details if the thrower provided one
        if (typeof responseObj.code === 'string') {
          code = responseObj.code;
        }
        if (responseObj.details !== undefined) {
          details = responseObj.details;
        }
      } else {
        message = exception.message;
      }
      stack = exception.stack;
    } else if (exception instanceof Error) {
      // Handle standard Error objects
      statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
      message = exception.message || 'Internal server error';
      stack = exception.stack;
    } else {
      // Handle completely unknown exceptions
      statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
      message = 'Internal server error';
      stack = undefined;
    }

    // Format message as a single string if it's an array
    const formattedMessage = Array.isArray(message)
      ? message.join(', ')
      : message;

    // Derive a stable machine-readable error code when not explicitly set
    const errorCode = code || this.deriveErrorCode(statusCode);

    // Propagate the request id so clients can correlate with server logs
    const requestId =
      (request.headers['x-request-id'] as string) ||
      (request as Request & { requestId?: string }).requestId;

    // Log the error with context
    const logContext = {
      statusCode,
      code: errorCode,
      requestId,
      method: request.method,
      url: request.url,
      ip: request.ip,
      userAgent: request.headers['user-agent'],
      errorMessage: formattedMessage,
      stack: stack,
    };

    if (statusCode >= 500) {
      // Server errors (5xx) - log as error
      this.logger.error(
        `${request.method} ${request.url} - ${statusCode} - ${formattedMessage}`,
        stack,
        'HttpExceptionFilter',
      );
      this.logger.logWithMeta('error', 'Server Error Details', logContext);
    } else if (statusCode >= 400) {
      // Client errors (4xx) - log as warning
      this.logger.warn(
        `${request.method} ${request.url} - ${statusCode} - ${formattedMessage}`,
        'HttpExceptionFilter',
      );
      this.logger.logWithMeta('warn', 'Client Error Details', logContext);
    }

    const standardResponse: StandardResponse<null> & {
      code: string;
      requestId?: string;
      details?: unknown;
    } = {
      success: false,
      message: formattedMessage,
      data: null,
      statusCode,
      code: errorCode,
    };

    if (requestId) {
      standardResponse.requestId = requestId;
    }
    if (details !== undefined) {
      standardResponse.details = details;
    }

    response.status(statusCode).json(standardResponse);
  }

  /**
   * Maps an HTTP status to a stable, machine-readable error code so that
   * backend and shop-api error envelopes stay aligned per
   * docs/API_ERROR_RESPONSE_STANDARDS.md.
   */
  private deriveErrorCode(statusCode: number): string {
    switch (statusCode) {
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
        return statusCode >= 500 ? 'INTERNAL_SERVER_ERROR' : 'ERROR';
    }
  }
}
