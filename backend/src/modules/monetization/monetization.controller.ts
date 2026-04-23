import {
  Body,
  Controller,
  Headers,
  Post,
  Req,
  BadRequestException,
} from '@nestjs/common';
import { Request } from 'express';
import { PaymentWebhook } from './webhooks/paymentWebhook';
import type { PaymentWebhookEvent } from './webhooks/paymentWebhook';
import { CouponService } from './coupons/couponService';
import { EventRewards, MonetizationEvent } from './rewards/eventRewards';

@Controller('monetization')
export class MonetizationController {
  constructor(
    private readonly paymentWebhook: PaymentWebhook,
    private readonly couponService: CouponService,
    private readonly eventRewards: EventRewards,
  ) {}

  @Post('webhooks/payment')
  async handlePaymentWebhook(
    @Req() req: Request & { rawBody?: Buffer },
    @Headers('stripe-signature') stripeSignature: string | undefined,
    @Body() event: PaymentWebhookEvent,
  ) {
    const forwardedProto = req.headers['x-forwarded-proto'];
    if (forwardedProto && String(forwardedProto).toLowerCase() !== 'https') {
      throw new BadRequestException('Webhook endpoint requires HTTPS');
    }

    const payload = req.rawBody
      ? req.rawBody.toString('utf8')
      : JSON.stringify(event);

    return this.paymentWebhook.handlePaymentWebhook(
      payload,
      stripeSignature,
      event,
    );
  }

  @Post('coupons/validate')
  async validateCoupon(
    @Body() body: { code: string; shopItemId: number; purchaseAmount: number },
  ) {
    return this.couponService.validateAndApplyCoupon(body);
  }

  @Post('rewards/events')
  async processRewardEvent(
    @Body()
    body: {
      event: MonetizationEvent;
      payload: {
        userId: number;
        level?: number;
        perkId?: number;
        quantity?: number;
        grantedBy?: string;
      };
    },
  ) {
    return this.eventRewards.processEvent(body.event, body.payload);
  }
}
