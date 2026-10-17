import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { FilterGiftsDto } from './filter-gifts.dto';
import { GiftStatus } from '../enums/gift-status.enum';

async function validateDto(plain: Record<string, unknown>) {
  const dto = plainToInstance(FilterGiftsDto, plain);
  const errors = await validate(dto);
  return { dto, errors };
}

describe('FilterGiftsDto', () => {
  // ── status (optional enum) ────────────────────────────────────────────────
  describe('status', () => {
    it('is optional — empty object produces no errors', async () => {
      const { errors } = await validateDto({});
      expect(errors).toHaveLength(0);
    });

    it.each(Object.values(GiftStatus))('accepts valid GiftStatus "%s"', async (status) => {
      const { errors } = await validateDto({ status });
      expect(errors).toHaveLength(0);
    });

    it('rejects an unknown status value', async () => {
      const { errors } = await validateDto({ status: 'unknown_status' });
      expect(errors.some((e) => e.property === 'status')).toBe(true);
    });

    it('rejects status "active" which is not in GiftStatus', async () => {
      const { errors } = await validateDto({ status: 'active' });
      expect(errors.some((e) => e.property === 'status')).toBe(true);
    });

    it('rejects status "PENDING" (wrong casing — enum uses lowercase)', async () => {
      const { errors } = await validateDto({ status: 'PENDING' });
      expect(errors.some((e) => e.property === 'status')).toBe(true);
    });
  });

  // ── page (optional int, min 1) ────────────────────────────────────────────
  describe('page', () => {
    it('defaults to 1 when omitted', async () => {
      const { dto, errors } = await validateDto({});
      expect(errors).toHaveLength(0);
      expect(dto.page).toBe(1);
    });

    it('accepts a valid page number', async () => {
      const { errors } = await validateDto({ page: 3 });
      expect(errors).toHaveLength(0);
    });

    it('coerces string page to number via @Type', async () => {
      const { dto, errors } = await validateDto({ page: '5' });
      expect(errors).toHaveLength(0);
      expect(dto.page).toBe(5);
    });

    it('rejects page of 0', async () => {
      const { errors } = await validateDto({ page: 0 });
      expect(errors.some((e) => e.property === 'page')).toBe(true);
    });

    it('rejects negative page', async () => {
      const { errors } = await validateDto({ page: -1 });
      expect(errors.some((e) => e.property === 'page')).toBe(true);
    });

    it('rejects float page', async () => {
      const { errors } = await validateDto({ page: 1.5 });
      expect(errors.some((e) => e.property === 'page')).toBe(true);
    });
  });

  // ── limit (optional int, min 1) ───────────────────────────────────────────
  describe('limit', () => {
    it('defaults to 20 when omitted', async () => {
      const { dto, errors } = await validateDto({});
      expect(errors).toHaveLength(0);
      expect(dto.limit).toBe(20);
    });

    it('accepts a valid limit', async () => {
      const { errors } = await validateDto({ limit: 50 });
      expect(errors).toHaveLength(0);
    });

    it('coerces string limit to number via @Type', async () => {
      const { dto, errors } = await validateDto({ limit: '10' });
      expect(errors).toHaveLength(0);
      expect(dto.limit).toBe(10);
    });

    it('rejects limit of 0', async () => {
      const { errors } = await validateDto({ limit: 0 });
      expect(errors.some((e) => e.property === 'limit')).toBe(true);
    });

    it('rejects negative limit', async () => {
      const { errors } = await validateDto({ limit: -1 });
      expect(errors.some((e) => e.property === 'limit')).toBe(true);
    });

    it('rejects float limit', async () => {
      const { errors } = await validateDto({ limit: 2.5 });
      expect(errors.some((e) => e.property === 'limit')).toBe(true);
    });
  });

  // ── combined ──────────────────────────────────────────────────────────────
  describe('combined valid payload', () => {
    it('accepts status + page + limit together', async () => {
      const { errors } = await validateDto({
        status: GiftStatus.PENDING,
        page: 2,
        limit: 15,
      });
      expect(errors).toHaveLength(0);
    });
  });
});
