import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { ThemeMarketplaceService } from './theme-marketplace.service';
import { Purchase } from './entities/purchase.entity';
import { UserInventory } from './entities/user-inventory.entity';
import { UsersService } from '../users/users.service';
import { CouponsService } from '../coupons/coupons.service';
import { SkinsService } from '../skins/skins.service';
import { BoardStylesService } from '../board-styles/board-styles.service';
import { UserSkinsService } from '../skins/user-skins.service';
import { RedisService } from '../redis/redis.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';

describe('ThemeMarketplaceService', () => {
  let service: ThemeMarketplaceService;
  let purchaseRepositoryMock: any;
  let userInventoryRepositoryMock: any;

  const mockUsersService = {
    findOne: jest.fn(),
    update: jest.fn(),
  };

  const mockCouponsService = {
    validateCoupon: jest.fn(),
    incrementUsage: jest.fn(),
  };

  const mockSkinsService = {
    findOne: jest.fn(),
    findAll: jest.fn(),
  };

  const mockBoardStylesService = {
    findOne: jest.fn(),
    findAll: jest.fn(),
  };

  const mockUserSkinsService = {
    unlockSkin: jest.fn(),
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
      find: jest.fn(),
    },
  };

  const mockDataSource = {
    createQueryRunner: jest.fn(() => mockQueryRunner),
  };

  const mockRedisService = {
    delByPattern: jest.fn(),
  };

  beforeEach(async () => {
    purchaseRepositoryMock = {
      findAndCount: jest.fn(),
    };

    userInventoryRepositoryMock = {
      find: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ThemeMarketplaceService,
        {
          provide: getRepositoryToken(Purchase),
          useValue: purchaseRepositoryMock,
        },
        {
          provide: getRepositoryToken(UserInventory),
          useValue: userInventoryRepositoryMock,
        },
        {
          provide: UsersService,
          useValue: mockUsersService,
        },
        {
          provide: CouponsService,
          useValue: mockCouponsService,
        },
        {
          provide: SkinsService,
          useValue: mockSkinsService,
        },
        {
          provide: BoardStylesService,
          useValue: mockBoardStylesService,
        },
        {
          provide: UserSkinsService,
          useValue: mockUserSkinsService,
        },
        {
          provide: DataSource,
          useValue: mockDataSource,
        },
        {
          provide: RedisService,
          useValue: mockRedisService,
        },
      ],
    }).compile();

    service = module.get<ThemeMarketplaceService>(ThemeMarketplaceService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('purchaseThemes', () => {
    it('should throw error if user not found', async () => {
      mockUsersService.findOne.mockResolvedValueOnce(null);

      await expect(
        service.purchaseThemes(1, {
          themeIds: ['skin-1'],
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw error if no themes selected', async () => {
      mockUsersService.findOne.mockResolvedValueOnce({ id: 1, balance: '1000' });

      await expect(
        service.purchaseThemes(1, {
          themeIds: [],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should complete purchase successfully with single skin', async () => {
      const mockUser = { id: 1, balance: '1000' };
      const mockSkin = { id: 1, name: 'Dragon Skin', price: 500 };

      mockUsersService.findOne.mockResolvedValueOnce(mockUser);
      mockSkinsService.findOne.mockResolvedValueOnce(mockSkin);
      mockQueryRunner.manager.find.mockResolvedValueOnce([]);
      mockQueryRunner.manager.create.mockReturnValueOnce({});
      mockQueryRunner.manager.save.mockResolvedValueOnce({
        id: 1,
        transaction_id: 'THEME-123-abc',
      });
      mockUserSkinsService.unlockSkin.mockResolvedValueOnce({});
      mockUsersService.update.mockResolvedValueOnce(mockUser);

      const result = await service.purchaseThemes(1, {
        themeIds: ['1'],
      });

      expect(result.unlockedThemes).toContain('skin-1');
      expect(result.message).toContain('Successfully purchased');
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
    });
  });

  describe('getAvailableThemes', () => {
    it('should return all themes when no type filter', async () => {
      const mockSkins = [{ id: 1, name: 'Skin 1', price: 100 }];
      const mockBoardStyles = [{ id: 1, name: 'Board 1', price: 200 }];

      mockSkinsService.findAll.mockResolvedValueOnce(mockSkins);
      mockBoardStylesService.findAll.mockResolvedValueOnce(mockBoardStyles);

      const result = await service.getAvailableThemes();

      expect(result).toHaveLength(2);
    });

    it('should return only skins when type is skin', async () => {
      const mockSkins = [{ id: 1, name: 'Skin 1', price: 100 }];

      mockSkinsService.findAll.mockResolvedValueOnce(mockSkins);

      const result = await service.getAvailableThemes('skin');

      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('skin');
    });

    it('should return only board styles when type is board', async () => {
      const mockBoardStyles = [{ id: 1, name: 'Board 1', price: 200 }];

      mockBoardStylesService.findAll.mockResolvedValueOnce(mockBoardStyles);

      const result = await service.getAvailableThemes('board');

      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('board');
    });
  });

  describe('getUserThemeTransactions', () => {
    it('should return paginated user transactions', async () => {
      const mockTransactions = [
        { id: 1, user_id: 1, transaction_id: 'THEME-123' },
      ];

      purchaseRepositoryMock.findAndCount.mockResolvedValueOnce([
        mockTransactions,
        1,
      ]);

      const result = await service.getUserThemeTransactions(1);

      expect(result.transactions).toHaveLength(1);
      expect(result.pagination.page).toBe(1);
      expect(result.pagination.total).toBe(1);
    });

    it('should support custom pagination', async () => {
      purchaseRepositoryMock.findAndCount.mockResolvedValueOnce([[], 0]);

      await service.getUserThemeTransactions(1, 2, 10);

      expect(purchaseRepositoryMock.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 10,
          take: 10,
        }),
      );
    });
  });
});
