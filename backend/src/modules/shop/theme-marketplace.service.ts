import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Purchase } from './entities/purchase.entity';
import { UserInventory } from './entities/user-inventory.entity';
import { PurchaseThemeDto } from './dto/purchase-theme.dto';
import { UsersService } from '../users/users.service';
import { CouponsService } from '../coupons/coupons.service';
import { SkinsService } from '../skins/skins.service';
import { BoardStylesService } from '../board-styles/board-styles.service';
import { UserSkinsService } from '../skins/user-skins.service';
import { secureRandomHex } from '../../common/crypto-secure-random';
import { RedisService } from '../redis/redis.service';

@Injectable()
export class ThemeMarketplaceService {
  private readonly logger = new Logger(ThemeMarketplaceService.name);

  constructor(
    @InjectRepository(Purchase)
    private readonly purchaseRepository: Repository<Purchase>,
    @InjectRepository(UserInventory)
    private readonly userInventoryRepository: Repository<UserInventory>,
    private readonly usersService: UsersService,
    private readonly couponsService: CouponsService,
    private readonly skinsService: SkinsService,
    private readonly boardStylesService: BoardStylesService,
    private readonly userSkinsService: UserSkinsService,
    private readonly dataSource: DataSource,
    private readonly redisService: RedisService,
  ) {}

  /**
   * Purchase themes (skins and/or board styles) with optional coupon
   * Supports single or bulk purchases
   * Instantly unlocks themes and creates transaction record
   */
  async purchaseThemes(
    userId: number,
    dto: PurchaseThemeDto,
  ): Promise<{
    transaction: Purchase;
    unlockedThemes: string[];
    message: string;
  }> {
    const { themeIds, couponCode, paymentMethod = 'balance' } = dto;

    this.logger.log(
      `Purchase initiated for user ${userId}: ${themeIds.length} themes`,
    );

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. Validate user exists and has sufficient balance
      const user = await this.usersService.findOne(userId);
      if (!user) {
        throw new NotFoundException(`User with ID ${userId} not found`);
      }

      if (!themeIds || themeIds.length === 0) {
        throw new BadRequestException('At least one theme must be selected');
      }

      // 2. Parse theme IDs and categorize them
      const skinIds: number[] = [];
      const boardStyleIds: number[] = [];

      for (const themeId of themeIds) {
        // Try to parse as number (board style) or check if it's a skin ID
        const numId = parseInt(themeId, 10);
        if (!isNaN(numId)) {
          boardStyleIds.push(numId);
        } else {
          // Assume it's a skin ID string
          skinIds.push(numId);
        }
      }

      // 3. Validate and get theme details
      const selectedSkins: any[] = [];
      const selectedBoardStyles: any[] = [];
      let totalPrice = 0;

      // Get skins
      for (const skinId of skinIds) {
        try {
          const skin = await this.skinsService.findOne(skinId);
          if (!skin) {
            throw new NotFoundException(`Skin ${skinId} not found`);
          }
          selectedSkins.push(skin);
          totalPrice += skin.price || 0;
        } catch (error) {
          this.logger.warn(`Could not fetch skin ${skinId}`, error);
        }
      }

      // Get board styles
      for (const boardStyleId of boardStyleIds) {
        try {
          const boardStyle =
            await this.boardStylesService.findOne(boardStyleId);
          if (!boardStyle) {
            throw new NotFoundException(
              `Board style ${boardStyleId} not found`,
            );
          }
          selectedBoardStyles.push(boardStyle);
          totalPrice += boardStyle.price || 0;
        } catch (error) {
          this.logger.warn(`Could not fetch board style ${boardStyleId}`, error);
        }
      }

      if (selectedSkins.length === 0 && selectedBoardStyles.length === 0) {
        throw new BadRequestException(
          'No valid themes found for the provided IDs',
        );
      }

      // 4. Check if user already owns any of these themes
      const userInventory = await queryRunner.manager.find(UserInventory, {
        where: { user_id: userId },
      });

      const ownedItemIds = new Set(
        userInventory.map((inv) => inv.shop_item_id),
      );

      const selectedItemIds = [
        ...selectedSkins.map((s) => s.id),
        ...selectedBoardStyles.map((b) => b.id),
      ];

      const alreadyOwned = selectedItemIds.filter((id) => ownedItemIds.has(id));
      if (alreadyOwned.length > 0) {
        throw new ForbiddenException(
          `You already own ${alreadyOwned.length} of these themes`,
        );
      }

      // 5. Apply coupon discount if provided
      let discountAmount = 0;
      let finalPrice = totalPrice;

      if (couponCode) {
        try {
          const couponValidation = await this.couponsService.validateCoupon({
            code: couponCode,
            purchase_amount: totalPrice,
          } as any);

          if (couponValidation.valid && couponValidation.discount_amount) {
            discountAmount = couponValidation.discount_amount;
            finalPrice = totalPrice - discountAmount;

            // Increment coupon usage
            if (couponValidation.coupon?.id) {
              await this.couponsService.incrementUsage(
                couponValidation.coupon.id,
              );
            }
          }
        } catch (error) {
          this.logger.warn(`Coupon validation failed: ${error.message}`);
          // Continue without coupon rather than failing the purchase
        }
      }

      // 6. Check user balance
      const userBalance = parseFloat(user.balance as any) || 0;
      if (userBalance < finalPrice) {
        throw new BadRequestException(
          `Insufficient balance. Required: ${finalPrice}, Available: ${userBalance}`,
        );
      }

      // 7. Create purchase transaction
      const purchase = queryRunner.manager.create(Purchase, {
        user_id: userId,
        shop_item_id: null, // This is a theme purchase, not a regular shop item
        quantity: themeIds.length,
        unit_price: String(totalPrice / themeIds.length),
        total_price: String(totalPrice),
        currency: 'USD',
        payment_method: paymentMethod,
        is_gift: false,
        transaction_id: this.generateTransactionId(),
        metadata: {
          theme_purchase: true,
          skins: selectedSkins.map((s) => s.id),
          board_styles: selectedBoardStyles.map((b) => b.id),
          discount_amount: discountAmount,
          coupon_code: couponCode,
        },
      });

      const savedPurchase = await queryRunner.manager.save(purchase);

      // 8. Unlock themes by adding to user inventory
      const unlockedThemes: string[] = [];

      // Unlock skins
      for (const skin of selectedSkins) {
        try {
          await this.userSkinsService.unlockSkin(userId, skin.id);
          unlockedThemes.push(`skin-${skin.id}`);
        } catch (error) {
          this.logger.error(
            `Failed to unlock skin ${skin.id} for user ${userId}`,
            error,
          );
        }
      }

      // Unlock board styles (add to user inventory if needed)
      for (const boardStyle of selectedBoardStyles) {
        const userInventory = queryRunner.manager.create(UserInventory, {
          user_id: userId,
          shop_item_id: boardStyle.id,
          acquired_at: new Date(),
        });
        await queryRunner.manager.save(userInventory);
        unlockedThemes.push(`board-${boardStyle.id}`);
      }

      // 9. Deduct from user balance (note: typically done through a separate payment service)
      // This is a simplified version; in production, use proper ledger/accounting system
      const newBalance = userBalance - finalPrice;
      await this.usersService.update(userId, {
        balance: newBalance,
      });

      await queryRunner.commitTransaction();
      this.logger.log(
        `Theme purchase successful: ${savedPurchase.id}, user ${userId}, ${unlockedThemes.length} themes`,
      );

      // Invalidate user cache
      await this.redisService.delByPattern(`tycoon:users:*:${userId}:*`);

      return {
        transaction: savedPurchase,
        unlockedThemes,
        message: `Successfully purchased ${unlockedThemes.length} theme(s). ${discountAmount > 0 ? `Discount applied: ${discountAmount}` : ''}`,
      };
    } catch (error) {
      this.logger.error(
        `Theme purchase failed for user ${userId}: ${error.message}`,
        error.stack,
      );
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Get available themes (skins and board styles)
   */
  async getAvailableThemes(type?: 'skin' | 'board'): Promise<any[]> {
    const themes: any[] = [];

    if (type === 'skin' || !type) {
      const skins = await this.skinsService.findAll();
      themes.push(
        ...skins.map((s) => ({
          id: `skin-${s.id}`,
          name: s.name,
          type: 'skin',
          price: s.price,
          description: s.description,
          imageUrl: s.image_url,
          available: true,
        })),
      );
    }

    if (type === 'board' || !type) {
      const boardStyles = await this.boardStylesService.findAll();
      themes.push(
        ...boardStyles.map((b) => ({
          id: `board-${b.id}`,
          name: b.name,
          type: 'board',
          price: b.price,
          description: b.description,
          imageUrl: b.image_url,
          available: !b.is_premium,
        })),
      );
    }

    return themes;
  }

  /**
   * Get user's transaction history for theme purchases
   */
  async getUserThemeTransactions(
    userId: number,
    page: number = 1,
    limit: number = 20,
  ): Promise<any> {
    const skip = (page - 1) * limit;

    const [transactions, total] = await this.purchaseRepository.findAndCount({
      where: {
        user_id: userId,
        metadata: { theme_purchase: true },
      },
      skip,
      take: limit,
      order: { created_at: 'DESC' },
    });

    return {
      transactions,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Generate a unique transaction ID
   */
  private generateTransactionId(): string {
    const timestamp = Date.now();
    return `THEME-${timestamp}-${secureRandomHex(8)}`.toUpperCase();
  }
}
