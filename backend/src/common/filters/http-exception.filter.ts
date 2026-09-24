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
 * Response format:
 * {
 *   "success": false,
 *   "message": "Error message",
 *   "data": null,
 *   "statusCode": 400
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

    // Log the error with context
    const logContext = {
      statusCode,
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

    const standardResponse: StandardResponse<null> = {
      success: false,
      message: formattedMessage,
      data: null,
      statusCode,
    };

    response.status(statusCode).json(standardResponse);
  }
}
