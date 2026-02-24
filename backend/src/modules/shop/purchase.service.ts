import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Purchase } from './entities/purchase.entity';
import { ShopItem } from './entities/shop-item.entity';
import { CreatePurchaseDto } from './dto/create-purchase.dto';
import { CouponsService } from '../coupons/coupons.service';

export interface PurchaseCalculation {
  original_price: number;
  discount_amount: number;
  final_price: number;
  coupon_id?: number;
  coupon_code?: string;
}

@Injectable()
export class PurchaseService {
  constructor(
    @InjectRepository(Purchase)
    private readonly purchaseRepository: Repository<Purchase>,
    @InjectRepository(ShopItem)
    private readonly shopItemRepository: Repository<ShopItem>,
    private readonly couponsService: CouponsService,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Create a purchase with coupon validation
   */
  async createPurchase(
    userId: number,
    createPurchaseDto: CreatePurchaseDto,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<Purchase> {
    const { shop_item_id, quantity = 1, coupon_code } = createPurchaseDto;

    // Validate shop item exists and is active
    const shopItem = await this.shopItemRepository.findOne({
      where: { id: shop_item_id },
    });

    if (!shopItem) {
      throw new NotFoundException(`Shop item with ID ${shop_item_id} not found`);
    }

    if (!shopItem.active) {
      throw new BadRequestException('This item is no longer available for purchase');
    }

    // Calculate pricing with coupon validation
    const calculation = await this.calculatePurchasePrice(
      shopItem,
      quantity,
      coupon_code,
    );

    // Use transaction to ensure atomicity
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Create purchase record
      const purchase = this.purchaseRepository.create({
        user_id: userId,
        shop_item_id: shopItem.id,
        quantity,
        unit_price: shopItem.price,
        total_price: String(calculation.original_price),
        original_price: String(calculation.original_price),
        discount_amount: String(calculation.discount_amount),
        final_price: String(calculation.final_price),
        coupon_id: calculation.coupon_id,
        coupon_code: calculation.coupon_code,
        currency: shopItem.currency,
        status: 'completed',
      });

      const savedPurchase = await queryRunner.manager.save(purchase);

      // If coupon was used, increment its usage and log it
      if (calculation.coupon_id && calculation.coupon_code) {
        await this.couponsService.incrementUsage(calculation.coupon_id);
        
        // Log coupon usage for audit trail
        await this.couponsService.logCouponUsage(
          calculation.coupon_id,
          userId,
          calculation.coupon_code,
          calculation.original_price,
          calculation.discount_amount,
          calculation.final_price,
          savedPurchase.id,
          ipAddress,
          userAgent,
          {
            shop_item_id: shopItem.id,
            shop_item_name: shopItem.name,
            quantity,
          },
        );
      }

      await queryRunner.commitTransaction();

      // Load relations for response
      const purchaseWithRelations = await this.purchaseRepository.findOne({
        where: { id: savedPurchase.id },
        relations: ['shop_item'],
      });

      if (!purchaseWithRelations) {
        throw new NotFoundException('Purchase not found after creation');
      }

      return purchaseWithRelations;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Calculate purchase price with coupon validation
   * Prevents stacking abuse by only allowing one coupon per purchase
   */
  async calculatePurchasePrice(
    shopItem: ShopItem,
    quantity: number,
    couponCode?: string,
  ): Promise<PurchaseCalculation> {
    const itemPrice = parseFloat(shopItem.price);
    const originalPrice = itemPrice * quantity;

    let discountAmount = 0;
    let couponId: number | undefined;
    let validCouponCode: string | undefined;

    // Only one coupon allowed per purchase (anti-stacking)
    if (couponCode) {
      // Validate coupon
      const validation = await this.couponsService.validateCoupon({
        code: couponCode,
        shop_item_id: shopItem.id,
        purchase_amount: originalPrice,
      });

      if (!validation.valid) {
        throw new BadRequestException(
          `Coupon validation failed: ${validation.message}`,
        );
      }

      // Calculate discount for the total purchase amount
      const coupon = await this.couponsService.findByCode(couponCode);
      discountAmount = this.couponsService.calculateDiscount(coupon, originalPrice);

      couponId = validation.coupon?.id;
      validCouponCode = couponCode;
    }

    const finalPrice = Math.max(0, originalPrice - discountAmount);

    return {
      original_price: originalPrice,
      discount_amount: discountAmount,
      final_price: finalPrice,
      coupon_id: couponId,
      coupon_code: validCouponCode,
    };
  }

  /**
   * Get purchase history for a user
   */
  async getUserPurchases(
    userId: number,
    page: number = 1,
    limit: number = 20,
  ): Promise<{
    data: Purchase[];
    meta: { page: number; limit: number; total: number; totalPages: number };
  }> {
    const [data, total] = await this.purchaseRepository.findAndCount({
      where: { user_id: userId },
      relations: ['shop_item'],
      order: { created_at: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      data,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get a single purchase by ID
   */
  async getPurchaseById(id: number, userId?: number): Promise<Purchase> {
    const where: any = { id };
    if (userId) {
      where.user_id = userId;
    }

    const purchase = await this.purchaseRepository.findOne({
      where,
      relations: ['shop_item', 'coupon'],
    });

    if (!purchase) {
      throw new NotFoundException(`Purchase with ID ${id} not found`);
    }

    return purchase;
  }

  /**
   * Validate purchase eligibility (can be extended with more business rules)
   */
  async validatePurchaseEligibility(
    userId: number,
    shopItemId: number,
  ): Promise<{ eligible: boolean; reason?: string }> {
    // Check if item exists and is active
    const shopItem = await this.shopItemRepository.findOne({
      where: { id: shopItemId },
    });

    if (!shopItem) {
      return { eligible: false, reason: 'Item not found' };
    }

    if (!shopItem.active) {
      return { eligible: false, reason: 'Item is not available' };
    }

    // Add more business rules here (e.g., user level requirements, ownership checks, etc.)

    return { eligible: true };
  }
}
