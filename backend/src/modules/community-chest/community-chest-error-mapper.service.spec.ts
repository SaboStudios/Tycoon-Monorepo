import { HttpStatus } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ValidationError } from 'class-validator';
import {
  CommunityChestErrorMapperService,
  CommunityChestErrorCode,
} from './community-chest-error-mapper.service';

describe('CommunityChestErrorMapperService', () => {
  let service: CommunityChestErrorMapperService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CommunityChestErrorMapperService],
    }).compile();

    service = module.get<CommunityChestErrorMapperService>(
      CommunityChestErrorMapperService,
    );
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('mapError', () => {
    it('should map VALIDATION_ERROR to 400', () => {
      const result = service.mapError(CommunityChestErrorCode.VALIDATION_ERROR);

      expect(result.statusCode).toBe(HttpStatus.BAD_REQUEST);
      expect(result.message).toBe('Validation failed');
      expect(result.error).toBe(CommunityChestErrorCode.VALIDATION_ERROR);
    });

    it('should map NOT_FOUND to 404', () => {
      const result = service.mapError(CommunityChestErrorCode.NOT_FOUND);

      expect(result.statusCode).toBe(HttpStatus.NOT_FOUND);
      expect(result.message).toContain('not found');
    });

    it('should map DUPLICATE_INSTRUCTION to 409', () => {
      const result = service.mapError(
        CommunityChestErrorCode.DUPLICATE_INSTRUCTION,
      );

      expect(result.statusCode).toBe(HttpStatus.CONFLICT);
      expect(result.message).toContain('already exists');
    });

    it('should map INVALID_TYPE to 400', () => {
      const result = service.mapError(CommunityChestErrorCode.INVALID_TYPE);

      expect(result.statusCode).toBe(HttpStatus.BAD_REQUEST);
      expect(result.message).toContain('Invalid card type');
    });

    it('should map INVALID_AMOUNT to 400', () => {
      const result = service.mapError(CommunityChestErrorCode.INVALID_AMOUNT);

      expect(result.statusCode).toBe(HttpStatus.BAD_REQUEST);
    });

    it('should map CREATE_FAILED to 500', () => {
      const result = service.mapError(CommunityChestErrorCode.CREATE_FAILED);

      expect(result.statusCode).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
    });

    it('should map UPDATE_FAILED to 500', () => {
      const result = service.mapError(CommunityChestErrorCode.UPDATE_FAILED);

      expect(result.statusCode).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
    });

    it('should include details when provided', () => {
      const details = { instruction: ['must be a string'] };
      const result = service.mapError(
        CommunityChestErrorCode.VALIDATION_ERROR,
        details,
      );

      expect(result.details).toEqual(details);
    });
  });

  describe('mapValidationErrors', () => {
    it('should format simple validation errors', () => {
      const errors: ValidationError[] = [
        {
          property: 'instruction',
          constraints: {
            isString: 'instruction must be a string',
            maxLength: 'instruction must be shorter than 500 characters',
          },
          children: [],
          target: undefined,
          value: undefined,
        },
      ];

      const result = service.mapValidationErrors(errors);

      expect(result.statusCode).toBe(HttpStatus.BAD_REQUEST);
      expect(result.error).toBe(CommunityChestErrorCode.VALIDATION_ERROR);
      expect(result.details).toBeDefined();
      expect(result.details!['instruction']).toHaveLength(2);
    });

    it('should format nested validation errors', () => {
      const errors: ValidationError[] = [
        {
          property: 'extra',
          constraints: undefined,
          children: [
            {
              property: 'nested',
              constraints: { isString: 'nested must be a string' },
              children: [],
              target: undefined,
              value: undefined,
            },
          ],
          target: undefined,
          value: undefined,
        },
      ];

      const result = service.mapValidationErrors(errors);

      expect(result.details).toBeDefined();
      expect(result.details!['extra.nested']).toBeDefined();
    });

    it('should handle empty error list', () => {
      const result = service.mapValidationErrors([]);

      expect(result.statusCode).toBe(HttpStatus.BAD_REQUEST);
      expect(result.details).toEqual({});
    });
  });

  describe('getStatusCode', () => {
    it('should return correct status code for known errors', () => {
      expect(
        service.getStatusCode(CommunityChestErrorCode.NOT_FOUND),
      ).toBe(HttpStatus.NOT_FOUND);
    });

    it('should return 500 for unknown errors', () => {
      expect(
        service.getStatusCode('UNKNOWN' as CommunityChestErrorCode),
      ).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
    });
  });

  describe('getMessage', () => {
    it('should return correct message for known errors', () => {
      expect(
        service.getMessage(CommunityChestErrorCode.DUPLICATE_INSTRUCTION),
      ).toContain('already exists');
    });

    it('should return fallback for unknown errors', () => {
      expect(
        service.getMessage('UNKNOWN' as CommunityChestErrorCode),
      ).toBe('An unexpected error occurred');
    });
  });
});
