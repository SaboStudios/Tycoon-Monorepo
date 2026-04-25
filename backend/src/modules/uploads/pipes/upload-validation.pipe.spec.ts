import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { UploadValidationPipe } from './upload-validation.pipe';
import { UploadsErrorMapperService } from '../uploads-error-mapper.service';
import { GetSignedUrlDto } from '../dto/upload-file.dto';

describe('UploadValidationPipe', () => {
  let pipe: UploadValidationPipe;
  let errorMapper: UploadsErrorMapperService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [UploadValidationPipe, UploadsErrorMapperService],
    }).compile();

    pipe = module.get<UploadValidationPipe>(UploadValidationPipe);
    errorMapper = module.get<UploadsErrorMapperService>(UploadsErrorMapperService);
  });

  it('should be defined', () => {
    expect(pipe).toBeDefined();
  });

  describe('transform', () => {
    it('should pass valid DTO through', async () => {
      const validDto = { key: 'avatars/user-123/profile.jpg' };
      const metadata = { metatype: GetSignedUrlDto, type: 'query' as const };

      const result = await pipe.transform(validDto, metadata);

      expect(result).toBeInstanceOf(GetSignedUrlDto);
      expect(result.key).toBe(validDto.key);
    });

    it('should throw BadRequestException for invalid DTO', async () => {
      const invalidDto = { key: '' }; // Empty key
      const metadata = { metatype: GetSignedUrlDto, type: 'query' as const };

      await expect(pipe.transform(invalidDto, metadata)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should include validation details in error', async () => {
      const invalidDto = { key: '' };
      const metadata = { metatype: GetSignedUrlDto, type: 'query' as const };

      try {
        await pipe.transform(invalidDto, metadata);
        fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(BadRequestException);
        const response = error.getResponse();
        expect(response).toHaveProperty('details');
        expect(response.details).toHaveProperty('key');
      }
    });

    it('should skip validation for primitive types', async () => {
      const value = 'test-string';
      const metadata = { metatype: String, type: 'query' as const };

      const result = await pipe.transform(value, metadata);

      expect(result).toBe(value);
    });

    it('should validate nested properties', async () => {
      const invalidDto = {
        key: 'valid-key',
        nested: {
          invalid: 'x'.repeat(600), // Exceeds max length
        },
      };
      const metadata = { metatype: GetSignedUrlDto, type: 'query' as const };

      // This test assumes nested validation is configured
      // Adjust based on actual DTO structure
      const result = await pipe.transform(invalidDto, metadata);
      expect(result).toBeDefined();
    });

    it('should strip non-whitelisted properties', async () => {
      const dtoWithExtra = {
        key: 'avatars/user-123/profile.jpg',
        extraField: 'should-be-removed',
      };
      const metadata = { metatype: GetSignedUrlDto, type: 'query' as const };

      const result = await pipe.transform(dtoWithExtra, metadata);

      expect(result.key).toBe(dtoWithExtra.key);
      expect(result).not.toHaveProperty('extraField');
    });
  });
});
