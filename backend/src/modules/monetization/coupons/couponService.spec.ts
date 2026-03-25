import { CouponService } from './couponService';

describe('CouponService', () => {
  const couponsService = {
    validateCoupon: jest.fn(),
    applyCoupon: jest.fn(),
  };

  let service: CouponService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new CouponService(couponsService as any);
  });

  it('returns invalid response for invalid coupons', async () => {
    couponsService.validateCoupon.mockResolvedValue({
      valid: false,
      message: 'Invalid coupon code',
    });

    const result = await service.validateAndApplyCoupon({
      code: 'BADCODE',
      shopItemId: 10,
      purchaseAmount: 100,
    });

    expect(result).toEqual({
      valid: false,
      reason: 'Invalid coupon code',
      originalAmount: 100,
      discountAmount: 0,
      finalAmount: 100,
    });
    expect(couponsService.applyCoupon).not.toHaveBeenCalled();
  });

  it('applies discount for valid coupons', async () => {
    couponsService.validateCoupon.mockResolvedValue({
      valid: true,
      message: 'Coupon is valid',
    });
    couponsService.applyCoupon.mockResolvedValue(25);

    const result = await service.validateAndApplyCoupon({
      code: 'SAVE25',
      shopItemId: 10,
      purchaseAmount: 100,
    });

    expect(result).toEqual({
      valid: true,
      reason: 'Coupon is valid',
      originalAmount: 100,
      discountAmount: 25,
      finalAmount: 75,
    });
  });
});
