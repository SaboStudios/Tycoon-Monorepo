import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CouponsService } from './coupons.service';
import { Coupon } from './entities/coupon.entity';
import { CouponUsageLog } from './entities/coupon-usage-log.entity';
import { CouponType } from './enums/coupon-type.enum';
import { NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';

describe('CouponsService', () => {
  let service: CouponsService;
  let repository: Repository<Coupon>;
  let usageLogRepository: Repository<CouponUsageLog>;

  const mockCoupon: Partial<Coupon> = {
    id: 1,
    code: 'SAVE20',
    type: CouponType.PERCENTAGE,
    value: '20',
    max_uses: 100,
    current_usage: 0,
    active: true,
    expiration: new Date('2026-12-31'),
    item_restriction_id: null,
    description: 'Test coupon',
    min_purchase_amount: null,
    max_discount_amount: null,
    created_at: new Date(),
    updated_at: new Date(),
  };

  const mockRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    remove: jest.fn(),
    increment: jest.fn(),
    createQueryBuilder: jest.fn(() => ({
      orderBy: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getCount: jest.fn(),
      getMany: jest.fn(),
    })),
  };

  const mockUsageLogRepository = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    createQueryBuilder: jest.fn(() => ({
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getCount: jest.fn(),
      getMany: jest.fn(),
    })),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CouponsService,
        {
          provide: getRepositoryToken(Coupon),
          useValue: mockRepository,
        },
        {
          provide: getRepositoryToken(CouponUsageLog),
          useValue: mockUsageLogRepository,
        },
      ],
    }).compile();

    service = module.get<CouponsService>(CouponsService);
    repository = module.get<Repository<Coupon>>(getRepositoryToken(Coupon));
    usageLogRepository = module.get<Repository<CouponUsageLog>>(
      getRepositoryToken(CouponUsageLog),
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a new coupon', async () => {
      const createDto = {
        code: 'SAVE20',
        type: CouponType.PERCENTAGE,
        value: 20,
        max_uses: 100,
        active: true,
      };

      mockRepository.findOne.mockResolvedValue(null);
      mockRepository.create.mockReturnValue(mockCoupon);
      mockRepository.save.mockResolvedValue(mockCoupon);

      const result = await service.create(createDto);

      expect(result).toEqual(mockCoupon);
      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { code: createDto.code },
      });
      expect(mockRepository.save).toHaveBeenCalled();
    });

    it('should throw ConflictException if coupon code already exists', async () => {
      const createDto = {
        code: 'SAVE20',
        type: CouponType.PERCENTAGE,
        value: 20,
      };

      mockRepository.findOne.mockResolvedValue(mockCoupon);

      await expect(service.create(createDto)).rejects.toThrow(ConflictException);
    });
  });

  describe('findOne', () => {
    it('should return a coupon by id', async () => {
      mockRepository.findOne.mockResolvedValue(mockCoupon);

      const result = await service.findOne(1);

      expect(result).toEqual(mockCoupon);
      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { id: 1 },
        relations: ['item_restriction'],
      });
    });

    it('should throw NotFoundException if coupon not found', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      await expect(service.findOne(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('validateCoupon', () => {
    it('should validate a valid coupon', async () => {
      mockRepository.findOne.mockResolvedValue(mockCoupon);

      const result = await service.validateCoupon({
        code: 'SAVE20',
        purchase_amount: 100,
      });

      expect(result.valid).toBe(true);
      expect(result.discount_amount).toBe(20);
    });

    it('should reject an inactive coupon', async () => {
      const inactiveCoupon = { ...mockCoupon, active: false };
      mockRepository.findOne.mockResolvedValue(inactiveCoupon);

      const result = await service.validateCoupon({
        code: 'SAVE20',
        purchase_amount: 100,
      });

      expect(result.valid).toBe(false);
      expect(result.message).toContain('no longer active');
    });

    it('should reject an expired coupon', async () => {
      const expiredCoupon = { ...mockCoupon, expiration: new Date('2020-01-01') };
      mockRepository.findOne.mockResolvedValue(expiredCoupon);

      const result = await service.validateCoupon({
        code: 'SAVE20',
        purchase_amount: 100,
      });

      expect(result.valid).toBe(false);
      expect(result.message).toContain('expired');
    });

    it('should reject a coupon that reached usage limit', async () => {
      const usedUpCoupon = { ...mockCoupon, max_uses: 10, current_usage: 10 };
      mockRepository.findOne.mockResolvedValue(usedUpCoupon);

      const result = await service.validateCoupon({
        code: 'SAVE20',
        purchase_amount: 100,
      });

      expect(result.valid).toBe(false);
      expect(result.message).toContain('usage limit');
    });

    it('should reject item-specific coupon for wrong item', async () => {
      const itemCoupon = { ...mockCoupon, item_restriction_id: 5 };
      mockRepository.findOne.mockResolvedValue(itemCoupon);

      const result = await service.validateCoupon({
        code: 'SAVE20',
        shop_item_id: 10,
        purchase_amount: 100,
      });

      expect(result.valid).toBe(false);
      expect(result.message).toContain('not valid for the selected item');
    });

    it('should reject if minimum purchase amount not met', async () => {
      const minPurchaseCoupon = { ...mockCoupon, min_purchase_amount: '50' };
      mockRepository.findOne.mockResolvedValue(minPurchaseCoupon);

      const result = await service.validateCoupon({
        code: 'SAVE20',
        purchase_amount: 30,
      });

      expect(result.valid).toBe(false);
      expect(result.message).toContain('Minimum purchase amount');
    });
  });

  describe('calculateDiscount', () => {
    it('should calculate percentage discount correctly', () => {
      const coupon = { ...mockCoupon, type: CouponType.PERCENTAGE, value: '20' } as Coupon;
      const discount = service.calculateDiscount(coupon, 100);

      expect(discount).toBe(20);
    });

    it('should apply max discount cap for percentage', () => {
      const coupon = {
        ...mockCoupon,
        type: CouponType.PERCENTAGE,
        value: '50',
        max_discount_amount: '10',
      } as Coupon;
      const discount = service.calculateDiscount(coupon, 100);

      expect(discount).toBe(10);
    });

    it('should calculate fixed discount correctly', () => {
      const coupon = { ...mockCoupon, type: CouponType.FIXED, value: '15' } as Coupon;
      const discount = service.calculateDiscount(coupon, 100);

      expect(discount).toBe(15);
    });

    it('should not exceed purchase amount', () => {
      const coupon = { ...mockCoupon, type: CouponType.FIXED, value: '150' } as Coupon;
      const discount = service.calculateDiscount(coupon, 100);

      expect(discount).toBe(100);
    });
  });

  describe('incrementUsage', () => {
    it('should increment coupon usage', async () => {
      mockRepository.increment.mockResolvedValue(undefined);

      await service.incrementUsage(1);

      expect(mockRepository.increment).toHaveBeenCalledWith({ id: 1 }, 'current_usage', 1);
    });
  });

  describe('applyCoupon', () => {
    it('should apply a valid coupon and increment usage', async () => {
      mockRepository.findOne.mockResolvedValue(mockCoupon);
      mockRepository.increment.mockResolvedValue(undefined);

      const discount = await service.applyCoupon('SAVE20', null, 100);

      expect(discount).toBe(20);
      expect(mockRepository.increment).toHaveBeenCalled();
    });

    it('should throw BadRequestException for invalid coupon', async () => {
      const inactiveCoupon = { ...mockCoupon, active: false };
      mockRepository.findOne.mockResolvedValue(inactiveCoupon);

      await expect(service.applyCoupon('SAVE20', null, 100)).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});
