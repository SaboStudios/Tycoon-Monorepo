import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { createHmac } from 'crypto';
import { PaymentWebhook } from './paymentWebhook';

describe('PaymentWebhook', () => {
  const purchaseRepository = {
    findOne: jest.fn(),
    save: jest.fn(),
  };

  const rewardEngine = {
    earnPerk: jest.fn(),
  };

  const configService = {
    get: jest.fn(),
  };

  let service: PaymentWebhook;

  const secret = 'test-secret';

  const sign = (payload: string) =>
    createHmac('sha256', secret).update(payload).digest('hex');

  beforeEach(() => {
    jest.clearAllMocks();
    configService.get.mockReturnValue(secret);
    service = new PaymentWebhook(
      purchaseRepository as any,
      rewardEngine as any,
      configService as any,
    );
  });

  it('rejects invalid signatures', async () => {
    const payload = JSON.stringify({ type: 'payment.success', data: {} });

    expect(() =>
      service.handlePaymentWebhook(payload, 'invalid', {
        type: 'payment.success',
        data: {},
      }),
    ).toThrow(UnauthorizedException);
  });

  it('processes payment.success and grants perk', async () => {
    const event = {
      type: 'payment.success' as const,
      data: {
        purchase_id: 1,
        user_id: 2,
        perk_id: 3,
        quantity: 1,
        amount: 50,
        transaction_id: 'tx-123',
      },
    };

    purchaseRepository.findOne.mockResolvedValue({
      id: 1,
      final_price: '50.00',
      status: 'pending',
    });
    purchaseRepository.save.mockResolvedValue({});
    rewardEngine.earnPerk.mockResolvedValue({ granted: true });

    const payload = JSON.stringify(event);
    const result = await service.handlePaymentWebhook(
      payload,
      sign(payload),
      event,
    );

    expect(result).toEqual({ ok: true, status: 'processed' });
    expect(rewardEngine.earnPerk).toHaveBeenCalledWith({
      userId: 2,
      perkId: 3,
      quantity: 1,
      source: 'payment.success',
    });
  });

  it('rejects payment amount mismatches', async () => {
    const event = {
      type: 'payment.success' as const,
      data: {
        purchase_id: 1,
        user_id: 2,
        perk_id: 3,
        quantity: 1,
        amount: 999,
      },
    };

    purchaseRepository.findOne.mockResolvedValue({
      id: 1,
      final_price: '50.00',
      status: 'pending',
    });

    const payload = JSON.stringify(event);

    await expect(
      service.handlePaymentWebhook(payload, sign(payload), event),
    ).rejects.toThrow(BadRequestException);
  });
});
