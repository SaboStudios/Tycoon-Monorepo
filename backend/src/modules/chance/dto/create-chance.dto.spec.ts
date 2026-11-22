import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CreateChanceDto } from './create-chance.dto';
import { ChanceType } from '../enums/chance-type.enum';

async function validateDto(plain: Record<string, unknown>) {
  const dto = plainToInstance(CreateChanceDto, plain);
  const errors = await validate(dto);
  return { dto, errors };
}

const baseValid = {
  instruction: 'Collect your reward',
  type: ChanceType.REWARD,
};

describe('CreateChanceDto money fields', () => {
  describe('amount', () => {
    it('accepts a normal integer', async () => {
      const { errors } = await validateDto({ ...baseValid, amount: 100 });
      expect(errors).toHaveLength(0);
    });

    it('rejects NaN', async () => {
      const { errors } = await validateDto({ ...baseValid, amount: NaN });
      expect(errors.some((e) => e.property === 'amount')).toBe(true);
    });

    it('rejects Infinity', async () => {
      const { errors } = await validateDto({
        ...baseValid,
        amount: Infinity,
      });
      expect(errors.some((e) => e.property === 'amount')).toBe(true);
    });

    it('rejects -Infinity', async () => {
      const { errors } = await validateDto({
        ...baseValid,
        amount: -Infinity,
      });
      expect(errors.some((e) => e.property === 'amount')).toBe(true);
    });

    it('rejects a non-integer amount', async () => {
      const { errors } = await validateDto({ ...baseValid, amount: 10.5 });
      expect(errors.some((e) => e.property === 'amount')).toBe(true);
    });

    it('rejects a negative amount', async () => {
      const { errors } = await validateDto({ ...baseValid, amount: -5 });
      expect(errors.some((e) => e.property === 'amount')).toBe(true);
    });
  });

  describe('position', () => {
    it('accepts a normal integer', async () => {
      const { errors } = await validateDto({
        ...baseValid,
        type: ChanceType.MOVE,
        position: 12,
      });
      expect(errors).toHaveLength(0);
    });

    it('rejects NaN', async () => {
      const { errors } = await validateDto({
        ...baseValid,
        type: ChanceType.MOVE,
        position: NaN,
      });
      expect(errors.some((e) => e.property === 'position')).toBe(true);
    });

    it('rejects Infinity', async () => {
      const { errors } = await validateDto({
        ...baseValid,
        type: ChanceType.MOVE,
        position: Infinity,
      });
      expect(errors.some((e) => e.property === 'position')).toBe(true);
    });

    it('rejects a non-integer position', async () => {
      const { errors } = await validateDto({
        ...baseValid,
        type: ChanceType.MOVE,
        position: 3.25,
      });
      expect(errors.some((e) => e.property === 'position')).toBe(true);
    });

    it('rejects a negative position', async () => {
      const { errors } = await validateDto({
        ...baseValid,
        type: ChanceType.MOVE,
        position: -1,
      });
      expect(errors.some((e) => e.property === 'position')).toBe(true);
    });
  });
});
