import { Test, TestingModule } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { AdminShopController } from './admin-shop.controller';
import { ShopService } from './shop.service';
import { AuditTrailService } from '../audit-trail/audit-trail.service';
import { AuditTrailInterceptor, AUDIT_ACTION_KEY } from '../audit-trail/audit-trail.interceptor';
import { AuditAction } from '../audit-trail/entities/audit-trail.entity';
import { UpdateShopPriceDto } from './dto/update-shop-price.dto';
import { UpdateShopItemStatusDto } from './dto/update-shop-item-status.dto';
import { BulkUpdateShopItemsDto } from './dto/bulk-update-shop-items.dto';
import { ShopItemType } from './enums/shop-item-type.enum';

describe('AdminShopController', () => {
  let controller: AdminShopController;
  let service: ShopService;

  const mockShopItem = {
    id: 1,
    name: 'Test Item',
    description: 'Test Description',
    type: ShopItemType.COSMETIC,
    price: '99.99',
    currency: 'USD',
    active: true,
    images: [],
    created_at: new Date(),
    updated_at: new Date(),
  };

  const mockShopService = {
    update: jest.fn().mockResolvedValue(mockShopItem),
    bulkUpdate: jest.fn().mockResolvedValue([mockShopItem]),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminShopController],
      providers: [
        {
          provide: ShopService,
          useValue: mockShopService,
        },
        // --- AuditTrailInterceptor Mock Pattern ---
        // Controllers using @UseInterceptors(AuditTrailInterceptor) must always provide
        // AuditTrailService and Reflector in their testing modules. Even though
        // unit tests often bypass interceptors (by calling methods directly), providing
        // these ensures NestJS dependency injection works smoothly during test compilation
        // and when instantiating the controller for e2e/integration specs.
        // ----------------------------------------
        { provide: AuditTrailService, useValue: { log: jest.fn() } },
        { provide: Reflector, useValue: { get: jest.fn() } },
      ],
    }).compile();

    controller = module.get<AdminShopController>(AdminShopController);
    service = module.get<ShopService>(ShopService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('AuditTrailInterceptor mock pattern & decorators', () => {
    it('should have AuditTrailInterceptor applied to the controller', () => {
      const interceptors = Reflect.getMetadata(
        '__interceptors__',
        AdminShopController,
      );
      expect(interceptors).toContain(AuditTrailInterceptor);
    });

    it('should apply @AuditLog decorator with correct AuditAction to all state-mutating endpoints', () => {
      const endpoints = [
        controller.updatePrice,
        controller.updateStatus,
        controller.bulkUpdate,
        controller.uploadImages,
      ];

      for (const endpoint of endpoints) {
        const action = Reflect.getMetadata(AUDIT_ACTION_KEY, endpoint);
        expect(action).toBe(AuditAction.SHOP_ITEM_UPDATED);
      }
    });
  });

  describe('updatePrice', () => {
    it('should update the price of a shop item', async () => {
      const updatePriceDto: UpdateShopPriceDto = {
        price: 149.99,
        currency: 'USD',
      };

      const result = await controller.updatePrice(1, updatePriceDto);

      expect(service.update).toHaveBeenCalledWith(1, {
        price: 149.99,
        currency: 'USD',
      });
      expect(result).toEqual(mockShopItem);
    });

    it('should handle missing currency in update price', async () => {
      const updatePriceDto: UpdateShopPriceDto = {
        price: 149.99,
      };

      await controller.updatePrice(1, updatePriceDto);

      expect(service.update).toHaveBeenCalledWith(1, {
        price: 149.99,
        currency: undefined,
      });
    });
  });

  describe('updateStatus', () => {
    it('should update the active status of a shop item', async () => {
      const updateStatusDto: UpdateShopItemStatusDto = {
        isActive: false,
      };

      const result = await controller.updateStatus(1, updateStatusDto);

      expect(service.update).toHaveBeenCalledWith(1, {
        active: false,
      });
      expect(result).toEqual(mockShopItem);
    });
  });

  describe('bulkUpdate', () => {
    it('should bulk update multiple shop items', async () => {
      const bulkUpdateDto: BulkUpdateShopItemsDto = {
        items: [
          { id: 1, price: 149.99 },
          { id: 2, active: false },
          { id: 3, price: 199.99, active: true },
        ],
      };

      const result = await controller.bulkUpdate(bulkUpdateDto);

      expect(service.bulkUpdate).toHaveBeenCalledWith(bulkUpdateDto.items);
      expect(result).toEqual([mockShopItem]);
    });

    // Empty/oversized batch rejection (400) is enforced by
    // BulkUpdateShopItemsDto validation and ShopService.bulkUpdate —
    // see shop-dto-validation.spec.ts and shop.service.spec.ts.
  });

  describe('uploadImages', () => {
    it('should upload images for a shop item', async () => {
      const mockFiles: Express.Multer.File[] = [
        {
          filename: 'test-1.jpg',
          originalname: 'test-1.jpg',
          mimetype: 'image/jpeg',
          size: 1024,
          destination: './uploads/shop-items',
        } as Express.Multer.File,
        {
          filename: 'test-2.jpg',
          originalname: 'test-2.jpg',
          mimetype: 'image/jpeg',
          size: 2048,
          destination: './uploads/shop-items',
        } as Express.Multer.File,
      ];

      const result = await controller.uploadImages(1, mockFiles);

      expect(service.update).toHaveBeenCalledWith(1, {
        images: [
          '/uploads/shop-items/test-1.jpg',
          '/uploads/shop-items/test-2.jpg',
        ],
      });
      expect(result).toEqual(mockShopItem);
    });

    it('should handle single image upload', async () => {
      const mockFile: Express.Multer.File[] = [
        {
          filename: 'single-image.jpg',
          originalname: 'single-image.jpg',
          mimetype: 'image/jpeg',
          size: 1024,
          destination: './uploads/shop-items',
        } as Express.Multer.File,
      ];

      await controller.uploadImages(1, mockFile);

      expect(service.update).toHaveBeenCalledWith(1, {
        images: ['/uploads/shop-items/single-image.jpg'],
      });
    });

    it('should handle no files uploaded', async () => {
      const mockFiles: Express.Multer.File[] = [];

      await controller.uploadImages(1, mockFiles);

      expect(service.update).toHaveBeenCalledWith(1, {
        images: [],
      });
    });
  });
});
