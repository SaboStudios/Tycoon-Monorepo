// src/modules/notifications/dto/get-notifications-query.dto.spec.ts
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { GetNotificationsQueryDto } from './get-notifications-query.dto';

async function validateDto(plain: Record<string, unknown>) {
  const dto = plainToInstance(GetNotificationsQueryDto, plain);
  const errors = await validate(dto);
  return { dto, errors };
}

describe('GetNotificationsQueryDto', () => {
  describe('defaults', () => {
    it('should default page to 1 and limit to 20 when nothing is provided', async () => {
      const { dto, errors } = await validateDto({});
      expect(errors).toHaveLength(0);
      expect(dto.page).toBe(1);
      expect(dto.limit).toBe(20);
    });
  });

  describe('page', () => {
    it('should accept a valid page number', async () => {
      const { errors } = await validateDto({ page: '3' });
      expect(errors).toHaveLength(0);
    });

    it('should coerce string numbers to integers', async () => {
      const { dto } = await validateDto({ page: '5' });
      expect(dto.page).toBe(5);
    });

    it('should reject page < 1', async () => {
      const { errors } = await validateDto({ page: '0' });
      expect(errors.some((e) => e.property === 'page')).toBe(true);
    });

    it('should reject negative page', async () => {
      const { errors } = await validateDto({ page: '-1' });
      expect(errors.some((e) => e.property === 'page')).toBe(true);
    });

    it('should reject non-integer page', async () => {
      const { errors } = await validateDto({ page: '1.5' });
      expect(errors.some((e) => e.property === 'page')).toBe(true);
    });
  });

  describe('limit', () => {
    it('should accept a valid limit', async () => {
      const { errors } = await validateDto({ limit: '50' });
      expect(errors).toHaveLength(0);
    });

    it('should coerce string limit to number', async () => {
      const { dto } = await validateDto({ limit: '10' });
      expect(dto.limit).toBe(10);
    });

    it('should reject limit < 1', async () => {
      const { errors } = await validateDto({ limit: '0' });
      expect(errors.some((e) => e.property === 'limit')).toBe(true);
    });

    it('should reject limit > 100', async () => {
      const { errors } = await validateDto({ limit: '101' });
      expect(errors.some((e) => e.property === 'limit')).toBe(true);
    });

    it('should accept limit of exactly 100', async () => {
      const { errors } = await validateDto({ limit: '100' });
      expect(errors).toHaveLength(0);
    });

    it('should accept limit of exactly 1', async () => {
      const { errors } = await validateDto({ limit: '1' });
      expect(errors).toHaveLength(0);
    });
  });

  describe('combined', () => {
    it('should accept both valid page and limit', async () => {
      const { dto, errors } = await validateDto({ page: '2', limit: '15' });
      expect(errors).toHaveLength(0);
      expect(dto.page).toBe(2);
      expect(dto.limit).toBe(15);
    });
  });
});
