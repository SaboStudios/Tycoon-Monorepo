import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CouponsController } from './coupons.controller';
import { CouponsService } from './coupons.service';
import { Coupon } from './entities/coupon.entity';
import { CouponUsageLog } from './entities/coupon-usage-log.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Coupon, CouponUsageLog])],
  controllers: [CouponsController],
  providers: [CouponsService],
  exports: [CouponsService],
})
export class CouponsModule {}
