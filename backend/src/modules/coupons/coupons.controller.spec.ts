import { Test, TestingModule } from '@nestjs/testing';
import { CouponsController } from './coupons.controller';
import { CouponsService } from './coupons.service';
import { CouponType } from './enums/coupon-type.enum';

describe('CouponsController', () => {
  let controller: CouponsController;
  let service: CouponsService;

  const mockCoupon = {
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

  const mockCouponsService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
    validateCoupon: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CouponsController],
      providers: [
        {
          provide: CouponsService,
          useValue: mockCouponsService,
        },
      ],
    }).compile();

    controller = module.get<CouponsController>(CouponsController);
    service = module.get<CouponsService>(CouponsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('should create a coupon', async () => {
      const createDto = {
        code: 'SAVE20',
        type: CouponType.PERCENTAGE,
        value: 20,
        max_uses: 100,
        active: true,
      };

      mockCouponsService.create.mockResolvedValue(mockCoupon);

      const result = await controller.create(createDto);

      expect(result).toEqual(mockCoupon);
      expect(service.create).toHaveBeenCalledWith(createDto);
    });
  });

  describe('findAll', () => {
    it('should return paginated coupons', async () => {
      const paginatedResult = {
        data: [mockCoupon],
        meta: {
          page: 1,
          limit: 20,
          total: 1,
          totalPages: 1,
        },
      };

      mockCouponsService.findAll.mockResolvedValue(paginatedResult);

      const result = await controller.findAll({});

      expect(result).toEqual(paginatedResult);
      expect(service.findAll).toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('should return a single coupon', async () => {
      mockCouponsService.findOne.mockResolvedValue(mockCoupon);

      const result = await controller.findOne(1);

      expect(result).toEqual(mockCoupon);
      expect(service.findOne).toHaveBeenCalledWith(1);
    });
  });

  describe('validate', () => {
    it('should validate a coupon', async () => {
      const validateDto = {
        code: 'SAVE20',
        purchase_amount: 100,
      };

      const validationResult = {
        valid: true,
        message: 'Coupon is valid',
        discount_amount: 20,
        coupon: {
          id: 1,
          code: 'SAVE20',
          type: 'percentage',
          value: '20',
        },
      };

      mockCouponsService.validateCoupon.mockResolvedValue(validationResult);

      const result = await controller.validate(validateDto);

      expect(result).toEqual(validationResult);
      expect(service.validateCoupon).toHaveBeenCalledWith(validateDto);
    });
  });

  describe('update', () => {
    it('should update a coupon', async () => {
      const updateDto = {
        active: false,
      };

      const updatedCoupon = { ...mockCoupon, active: false };
      mockCouponsService.update.mockResolvedValue(updatedCoupon);

      const result = await controller.update(1, updateDto);

      expect(result).toEqual(updatedCoupon);
      expect(service.update).toHaveBeenCalledWith(1, updateDto);
    });
  });

  describe('remove', () => {
    it('should delete a coupon', async () => {
      mockCouponsService.remove.mockResolvedValue(undefined);

      await controller.remove(1);

      expect(service.remove).toHaveBeenCalledWith(1);
    });
  });
});
