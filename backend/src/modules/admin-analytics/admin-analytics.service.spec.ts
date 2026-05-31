import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AdminAnalyticsService } from './admin-analytics.service';
import { User } from '../users/entities/user.entity';
import { Game } from '../games/entities/game.entity';
import { GamePlayer } from '../games/entities/game-player.entity';
import { PaginationService } from '../../common/services/pagination.service';
import {
  PaginatedUsersQueryDto,
  PaginatedGamesQueryDto,
  UserSortField,
  GameSortField,
} from './dto/analytics-query.dto';
import { SortOrder } from '../../common/dto/pagination.dto';

describe('AdminAnalyticsService', () => {
  let service: AdminAnalyticsService;

  const mockQb = {} as any;

  const mockUserRepo = {
    count: jest.fn(),
    createQueryBuilder: jest.fn().mockReturnValue(mockQb),
  };

  const mockGameRepo = {
    count: jest.fn(),
    createQueryBuilder: jest.fn().mockReturnValue(mockQb),
  };

  const mockGamePlayerRepo = { count: jest.fn() };

  const mockPaginationService = { paginate: jest.fn() };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminAnalyticsService,
        { provide: getRepositoryToken(User), useValue: mockUserRepo },
        { provide: getRepositoryToken(Game), useValue: mockGameRepo },
        { provide: getRepositoryToken(GamePlayer), useValue: mockGamePlayerRepo },
        { provide: PaginationService, useValue: mockPaginationService },
      ],
    }).compile();

    service = module.get<AdminAnalyticsService>(AdminAnalyticsService);
  });

  afterEach(() => jest.clearAllMocks());

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getTotalUsers', () => {
    it('should return total users count', async () => {
      mockUserRepo.count.mockResolvedValue(100);
      expect(await service.getTotalUsers()).toBe(100);
    });
  });

  describe('getActiveUsers', () => {
    it('should return active users count filtered by last 30 days', async () => {
      mockUserRepo.count.mockResolvedValue(50);
      const result = await service.getActiveUsers();
      expect(result).toBe(50);
      expect(mockUserRepo.count).toHaveBeenCalledWith({
        where: {
          updated_at: expect.objectContaining({ _type: 'moreThan' }),
        },
      });
    });
  });

  describe('getTotalGames', () => {
    it('should return total games count', async () => {
      mockGameRepo.count.mockResolvedValue(200);
      expect(await service.getTotalGames()).toBe(200);
    });
  });

  describe('getTotalGamePlayers', () => {
    it('should return total game players count', async () => {
      mockGamePlayerRepo.count.mockResolvedValue(400);
      expect(await service.getTotalGamePlayers()).toBe(400);
    });
  });

  describe('getDashboardAnalytics', () => {
    it('should return all analytics data', async () => {
      mockUserRepo.count.mockResolvedValueOnce(100).mockResolvedValueOnce(50);
      mockGameRepo.count.mockResolvedValue(200);
      mockGamePlayerRepo.count.mockResolvedValue(400);

      const result = await service.getDashboardAnalytics();
      expect(result).toEqual({
        totalUsers: 100,
        activeUsers: 50,
        totalGames: 200,
        totalGamePlayers: 400,
      });
    });
  });

  describe('getPaginatedUsers', () => {
    const mockResult = {
      data: [{ id: 1, email: 'a@b.com' }],
      meta: { page: 1, limit: 10, totalItems: 1, totalPages: 1, hasNextPage: false, hasPreviousPage: false },
    };

    beforeEach(() => mockPaginationService.paginate.mockResolvedValue(mockResult));

    it('should call createQueryBuilder and paginate with correct args', async () => {
      const query: PaginatedUsersQueryDto = { page: 1, limit: 10 };
      const result = await service.getPaginatedUsers(query);

      expect(mockUserRepo.createQueryBuilder).toHaveBeenCalledWith('user');
      expect(mockPaginationService.paginate).toHaveBeenCalledWith(
        mockQb,
        query,
        ['email', 'firstName', 'lastName', 'username'],
        ['id', 'email', 'created_at', 'games_played', 'game_won'],
      );
      expect(result).toEqual(mockResult);
    });

    it('should forward sortBy and sortOrder', async () => {
      const query: PaginatedUsersQueryDto = {
        page: 1,
        limit: 5,
        sortBy: UserSortField.GAMES_PLAYED,
        sortOrder: SortOrder.ASC,
      };
      await service.getPaginatedUsers(query);
      expect(mockPaginationService.paginate).toHaveBeenCalledWith(
        mockQb,
        query,
        expect.any(Array),
        expect.any(Array),
      );
    });

    it('should forward search term', async () => {
      const query: PaginatedUsersQueryDto = { page: 1, limit: 10, search: 'alice' };
      await service.getPaginatedUsers(query);
      expect(mockPaginationService.paginate).toHaveBeenCalledWith(
        mockQb,
        query,
        ['email', 'firstName', 'lastName', 'username'],
        expect.any(Array),
      );
    });
  });

  describe('getPaginatedGames', () => {
    const mockResult = {
      data: [{ id: 1, code: 'GAME1', status: 'PENDING' }],
      meta: { page: 1, limit: 10, totalItems: 1, totalPages: 1, hasNextPage: false, hasPreviousPage: false },
    };

    beforeEach(() => mockPaginationService.paginate.mockResolvedValue(mockResult));

    it('should call createQueryBuilder and paginate with correct args', async () => {
      const query: PaginatedGamesQueryDto = { page: 1, limit: 10 };
      const result = await service.getPaginatedGames(query);

      expect(mockGameRepo.createQueryBuilder).toHaveBeenCalledWith('game');
      expect(mockPaginationService.paginate).toHaveBeenCalledWith(
        mockQb,
        query,
        ['code', 'status', 'mode'],
        ['id', 'status', 'created_at', 'mode'],
      );
      expect(result).toEqual(mockResult);
    });

    it('should forward sortBy and sortOrder', async () => {
      const query: PaginatedGamesQueryDto = {
        page: 2,
        limit: 20,
        sortBy: GameSortField.STATUS,
        sortOrder: SortOrder.ASC,
      };
      await service.getPaginatedGames(query);
      expect(mockPaginationService.paginate).toHaveBeenCalledWith(
        mockQb,
        query,
        expect.any(Array),
        expect.any(Array),
      );
    });
  });
});
