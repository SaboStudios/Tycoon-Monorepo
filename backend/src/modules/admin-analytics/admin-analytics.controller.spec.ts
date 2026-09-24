import { Test, TestingModule } from '@nestjs/testing';
import { AdminAnalyticsController } from './admin-analytics.controller';
import { AdminAnalyticsService } from './admin-analytics.service';

describe('AdminAnalyticsController', () => {
  let controller: AdminAnalyticsController;
  let service: AdminAnalyticsService;

  const mockAnalyticsService = {
    getDashboardAnalytics: jest.fn(),
    getTotalUsers: jest.fn(),
    getActiveUsers: jest.fn(),
    getTotalGames: jest.fn(),
    getTotalGamePlayers: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminAnalyticsController],
      providers: [
        {
          provide: AdminAnalyticsService,
          useValue: mockAnalyticsService,
        },
      ],
    }).compile();

    controller = module.get<AdminAnalyticsController>(AdminAnalyticsController);
    service = module.get<AdminAnalyticsService>(AdminAnalyticsService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getDashboardAnalytics', () => {
    it('should return dashboard analytics', async () => {
      const mockData = {
        totalUsers: 100,
        activeUsers: 50,
        totalGames: 200,
        totalGamePlayers: 400,
      };

      mockAnalyticsService.getDashboardAnalytics.mockResolvedValue(mockData);

      const result = await controller.getDashboardAnalytics();

      expect(result).toEqual(mockData);
      expect(service.getDashboardAnalytics).toHaveBeenCalled();
    });
  });

  describe('getTotalUsers', () => {
    it('should return total users count', async () => {
      mockAnalyticsService.getTotalUsers.mockResolvedValue(100);

      const result = await controller.getTotalUsers();

      expect(result).toEqual({ totalUsers: 100 });
      expect(service.getTotalUsers).toHaveBeenCalled();
    });
  });

  describe('getActiveUsers', () => {
    it('should return active users count', async () => {
      mockAnalyticsService.getActiveUsers.mockResolvedValue(50);

      const result = await controller.getActiveUsers();

      expect(result).toEqual({ activeUsers: 50 });
      expect(service.getActiveUsers).toHaveBeenCalled();
    });
  });

  describe('getTotalGames', () => {
    it('should return total games count', async () => {
      mockAnalyticsService.getTotalGames.mockResolvedValue(200);

      const result = await controller.getTotalGames();

      expect(result).toEqual({ totalGames: 200 });
      expect(service.getTotalGames).toHaveBeenCalled();
    });
  });

  describe('getTotalGamePlayers', () => {
    it('should return total game players count', async () => {
      mockAnalyticsService.getTotalGamePlayers.mockResolvedValue(400);

      const result = await controller.getTotalGamePlayers();

      expect(result).toEqual({ totalGamePlayers: 400 });
      expect(service.getTotalGamePlayers).toHaveBeenCalled();
    });
  });
});
