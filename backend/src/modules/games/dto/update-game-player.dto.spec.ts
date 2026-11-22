/**
 * #2113: Player cash updates must accept only canonical integer strings.
 *
 * "10" is accepted as the integer 10; malformed values such as "10abc" and
 * "1e2" must fail validation instead of being silently parsed by parseFloat.
 */

import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { UpdateGamePlayerDto } from './update-game-player.dto';

async function getErrors(plain: object) {
  const instance = plainToInstance(UpdateGamePlayerDto, plain);
  const errors = await validate(instance);
  return errors.flatMap((e) => Object.values(e.constraints ?? {}));
}

describe('UpdateGamePlayerDto cash fields (#2113)', () => {
  it('accepts "10" as the integer 10', async () => {
    const dto = plainToInstance(UpdateGamePlayerDto, { balance: '10' });
    expect(dto.balance).toBe(10);
    expect(await getErrors({ balance: '10' })).toHaveLength(0);
  });

  it('rejects "10abc"', async () => {
    const errors = await getErrors({ balance: '10abc' });
    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects "1e2"', async () => {
    const errors = await getErrors({ balance: '1e2' });
    expect(errors.length).toBeGreaterThan(0);
  });

  it('applies the same rule to trade_locked_balance', async () => {
    const dto = plainToInstance(UpdateGamePlayerDto, {
      trade_locked_balance: '10',
    });
    expect(dto.trade_locked_balance).toBe(10);
    expect(await getErrors({ trade_locked_balance: '10abc' })).not.toHaveLength(
      0,
    );
    expect(await getErrors({ trade_locked_balance: '1e2' })).not.toHaveLength(
      0,
    );
  });
});
