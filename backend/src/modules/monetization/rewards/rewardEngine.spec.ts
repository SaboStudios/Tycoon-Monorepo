import { BadRequestException } from '@nestjs/common';
import { RewardEngine } from './rewardEngine';

describe('RewardEngine', () => {
  let engine: RewardEngine;

  const inventoryService = {
    addPerksToInventory: jest.fn(),
  };

  const perksService = {
    findOnePublic: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    perksService.findOnePublic.mockResolvedValue({ id: 1, price: '10.00' });
    engine = new RewardEngine(inventoryService as any, perksService as any);
  });

  it('buys a perk using server-side price', async () => {
    const result = await engine.buyPerk({
      userId: 42,
      perkId: 1,
      quantity: 2,
      availableCurrency: 30,
      clientUnitPrice: 10,
    });

    expect(result).toEqual({
      purchased: true,
      totalCost: 20,
      remainingCurrency: 10,
    });
    expect(inventoryService.addPerksToInventory).toHaveBeenCalledWith(42, [
      { perkId: 1, quantity: 2 },
    ]);
  });

  it('rejects client-side price mismatch', async () => {
    await expect(
      engine.buyPerk({
        userId: 42,
        perkId: 1,
        quantity: 1,
        availableCurrency: 100,
        clientUnitPrice: 1,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects insufficient currency', async () => {
    await expect(
      engine.buyPerk({
        userId: 42,
        perkId: 1,
        quantity: 2,
        availableCurrency: 5,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('rate limits excessive purchase attempts', async () => {
    for (let i = 0; i < 10; i += 1) {
      await engine.buyPerk({
        userId: 99,
        perkId: 1,
        quantity: 1,
        availableCurrency: 999,
      });
    }

    await expect(
      engine.buyPerk({
        userId: 99,
        perkId: 1,
        quantity: 1,
        availableCurrency: 999,
      }),
    ).rejects.toThrow(BadRequestException);
  });
});
