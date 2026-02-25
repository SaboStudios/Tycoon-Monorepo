import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { PurchaseService } from './purchase.service';
import { Purchase } from './entities/purchase.entity';
import { ShopItem } from './entities/shop-item.entity';
import { CouponsService } from '../coupons/coupons.service';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { ShopItemType } from './enums/shop-item-type.enum';
import { CouponType } from '../coupons/enums/coupon-type.enum';

describe('PurchaseService', () => {
  let service: PurchaseService;
  let purchaseRepository: Repository<Purchase>;
  let shopItemRepository: Repository<ShopItem>;
  let couponsService: CouponsService;
  let dataSource: DataSource;

  const mockShopItem: Partial<ShopItem> = {
    id: 1,
    name: 'Test Item',
    price: '100.00',
    currency: 'USD',
    active: true,
    type: ShopItemType.SKIN,
  };

  const mockCoupon = {
    id: 1,
    code: 'SAVE20',
    type: CouponType.PERCENTAGE,
    value: '20',
    active: true,
    max_uses: 100,
    current_usage: 0,
  };

  const mockQueryRunner = {
    connect: jest.fn(),
    startTransaction: jest.fn(),
    commitTransaction: jest.fn(),
    rollbackTransaction: jest.fn(),
    release: jest.fn(),
    manager: {
      save: jest.fn(),
    },
  };

  const mockDataSource = {
    createQueryRunner: jest.fn(() => mockQueryRunner),
  };

  const mockPurchaseRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    findAndCount: jest.fn(),
  };

  const mockShopItemRepository = {
    findOne: jest.fn(),
  };

  const mockCouponsService = {
    validateCoupon: jest.fn(),
    findByCode: jest.fn(),
    calculateDiscount: jest.fn(),
    incrementUsage: jest.fn(),
    logCouponUsage: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PurchaseService,
        {
          provide: getRepositoryToken(Purchase),
          useValue: mockPurchaseRepository,
        },
        {
          provide: getRepositoryToken(ShopItem),
          useValue: mockShopItemRepository,
        },
        {
          provide: CouponsService,
          useValue: mockCouponsService,
        },
        {
          provide: DataSource,
          useValue: mockDataSource,
        },
      ],
    }).compile();

    service = module.get<PurchaseService>(PurchaseService);
    purchaseRepository = module.get<Repository<Purchase>>(
      getRepositoryToken(Purchase),
    );
    shopItemRepository = module.get<Repository<ShopItem>>(
      getRepositoryToken(ShopItem),
    );
    couponsService = module.get<CouponsService>(CouponsService);
    dataSource = module.get<DataSource>(DataSource);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createPurchase', () => {
    it('should create a purchase without coupon', async () => {
      const userId = 1;
      const createDto = {
        shop_item_id: 1,
        quantity: 1,
      };

      const mockPurchase = {
        id: 1,
        user_id: userId,
        shop_item_id: 1,
        quantity: 1,
        original_price: '100.00',
        discount_amount: '0',
        final_price: '100.00',
        shop_item: mockShopItem,
      };

      mockShopItemRepository.findOne.mockResolvedValue(mockShopItem);
      mockPurchaseRepository.create.mockReturnValue(mockPurchase);
      mockQueryRunner.manager.save.mockResolvedValue(mockPurchase);
      mockPurchaseRepository.findOne.mockResolvedValue(mockPurchase);

      const result = await service.createPurchase(userId, createDto);

      expect(result).toEqual(mockPurchase);
      expect(mockShopItemRepository.findOne).toHaveBeenCalledWith({
        where: { id: 1 },
      });
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
    });

    it('should create a purchase with valid coupon', async () => {
      const userId = 1;
      const createDto = {
        shop_item_id: 1,
        quantity: 1,
        coupon_code: 'SAVE20',
      };

      const mockPurchase = {
        id: 1,
        user_id: userId,
        shop_item_id: 1,
        quantity: 1,
        original_price: '100.00',
        discount_amount: '20.00',
        final_price: '80.00',
        coupon_id: 1,
        coupon_code: 'SAVE20',
        shop_item: mockShopItem,
      };

      mockShopItemRepository.findOne.mockResolvedValue(mockShopItem);
      mockCouponsService.validateCoupon.mockResolvedValue({
        valid: true,
        discount_amount: 20,
        coupon: { id: 1, code: 'SAVE20', type: 'percentage', value: '20' },
      });
      mockCouponsService.findByCode.mockResolvedValue(mockCoupon);
      mockCouponsService.calculateDiscount.mockReturnValue(20);
      mockCouponsService.logCouponUsage.mockResolvedValue({});
      mockPurchaseRepository.create.mockReturnValue(mockPurchase);
      mockQueryRunner.manager.save.mockResolvedValue(mockPurchase);
      mockPurchaseRepository.findOne.mockResolvedValue(mockPurchase);

      const result = await service.createPurchase(userId, createDto);

      expect(result.discount_amount).toBe('20.00');
      expect(result.final_price).toBe('80.00');
      expect(mockCouponsService.incrementUsage).toHaveBeenCalledWith(1);
      expect(mockCouponsService.logCouponUsage).toHaveBeenCalled();
    });

    it('should throw NotFoundException if shop item not found', async () => {
      mockShopItemRepository.findOne.mockResolvedValue(null);

      await expect(
        service.createPurchase(1, { shop_item_id: 999, quantity: 1 }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if item is inactive', async () => {
      const inactiveItem = { ...mockShopItem, active: false };
      mockShopItemRepository.findOne.mockResolvedValue(inactiveItem);

      await expect(
        service.createPurchase(1, { shop_item_id: 1, quantity: 1 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should rollback transaction on error', async () => {
      mockShopItemRepository.findOne.mockResolvedValue(mockShopItem);
      mockPurchaseRepository.create.mockReturnValue({});
      mockQueryRunner.manager.save.mockRejectedValue(new Error('DB Error'));

      await expect(
        service.createPurchase(1, { shop_item_id: 1, quantity: 1 }),
      ).rejects.toThrow();

      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.release).toHaveBeenCalled();
    });
  });

  describe('calculatePurchasePrice', () => {
    it('should calculate price without coupon', async () => {
      const result = await service.calculatePurchasePrice(
        mockShopItem as ShopItem,
        2,
      );

      expect(result.original_price).toBe(200);
      expect(result.discount_amount).toBe(0);
      expect(result.final_price).toBe(200);
      expect(result.coupon_id).toBeUndefined();
    });

    it('should calculate price with valid coupon', async () => {
      mockCouponsService.validateCoupon.mockResolvedValue({
        valid: true,
        discount_amount: 20,
        coupon: { id: 1, code: 'SAVE20', type: 'percentage', value: '20' },
      });
      mockCouponsService.findByCode.mockResolvedValue(mockCoupon);
      mockCouponsService.calculateDiscount.mockReturnValue(20);

      const result = await service.calculatePurchasePrice(
        mockShopItem as ShopItem,
        1,
        'SAVE20',
      );

      expect(result.original_price).toBe(100);
      expect(result.discount_amount).toBe(20);
      expect(result.final_price).toBe(80);
      expect(result.coupon_code).toBe('SAVE20');
    });

    it('should throw BadRequestException for invalid coupon', async () => {
      mockCouponsService.validateCoupon.mockResolvedValue({
        valid: false,
        message: 'Coupon expired',
      });

      await expect(
        service.calculatePurchasePrice(mockShopItem as ShopItem, 1, 'EXPIRED'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should not allow negative final price', async () => {
      mockCouponsService.validateCoupon.mockResolvedValue({
        valid: true,
        discount_amount: 150,
        coupon: { id: 1, code: 'HUGE', type: 'fixed', value: '150' },
      });
      mockCouponsService.findByCode.mockResolvedValue({
        ...mockCoupon,
        type: CouponType.FIXED,
        value: '150',
      });
      mockCouponsService.calculateDiscount.mockReturnValue(150);

      const result = await service.calculatePurchasePrice(
        mockShopItem as ShopItem,
        1,
        'HUGE',
      );

      expect(result.final_price).toBe(0);
    });
  });

  describe('getUserPurchases', () => {
    it('should return paginated purchase history', async () => {
      const mockPurchases = [
        { id: 1, user_id: 1, shop_item: mockShopItem },
        { id: 2, user_id: 1, shop_item: mockShopItem },
      ];

      mockPurchaseRepository.findAndCount.mockResolvedValue([
        mockPurchases,
        2,
      ]);

      const result = await service.getUserPurchases(1, 1, 20);

      expect(result.data).toEqual(mockPurchases);
      expect(result.meta.total).toBe(2);
      expect(result.meta.totalPages).toBe(1);
    });
  });

  describe('getPurchaseById', () => {
    it('should return purchase by id', async () => {
      const mockPurchase = {
        id: 1,
        user_id: 1,
        shop_item: mockShopItem,
      };

      mockPurchaseRepository.findOne.mockResolvedValue(mockPurchase);

      const result = await service.getPurchaseById(1, 1);

      expect(result).toEqual(mockPurchase);
    });

    it('should throw NotFoundException if purchase not found', async () => {
      mockPurchaseRepository.findOne.mockResolvedValue(null);

      await expect(service.getPurchaseById(999, 1)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('validatePurchaseEligibility', () => {
    it('should return eligible for valid item', async () => {
      mockShopItemRepository.findOne.mockResolvedValue(mockShopItem);

      const result = await service.validatePurchaseEligibility(1, 1);

      expect(result.eligible).toBe(true);
    });

    it('should return not eligible for non-existent item', async () => {
      mockShopItemRepository.findOne.mockResolvedValue(null);

      const result = await service.validatePurchaseEligibility(1, 999);

      expect(result.eligible).toBe(false);
      expect(result.reason).toBe('Item not found');
    });

    it('should return not eligible for inactive item', async () => {
      const inactiveItem = { ...mockShopItem, active: false };
      mockShopItemRepository.findOne.mockResolvedValue(inactiveItem);

      const result = await service.validatePurchaseEligibility(1, 1);

      expect(result.eligible).toBe(false);
      expect(result.reason).toBe('Item is not available');
    });
  });
});
