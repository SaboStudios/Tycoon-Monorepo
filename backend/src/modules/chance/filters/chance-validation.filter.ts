import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  BadRequestException,
  HttpException,
} from '@nestjs/common';
import { Response } from 'express';
import {
  mapValidationErrorToChanceException,
  ChanceException,
} from '../exceptions/chance-exceptions';

@Catch(BadRequestException)
export class ChanceValidationFilter implements ExceptionFilter {
  catch(exception: BadRequestException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const exceptionResponse = exception.getResponse() as any;

    // Check if this is a validation error
    if (Array.isArray(exceptionResponse?.message)) {
      const chanceException = mapValidationErrorToChanceException(
        exceptionResponse.message,
      );

      response.status(chanceException.getStatus()).json({
        error: (chanceException.getResponse() as any)?.error,
        message: (chanceException.getResponse() as any)?.message,
        details: (chanceException.getResponse() as any)?.details,
        timestamp: new Date().toISOString(),
      });

      return;
    }

    // For non-validation BadRequestExceptions, pass through
    response.status(exception.getStatus()).json(exceptionResponse);
  }
}

@Catch(ChanceException)
export class ChanceExceptionFilter implements ExceptionFilter {
  catch(exception: ChanceException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    const exceptionResponse = exception.getResponse();
    response.status(exception.getStatus()).json(exceptionResponse);
  }
}

@Catch()
export class ChanceGlobalExceptionFilter implements ExceptionFilter {
  catch(exception: any, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const status = exception.getStatus?.() || 500;

    // If it's already an HTTP exception, return as-is
    if (exception instanceof HttpException) {
      response.status(status).json(exception.getResponse());
      return;
    }

    // Generic error response
    response.status(status).json({
      error: 'INTERNAL_SERVER_ERROR',
      message: exception.message || 'An unexpected error occurred',
      timestamp: new Date().toISOString(),
    });
  }
}
