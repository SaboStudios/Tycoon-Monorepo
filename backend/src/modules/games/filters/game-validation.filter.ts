import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { mapValidationErrorToGameException, GameException } from '../exceptions/game-exceptions';

@Catch()
export class GameValidationFilter implements ExceptionFilter {
  private readonly logger = new Logger(GameValidationFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let gameException: GameException;
    let status: HttpStatus;

    if (exception instanceof GameException) {
      // Already a GameException, just log and return
      gameException = exception;
      status = exception.getStatus();
      
      this.logger.warn('Game exception occurred', {
        error: exception.errorCode,
        message: exception.message,
        details: exception.details,
        url: request.url,
        method: request.method,
        timestamp: new Date().toISOString(),
      });
    } else if (exception instanceof HttpException) {
      const exceptionResponse = exception.getResponse();
      
      // Handle validation errors from class-validator
      if (
        typeof exceptionResponse === 'object' &&
        exceptionResponse !== null &&
        'message' in exceptionResponse &&
        Array.isArray(exceptionResponse.message)
      ) {
        gameException = mapValidationErrorToGameException(exceptionResponse.message);
        status = gameException.getStatus();
        
        this.logger.warn('Validation error mapped to game exception', {
          originalError: exceptionResponse,
          mappedError: gameException.errorCode,
          url: request.url,
          method: request.method,
        });
      } else {
        // Other HTTP exceptions
        gameException = new GameException(
          exception.message,
          'HTTP_ERROR',
          { originalStatus: exception.getStatus() },
          exception.getStatus(),
        );
        status = exception.getStatus();
      }
    } else if (exception instanceof Error) {
      // Generic errors
      gameException = new GameException(
        exception.message,
        'INTERNAL_ERROR',
        { stack: exception.stack },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      
      this.logger.error('Unhandled error in game module', {
        error: exception.message,
        stack: exception.stack,
        url: request.url,
        method: request.method,
      });
    } else {
      // Unknown error type
      gameException = new GameException(
        'Unknown error occurred',
        'UNKNOWN_ERROR',
        { originalException: exception },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      
      this.logger.error('Unknown error type in game module', {
        exception,
        url: request.url,
        method: request.method,
      });
    }

    const errorResponse = {
      error: gameException.errorCode,
      message: gameException.message,
      details: gameException.details,
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
    };

    response.status(status).json(errorResponse);
  }
}
