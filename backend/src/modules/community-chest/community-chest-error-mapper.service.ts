import { Injectable, HttpStatus } from '@nestjs/common';
import { ValidationError } from 'class-validator';

export interface CommunityChestMappedError {
  statusCode: number;
  message: string;
  error: string;
  details?: Record<string, string[]>;
}

export enum CommunityChestErrorCode {
  VALIDATION_ERROR = 'COMMUNITY_CHEST_VALIDATION_ERROR',
  NOT_FOUND = 'COMMUNITY_CHEST_NOT_FOUND',
  DUPLICATE_INSTRUCTION = 'COMMUNITY_CHEST_DUPLICATE_INSTRUCTION',
  INVALID_TYPE = 'COMMUNITY_CHEST_INVALID_TYPE',
  INVALID_AMOUNT = 'COMMUNITY_CHEST_INVALID_AMOUNT',
  CREATE_FAILED = 'COMMUNITY_CHEST_CREATE_FAILED',
  UPDATE_FAILED = 'COMMUNITY_CHEST_UPDATE_FAILED',
}

@Injectable()
export class CommunityChestErrorMapperService {
  private readonly statusCodeMap: Record<string, number> = {
    [CommunityChestErrorCode.VALIDATION_ERROR]: HttpStatus.BAD_REQUEST,
    [CommunityChestErrorCode.NOT_FOUND]: HttpStatus.NOT_FOUND,
    [CommunityChestErrorCode.DUPLICATE_INSTRUCTION]: HttpStatus.CONFLICT,
    [CommunityChestErrorCode.INVALID_TYPE]: HttpStatus.BAD_REQUEST,
    [CommunityChestErrorCode.INVALID_AMOUNT]: HttpStatus.BAD_REQUEST,
    [CommunityChestErrorCode.CREATE_FAILED]: HttpStatus.INTERNAL_SERVER_ERROR,
    [CommunityChestErrorCode.UPDATE_FAILED]: HttpStatus.INTERNAL_SERVER_ERROR,
  };

  private readonly messageMap: Record<string, string> = {
    [CommunityChestErrorCode.VALIDATION_ERROR]: 'Validation failed',
    [CommunityChestErrorCode.NOT_FOUND]: 'Community Chest card not found',
    [CommunityChestErrorCode.DUPLICATE_INSTRUCTION]:
      'A Community Chest card with this instruction already exists',
    [CommunityChestErrorCode.INVALID_TYPE]:
      'Invalid card type. Must be one of: reward, penalty, move',
    [CommunityChestErrorCode.INVALID_AMOUNT]:
      'Amount must be a non-negative integer',
    [CommunityChestErrorCode.CREATE_FAILED]:
      'Failed to create Community Chest card',
    [CommunityChestErrorCode.UPDATE_FAILED]:
      'Failed to update Community Chest card',
  };

  mapError(
    errorCode: CommunityChestErrorCode,
    details?: Record<string, string[]>,
  ): CommunityChestMappedError {
    return {
      statusCode:
        this.statusCodeMap[errorCode] ?? HttpStatus.INTERNAL_SERVER_ERROR,
      message: this.messageMap[errorCode] ?? 'An unexpected error occurred',
      error: errorCode,
      details,
    };
  }

  mapValidationErrors(errors: ValidationError[]): CommunityChestMappedError {
    const details = this.formatValidationErrors(errors);

    return {
      statusCode: HttpStatus.BAD_REQUEST,
      message: 'Validation failed',
      error: CommunityChestErrorCode.VALIDATION_ERROR,
      details,
    };
  }

  private formatValidationErrors(
    errors: ValidationError[],
  ): Record<string, string[]> {
    const formatted: Record<string, string[]> = {};

    for (const error of errors) {
      if (error.constraints) {
        formatted[error.property] = Object.values(error.constraints);
      }

      if (error.children && error.children.length > 0) {
        const nested = this.formatValidationErrors(error.children);
        for (const key of Object.keys(nested)) {
          formatted[`${error.property}.${key}`] = nested[key];
        }
      }
    }

    return formatted;
  }

  getStatusCode(errorCode: CommunityChestErrorCode): number {
    return this.statusCodeMap[errorCode] ?? HttpStatus.INTERNAL_SERVER_ERROR;
  }

  getMessage(errorCode: CommunityChestErrorCode): string {
    return this.messageMap[errorCode] ?? 'An unexpected error occurred';
  }
}
