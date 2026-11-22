import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CreateBoardStyleDto } from './create-board-style.dto';

async function validateDto(plain: Record<string, unknown>) {
  const dto = plainToInstance(CreateBoardStyleDto, plain);
  const errors = await validate(dto);
  return { dto, errors };
}

const baseValid = { name: 'Cyberpunk Theme' };

describe('CreateBoardStyleDto price', () => {
  it('accepts a normal number', async () => {
    const { errors } = await validateDto({ ...baseValid, price: 9.99 });
    expect(errors).toHaveLength(0);
  });

  it('accepts an integer price', async () => {
    const { errors } = await validateDto({ ...baseValid, price: 10 });
    expect(errors).toHaveLength(0);
  });

  it('rejects NaN', async () => {
    const { errors } = await validateDto({ ...baseValid, price: NaN });
    expect(errors.some((e) => e.property === 'price')).toBe(true);
  });

  it('rejects Infinity', async () => {
    const { errors } = await validateDto({ ...baseValid, price: Infinity });
    expect(errors.some((e) => e.property === 'price')).toBe(true);
  });

  it('rejects -Infinity', async () => {
    const { errors } = await validateDto({ ...baseValid, price: -Infinity });
    expect(errors.some((e) => e.property === 'price')).toBe(true);
  });

  it('rejects a negative price', async () => {
    const { errors } = await validateDto({ ...baseValid, price: -1 });
    expect(errors.some((e) => e.property === 'price')).toBe(true);
  });

  it('rejects more than 2 decimal places', async () => {
    const { errors } = await validateDto({ ...baseValid, price: 9.999 });
    expect(errors.some((e) => e.property === 'price')).toBe(true);
  });
});
