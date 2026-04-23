import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MonetizationController } from './monetization.controller';
import { PaymentWebhook } from './webhooks/paymentWebhook';
import { RewardEngine } from './rewards/rewardEngine';
import { CouponService } from './coupons/couponService';
import { EventRewards } from './rewards/eventRewards';
import { Purchase } from '../shop/entities/purchase.entity';
import { ShopModule } from '../shop/shop.module';
import { CouponsModule } from '../coupons/coupons.module';
import { PerksModule } from '../perks/perks.module';
import { PerksBoostsModule } from '../perks-boosts/perks-boosts.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Purchase]),
    ShopModule,
    CouponsModule,
    PerksModule,
    PerksBoostsModule,
  ],
  controllers: [MonetizationController],
  providers: [PaymentWebhook, RewardEngine, CouponService, EventRewards],
  exports: [PaymentWebhook, RewardEngine, CouponService, EventRewards],
})
export class MonetizationModule {}
