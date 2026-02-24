import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { ShopItem } from './entities/shop-item.entity';
import { Purchase } from './entities/purchase.entity';
import { CreateShopItemDto } from './dto/create-shop-item.dto';
import { UpdateShopItemDto } from './dto/update-shop-item.dto';
import { FilterShopItemsDto } from './dto/filter-shop-items.dto';
import { PurchaseAndGiftDto } from './dto/purchase-and-gift.dto';
import { UsersService } from '../users/users.service';
import { GiftsService } from '../gifts/gifts.service';
import { Gift } from '../gifts/entities/gift.entity';

export interface PaginatedShopItems {
  data: ShopItem[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

@Injectable()
export class ShopService {
  constructor(
    @InjectRepository(ShopItem)
    private readonly shopItemRepository: Repository<ShopItem>,
    @InjectRepository(Purchase)
    private readonly purchaseRepository: Repository<Purchase>,
    private readonly usersService: UsersService,
    private readonly giftsService: GiftsService,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Create a new shop item
   */
  async create(createShopItemDto: CreateShopItemDto): Promise<ShopItem> {
    const item = this.shopItemRepository.create({
      ...createShopItemDto,
      price: String(createShopItemDto.price),
    });
    return this.shopItemRepository.save(item);
  }

  /**
   * List shop items with optional filters and pagination
   */
  async findAll(filterDto: FilterShopItemsDto): Promise<PaginatedShopItems> {
    const { type, rarity, active, page = 1, limit = 20 } = filterDto;

    const qb = this.shopItemRepository
      .createQueryBuilder('item')
      .orderBy('item.created_at', 'DESC');

    if (type !== undefined) {
      qb.andWhere('item.type = :type', { type });
    }

    if (rarity !== undefined) {
      qb.andWhere('item.rarity = :rarity', { rarity });
    }

    if (active !== undefined) {
      qb.andWhere('item.active = :active', { active });
    }

    const total = await qb.getCount();
    const data = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .getMany();

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
   * Get a single shop item by ID
   */
  async findOne(id: number): Promise<ShopItem> {
    const item = await this.shopItemRepository.findOne({ where: { id } });
    if (!item) {
      throw new NotFoundException(`Shop item with ID ${id} not found`);
    }
    return item;
  }

  /**
   * Update a shop item
   */
  async update(
    id: number,
    updateShopItemDto: UpdateShopItemDto,
  ): Promise<ShopItem> {
    const item = await this.findOne(id);
    Object.assign(item, updateShopItemDto);
    return this.shopItemRepository.save(item);
  }

  /**
   * Soft-delete: deactivate the item instead of destroying the DB record.
   * This preserves referential integrity for past purchases.
   */
  async remove(id: number): Promise<ShopItem> {
    const item = await this.findOne(id);
    item.active = false;
    return this.shopItemRepository.save(item);
  }
}

  /**
   * Purchase an item and send it as a gift in a single atomic transaction
   */
  async purchaseAndGift(
    senderId: number,
    dto: PurchaseAndGiftDto,
  ): Promise<{ purchase: Purchase; gift: Gift }> {
    const { shop_item_id, receiver_id, quantity = 1, message, payment_method = 'balance' } = dto;

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. Validate sender exists
      const sender = await this.usersService.findOne(senderId);
      if (!sender) {
        throw new NotFoundException(`Sender with ID ${senderId} not found`);
      }

      // 2. Validate receiver exists
      const receiver = await this.usersService.findOne(receiver_id);
      if (!receiver) {
        throw new NotFoundException(`Receiver with ID ${receiver_id} not found`);
      }

      // 3. Validate sender is not gifting to themselves
      if (senderId === receiver_id) {
        throw new BadRequestException('Cannot purchase and gift to yourself');
      }

      // 4. Validate shop item exists and is active
      const shopItem = await this.findOne(shop_item_id);
      if (!shopItem.active) {
        throw new BadRequestException('This item is not available for purchase');
      }

      // 5. Calculate total price
      const unitPrice = parseFloat(shopItem.price);
      const totalPrice = unitPrice * quantity;

      // 6. Create purchase record
      const purchase = queryRunner.manager.create(Purchase, {
        user_id: senderId,
        shop_item_id,
        quantity,
        unit_price: shopItem.price,
        total_price: totalPrice.toFixed(2),
        currency: shopItem.currency,
        payment_method,
        is_gift: true,
        transaction_id: this.generateTransactionId(),
        metadata: {
          receiver_id,
          message,
        },
      });
      const savedPurchase = await queryRunner.manager.save(purchase);

      // 7. Create gift record
      const gift = queryRunner.manager.create(Gift, {
        sender_id: senderId,
        receiver_id,
        shop_item_id,
        quantity,
        message,
        status: 'pending',
        expiration: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        metadata: {
          purchase_id: savedPurchase.id,
          purchased: true,
        },
      });
      const savedGift = await queryRunner.manager.save(gift);

      // 8. Update purchase with gift_id
      savedPurchase.gift_id = savedGift.id;
      await queryRunner.manager.save(savedPurchase);

      await queryRunner.commitTransaction();

      // 9. TODO: Notify receiver (implement notification service)
      // await this.notificationService.notifyGiftReceived(receiver_id, savedGift);

      return {
        purchase: savedPurchase,
        gift: savedGift,
      };
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Generate a unique transaction ID
   */
  private generateTransactionId(): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 15);
    return `TXN-${timestamp}-${random}`.toUpperCase();
  }

  /**
   * Get purchase history for a user
   */
  async getPurchaseHistory(
    userId: number,
    page: number = 1,
    limit: number = 20,
  ): Promise<{
    data: Purchase[];
    meta: { page: number; limit: number; total: number; totalPages: number };
  }> {
    const qb = this.purchaseRepository
      .createQueryBuilder('purchase')
      .leftJoinAndSelect('purchase.shop_item', 'shop_item')
      .where('purchase.user_id = :userId', { userId })
      .orderBy('purchase.created_at', 'DESC');

    const total = await qb.getCount();
    const data = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .getMany();

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
}
