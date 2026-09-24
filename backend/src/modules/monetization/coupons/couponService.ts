import { Injectable } from '@nestjs/common';
import { CouponsService } from '../../coupons/coupons.service';

@Injectable()
export class CouponService {
  constructor(private readonly couponsService: CouponsService) {}

  async validateAndApplyCoupon(params: {
    code: string;
    shopItemId: number;
    purchaseAmount: number;
  }) {
    const validation = await this.couponsService.validateCoupon({
      code: params.code,
      shop_item_id: params.shopItemId,
      purchase_amount: params.purchaseAmount,
    });

    if (!validation.valid) {
      return {
        valid: false,
        reason: validation.message,
        originalAmount: params.purchaseAmount,
        discountAmount: 0,
        finalAmount: params.purchaseAmount,
      };
    }

    const discountAmount = await this.couponsService.applyCoupon(
      params.code,
      params.shopItemId,
      params.purchaseAmount,
    );

    return {
      valid: true,
      reason: validation.message,
      originalAmount: params.purchaseAmount,
      discountAmount,
      finalAmount: Math.max(0, params.purchaseAmount - discountAmount),
    };
  }
}
