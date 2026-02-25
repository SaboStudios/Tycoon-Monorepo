import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, LessThan } from 'typeorm';
import { Gift } from './entities/gift.entity';
import { CreateGiftDto } from './dto/create-gift.dto';
import { FilterGiftsDto } from './dto/filter-gifts.dto';
import { GiftStatus } from './enums/gift-status.enum';
import { ShopService } from '../shop/shop.service';
import { UsersService } from '../users/users.service';
import { GiftResponse } from './dto/respond-gift.dto';

export interface PaginatedGifts {
  data: Gift[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

@Injectable()
export class GiftsService {
  constructor(
    @InjectRepository(Gift)
    private readonly giftRepository: Repository<Gift>,
    private readonly shopService: ShopService,
    private readonly usersService: UsersService,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Create a new gift
   */
  async create(senderId: number, createGiftDto: CreateGiftDto): Promise<Gift> {
    const { receiver_id, shop_item_id, quantity = 1, message, expiration_hours = 168 } = createGiftDto;

    // Validate sender and receiver exist
    await this.usersService.findOne(senderId);
    await this.usersService.findOne(receiver_id);

    // Validate sender is not gifting to themselves
    if (senderId === receiver_id) {
      throw new BadRequestException('Cannot send a gift to yourself');
    }

    // Validate shop item exists and is active
    const shopItem = await this.shopService.findOne(shop_item_id);
    if (!shopItem.active) {
      throw new BadRequestException('This item is not available for gifting');
    }

    // Calculate expiration
    const expiration = new Date();
    expiration.setHours(expiration.getHours() + expiration_hours);

    const gift = this.giftRepository.create({
      sender_id: senderId,
      receiver_id,
      shop_item_id,
      quantity,
      message,
      expiration,
      status: GiftStatus.PENDING,
    });

    return await this.giftRepository.save(gift);
  }

  /**
   * Get gifts sent by a user
   */
  async findSentGifts(
    senderId: number,
    filterDto: FilterGiftsDto,
  ): Promise<PaginatedGifts> {
    const { status, page = 1, limit = 20 } = filterDto;

    const qb = this.giftRepository
      .createQueryBuilder('gift')
      .leftJoinAndSelect('gift.receiver', 'receiver')
      .leftJoinAndSelect('gift.shop_item', 'shop_item')
      .where('gift.sender_id = :senderId', { senderId })
      .orderBy('gift.created_at', 'DESC');

    if (status) {
      qb.andWhere('gift.status = :status', { status });
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
   * Get gifts received by a user
   */
  async findReceivedGifts(
    receiverId: number,
    filterDto: FilterGiftsDto,
  ): Promise<PaginatedGifts> {
    const { status, page = 1, limit = 20 } = filterDto;

    const qb = this.giftRepository
      .createQueryBuilder('gift')
      .leftJoinAndSelect('gift.sender', 'sender')
      .leftJoinAndSelect('gift.shop_item', 'shop_item')
      .where('gift.receiver_id = :receiverId', { receiverId })
      .orderBy('gift.created_at', 'DESC');

    if (status) {
      qb.andWhere('gift.status = :status', { status });
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
   * Get a single gift by ID
   */
  async findOne(id: number, userId: number): Promise<Gift> {
    const gift = await this.giftRepository.findOne({
      where: { id },
      relations: ['sender', 'receiver', 'shop_item'],
    });

    if (!gift) {
      throw new NotFoundException(`Gift with ID ${id} not found`);
    }

    // Verify user is sender or receiver
    if (gift.sender_id !== userId && gift.receiver_id !== userId) {
      throw new ForbiddenException('You do not have access to this gift');
    }

    return gift;
  }

  /**
   * Respond to a gift (accept or reject)
   */
  async respondToGift(
    giftId: number,
    receiverId: number,
    action: GiftResponse,
  ): Promise<Gift> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const gift = await queryRunner.manager.findOne(Gift, {
        where: { id: giftId },
        relations: ['shop_item'],
      });

      if (!gift) {
        throw new NotFoundException(`Gift with ID ${giftId} not found`);
      }

      // Verify user is the receiver
      if (gift.receiver_id !== receiverId) {
        throw new ForbiddenException('You are not the recipient of this gift');
      }

      // Verify gift is pending
      if (gift.status !== GiftStatus.PENDING) {
        throw new BadRequestException(
          `Gift has already been ${gift.status}`,
        );
      }

      // Check if gift has expired
      if (gift.expiration && new Date() > gift.expiration) {
        gift.status = GiftStatus.EXPIRED;
        await queryRunner.manager.save(gift);
        await queryRunner.commitTransaction();
        throw new BadRequestException('This gift has expired');
      }

      // Update gift status
      if (action === GiftResponse.ACCEPT) {
        gift.status = GiftStatus.ACCEPTED;
        gift.accepted_at = new Date();
        // TODO: Add item to user's inventory when inventory system is implemented
      } else {
        gift.status = GiftStatus.REJECTED;
        gift.rejected_at = new Date();
      }

      const updatedGift = await queryRunner.manager.save(gift);
      await queryRunner.commitTransaction();

      return updatedGift;
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Cancel a pending gift (sender only)
   */
  async cancelGift(giftId: number, senderId: number): Promise<Gift> {
    const gift = await this.giftRepository.findOne({
      where: { id: giftId },
      relations: ['shop_item'],
    });

    if (!gift) {
      throw new NotFoundException(`Gift with ID ${giftId} not found`);
    }

    // Verify user is the sender
    if (gift.sender_id !== senderId) {
      throw new ForbiddenException('You are not the sender of this gift');
    }

    // Verify gift is pending
    if (gift.status !== GiftStatus.PENDING) {
      throw new BadRequestException(
        `Cannot cancel a gift that has been ${gift.status}`,
      );
    }

    gift.status = GiftStatus.CANCELLED;
    return await this.giftRepository.save(gift);
  }

  /**
   * Expire old pending gifts (cron job)
   */
  async expireOldGifts(): Promise<number> {
    const result = await this.giftRepository.update(
      {
        status: GiftStatus.PENDING,
        expiration: LessThan(new Date()),
      },
      {
        status: GiftStatus.EXPIRED,
      },
    );

    return result.affected || 0;
  }
}
