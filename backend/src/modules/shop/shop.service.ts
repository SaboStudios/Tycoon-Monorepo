import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ShopItem } from './entities/shop-item.entity';
import { CreateShopItemDto } from './dto/create-shop-item.dto';
import { UpdateShopItemDto } from './dto/update-shop-item.dto';
import { FilterShopItemsDto } from './dto/filter-shop-items.dto';

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
