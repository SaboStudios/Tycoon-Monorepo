import { HttpException, HttpStatus } from '@nestjs/common';

export class ChanceException extends HttpException {
  constructor(
    message: string,
    public readonly errorCode: string,
    public readonly details?: any,
    httpStatus: HttpStatus = HttpStatus.BAD_REQUEST,
  ) {
    super(
      {
        error: errorCode,
        message,
        details,
        timestamp: new Date().toISOString(),
      },
      httpStatus,
    );
  }
}

export class ChanceNotFoundException extends ChanceException {
  constructor(chanceId: number | string, details?: any) {
    super(
      `Chance card with ID ${chanceId} not found`,
      'CHANCE_NOT_FOUND',
      { chanceId, ...details },
      HttpStatus.NOT_FOUND,
    );
  }
}

export class NoChanceCardsAvailableException extends ChanceException {
  constructor(details?: any) {
    super(
      'No chance cards available to draw',
      'NO_CHANCE_CARDS_AVAILABLE',
      details,
      HttpStatus.BAD_REQUEST,
    );
  }
}

export class ChanceValidationException extends ChanceException {
  constructor(field: string, value: any, constraint: string, details?: any) {
    super(
      `Invalid ${field}: ${constraint}`,
      'CHANCE_VALIDATION_ERROR',
      { field, value, constraint, ...details },
      HttpStatus.BAD_REQUEST,
    );
  }
}

export class InvalidChanceTypeException extends ChanceException {
  constructor(type: string, details?: any) {
    super(
      `Invalid chance type: ${type}. Must be one of: reward, penalty, move`,
      'INVALID_CHANCE_TYPE',
      { type, ...details },
      HttpStatus.BAD_REQUEST,
    );
  }
}

export class MissingRequiredFieldException extends ChanceException {
  constructor(field: string, reason: string, details?: any) {
    super(
      `Missing required field '${field}': ${reason}`,
      'MISSING_REQUIRED_FIELD',
      { field, reason, ...details },
      HttpStatus.BAD_REQUEST,
    );
  }
}

// Utility function to map validation errors to ChanceException
export function mapValidationErrorToChanceException(
  errors: any[],
): ChanceException {
  if (errors.length === 0) {
    return new ChanceException(
      'Unknown validation error',
      'UNKNOWN_VALIDATION_ERROR',
    );
  }

  const firstError = errors[0];
  const constraints = firstError.constraints;
  const property = firstError.property;
  const value = firstError.value;

  // Map common validation errors to specific exceptions
  if (constraints && Object.keys(constraints).length > 0) {
    const constraintKey = Object.keys(constraints)[0];
    const constraintMessage = constraints[constraintKey];

    switch (constraintKey) {
      case 'isEnum':
        return new InvalidChanceTypeException(value);
      case 'isString':
        return new ChanceValidationException(property, value, 'Must be a string');
      case 'isNotEmpty':
        return new ChanceValidationException(
          property,
          value,
          'Cannot be empty',
        );
      case 'isNumber':
        return new ChanceValidationException(property, value, 'Must be a number');
      case 'isInt':
        return new ChanceValidationException(
          property,
          value,
          'Must be an integer',
        );
      case 'min':
        return new ChanceValidationException(
          property,
          value,
          constraintMessage || 'Value is too small',
        );
      case 'max':
        return new ChanceValidationException(
          property,
          value,
          'Value is too large',
        );
      case 'maxLength':
        return new ChanceValidationException(
          property,
          value,
          'Value is too long',
        );
      case 'minLength':
        return new ChanceValidationException(
          property,
          value,
          'Value is too short',
        );
      case 'isObject':
        return new ChanceValidationException(property, value, 'Must be an object');
      default:
        return new ChanceValidationException(property, value, constraintMessage);
    }
  }

  return new ChanceValidationException(property, value, 'Validation failed');
}
