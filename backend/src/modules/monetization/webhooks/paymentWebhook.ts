import {
  Injectable,
  Logger,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { createHmac, timingSafeEqual } from 'crypto';
import { Purchase } from '../../shop/entities/purchase.entity';
import { RewardEngine } from '../rewards/rewardEngine';

export type PaymentWebhookEventType =
  | 'payment.success'
  | 'payment.failed'
  | 'refund.issued';

export interface PaymentWebhookEvent {
  id?: string;
  type: PaymentWebhookEventType;
  data: {
    purchase_id?: number;
    user_id?: number;
    perk_id?: number;
    quantity?: number;
    amount?: number;
    transaction_id?: string;
    reason?: string;
  };
}

@Injectable()
export class PaymentWebhook {
  private readonly logger = new Logger(PaymentWebhook.name);

  constructor(
    @InjectRepository(Purchase)
    private readonly purchaseRepository: Repository<Purchase>,
    private readonly rewardEngine: RewardEngine,
    private readonly configService: ConfigService,
  ) {}

  handlePaymentWebhook(
    payload: string,
    signature: string | undefined,
    event: PaymentWebhookEvent,
  ) {
    this.verifySignature(payload, signature);

    switch (event.type) {
      case 'payment.success':
        return this.handlePaymentSuccess(event);
      case 'payment.failed':
        return this.handlePaymentFailed(event);
      case 'refund.issued':
        return this.handleRefundIssued(event);
      default:
        throw new BadRequestException('Unsupported webhook event type');
    }
  }

  private verifySignature(payload: string, signature?: string): void {
    const secret =
      this.configService.get<string>('PAYMENT_WEBHOOK_SECRET') ||
      process.env.PAYMENT_WEBHOOK_SECRET;

    if (!secret) {
      this.logger.warn(
        'PAYMENT_WEBHOOK_SECRET is not configured; rejecting webhook',
      );
      throw new UnauthorizedException('Webhook verification unavailable');
    }

    if (!signature) {
      throw new UnauthorizedException('Missing webhook signature');
    }

    const expected = createHmac('sha256', secret).update(payload).digest('hex');
    const expectedBuffer = Buffer.from(expected);
    const providedBuffer = Buffer.from(signature);

    if (
      expectedBuffer.length !== providedBuffer.length ||
      !timingSafeEqual(expectedBuffer, providedBuffer)
    ) {
      this.logger.warn('Webhook signature validation failed');
      throw new UnauthorizedException('Invalid webhook signature');
    }
  }

  private async handlePaymentSuccess(event: PaymentWebhookEvent) {
    const {
      purchase_id,
      user_id,
      perk_id,
      quantity = 1,
      amount,
      transaction_id,
    } = event.data;

    if (!purchase_id || !user_id || !perk_id) {
      throw new BadRequestException(
        'payment.success requires purchase_id, user_id, and perk_id',
      );
    }

    const purchase = await this.purchaseRepository.findOne({
      where: { id: purchase_id },
    });
    if (!purchase) {
      this.logger.warn(`Suspicious webhook: purchase ${purchase_id} not found`);
      throw new BadRequestException('Purchase not found');
    }

    const expectedAmount = Number(purchase.final_price);
    if (
      typeof amount === 'number' &&
      Math.abs(amount - expectedAmount) > 0.01
    ) {
      this.logger.warn(
        `Suspicious payment amount for purchase ${purchase_id}. Expected=${expectedAmount} Received=${amount}`,
      );
      throw new BadRequestException('Payment amount mismatch');
    }

    purchase.status = 'completed';
    purchase.transaction_id = transaction_id || purchase.transaction_id;
    await this.purchaseRepository.save(purchase);

    await this.rewardEngine.earnPerk({
      userId: user_id,
      perkId: perk_id,
      quantity,
      source: 'payment.success',
    });

    return { ok: true, status: 'processed' as const };
  }

  private async handlePaymentFailed(event: PaymentWebhookEvent) {
    const { purchase_id, reason } = event.data;

    if (!purchase_id) {
      throw new BadRequestException('payment.failed requires purchase_id');
    }

    const purchase = await this.purchaseRepository.findOne({
      where: { id: purchase_id },
    });
    if (!purchase) {
      this.logger.warn(`payment.failed for unknown purchase ${purchase_id}`);
      return { ok: true, status: 'ignored' as const };
    }

    purchase.status = 'failed';
    purchase.metadata = {
      ...(purchase.metadata || {}),
      payment_failure_reason: reason || 'unknown',
    };
    await this.purchaseRepository.save(purchase);

    return { ok: true, status: 'processed' as const };
  }

  private async handleRefundIssued(event: PaymentWebhookEvent) {
    const { purchase_id, reason } = event.data;

    if (!purchase_id) {
      throw new BadRequestException('refund.issued requires purchase_id');
    }

    const purchase = await this.purchaseRepository.findOne({
      where: { id: purchase_id },
    });
    if (!purchase) {
      this.logger.warn(`refund.issued for unknown purchase ${purchase_id}`);
      return { ok: true, status: 'ignored' as const };
    }

    purchase.status = 'refunded';
    purchase.metadata = {
      ...(purchase.metadata || {}),
      refund_reason: reason || 'unspecified',
      refunded_at: new Date().toISOString(),
    };
    await this.purchaseRepository.save(purchase);

    return { ok: true, status: 'processed' as const };
  }
}
