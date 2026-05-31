import { Test, TestingModule } from '@nestjs/testing';
import { AdminAnalyticsController } from './admin-analytics.controller';
import { AdminAnalyticsService } from './admin-analytics.service';
import { PaginatedUsersQueryDto, PaginatedGamesQueryDto } from './dto/analytics-query.dto';

describe('AdminAnalyticsController', () => {
  let controller: AdminAnalyticsController;
  let service: AdminAnalyticsService;

  const mockAnalyticsService = {
    getDashboardAnalytics: jest.fn(),
    getTotalUsers: jest.fn(),
    getActiveUsers: jest.fn(),
    getTotalGames: jest.fn(),
    getTotalGamePlayers: jest.fn(),
    getPaginatedUsers: jest.fn(),
    getPaginatedGames: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminAnalyticsController],
      providers: [{ provide: AdminAnalyticsService, useValue: mockAnalyticsService }],
    }).compile();

    controller = module.get<AdminAnalyticsController>(AdminAnalyticsController);
    service = module.get<AdminAnalyticsService>(AdminAnalyticsService);
  });

  afterEach(() => jest.clearAllMocks());

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getDashboardAnalytics', () => {
    it('should return dashboard analytics', async () => {
      const mockData = { totalUsers: 100, activeUsers: 50, totalGames: 200, totalGamePlayers: 400 };
      mockAnalyticsService.getDashboardAnalytics.mockResolvedValue(mockData);
      expect(await controller.getDashboardAnalytics()).toEqual(mockData);
    });
  });

  describe('getTotalUsers', () => {
    it('should return total users count', async () => {
      mockAnalyticsService.getTotalUsers.mockResolvedValue(100);
      expect(await controller.getTotalUsers()).toEqual({ totalUsers: 100 });
    });
  });

  describe('getActiveUsers', () => {
    it('should return active users count', async () => {
      mockAnalyticsService.getActiveUsers.mockResolvedValue(50);
      expect(await controller.getActiveUsers()).toEqual({ activeUsers: 50 });
    });
  });

  describe('getTotalGames', () => {
    it('should return total games count', async () => {
      mockAnalyticsService.getTotalGames.mockResolvedValue(200);
      expect(await controller.getTotalGames()).toEqual({ totalGames: 200 });
    });
  });

  describe('getTotalGamePlayers', () => {
    it('should return total game players count', async () => {
      mockAnalyticsService.getTotalGamePlayers.mockResolvedValue(400);
      expect(await controller.getTotalGamePlayers()).toEqual({ totalGamePlayers: 400 });
    });
  });

  describe('getPaginatedUsers', () => {
    it('should return paginated users', async () => {
      const mockResult = {
        data: [{ id: 1, email: 'a@b.com' }],
        meta: { page: 1, limit: 10, totalItems: 1, totalPages: 1, hasNextPage: false, hasPreviousPage: false },
      };
      mockAnalyticsService.getPaginatedUsers.mockResolvedValue(mockResult);

      const query: PaginatedUsersQueryDto = { page: 1, limit: 10 };
      const result = await controller.getPaginatedUsers(query);

      expect(result).toEqual(mockResult);
      expect(service.getPaginatedUsers).toHaveBeenCalledWith(query);
    });

    it('should pass query params through to service', async () => {
      mockAnalyticsService.getPaginatedUsers.mockResolvedValue({ data: [], meta: {} });
      const query: PaginatedUsersQueryDto = { page: 2, limit: 5, search: 'bob' };
      await controller.getPaginatedUsers(query);
      expect(service.getPaginatedUsers).toHaveBeenCalledWith(query);
    });
  });

  describe('getPaginatedGames', () => {
    it('should return paginated games', async () => {
      const mockResult = {
        data: [{ id: 1, code: 'GAME1' }],
        meta: { page: 1, limit: 10, totalItems: 1, totalPages: 1, hasNextPage: false, hasPreviousPage: false },
      };
      mockAnalyticsService.getPaginatedGames.mockResolvedValue(mockResult);

      const query: PaginatedGamesQueryDto = { page: 1, limit: 10 };
      const result = await controller.getPaginatedGames(query);

      expect(result).toEqual(mockResult);
      expect(service.getPaginatedGames).toHaveBeenCalledWith(query);
    });

    it('should pass query params through to service', async () => {
      mockAnalyticsService.getPaginatedGames.mockResolvedValue({ data: [], meta: {} });
      const query: PaginatedGamesQueryDto = { page: 3, limit: 25 };
      await controller.getPaginatedGames(query);
      expect(service.getPaginatedGames).toHaveBeenCalledWith(query);
    });
  });
});
