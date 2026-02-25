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
    let error: string | undefined;
    let stack: string | undefined;

    if (exception instanceof HttpException) {
      httpStatus = exception.getStatus();
      const response = exception.getResponse();

      if (typeof response === 'string') {
        message = response;
      } else {
        const responseObj = response as Record<string, unknown>;
        message = (responseObj.message as string) || exception.message;
        error = responseObj.error as string | undefined;
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
            break;
          case '23503': // Foreign key violation
            httpStatus = HttpStatus.BAD_REQUEST;
            message = 'Referenced record does not exist';
            break;
          case '23502': // Not null violation
            httpStatus = HttpStatus.BAD_REQUEST;
            message = 'Required field is missing';
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

    // Log the error with context
    const logContext = {
      statusCode: httpStatus,
      method: request.method,
      url: request.url,
      ip: request.ip,
      userAgent: request.headers['user-agent'],
      errorMessage: message,
      error,
      stack,
    };

    if (httpStatus >= 500) {
      this.logger.logWithMeta('error', 'Server Error', logContext);
    } else if (httpStatus >= 400) {
      this.logger.logWithMeta('warn', 'Client Error', logContext);
    }

    const responseBody: Record<string, unknown> = {
      statusCode: httpStatus,
      timestamp: new Date().toISOString(),
      path: httpAdapter.getRequestUrl(ctx.getRequest()),
      message,
      ...(error && { error }),
    };

    httpAdapter.reply(ctx.getResponse(), responseBody, httpStatus);
  }
}
