import { Test, TestingModule } from '@nestjs/testing';
import { ThemeMarketplaceController } from './theme-marketplace.controller';
import { ThemeMarketplaceService } from './theme-marketplace.service';
import { PurchaseThemeDto } from './dto/purchase-theme.dto';

describe('ThemeMarketplaceController', () => {
  let controller: ThemeMarketplaceController;
  let service: ThemeMarketplaceService;

  const mockTheme = {
    id: 'skin-1',
    name: 'Dragon Skin',
    type: 'skin',
    price: 500,
    description: 'Epic dragon-themed skin',
    available: true,
  };

  const mockTransaction = {
    id: 1,
    user_id: 1,
    quantity: 1,
    total_price: '500',
    transaction_id: 'THEME-123-abc',
    metadata: {
      theme_purchase: true,
      skins: [1],
      discount_amount: 0,
    },
  };

  const mockThemeMarketplaceService = {
    purchaseThemes: jest.fn().mockResolvedValue({
      transaction: mockTransaction,
      unlockedThemes: ['skin-1'],
      message: 'Successfully purchased 1 theme(s).',
    }),
    getAvailableThemes: jest.fn().mockResolvedValue([mockTheme]),
    getUserThemeTransactions: jest.fn().mockResolvedValue({
      transactions: [mockTransaction],
      pagination: {
        page: 1,
        limit: 20,
        total: 1,
        pages: 1,
      },
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ThemeMarketplaceController],
      providers: [
        {
          provide: ThemeMarketplaceService,
          useValue: mockThemeMarketplaceService,
        },
      ],
    }).compile();

    controller = module.get<ThemeMarketplaceController>(
      ThemeMarketplaceController,
    );
    service = module.get<ThemeMarketplaceService>(ThemeMarketplaceService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('purchaseThemes', () => {
    it('should purchase themes successfully', async () => {
      const purchaseDto: PurchaseThemeDto = {
        themeIds: ['skin-1'],
      };

      const result = await controller.purchaseThemes(
        { id: 1 },
        purchaseDto,
      );

      expect(service.purchaseThemes).toHaveBeenCalledWith(1, purchaseDto);
      expect(result.unlockedThemes).toContain('skin-1');
      expect(result.message).toContain('Successfully purchased');
    });

    it('should purchase themes with coupon', async () => {
      const purchaseDto: PurchaseThemeDto = {
        themeIds: ['skin-1'],
        couponCode: 'WELCOME20',
      };

      await controller.purchaseThemes({ id: 1 }, purchaseDto);

      expect(service.purchaseThemes).toHaveBeenCalledWith(1, purchaseDto);
    });
  });

  describe('getAvailableThemes', () => {
    it('should return available themes', async () => {
      const result = await controller.getAvailableThemes();

      expect(service.getAvailableThemes).toHaveBeenCalledWith(undefined);
      expect(result.themes).toHaveLength(1);
      expect(result.count).toBe(1);
    });

    it('should filter themes by type', async () => {
      await controller.getAvailableThemes('skin');

      expect(service.getAvailableThemes).toHaveBeenCalledWith('skin');
    });

    it('should filter board themes', async () => {
      await controller.getAvailableThemes('board');

      expect(service.getAvailableThemes).toHaveBeenCalledWith('board');
    });
  });

  describe('getTransactionHistory', () => {
    it('should return user transaction history', async () => {
      const result = await controller.getTransactionHistory({ id: 1 });

      expect(service.getUserThemeTransactions).toHaveBeenCalledWith(1, 1, 20);
      expect(result.transactions).toHaveLength(1);
      expect(result.pagination.page).toBe(1);
    });

    it('should support pagination', async () => {
      await controller.getTransactionHistory({ id: 1 }, 2, 10);

      expect(service.getUserThemeTransactions).toHaveBeenCalledWith(1, 2, 10);
    });
  });
});
