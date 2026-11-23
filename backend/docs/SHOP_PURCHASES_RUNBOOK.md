# Shop Purchases Runbook

Operational guide for shop purchases, including coupon handling.

## Coupon types

Coupons are validated and priced by
[`CouponsService`](../src/modules/coupons/coupons.service.ts)
(`validateCoupon` and `calculateDiscount`). Two types exist
(`CouponType` in `src/modules/coupons/enums/coupon-type.enum.ts`):

- **PERCENTAGE** — `value` is a percentage between 1 and 100 (stored/parsed as
  basis points, 1% = 100 bps). The discount is
  `floor(purchase_amount * value / 100)`, so it never exceeds the purchase
  amount.
- **FIXED** — `value` is a flat amount in the shop currency. A fixed discount
  larger than the purchase amount is rejected with
  `Fixed discount cannot exceed the purchase amount`.

### `max_discount_amount`

Optional cap applied **only to PERCENTAGE coupons**: after the percentage is
computed, the discount is clamped to `max_discount_amount`. It is ignored for
FIXED coupons, whose `value` is already the exact discount.

### Validation checks

Before any discount is calculated, `validateCoupon` rejects the coupon when:

- it is inactive or expired;
- **usage limit** — `max_uses` is set and `current_usage >= max_uses`
  (`This coupon has reached its usage limit`);
- it is restricted to another item (`item_restriction_id`);
- **minimum purchase** — `min_purchase_amount` is set and the purchase amount
  is below it (`Minimum purchase amount of <amount> required`).

All money values are parsed as canonical decimal strings into integer minor
units, so no floating-point arithmetic is involved.
