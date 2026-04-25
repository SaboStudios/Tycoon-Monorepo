import { Injectable, HttpStatus } from '@nestjs/common';
import { ValidationError } from 'class-validator';

export interface MappedError {
  statusCode: number;
  message: string;
  error: string;
  details?: any;
}

export enum UploadErrorCode {
  // File validation errors
  FILE_TOO_LARGE = 'FILE_TOO_LARGE',
  FILE_TYPE_NOT_ALLOWED = 'FILE_TYPE_NOT_ALLOWED',
  EXECUTABLE_NOT_ALLOWED = 'EXECUTABLE_NOT_ALLOWED',
  MAGIC_BYTES_MISMATCH = 'MAGIC_BYTES_MISMATCH',
  FILE_REQUIRED = 'FILE_REQUIRED',
  
  // Multer errors
  LIMIT_FILE_SIZE = 'LIMIT_FILE_SIZE',
  LIMIT_FILE_COUNT = 'LIMIT_FILE_COUNT',
  LIMIT_UNEXPECTED_FILE = 'LIMIT_UNEXPECTED_FILE',
  LIMIT_FIELD_KEY = 'LIMIT_FIELD_KEY',
  LIMIT_FIELD_VALUE = 'LIMIT_FIELD_VALUE',
  LIMIT_FIELD_COUNT = 'LIMIT_FIELD_COUNT',
  LIMIT_PART_COUNT = 'LIMIT_PART_COUNT',
  
  // Virus scan errors
  VIRUS_DETECTED = 'VIRUS_DETECTED',
  VIRUS_SCAN_FAILED = 'VIRUS_SCAN_FAILED',
  
  // Storage errors
  STORAGE_ERROR = 'STORAGE_ERROR',
  STORAGE_QUOTA_EXCEEDED = 'STORAGE_QUOTA_EXCEEDED',
  
  // Token/URL errors
  INVALID_TOKEN = 'INVALID_TOKEN',
  EXPIRED_TOKEN = 'EXPIRED_TOKEN',
  INVALID_KEY = 'INVALID_KEY',
  
  // DTO validation errors
  VALIDATION_ERROR = 'VALIDATION_ERROR',
}

/**
 * Service for mapping upload-related errors to standardized HTTP responses
 * Provides consistent error messages and status codes across the uploads module
 * 
 * Security: No sensitive information (file paths, internal errors) exposed
 * Compliance: Aligns with ERROR_MESSAGE_STANDARDS.md
 */
@Injectable()
export class UploadsErrorMapperService {
  /**
   * Map error code to HTTP status code
   */
  private readonly statusCodeMap: Record<string, number> = {
    // 400 Bad Request
    [UploadErrorCode.FILE_REQUIRED]: HttpStatus.BAD_REQUEST,
    [UploadErrorCode.FILE_TYPE_NOT_ALLOWED]: HttpStatus.BAD_REQUEST,
    [UploadErrorCode.EXECUTABLE_NOT_ALLOWED]: HttpStatus.BAD_REQUEST,
    [UploadErrorCode.MAGIC_BYTES_MISMATCH]: HttpStatus.BAD_REQUEST,
    [UploadErrorCode.INVALID_KEY]: HttpStatus.BAD_REQUEST,
    [UploadErrorCode.VALIDATION_ERROR]: HttpStatus.BAD_REQUEST,
    [UploadErrorCode.LIMIT_FILE_COUNT]: HttpStatus.BAD_REQUEST,
    [UploadErrorCode.LIMIT_UNEXPECTED_FILE]: HttpStatus.BAD_REQUEST,
    [UploadErrorCode.LIMIT_FIELD_KEY]: HttpStatus.BAD_REQUEST,
    [UploadErrorCode.LIMIT_FIELD_VALUE]: HttpStatus.BAD_REQUEST,
    [UploadErrorCode.LIMIT_FIELD_COUNT]: HttpStatus.BAD_REQUEST,
    [UploadErrorCode.LIMIT_PART_COUNT]: HttpStatus.BAD_REQUEST,
    
    // 401 Unauthorized
    [UploadErrorCode.INVALID_TOKEN]: HttpStatus.UNAUTHORIZED,
    [UploadErrorCode.EXPIRED_TOKEN]: HttpStatus.UNAUTHORIZED,
    
    // 413 Payload Too Large
    [UploadErrorCode.FILE_TOO_LARGE]: HttpStatus.PAYLOAD_TOO_LARGE,
    [UploadErrorCode.LIMIT_FILE_SIZE]: HttpStatus.PAYLOAD_TOO_LARGE,
    
    // 422 Unprocessable Entity
    [UploadErrorCode.VIRUS_DETECTED]: HttpStatus.UNPROCESSABLE_ENTITY,
    
    // 500 Internal Server Error
    [UploadErrorCode.VIRUS_SCAN_FAILED]: HttpStatus.INTERNAL_SERVER_ERROR,
    [UploadErrorCode.STORAGE_ERROR]: HttpStatus.INTERNAL_SERVER_ERROR,
    
    // 507 Insufficient Storage
    [UploadErrorCode.STORAGE_QUOTA_EXCEEDED]: HttpStatus.INSUFFICIENT_STORAGE,
  };

  /**
   * Map error code to user-friendly message
   */
  private readonly messageMap: Record<string, string> = {
    [UploadErrorCode.FILE_REQUIRED]: 'File is required',
    [UploadErrorCode.FILE_TOO_LARGE]: 'File size exceeds the maximum allowed size of 5MB',
    [UploadErrorCode.FILE_TYPE_NOT_ALLOWED]: 'File type not permitted. Only JPEG, PNG, GIF, and WebP images are accepted',
    [UploadErrorCode.EXECUTABLE_NOT_ALLOWED]: 'Executable files are not allowed',
    [UploadErrorCode.MAGIC_BYTES_MISMATCH]: 'File content does not match the declared file type',
    [UploadErrorCode.LIMIT_FILE_SIZE]: 'File size exceeds the maximum allowed size of 5MB',
    [UploadErrorCode.LIMIT_FILE_COUNT]: 'Too many files uploaded. Only 1 file is allowed',
    [UploadErrorCode.LIMIT_UNEXPECTED_FILE]: 'Unexpected file field in upload',
    [UploadErrorCode.LIMIT_FIELD_KEY]: 'Field name is too long',
    [UploadErrorCode.LIMIT_FIELD_VALUE]: 'Field value is too long',
    [UploadErrorCode.LIMIT_FIELD_COUNT]: 'Too many fields in upload',
    [UploadErrorCode.LIMIT_PART_COUNT]: 'Too many parts in multipart upload',
    [UploadErrorCode.VIRUS_DETECTED]: 'File contains malicious content and cannot be uploaded',
    [UploadErrorCode.VIRUS_SCAN_FAILED]: 'Unable to scan file for viruses. Please try again',
    [UploadErrorCode.STORAGE_ERROR]: 'Failed to store file. Please try again',
    [UploadErrorCode.STORAGE_QUOTA_EXCEEDED]: 'Storage quota exceeded. Please delete some files or contact support',
    [UploadErrorCode.INVALID_TOKEN]: 'Invalid or malformed download token',
    [UploadErrorCode.EXPIRED_TOKEN]: 'Download token has expired',
    [UploadErrorCode.INVALID_KEY]: 'Invalid file key format',
    [UploadErrorCode.VALIDATION_ERROR]: 'Validation failed',
  };

  /**
   * Map an error code to a standardized error response
   */
  mapError(errorCode: UploadErrorCode, details?: any): MappedError {
    const statusCode = this.statusCodeMap[errorCode] ?? HttpStatus.BAD_REQUEST;
    const message = this.messageMap[errorCode] ?? 'An error occurred during file upload';

    return {
      statusCode,
      message,
      error: errorCode,
      details: this.sanitizeDetails(details),
    };
  }

  /**
   * Map Multer error to standardized error response
   */
  mapMulterError(multerCode: string, originalMessage?: string): MappedError {
    const errorCode = multerCode as UploadErrorCode;
    const mapped = this.mapError(errorCode);

    // Use original message if available and more specific
    if (originalMessage && !this.messageMap[errorCode]) {
      mapped.message = this.sanitizeMessage(originalMessage);
    }

    return mapped;
  }

  /**
   * Map class-validator ValidationError array to standardized error response
   */
  mapValidationErrors(errors: ValidationError[]): MappedError {
    const details = this.formatValidationErrors(errors);

    return {
      statusCode: HttpStatus.BAD_REQUEST,
      message: 'Validation failed',
      error: UploadErrorCode.VALIDATION_ERROR,
      details,
    };
  }

  /**
   * Map file validator error to standardized error response
   */
  mapFileValidatorError(validatorMessage: string): MappedError {
    // Determine error code based on message content
    let errorCode: UploadErrorCode;

    if (validatorMessage.includes('Executable')) {
      errorCode = UploadErrorCode.EXECUTABLE_NOT_ALLOWED;
    } else if (validatorMessage.includes('File type') || validatorMessage.includes('magic')) {
      errorCode = UploadErrorCode.MAGIC_BYTES_MISMATCH;
    } else if (validatorMessage.includes('size')) {
      errorCode = UploadErrorCode.FILE_TOO_LARGE;
    } else {
      errorCode = UploadErrorCode.FILE_TYPE_NOT_ALLOWED;
    }

    return this.mapError(errorCode);
  }

  /**
   * Format class-validator errors into a structured format
   */
  private formatValidationErrors(errors: ValidationError[]): Record<string, string[]> {
    const formatted: Record<string, string[]> = {};

    for (const error of errors) {
      if (error.constraints) {
        formatted[error.property] = Object.values(error.constraints);
      }

      // Handle nested validation errors
      if (error.children && error.children.length > 0) {
        const nested = this.formatValidationErrors(error.children);
        Object.keys(nested).forEach((key) => {
          formatted[`${error.property}.${key}`] = nested[key];
        });
      }
    }

    return formatted;
  }

  /**
   * Sanitize error details to remove sensitive information
   */
  private sanitizeDetails(details: any): any {
    if (!details) {
      return undefined;
    }

    // If it's a string, check for sensitive patterns
    if (typeof details === 'string') {
      return this.sanitizeMessage(details);
    }

    // If it's an object, recursively sanitize
    if (typeof details === 'object') {
      const sanitized: any = Array.isArray(details) ? [] : {};

      for (const key in details) {
        // Skip sensitive keys
        if (this.isSensitiveKey(key)) {
          continue;
        }

        sanitized[key] = this.sanitizeDetails(details[key]);
      }

      return sanitized;
    }

    return details;
  }

  /**
   * Sanitize error message to remove sensitive information
   */
  private sanitizeMessage(message: string): string {
    // Remove file paths
    message = message.replace(/\/[^\s]+\.(jpg|png|gif|webp|exe|bin|sh)/gi, '[file]');
    
    // Remove potential internal error details
    message = message.replace(/Error: .+/g, 'An error occurred');
    
    // Remove stack traces
    message = message.split('\n')[0];

    return message;
  }

  /**
   * Check if a key contains sensitive information
   */
  private isSensitiveKey(key: string): boolean {
    const sensitiveKeys = [
      'password',
      'token',
      'secret',
      'apiKey',
      'api_key',
      'authorization',
      'auth',
      'credential',
      'key',
      'path',
      'filepath',
      'filename',
    ];

    const lowerKey = key.toLowerCase();
    return sensitiveKeys.some((sensitive) => lowerKey.includes(sensitive));
  }

  /**
   * Get HTTP status code for an error code
   */
  getStatusCode(errorCode: UploadErrorCode): number {
    return this.statusCodeMap[errorCode] ?? HttpStatus.BAD_REQUEST;
  }

  /**
   * Get user-friendly message for an error code
   */
  getMessage(errorCode: UploadErrorCode): string {
    return this.messageMap[errorCode] ?? 'An error occurred';
  }
}
