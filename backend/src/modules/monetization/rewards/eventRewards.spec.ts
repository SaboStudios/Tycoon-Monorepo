import { BadRequestException } from '@nestjs/common';
import { EventRewards } from './eventRewards';

describe('EventRewards', () => {
  const rewardEngine = {
    earnPerk: jest.fn(),
    grantPromotionalPerk: jest.fn(),
  };

  let service: EventRewards;

  beforeEach(() => {
    jest.clearAllMocks();
    rewardEngine.earnPerk.mockResolvedValue({ granted: true });
    rewardEngine.grantPromotionalPerk.mockResolvedValue({
      granted: true,
      promotional: true,
    });
    service = new EventRewards(rewardEngine as any);
  });

  it('grants rewards on level.up when level threshold is met', async () => {
    await service.processEvent('level.up', {
      userId: 1,
      level: 10,
      perkId: 7,
      quantity: 1,
    });

    expect(rewardEngine.earnPerk).toHaveBeenCalledWith({
      userId: 1,
      perkId: 7,
      quantity: 1,
      source: 'event:level.up',
    });
  });

  it('returns no reward below level threshold', async () => {
    const result = await service.processEvent('level.up', {
      userId: 1,
      level: 9,
      perkId: 7,
    });
    expect(result).toEqual({
      granted: false,
      reason: 'No reward rule matched',
    });
  });

  it('requires grantedBy for promotional grants', async () => {
    await expect(
      service.processEvent('admin.promotional.grant', { userId: 1, perkId: 7 }),
    ).rejects.toThrow(BadRequestException);
  });
});
