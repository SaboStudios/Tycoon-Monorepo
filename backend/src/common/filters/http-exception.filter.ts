import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import { StandardResponse } from '../interfaces/standard-response.interface';

/**
 * Global exception filter that wraps all error responses in the standardized format.
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
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    let statusCode: number;
    let message: string | string[];

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
    } else {
      // Handle non-HTTP exceptions (unexpected errors)
      statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
      message = 'Internal server error';
    }

    // Format message as a single string if it's an array
    const formattedMessage = Array.isArray(message)
      ? message.join(', ')
      : message;

    const standardResponse: StandardResponse<null> = {
      success: false,
      message: formattedMessage,
      data: null,
      statusCode,
    };

    response.status(statusCode).json(standardResponse);
  }
}
