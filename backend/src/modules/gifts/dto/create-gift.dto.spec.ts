import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CreateGiftDto } from './create-gift.dto';

async function validateDto(plain: Record<string, unknown>) {
  const dto = plainToInstance(CreateGiftDto, plain);
  const errors = await validate(dto);
  return { dto, errors };
}

describe('CreateGiftDto', () => {
  const baseValid = {
    receiver_id: 42,
    shop_item_id: 7,
  };

  // ── receiver_id ──────────────────────────────────────────────────────────
  describe('receiver_id', () => {
    it('accepts a valid positive integer', async () => {
      const { errors } = await validateDto(baseValid);
      expect(errors).toHaveLength(0);
    });

    it('rejects missing receiver_id', async () => {
      const { shop_item_id } = baseValid;
      const { errors } = await validateDto({ shop_item_id });
      expect(errors.some((e) => e.property === 'receiver_id')).toBe(true);
    });

    it('rejects receiver_id of 0 (not positive)', async () => {
      const { errors } = await validateDto({ ...baseValid, receiver_id: 0 });
      expect(errors.some((e) => e.property === 'receiver_id')).toBe(true);
    });

    it('rejects negative receiver_id', async () => {
      const { errors } = await validateDto({ ...baseValid, receiver_id: -1 });
      expect(errors.some((e) => e.property === 'receiver_id')).toBe(true);
    });

    it('rejects float receiver_id', async () => {
      const { errors } = await validateDto({ ...baseValid, receiver_id: 1.5 });
      expect(errors.some((e) => e.property === 'receiver_id')).toBe(true);
    });

    it('coerces string receiver_id to number via @Type', async () => {
      const { dto, errors } = await validateDto({ ...baseValid, receiver_id: '10' });
      expect(errors).toHaveLength(0);
      expect(dto.receiver_id).toBe(10);
    });
  });

  // ── shop_item_id ─────────────────────────────────────────────────────────
  describe('shop_item_id', () => {
    it('rejects missing shop_item_id', async () => {
      const { receiver_id } = baseValid;
      const { errors } = await validateDto({ receiver_id });
      expect(errors.some((e) => e.property === 'shop_item_id')).toBe(true);
    });

    it('rejects shop_item_id of 0', async () => {
      const { errors } = await validateDto({ ...baseValid, shop_item_id: 0 });
      expect(errors.some((e) => e.property === 'shop_item_id')).toBe(true);
    });

    it('rejects negative shop_item_id', async () => {
      const { errors } = await validateDto({ ...baseValid, shop_item_id: -5 });
      expect(errors.some((e) => e.property === 'shop_item_id')).toBe(true);
    });

    it('coerces string shop_item_id to number via @Type', async () => {
      const { dto, errors } = await validateDto({ ...baseValid, shop_item_id: '3' });
      expect(errors).toHaveLength(0);
      expect(dto.shop_item_id).toBe(3);
    });
  });

  // ── quantity (optional) ──────────────────────────────────────────────────
  describe('quantity', () => {
    it('accepts valid quantity', async () => {
      const { errors } = await validateDto({ ...baseValid, quantity: 5 });
      expect(errors).toHaveLength(0);
    });

    it('is optional — omitting it produces no errors', async () => {
      const { errors } = await validateDto(baseValid);
      expect(errors).toHaveLength(0);
    });

    it('rejects quantity of 0 (below @Min(1))', async () => {
      const { errors } = await validateDto({ ...baseValid, quantity: 0 });
      expect(errors.some((e) => e.property === 'quantity')).toBe(true);
    });

    it('rejects negative quantity', async () => {
      const { errors } = await validateDto({ ...baseValid, quantity: -2 });
      expect(errors.some((e) => e.property === 'quantity')).toBe(true);
    });

    it('rejects float quantity', async () => {
      const { errors } = await validateDto({ ...baseValid, quantity: 1.5 });
      expect(errors.some((e) => e.property === 'quantity')).toBe(true);
    });
  });

  // ── message (optional) ───────────────────────────────────────────────────
  describe('message', () => {
    it('accepts a valid message string', async () => {
      const { errors } = await validateDto({ ...baseValid, message: 'Happy birthday!' });
      expect(errors).toHaveLength(0);
    });

    it('is optional — omitting it produces no errors', async () => {
      const { errors } = await validateDto(baseValid);
      expect(errors).toHaveLength(0);
    });

    it('rejects message exceeding 500 characters', async () => {
      const { errors } = await validateDto({ ...baseValid, message: 'x'.repeat(501) });
      expect(errors.some((e) => e.property === 'message')).toBe(true);
    });

    it('accepts message at exactly 500 characters', async () => {
      const { errors } = await validateDto({ ...baseValid, message: 'x'.repeat(500) });
      expect(errors).toHaveLength(0);
    });

    it('rejects non-string message', async () => {
      const { errors } = await validateDto({ ...baseValid, message: 123 });
      expect(errors.some((e) => e.property === 'message')).toBe(true);
    });
  });

  // ── expiration_hours (optional) ──────────────────────────────────────────
  describe('expiration_hours', () => {
    it('accepts a valid expiration_hours', async () => {
      const { errors } = await validateDto({ ...baseValid, expiration_hours: 24 });
      expect(errors).toHaveLength(0);
    });

    it('is optional — omitting it produces no errors', async () => {
      const { errors } = await validateDto(baseValid);
      expect(errors).toHaveLength(0);
    });

    it('rejects expiration_hours of 0 (below @Min(1))', async () => {
      const { errors } = await validateDto({ ...baseValid, expiration_hours: 0 });
      expect(errors.some((e) => e.property === 'expiration_hours')).toBe(true);
    });

    it('rejects negative expiration_hours', async () => {
      const { errors } = await validateDto({ ...baseValid, expiration_hours: -1 });
      expect(errors.some((e) => e.property === 'expiration_hours')).toBe(true);
    });

    it('coerces string expiration_hours to number via @Type', async () => {
      const { dto, errors } = await validateDto({ ...baseValid, expiration_hours: '48' });
      expect(errors).toHaveLength(0);
      expect(dto.expiration_hours).toBe(48);
    });
  });
});
