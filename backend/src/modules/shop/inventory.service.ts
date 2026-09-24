import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan } from 'typeorm';
import { UserInventory } from './entities/user-inventory.entity';

@Injectable()
export class InventoryService {
  constructor(
    @InjectRepository(UserInventory)
    private readonly inventoryRepository: Repository<UserInventory>,
  ) {}

  async addItem(
    userId: number,
    shopItemId: number,
    quantity: number,
    expiresAt?: Date,
  ): Promise<UserInventory> {
    const existing = await this.inventoryRepository.findOne({
      where: { user_id: userId, shop_item_id: shopItemId },
    });

    if (existing) {
      existing.quantity += quantity;
      if (expiresAt) {
        existing.expires_at = expiresAt;
      }
      return await this.inventoryRepository.save(existing);
    }

    const item = this.inventoryRepository.create({
      user_id: userId,
      shop_item_id: shopItemId,
      quantity,
      expires_at: expiresAt,
    });

    return await this.inventoryRepository.save(item);
  }

  async getUserInventory(userId: number): Promise<UserInventory[]> {
    return await this.inventoryRepository.find({
      where: { user_id: userId },
      order: { created_at: 'DESC' },
    });
  }

  async getActiveInventory(userId: number): Promise<UserInventory[]> {
    const now = new Date();
    return await this.inventoryRepository
      .createQueryBuilder('inventory')
      .where('inventory.user_id = :userId', { userId })
      .andWhere(
        '(inventory.expires_at IS NULL OR inventory.expires_at > :now)',
        { now },
      )
      .orderBy('inventory.created_at', 'DESC')
      .getMany();
  }

  async useItem(
    userId: number,
    shopItemId: number,
    quantity: number = 1,
  ): Promise<void> {
    const item = await this.inventoryRepository.findOne({
      where: { user_id: userId, shop_item_id: shopItemId },
    });

    if (!item) {
      throw new NotFoundException('Item not found in inventory');
    }

    if (item.expires_at && item.expires_at < new Date()) {
      throw new BadRequestException('Item has expired');
    }

    if (item.quantity < quantity) {
      throw new BadRequestException('Insufficient quantity');
    }

    item.quantity -= quantity;

    if (item.quantity === 0) {
      await this.inventoryRepository.remove(item);
    } else {
      await this.inventoryRepository.save(item);
    }
  }

  async hasItem(userId: number, shopItemId: number): Promise<boolean> {
    const item = await this.inventoryRepository.findOne({
      where: { user_id: userId, shop_item_id: shopItemId },
    });

    if (!item) return false;
    if (item.expires_at && item.expires_at < new Date()) return false;
    return item.quantity > 0;
  }

  async getItemQuantity(userId: number, shopItemId: number): Promise<number> {
    const item = await this.inventoryRepository.findOne({
      where: { user_id: userId, shop_item_id: shopItemId },
    });

    if (!item) return 0;
    if (item.expires_at && item.expires_at < new Date()) return 0;
    return item.quantity;
  }

  async cleanupExpiredItems(): Promise<number> {
    const result = await this.inventoryRepository
      .createQueryBuilder()
      .delete()
      .where('expires_at IS NOT NULL')
      .andWhere('expires_at < :now', { now: new Date() })
      .execute();

    return result.affected || 0;
  }
}
