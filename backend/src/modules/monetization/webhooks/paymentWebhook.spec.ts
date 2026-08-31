import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { createHmac } from 'crypto';
import { PaymentWebhook } from './paymentWebhook';

describe('PaymentWebhook', () => {
  const purchaseRepository = {
    findOne: jest.fn(),
    save: jest.fn(),
  };

  const webhookEventRepository = {
    create: jest.fn((v) => v),
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
    webhookEventRepository.save.mockResolvedValue({});
    service = new PaymentWebhook(
      purchaseRepository as any,
      webhookEventRepository as any,
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

  describe('webhook_events idempotency', () => {
    it('records webhook event and processes payment on first delivery', async () => {
      const event = {
        id: 'evt_pay_123',
        type: 'payment.success' as const,
        data: {
          purchase_id: 1,
          user_id: 2,
          perk_id: 3,
          quantity: 1,
          amount: 50,
          transaction_id: 'tx-456',
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
      expect(webhookEventRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          eventId: 'evt_pay_123',
          eventType: 'payment.success',
          source: 'payment',
        }),
      );
    });

    it('returns idempotent response and does NOT double-credit on replay', async () => {
      const event = {
        id: 'evt_pay_duplicate_789',
        type: 'payment.success' as const,
        data: {
          purchase_id: 1,
          user_id: 2,
          perk_id: 3,
          quantity: 1,
          amount: 50,
          transaction_id: 'tx-789',
        },
      };

      purchaseRepository.findOne.mockResolvedValue({
        id: 1,
        final_price: '50.00',
        status: 'pending',
      });
      purchaseRepository.save.mockResolvedValue({});
      rewardEngine.earnPerk.mockResolvedValue({ granted: true });

      // Simulate unique constraint violation on duplicate event ID
      const uniqueConstraintError = new Error(
        'duplicate key value violates unique constraint',
      );
      (uniqueConstraintError as any).code = '23505';

      webhookEventRepository.save.mockRejectedValue(uniqueConstraintError);

      const payload = JSON.stringify(event);
      const result = await service.handlePaymentWebhook(
        payload,
        sign(payload),
        event,
      );

      expect(result).toEqual({ ok: true, status: 'idempotent' });
      expect(rewardEngine.earnPerk).not.toHaveBeenCalled();
      expect(purchaseRepository.save).not.toHaveBeenCalled();
    });

    it('skips idempotency check if event is missing ID', async () => {
      const event = {
        type: 'payment.success' as const,
        data: {
          purchase_id: 1,
          user_id: 2,
          perk_id: 3,
          quantity: 1,
          amount: 50,
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
        event as any,
      );

      expect(result).toEqual({ ok: true, status: 'processed' });
      expect(webhookEventRepository.save).not.toHaveBeenCalled();
    });
  });
});
