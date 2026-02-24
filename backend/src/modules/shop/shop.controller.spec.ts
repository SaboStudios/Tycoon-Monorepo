import { Test, TestingModule } from '@nestjs/testing';
import { ShopController } from './shop.controller';
import { ShopService } from './shop.service';
import { PurchaseAndGiftDto } from './dto/purchase-and-gift.dto';

describe('ShopController', () => {
  let controller: ShopController;
  let service: ShopService;

  const mockShopService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
    purchaseAndGift: jest.fn(),
    getPurchaseHistory: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ShopController],
      providers: [
        {
          provide: ShopService,
          useValue: mockShopService,
        },
      ],
    }).compile();

    controller = module.get<ShopController>(ShopController);
    service = module.get<ShopService>(ShopService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('purchaseAndGift', () => {
    it('should purchase and gift an item', async () => {
      const user = { id: 1 };
      const dto: PurchaseAndGiftDto = {
        shop_item_id: 1,
        receiver_id: 2,
        quantity: 1,
        message: 'Happy birthday!',
      };

      const mockResult = {
        purchase: {
          id: 1,
          user_id: 1,
          shop_item_id: 1,
          quantity: 1,
          total_price: '9.99',
        },
        gift: {
          id: 1,
          sender_id: 1,
          receiver_id: 2,
          shop_item_id: 1,
          status: 'pending',
        },
      };

      mockShopService.purchaseAndGift.mockResolvedValue(mockResult);

      const result = await controller.purchaseAndGift(user, dto);

      expect(result).toEqual(mockResult);
      expect(service.purchaseAndGift).toHaveBeenCalledWith(user.id, dto);
    });
  });

  describe('getPurchaseHistory', () => {
    it('should return purchase history', async () => {
      const user = { id: 1 };
      const mockHistory = {
        data: [],
        meta: { page: 1, limit: 20, total: 0, totalPages: 0 },
      };

      mockShopService.getPurchaseHistory.mockResolvedValue(mockHistory);

      const result = await controller.getPurchaseHistory(user, 1, 20);

      expect(result).toEqual(mockHistory);
      expect(service.getPurchaseHistory).toHaveBeenCalledWith(user.id, 1, 20);
    });
  });
});
