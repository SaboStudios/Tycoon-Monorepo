import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { MulterError } from 'multer';
import type { Response } from 'express';

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

  catch(exception: MulterError, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const status = STATUS_MAP[exception.code] ?? HttpStatus.BAD_REQUEST;

    this.logger.warn(`MulterError [${exception.code}]: ${exception.message}`);

    res.status(status).json({
      statusCode: status,
      message: exception.message,
      error: exception.code,
    });
  }
}
