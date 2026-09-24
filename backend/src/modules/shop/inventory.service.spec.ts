import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InventoryService } from './inventory.service';
import { UserInventory } from './entities/user-inventory.entity';
import { NotFoundException, BadRequestException } from '@nestjs/common';

describe('InventoryService', () => {
  let service: InventoryService;
  let repository: Repository<UserInventory>;

  const mockRepository = {
    findOne: jest.fn(),
    find: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    remove: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InventoryService,
        {
          provide: getRepositoryToken(UserInventory),
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<InventoryService>(InventoryService);
    repository = module.get<Repository<UserInventory>>(
      getRepositoryToken(UserInventory),
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('addItem', () => {
    it('should add new item to inventory', async () => {
      const userId = 1;
      const shopItemId = 10;
      const quantity = 5;

      mockRepository.findOne.mockResolvedValue(null);
      mockRepository.create.mockReturnValue({
        user_id: userId,
        shop_item_id: shopItemId,
        quantity,
      });
      mockRepository.save.mockResolvedValue({
        id: 1,
        user_id: userId,
        shop_item_id: shopItemId,
        quantity,
      });

      const result = await service.addItem(userId, shopItemId, quantity);

      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { user_id: userId, shop_item_id: shopItemId },
      });
      expect(mockRepository.create).toHaveBeenCalled();
      expect(mockRepository.save).toHaveBeenCalled();
      expect(result.quantity).toBe(quantity);
    });

    it('should increment quantity if item exists', async () => {
      const userId = 1;
      const shopItemId = 10;
      const existingQuantity = 3;
      const addQuantity = 2;

      const existingItem = {
        id: 1,
        user_id: userId,
        shop_item_id: shopItemId,
        quantity: existingQuantity,
      };

      mockRepository.findOne.mockResolvedValue(existingItem);
      mockRepository.save.mockResolvedValue({
        ...existingItem,
        quantity: existingQuantity + addQuantity,
      });

      const result = await service.addItem(userId, shopItemId, addQuantity);

      expect(result.quantity).toBe(existingQuantity + addQuantity);
    });
  });

  describe('useItem', () => {
    it('should decrease quantity when using item', async () => {
      const userId = 1;
      const shopItemId = 10;
      const item = {
        id: 1,
        user_id: userId,
        shop_item_id: shopItemId,
        quantity: 5,
        expires_at: null,
      };

      mockRepository.findOne.mockResolvedValue(item);
      mockRepository.save.mockResolvedValue({ ...item, quantity: 4 });

      await service.useItem(userId, shopItemId, 1);

      expect(mockRepository.save).toHaveBeenCalled();
    });

    it('should remove item when quantity reaches zero', async () => {
      const userId = 1;
      const shopItemId = 10;
      const item = {
        id: 1,
        user_id: userId,
        shop_item_id: shopItemId,
        quantity: 1,
        expires_at: null,
      };

      mockRepository.findOne.mockResolvedValue(item);

      await service.useItem(userId, shopItemId, 1);

      expect(mockRepository.remove).toHaveBeenCalledWith(item);
    });

    it('should throw NotFoundException if item not found', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      await expect(service.useItem(1, 10, 1)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException if insufficient quantity', async () => {
      const item = {
        id: 1,
        user_id: 1,
        shop_item_id: 10,
        quantity: 2,
        expires_at: null,
      };

      mockRepository.findOne.mockResolvedValue(item);

      await expect(service.useItem(1, 10, 5)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException if item expired', async () => {
      const pastDate = new Date('2020-01-01');
      const item = {
        id: 1,
        user_id: 1,
        shop_item_id: 10,
        quantity: 5,
        expires_at: pastDate,
      };

      mockRepository.findOne.mockResolvedValue(item);

      await expect(service.useItem(1, 10, 1)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('hasItem', () => {
    it('should return true if user has item', async () => {
      const item = {
        id: 1,
        user_id: 1,
        shop_item_id: 10,
        quantity: 5,
        expires_at: null,
      };

      mockRepository.findOne.mockResolvedValue(item);

      const result = await service.hasItem(1, 10);

      expect(result).toBe(true);
    });

    it('should return false if item not found', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      const result = await service.hasItem(1, 10);

      expect(result).toBe(false);
    });

    it('should return false if item expired', async () => {
      const pastDate = new Date('2020-01-01');
      const item = {
        id: 1,
        user_id: 1,
        shop_item_id: 10,
        quantity: 5,
        expires_at: pastDate,
      };

      mockRepository.findOne.mockResolvedValue(item);

      const result = await service.hasItem(1, 10);

      expect(result).toBe(false);
    });
  });
});
