import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
  Logger,
  Optional,
} from '@nestjs/common';
import { MulterError } from 'multer';
import type { Response } from 'express';
import { UploadsObservabilityService } from './uploads-observability.service';

const STATUS_MAP: Partial<Record<string, number>> = {
  LIMIT_FILE_SIZE: HttpStatus.PAYLOAD_TOO_LARGE,
  LIMIT_FILE_COUNT: HttpStatus.BAD_REQUEST,
  LIMIT_UNEXPECTED_FILE: HttpStatus.BAD_REQUEST,
  LIMIT_FIELD_KEY: HttpStatus.BAD_REQUEST,
  LIMIT_FIELD_VALUE: HttpStatus.BAD_REQUEST,
  LIMIT_FIELD_COUNT: HttpStatus.BAD_REQUEST,
  LIMIT_PART_COUNT: HttpStatus.BAD_REQUEST,
};

@Catch(MulterError)
export class MulterExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(MulterExceptionFilter.name);

  constructor(
    @Optional() private readonly uploadsObservability?: UploadsObservabilityService,
  ) {}

  catch(exception: MulterError, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const status = STATUS_MAP[exception.code] ?? HttpStatus.BAD_REQUEST;

    this.logger.warn(`MulterError [${exception.code}]: ${exception.message}`);
    this.uploadsObservability?.recordMulterError(exception.code);

    res.status(status).json({
      statusCode: status,
      message: exception.message,
      error: exception.code,
    });
  }
}
