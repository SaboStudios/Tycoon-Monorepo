import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ShopItem } from './entities/shop-item.entity';
import { Purchase } from './entities/purchase.entity';
import { UserInventory } from './entities/user-inventory.entity';
import { ShopService } from './shop.service';
import { PurchaseService } from './purchase.service';
import { InventoryService } from './inventory.service';
import { ThemeMarketplaceService } from './theme-marketplace.service';
import { ShopController } from './shop.controller';
import { AdminShopController } from './admin-shop.controller';
import { ThemeMarketplaceController } from './theme-marketplace.controller';
import { CouponsModule } from '../coupons/coupons.module';
import { UsersModule } from '../users/users.module';
import { GiftsModule } from '../gifts/gifts.module';
import { SkinsModule } from '../skins/skins.module';
import { BoardStylesModule } from '../board-styles/board-styles.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([ShopItem, Purchase, UserInventory]),
    CouponsModule,
    UsersModule,
    GiftsModule,
    SkinsModule,
    BoardStylesModule,
  ],
  controllers: [ShopController, AdminShopController, ThemeMarketplaceController],
  providers: [
    ShopService,
    PurchaseService,
    InventoryService,
    ThemeMarketplaceService,
  ],
  exports: [
    ShopService,
    PurchaseService,
    InventoryService,
    ThemeMarketplaceService,
  ],
})
export class ShopModule {}
