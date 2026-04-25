import { Test, TestingModule } from '@nestjs/testing';
import { HttpStatus } from '@nestjs/common';
import { ValidationError } from 'class-validator';
import { UploadsErrorMapperService, UploadErrorCode } from './uploads-error-mapper.service';

describe('UploadsErrorMapperService', () => {
  let service: UploadsErrorMapperService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [UploadsErrorMapperService],
    }).compile();

    service = module.get<UploadsErrorMapperService>(UploadsErrorMapperService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('mapError', () => {
    it('should map FILE_TOO_LARGE error correctly', () => {
      const result = service.mapError(UploadErrorCode.FILE_TOO_LARGE);

      expect(result.statusCode).toBe(HttpStatus.PAYLOAD_TOO_LARGE);
      expect(result.error).toBe(UploadErrorCode.FILE_TOO_LARGE);
      expect(result.message).toContain('5MB');
    });

    it('should map FILE_TYPE_NOT_ALLOWED error correctly', () => {
      const result = service.mapError(UploadErrorCode.FILE_TYPE_NOT_ALLOWED);

      expect(result.statusCode).toBe(HttpStatus.BAD_REQUEST);
      expect(result.error).toBe(UploadErrorCode.FILE_TYPE_NOT_ALLOWED);
      expect(result.message).toContain('JPEG, PNG, GIF');
    });

    it('should map VIRUS_DETECTED error correctly', () => {
      const result = service.mapError(UploadErrorCode.VIRUS_DETECTED);

      expect(result.statusCode).toBe(HttpStatus.UNPROCESSABLE_ENTITY);
      expect(result.error).toBe(UploadErrorCode.VIRUS_DETECTED);
      expect(result.message).toContain('malicious');
    });

    it('should map INVALID_TOKEN error correctly', () => {
      const result = service.mapError(UploadErrorCode.INVALID_TOKEN);

      expect(result.statusCode).toBe(HttpStatus.UNAUTHORIZED);
      expect(result.error).toBe(UploadErrorCode.INVALID_TOKEN);
    });

    it('should include sanitized details when provided', () => {
      const details = { field: 'test', value: 'safe' };
      const result = service.mapError(UploadErrorCode.VALIDATION_ERROR, details);

      expect(result.details).toEqual(details);
    });
  });

  describe('mapMulterError', () => {
    it('should map LIMIT_FILE_SIZE error', () => {
      const result = service.mapMulterError('LIMIT_FILE_SIZE', 'File too large');

      expect(result.statusCode).toBe(HttpStatus.PAYLOAD_TOO_LARGE);
      expect(result.error).toBe('LIMIT_FILE_SIZE');
    });

    it('should map LIMIT_FILE_COUNT error', () => {
      const result = service.mapMulterError('LIMIT_FILE_COUNT');

      expect(result.statusCode).toBe(HttpStatus.BAD_REQUEST);
      expect(result.message).toContain('Too many files');
    });

    it('should use original message when available', () => {
      const originalMessage = 'Custom error message';
      const result = service.mapMulterError('UNKNOWN_CODE', originalMessage);

      expect(result.message).toBe(originalMessage);
    });
  });

  describe('mapValidationErrors', () => {
    it('should map single validation error', () => {
      const errors: ValidationError[] = [
        {
          property: 'key',
          constraints: {
            isNotEmpty: 'Key is required',
            isString: 'Key must be a string',
          },
          children: [],
        } as ValidationError,
      ];

      const result = service.mapValidationErrors(errors);

      expect(result.statusCode).toBe(HttpStatus.BAD_REQUEST);
      expect(result.error).toBe(UploadErrorCode.VALIDATION_ERROR);
      expect(result.details).toHaveProperty('key');
      expect(result.details.key).toContain('Key is required');
      expect(result.details.key).toContain('Key must be a string');
    });

    it('should map nested validation errors', () => {
      const errors: ValidationError[] = [
        {
          property: 'metadata',
          constraints: {},
          children: [
            {
              property: 'description',
              constraints: {
                maxLength: 'Description must not exceed 500 characters',
              },
              children: [],
            } as ValidationError,
          ],
        } as ValidationError,
      ];

      const result = service.mapValidationErrors(errors);

      expect(result.details).toHaveProperty('metadata.description');
      expect(result.details['metadata.description']).toContain('500 characters');
    });

    it('should handle multiple validation errors', () => {
      const errors: ValidationError[] = [
        {
          property: 'key',
          constraints: { isNotEmpty: 'Key is required' },
          children: [],
        } as ValidationError,
        {
          property: 'token',
          constraints: { isString: 'Token must be a string' },
          children: [],
        } as ValidationError,
      ];

      const result = service.mapValidationErrors(errors);

      expect(result.details).toHaveProperty('key');
      expect(result.details).toHaveProperty('token');
    });
  });

  describe('mapFileValidatorError', () => {
    it('should map executable file error', () => {
      const result = service.mapFileValidatorError('Executable files are not allowed');

      expect(result.error).toBe(UploadErrorCode.EXECUTABLE_NOT_ALLOWED);
      expect(result.statusCode).toBe(HttpStatus.BAD_REQUEST);
    });

    it('should map file type error', () => {
      const result = service.mapFileValidatorError('File type not permitted');

      expect(result.error).toBe(UploadErrorCode.MAGIC_BYTES_MISMATCH);
    });

    it('should map size error', () => {
      const result = service.mapFileValidatorError('File size exceeds limit');

      expect(result.error).toBe(UploadErrorCode.FILE_TOO_LARGE);
    });

    it('should default to FILE_TYPE_NOT_ALLOWED for unknown messages', () => {
      const result = service.mapFileValidatorError('Unknown validation error');

      expect(result.error).toBe(UploadErrorCode.FILE_TYPE_NOT_ALLOWED);
    });
  });

  describe('getStatusCode', () => {
    it('should return correct status code for known error', () => {
      const statusCode = service.getStatusCode(UploadErrorCode.FILE_TOO_LARGE);

      expect(statusCode).toBe(HttpStatus.PAYLOAD_TOO_LARGE);
    });

    it('should return BAD_REQUEST for unknown error', () => {
      const statusCode = service.getStatusCode('UNKNOWN_ERROR' as UploadErrorCode);

      expect(statusCode).toBe(HttpStatus.BAD_REQUEST);
    });
  });

  describe('getMessage', () => {
    it('should return correct message for known error', () => {
      const message = service.getMessage(UploadErrorCode.VIRUS_DETECTED);

      expect(message).toContain('malicious');
    });

    it('should return generic message for unknown error', () => {
      const message = service.getMessage('UNKNOWN_ERROR' as UploadErrorCode);

      expect(message).toBe('An error occurred');
    });
  });

  describe('security - sanitization', () => {
    it('should remove sensitive keys from details', () => {
      const details = {
        password: 'secret123',
        token: 'jwt_token',
        apiKey: 'api_key_123',
        safeField: 'keep_this',
      };

      const result = service.mapError(UploadErrorCode.VALIDATION_ERROR, details);

      expect(result.details).not.toHaveProperty('password');
      expect(result.details).not.toHaveProperty('token');
      expect(result.details).not.toHaveProperty('apiKey');
      expect(result.details).toHaveProperty('safeField', 'keep_this');
    });

    it('should sanitize nested objects', () => {
      const details = {
        user: {
          password: 'secret',
          name: 'John',
        },
        safeData: 'keep',
      };

      const result = service.mapError(UploadErrorCode.VALIDATION_ERROR, details);

      expect(result.details.user).not.toHaveProperty('password');
      expect(result.details.user).toHaveProperty('name', 'John');
      expect(result.details).toHaveProperty('safeData', 'keep');
    });

    it('should sanitize file paths from messages', () => {
      const details = 'Error processing /var/uploads/secret/file.jpg';

      const result = service.mapError(UploadErrorCode.STORAGE_ERROR, details);

      expect(result.details).not.toContain('/var/uploads');
      expect(result.details).toContain('[file]');
    });

    it('should remove stack traces from messages', () => {
      const details = 'Error: Something went wrong\n    at Function.test\n    at Object.<anonymous>';

      const result = service.mapError(UploadErrorCode.STORAGE_ERROR, details);

      expect(result.details).not.toContain('at Function');
      expect(result.details).not.toContain('at Object');
    });

    it('should handle array details', () => {
      const details = [
        { password: 'secret', name: 'item1' },
        { token: 'jwt', value: 'item2' },
      ];

      const result = service.mapError(UploadErrorCode.VALIDATION_ERROR, details);

      expect(result.details[0]).not.toHaveProperty('password');
      expect(result.details[0]).toHaveProperty('name', 'item1');
      expect(result.details[1]).not.toHaveProperty('token');
      expect(result.details[1]).toHaveProperty('value', 'item2');
    });
  });

  describe('error code coverage', () => {
    it('should have status codes for all error codes', () => {
      const errorCodes = Object.values(UploadErrorCode);

      errorCodes.forEach((code) => {
        const statusCode = service.getStatusCode(code);
        expect(statusCode).toBeGreaterThanOrEqual(400);
        expect(statusCode).toBeLessThan(600);
      });
    });

    it('should have messages for all error codes', () => {
      const errorCodes = Object.values(UploadErrorCode);

      errorCodes.forEach((code) => {
        const message = service.getMessage(code);
        expect(message).toBeTruthy();
        expect(message.length).toBeGreaterThan(0);
      });
    });
  });
});
