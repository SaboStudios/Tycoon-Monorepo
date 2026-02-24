import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ShopItem } from './entities/shop-item.entity';
import { Purchase } from './entities/purchase.entity';
import { ShopService } from './shop.service';
import { PurchaseService } from './purchase.service';
import { ShopController } from './shop.controller';
import { CouponsModule } from '../coupons/coupons.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([ShopItem, Purchase]),
    CouponsModule,
  ],
  controllers: [ShopController],
  providers: [ShopService, PurchaseService],
  exports: [ShopService, PurchaseService],
})
export class ShopModule {}
