import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
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

  const mockQb: Record<string, never> = {};
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
        {
          provide: getRepositoryToken(GamePlayer),
          useValue: mockGamePlayerRepo,
        },
        { provide: PaginationService, useValue: mockPaginationService },
      ],
    }).compile();

    service = module.get<AdminAnalyticsService>(AdminAnalyticsService);
  });

  afterEach(() => jest.clearAllMocks());

  const getLogger = () => (service as unknown as { logger: Logger }).logger;

  it('should be defined', () => expect(service).toBeDefined());

  // ── observability: logger is wired ────────────────────────────────────────
  it('should have a Logger instance', () => {
    expect(getLogger()).toBeInstanceOf(Logger);
  });

  describe('getTotalUsers', () => {
    it('returns count and logs debug', async () => {
      mockUserRepo.count.mockResolvedValue(100);
      const debugSpy = jest.spyOn(getLogger(), 'debug').mockImplementation();
      expect(await service.getTotalUsers()).toBe(100);
      expect(debugSpy).toHaveBeenCalledWith(expect.stringContaining('100'));
    });
  });

  describe('getActiveUsers', () => {
    it('returns active count filtered by last 30 days and logs debug', async () => {
      mockUserRepo.count.mockResolvedValue(50);
      const debugSpy = jest.spyOn(getLogger(), 'debug').mockImplementation();
      expect(await service.getActiveUsers()).toBe(50);
      const countCalls = mockUserRepo.count.mock.calls as [
        [{ where: { updated_at: { _type: string } } }],
      ];
      const [countArg] = countCalls[0];
      expect(countArg.where.updated_at._type).toBe('moreThan');
      expect(debugSpy).toHaveBeenCalledWith(expect.stringContaining('50'));
    });
  });

  describe('getTotalGames', () => {
    it('returns count and logs debug', async () => {
      mockGameRepo.count.mockResolvedValue(200);
      const debugSpy = jest.spyOn(getLogger(), 'debug').mockImplementation();
      expect(await service.getTotalGames()).toBe(200);
      expect(debugSpy).toHaveBeenCalledWith(expect.stringContaining('200'));
    });
  });

  describe('getTotalGamePlayers', () => {
    it('returns count and logs debug', async () => {
      mockGamePlayerRepo.count.mockResolvedValue(400);
      const debugSpy = jest.spyOn(getLogger(), 'debug').mockImplementation();
      expect(await service.getTotalGamePlayers()).toBe(400);
      expect(debugSpy).toHaveBeenCalledWith(expect.stringContaining('400'));
    });
  });

  describe('getDashboardAnalytics', () => {
    it('returns all analytics and logs summary', async () => {
      mockUserRepo.count.mockResolvedValueOnce(100).mockResolvedValueOnce(50);
      mockGameRepo.count.mockResolvedValue(200);
      mockGamePlayerRepo.count.mockResolvedValue(400);
      const logSpy = jest.spyOn(getLogger(), 'log').mockImplementation();

      const result = await service.getDashboardAnalytics();
      expect(result).toEqual({
        totalUsers: 100,
        activeUsers: 50,
        totalGames: 200,
        totalGamePlayers: 400,
      });
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('dashboard'));
    });
  });

  describe('getPaginatedUsers', () => {
    const mockResult = {
      data: [{ id: 1, email: 'a@b.com' }],
      meta: {
        page: 1,
        limit: 10,
        totalItems: 1,
        totalPages: 1,
        hasNextPage: false,
        hasPreviousPage: false,
      },
    };

    beforeEach(() =>
      mockPaginationService.paginate.mockResolvedValue(mockResult),
    );

    it('calls createQueryBuilder and paginate with correct args', async () => {
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

    it('logs the operation', async () => {
      const logSpy = jest.spyOn(getLogger(), 'log').mockImplementation();
      await service.getPaginatedUsers({
        page: 1,
        limit: 10,
        sortBy: UserSortField.EMAIL,
      });
      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('getPaginatedUsers'),
      );
    });

    it('forwards sortBy and sortOrder', async () => {
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
  });

  describe('getPaginatedGames', () => {
    const mockResult = {
      data: [{ id: 1, code: 'GAME1', status: 'PENDING' }],
      meta: {
        page: 1,
        limit: 10,
        totalItems: 1,
        totalPages: 1,
        hasNextPage: false,
        hasPreviousPage: false,
      },
    };

    beforeEach(() =>
      mockPaginationService.paginate.mockResolvedValue(mockResult),
    );

    it('calls createQueryBuilder and paginate with correct args', async () => {
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

    it('logs the operation', async () => {
      const logSpy = jest.spyOn(getLogger(), 'log').mockImplementation();
      await service.getPaginatedGames({
        page: 1,
        limit: 10,
        sortBy: GameSortField.STATUS,
      });
      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('getPaginatedGames'),
      );
    });
  });
});
