import { GUARDS_METADATA } from '@nestjs/common/constants';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { IDEMPOTENT_KEY } from '../../common/decorators/idempotent.decorator';
import { PaginationService } from '../../common/services/pagination.service';
import { AdminGuard } from '../auth/guards/admin.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GamePlayer } from '../games/entities/game-player.entity';
import { Game } from '../games/entities/game.entity';
import { User } from '../users/entities/user.entity';
import { AdminAnalyticsController } from './admin-analytics.controller';
import { AdminAnalyticsService } from './admin-analytics.service';
import {
  PaginatedGamesQueryDto,
  PaginatedUsersQueryDto,
} from './dto/analytics-query.dto';

const paginated = (data: unknown[] = []) => ({
  data,
  meta: {
    page: 1,
    limit: 10,
    totalItems: data.length,
    totalPages: data.length ? 1 : 0,
    hasNextPage: false,
    hasPreviousPage: false,
  },
});

describe('AdminAnalytics idempotency and replay behavior (#862)', () => {
  let controller: AdminAnalyticsController;
  let service: AdminAnalyticsService;

  const mockUserRepo = {
    count: jest.fn(),
    createQueryBuilder: jest.fn(),
  };
  const mockGameRepo = {
    count: jest.fn(),
    createQueryBuilder: jest.fn(),
  };
  const mockGamePlayerRepo = {
    count: jest.fn(),
  };
  const mockPaginationService = {
    paginate: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminAnalyticsController],
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

    controller = module.get<AdminAnalyticsController>(AdminAnalyticsController);
    service = module.get<AdminAnalyticsService>(AdminAnalyticsService);
  });

  afterEach(() => jest.clearAllMocks());

  it('confirms admin-analytics currently exposes only read-only endpoints', () => {
    const routeNames = [
      'getDashboardAnalytics',
      'getTotalUsers',
      'getActiveUsers',
      'getPaginatedUsers',
      'getTotalGames',
      'getTotalGamePlayers',
      'getPaginatedGames',
    ] as const;

    routeNames.forEach((routeName) => {
      expect(
        Reflect.getMetadata(
          IDEMPOTENT_KEY,
          AdminAnalyticsController.prototype[routeName],
        ),
      ).toBeUndefined();
    });
  });

  it('keeps JwtAuthGuard and AdminGuard on the controller', () => {
    const guards = Reflect.getMetadata(
      GUARDS_METADATA,
      AdminAnalyticsController,
    ) as unknown[];

    expect(guards).toEqual([JwtAuthGuard, AdminGuard]);
  });

  it('processes the first dashboard analytics request normally', async () => {
    mockUserRepo.count.mockResolvedValueOnce(10).mockResolvedValueOnce(4);
    mockGameRepo.count.mockResolvedValue(6);
    mockGamePlayerRepo.count.mockResolvedValue(18);

    await expect(controller.getDashboardAnalytics()).resolves.toEqual({
      totalUsers: 10,
      activeUsers: 4,
      totalGames: 6,
      totalGamePlayers: 18,
    });
  });

  it('replays a same-input read request structurally by returning the same response shape', async () => {
    mockUserRepo.count
      .mockResolvedValueOnce(10)
      .mockResolvedValueOnce(4)
      .mockResolvedValueOnce(10)
      .mockResolvedValueOnce(4);
    mockGameRepo.count.mockResolvedValue(6);
    mockGamePlayerRepo.count.mockResolvedValue(18);

    const first = await controller.getDashboardAnalytics();
    const replay = await controller.getDashboardAnalytics();

    expect(replay).toEqual(first);
    expect(mockUserRepo.count).toHaveBeenCalledTimes(4);
    expect(mockGameRepo.count).toHaveBeenCalledTimes(2);
    expect(mockGamePlayerRepo.count).toHaveBeenCalledTimes(2);
  });

  it('allows changed query parameters to execute independently', async () => {
    const firstQuery: PaginatedUsersQueryDto = { page: 1, limit: 10 };
    const changedQuery: PaginatedUsersQueryDto = {
      page: 2,
      limit: 10,
      search: 'bob',
    };
    const firstResult = paginated([{ id: 1, email: 'a@test.com' }]);
    const changedResult = paginated([{ id: 2, email: 'bob@test.com' }]);
    mockUserRepo.createQueryBuilder.mockReturnValue({});
    mockPaginationService.paginate
      .mockResolvedValueOnce(firstResult)
      .mockResolvedValueOnce(changedResult);

    await expect(controller.getPaginatedUsers(firstQuery)).resolves.toEqual(
      firstResult,
    );
    await expect(controller.getPaginatedUsers(changedQuery)).resolves.toEqual(
      changedResult,
    );
    expect(mockPaginationService.paginate).toHaveBeenNthCalledWith(
      2,
      expect.any(Object),
      changedQuery,
      expect.any(Array),
      expect.any(Array),
    );
  });

  it('handles missing idempotency key according to read-only route rules', async () => {
    mockUserRepo.count.mockResolvedValue(3);

    await expect(controller.getTotalUsers()).resolves.toEqual({
      totalUsers: 3,
    });
  });

  it('propagates stale or disconnected data state without caching a successful replay', async () => {
    mockGameRepo.count.mockRejectedValueOnce(new Error('DB connection lost'));
    mockGameRepo.count.mockResolvedValueOnce(7);

    await expect(controller.getTotalGames()).rejects.toThrow(
      'DB connection lost',
    );
    await expect(controller.getTotalGames()).resolves.toEqual({
      totalGames: 7,
    });
    expect(mockGameRepo.count).toHaveBeenCalledTimes(2);
  });

  it('does not store a successful replay response when the service fails', async () => {
    mockUserRepo.createQueryBuilder.mockReturnValue({});
    mockPaginationService.paginate.mockRejectedValueOnce(
      new Error('invalid sort field'),
    );
    mockPaginationService.paginate.mockResolvedValueOnce(
      paginated([{ id: 1 }]),
    );

    const query: PaginatedUsersQueryDto = { page: 1, limit: 10 };

    await expect(controller.getPaginatedUsers(query)).rejects.toThrow(
      'invalid sort field',
    );
    await expect(controller.getPaginatedUsers(query)).resolves.toEqual(
      paginated([{ id: 1 }]),
    );
    expect(mockPaginationService.paginate).toHaveBeenCalledTimes(2);
  });

  it('replays empty analytics results without changing the empty response', async () => {
    const query: PaginatedGamesQueryDto = { page: 1, limit: 10 };
    const emptyResult = paginated();
    mockGameRepo.createQueryBuilder.mockReturnValue({});
    mockPaginationService.paginate
      .mockResolvedValueOnce(emptyResult)
      .mockResolvedValueOnce(emptyResult);

    const first = await service.getPaginatedGames(query);
    const replay = await service.getPaginatedGames(query);

    expect(replay).toEqual(first);
    expect(replay.data).toEqual([]);
  });
});
