import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { GiftsService } from './gifts.service';
import { Gift } from './entities/gift.entity';
import { BadRequestException } from '@nestjs/common';
import { GiftStatus } from './enums/gift-status.enum';
import { ShopService } from '../shop/shop.service';
import { InventoryService } from '../shop/inventory.service';
import { UsersService } from '../users/users.service';

describe('GiftsService - Security Features', () => {
  let service: GiftsService;

  const mockRepository = {
    count: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };

  const mockShopService = {
    findOne: jest.fn(),
  };

  const mockInventoryService = {};
  const mockUsersService = {
    findOne: jest.fn(),
  };

  const mockDataSource = {
    createQueryRunner: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GiftsService,
        {
          provide: getRepositoryToken(Gift),
          useValue: mockRepository,
        },
        {
          provide: ShopService,
          useValue: mockShopService,
        },
        {
          provide: InventoryService,
          useValue: mockInventoryService,
        },
        {
          provide: UsersService,
          useValue: mockUsersService,
        },
        {
          provide: DataSource,
          useValue: mockDataSource,
        },
      ],
    }).compile();

    service = module.get<GiftsService>(GiftsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Anti-spam protection', () => {
    it('should prevent self-gifting', async () => {
      const senderId = 1;
      const createDto = {
        receiver_id: 1, // Same as sender
        shop_item_id: 10,
        quantity: 1,
      };

      mockUsersService.findOne.mockResolvedValue({ id: 1 });

      await expect(service.create(senderId, createDto)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.create(senderId, createDto)).rejects.toThrow(
        'Cannot send a gift to yourself',
      );
    });

    it('should enforce daily gift limit', async () => {
      const senderId = 1;
      const createDto = {
        receiver_id: 2,
        shop_item_id: 10,
        quantity: 1,
      };

      mockUsersService.findOne.mockResolvedValue({ id: 1 });
      mockRepository.count.mockResolvedValue(50); // At limit

      await expect(service.create(senderId, createDto)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.create(senderId, createDto)).rejects.toThrow(
        'Daily gift limit reached',
      );
    });

    it('should enforce per-receiver gift limit', async () => {
      const senderId = 1;
      const createDto = {
        receiver_id: 2,
        shop_item_id: 10,
        quantity: 1,
      };

      mockUsersService.findOne.mockResolvedValue({ id: 1 });
      mockRepository.count
        .mockResolvedValueOnce(10) // Daily count OK
        .mockResolvedValueOnce(10); // Per-receiver at limit

      await expect(service.create(senderId, createDto)).rejects.toThrow(
        'You can only send 10 gifts per day to the same user',
      );
    });
  });

  describe('Replay attack protection', () => {
    it('should prevent accepting already accepted gift', async () => {
      const gift = {
        id: 1,
        receiver_id: 2,
        status: GiftStatus.ACCEPTED,
      };

      const mockQueryRunner = {
        connect: jest.fn(),
        startTransaction: jest.fn(),
        manager: {
          findOne: jest.fn().mockResolvedValue(gift),
        },
        commitTransaction: jest.fn(),
        rollbackTransaction: jest.fn(),
        release: jest.fn(),
      };

      mockDataSource.createQueryRunner.mockReturnValue(mockQueryRunner);

      await expect(
        service.respondToGift(1, 2, 'accept' as any),
      ).rejects.toThrow('Gift has already been accepted');
    });

    it('should prevent accepting already rejected gift', async () => {
      const gift = {
        id: 1,
        receiver_id: 2,
        status: GiftStatus.REJECTED,
      };

      const mockQueryRunner = {
        connect: jest.fn(),
        startTransaction: jest.fn(),
        manager: {
          findOne: jest.fn().mockResolvedValue(gift),
        },
        commitTransaction: jest.fn(),
        rollbackTransaction: jest.fn(),
        release: jest.fn(),
      };

      mockDataSource.createQueryRunner.mockReturnValue(mockQueryRunner);

      await expect(
        service.respondToGift(1, 2, 'accept' as any),
      ).rejects.toThrow('Gift has already been rejected');
    });
  });
});
