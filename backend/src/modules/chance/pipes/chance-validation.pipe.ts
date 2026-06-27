import { Injectable, PipeTransform, BadRequestException } from '@nestjs/common';
import { validate } from 'class-validator';
import { plainToClass } from 'class-transformer';
import {
  mapValidationErrorToChanceException,
  ChanceValidationException,
} from '../exceptions/chance-exceptions';

@Injectable()
export class ChanceValidationPipe implements PipeTransform {
  async transform(value: any): Promise<any> {
    // This pipe assumes the DTO class is determined by NestJS's type metadata
    // In actual use, the ValidationPipe is typically registered globally
    if (!value || typeof value !== 'object') {
      throw new BadRequestException('Request body must be an object');
    }

    return value;
  }
}

/**
 * Global validation error handler for chance DTOs.
 * This function can be used in exception filters to map validation errors
 * to ChanceException.
 */
export function handleChanceValidationError(error: any): ChanceValidationException {
  if (error.getResponse?.()) {
    const response = error.getResponse();
    if (Array.isArray(response?.message)) {
      return mapValidationErrorToChanceException(response.message);
    }
  }

  return new ChanceValidationException(
    'unknown',
    null,
    'Validation failed',
  );
}
