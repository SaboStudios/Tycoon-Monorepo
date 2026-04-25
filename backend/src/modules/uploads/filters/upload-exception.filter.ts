import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';
import { MulterError } from 'multer';
import { UploadsErrorMapperService, UploadErrorCode } from '../uploads-error-mapper.service';
import { UploadsObservabilityService } from '../uploads-observability.service';

/**
 * Comprehensive exception filter for upload-related errors
 * Handles Multer errors, validation errors, and custom upload errors
 * Uses error mapper for consistent error responses
 */
@Catch()
export class UploadExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(UploadExceptionFilter.name);

  constructor(
    private readonly errorMapper: UploadsErrorMapperService,
    private readonly observability?: UploadsObservabilityService,
  ) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest();

    let mappedError: ReturnType<typeof this.errorMapper.mapError>;

    // Handle Multer errors
    if (exception instanceof MulterError) {
      mappedError = this.errorMapper.mapMulterError(exception.code, exception.message);
      this.logger.warn(`Multer error: ${exception.code} - ${exception.message}`);
      this.observability?.recordMulterError(exception.code);
    }
    // Handle HTTP exceptions (including validation errors)
    else if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      // If it's already a mapped error from our error mapper, use it
      if (
        typeof exceptionResponse === 'object' &&
        exceptionResponse !== null &&
        'error' in exceptionResponse
      ) {
        mappedError = exceptionResponse as any;
      } else {
        // Map generic HTTP exception
        mappedError = {
          statusCode: status,
          message: exception.message,
          error: HttpStatus[status] || 'ERROR',
          details: typeof exceptionResponse === 'object' ? exceptionResponse : undefined,
        };
      }

      this.logger.warn(`HTTP exception: ${status} - ${exception.message}`);
    }
    // Handle file validator errors (from ParseFilePipe)
    else if (exception instanceof Error && exception.message.includes('Validation failed')) {
      // Extract the actual validation message
      const validatorMessage = exception.message.replace('Validation failed', '').trim();
      mappedError = this.errorMapper.mapFileValidatorError(validatorMessage);
      this.logger.warn(`File validation error: ${validatorMessage}`);
    }
    // Handle generic errors
    else if (exception instanceof Error) {
      mappedError = this.errorMapper.mapError(
        UploadErrorCode.STORAGE_ERROR,
        process.env.NODE_ENV === 'development' ? exception.message : undefined,
      );
      this.logger.error(`Unexpected error: ${exception.message}`, exception.stack);
    }
    // Handle unknown errors
    else {
      mappedError = this.errorMapper.mapError(UploadErrorCode.STORAGE_ERROR);
      this.logger.error('Unknown error occurred', String(exception));
    }

    // Log error details (sanitized)
    this.logger.debug(
      `Error response: ${JSON.stringify({
        path: request.url,
        method: request.method,
        statusCode: mappedError.statusCode,
        error: mappedError.error,
      })}`,
    );

    // Send response
    response.status(mappedError.statusCode).json(mappedError);
  }
}
