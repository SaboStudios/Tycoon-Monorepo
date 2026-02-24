import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ShopItem } from './entities/shop-item.entity';
import { Purchase } from './entities/purchase.entity';
import { ShopService } from './shop.service';
import { ShopController } from './shop.controller';
import { UsersModule } from '../users/users.module';
import { GiftsModule } from '../gifts/gifts.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([ShopItem, Purchase]),
    UsersModule,
    GiftsModule,
  ],
  controllers: [ShopController],
  providers: [ShopService],
  exports: [ShopService],
})
export class ShopModule {}
