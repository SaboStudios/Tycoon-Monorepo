import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { ShopService } from './shop.service';
import { ShopItem } from './entities/shop-item.entity';
import { Purchase } from './entities/purchase.entity';
import { UsersService } from '../users/users.service';
import { GiftsService } from '../gifts/gifts.service';
import {
  repositoryMockFactory,
  MockType,
} from '../../../test/mocks/database.mock';
import {
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';

describe('ShopService', () => {
  let service: ShopService;
  let shopItemRepositoryMock: MockType<Repository<ShopItem>>;
  let purchaseRepositoryMock: MockType<Repository<Purchase>>;

  const mockUsersService = {
    findOne: jest.fn(),
  };

  const mockGiftsService = {
    create: jest.fn(),
  };

  const mockQueryRunner = {
    connect: jest.fn(),
    startTransaction: jest.fn(),
    commitTransaction: jest.fn(),
    rollbackTransaction: jest.fn(),
    release: jest.fn(),
    manager: {
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
    },
  };

  const mockDataSource = {
    createQueryRunner: jest.fn(() => mockQueryRunner),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ShopService,
        {
          provide: getRepositoryToken(ShopItem),
          useFactory: repositoryMockFactory,
        },
        {
          provide: getRepositoryToken(Purchase),
          useFactory: repositoryMockFactory,
        },
        {
          provide: UsersService,
          useValue: mockUsersService,
        },
        {
          provide: GiftsService,
          useValue: mockGiftsService,
        },
        {
          provide: DataSource,
          useValue: mockDataSource,
        },
      ],
    }).compile();

    service = module.get<ShopService>(ShopService);
    shopItemRepositoryMock = module.get(getRepositoryToken(ShopItem));
    purchaseRepositoryMock = module.get(getRepositoryToken(Purchase));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findOne', () => {
    it('should return a shop item', async () => {
      const mockItem = {
        id: 1,
        name: 'Golden Dice',
        price: '9.99',
        active: true,
      };
      shopItemRepositoryMock.findOne!.mockResolvedValue(mockItem);

      const result = await service.findOne(1);

      expect(result).toEqual(mockItem);
      expect(shopItemRepositoryMock.findOne).toHaveBeenCalledWith({
        where: { id: 1 },
      });
    });

    it('should throw NotFoundException if item not found', async () => {
      shopItemRepositoryMock.findOne!.mockResolvedValue(null);

      await expect(service.findOne(1)).rejects.toThrow(NotFoundException);
    });
  });

  describe('purchaseAndGift', () => {
    const mockSender = { id: 1, email: 'sender@example.com' };
    const mockReceiver = { id: 2, email: 'receiver@example.com' };
    const mockShopItem = {
      id: 1,
      name: 'Golden Dice',
      price: '9.99',
      currency: 'USD',
      active: true,
    };

    const purchaseDto = {
      shop_item_id: 1,
      receiver_id: 2,
      quantity: 1,
      message: 'Happy birthday!',
      payment_method: 'balance',
    };

    beforeEach(() => {
      mockUsersService.findOne.mockImplementation((id: number) => {
        if (id === 1) return Promise.resolve(mockSender);
        if (id === 2) return Promise.resolve(mockReceiver);
        return Promise.resolve(null);
      });
    });

    it('should successfully purchase and gift an item', async () => {
      const mockPurchase = {
        id: 1,
        user_id: 1,
        shop_item_id: 1,
        quantity: 1,
        unit_price: '9.99',
        total_price: '9.99',
        currency: 'USD',
        is_gift: true,
      };

      const mockGift = {
        id: 1,
        sender_id: 1,
        receiver_id: 2,
        shop_item_id: 1,
        quantity: 1,
        message: 'Happy birthday!',
        status: 'pending',
      };

      // Mock findOne for shop item
      shopItemRepositoryMock.findOne!.mockResolvedValue(mockShopItem);

      // Mock query runner operations
      mockQueryRunner.manager.create.mockImplementation((entity: unknown, data: unknown) => {
        if (entity === Purchase) return { ...mockPurchase, ...data };
        return { ...mockGift, ...data };
      });

      mockQueryRunner.manager.save.mockImplementation((entity: unknown) => {
        if ((entity as { user_id?: number }).user_id) return Promise.resolve(mockPurchase);
        return Promise.resolve(mockGift);
      });

      const result = await service.purchaseAndGift(1, purchaseDto);

      expect(result).toHaveProperty('purchase');
      expect(result).toHaveProperty('gift');
      expect(mockUsersService.findOne).toHaveBeenCalledWith(1);
      expect(mockUsersService.findOne).toHaveBeenCalledWith(2);
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
    });

    it('should throw BadRequestException if sender gifts to themselves', async () => {
      const selfGiftDto = {
        ...purchaseDto,
        receiver_id: 1,
      };

      shopItemRepositoryMock.findOne!.mockResolvedValue(mockShopItem);

      await expect(service.purchaseAndGift(1, selfGiftDto)).rejects.toThrow(
        BadRequestException,
      );
      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
    });

    it('should throw NotFoundException if receiver not found', async () => {
      mockUsersService.findOne.mockImplementation((id: number) => {
        if (id === 1) return Promise.resolve(mockSender);
        return Promise.resolve(null);
      });

      shopItemRepositoryMock.findOne!.mockResolvedValue(mockShopItem);

      await expect(service.purchaseAndGift(1, purchaseDto)).rejects.toThrow(
        NotFoundException,
      );
      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
    });

    it('should throw BadRequestException if item is not active', async () => {
      const inactiveItem = { ...mockShopItem, active: false };
      shopItemRepositoryMock.findOne!.mockResolvedValue(inactiveItem);

      await expect(service.purchaseAndGift(1, purchaseDto)).rejects.toThrow(
        BadRequestException,
      );
      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
    });

    it('should calculate correct total price for multiple quantities', async () => {
      const multiQuantityDto = {
        ...purchaseDto,
        quantity: 3,
      };

      shopItemRepositoryMock.findOne!.mockResolvedValue(mockShopItem);

      mockQueryRunner.manager.create.mockImplementation((entity: unknown, data: unknown) => {
        return { ...data };
      });

      mockQueryRunner.manager.save.mockImplementation((entity: unknown) => {
        return Promise.resolve(entity);
      });

      await service.purchaseAndGift(1, multiQuantityDto);

      // Verify total price calculation
      const createCall = mockQueryRunner.manager.create.mock.calls.find(
        (call: unknown[]) => call[0] === Purchase,
      );
      expect(createCall).toBeDefined();
      const purchaseData = createCall[1] as { total_price: string };
      expect(purchaseData.total_price).toBe('29.97'); // 9.99 * 3
    });
  });

  describe('getPurchaseHistory', () => {
    it('should return paginated purchase history', async () => {
      const mockPurchases = [
        {
          id: 1,
          user_id: 1,
          shop_item_id: 1,
          quantity: 1,
          total_price: '9.99',
        },
      ];

      const mockQueryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getCount: jest.fn().mockResolvedValue(1),
        getMany: jest.fn().mockResolvedValue(mockPurchases),
      };

      purchaseRepositoryMock.createQueryBuilder = jest
        .fn()
        .mockReturnValue(mockQueryBuilder);

      const result = await service.getPurchaseHistory(1, 1, 20);

      expect(result.data).toEqual(mockPurchases);
      expect(result.meta).toEqual({
        page: 1,
        limit: 20,
        total: 1,
        totalPages: 1,
      });
    });
  });
});
