import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

/**
 * Global HTTP exception filter.
 *
 * - Returns a consistent JSON error shape.
 * - Logs 5xx errors server-side without echoing internal details to the client.
 * - Never surfaces stack traces, DB errors, or secret values in responses.
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    // For HttpExceptions use the NestJS message; for unknown errors use a
    // generic message so internal details never reach the client.
    const message =
      exception instanceof HttpException
        ? this.extractMessage(exception)
        : 'An unexpected error occurred';

    // Log 5xx with the real error; 4xx are client mistakes, no need to alarm.
    if (status >= 500) {
      this.logger.error(
        `${request.method} ${request.url} → ${status}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    response.status(status).json({
      statusCode: status,
      message,
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }

  private extractMessage(exception: HttpException): string | string[] {
    const res = exception.getResponse();
    if (typeof res === 'string') return res;
    if (typeof res === 'object' && res !== null && 'message' in res) {
      return (res as { message: string | string[] }).message;
    }
    return exception.message;
  }
}
