import { Test, TestingModule } from "@nestjs/testing";
import { AnalyticsController } from "./analytics.controller";
import { AnalyticsService } from "./analytics.service";

describe("AnalyticsController", () => {
  let controller: AnalyticsController;
  let service: AnalyticsService;

  const mockAnalyticsService = {
    getShopAnalytics: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AnalyticsController],
      providers: [
        {
          provide: AnalyticsService,
          useValue: mockAnalyticsService,
        },
      ],
    }).compile();

    controller = module.get<AnalyticsController>(AnalyticsController);
    service = module.get<AnalyticsService>(AnalyticsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should be defined", () => {
    expect(controller).toBeDefined();
  });

  describe("getShopAnalytics", () => {
    it("should return shop analytics data", async () => {
      const mockData = {
        totalRevenue: 5000,
        popularItems: [
          {
            itemId: "1",
            itemName: "Sword",
            purchaseCount: 100,
            totalRevenue: 2000,
          },
        ],
        conversionRate: 25,
        retentionMetrics: { day1: 80, day7: 60, day30: 40 },
      };

      mockAnalyticsService.getShopAnalytics.mockResolvedValue(mockData);

      const result = await controller.getShopAnalytics();

      expect(result).toEqual(mockData);
      expect(service.getShopAnalytics).toHaveBeenCalledTimes(1);
    });
  });
});
