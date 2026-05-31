/**
 * admin-analytics — idempotency and replay tests (#862)
 *
 * All admin-analytics endpoints are GET (read-only). Idempotency is therefore
 * structural: repeated calls with identical inputs must return identical
 * outputs and must never mutate state.
 *
 * Covers:
 *  - Repeated calls to every service method return the same value.
 *  - Concurrent calls resolve independently without cross-contamination.
 *  - Stale / disconnected repo (rejected promise) surfaces as a thrown error,
 *    not silent data corruption.
 *  - Paginated endpoints are stable: same query params → same page shape.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AdminAnalyticsService } from './admin-analytics.service';
import { User } from '../users/entities/user.entity';
import { Game } from '../games/entities/game.entity';
import { GamePlayer } from '../games/entities/game-player.entity';
import { PaginationService } from '../../common/services/pagination.service';
import { PaginatedUsersQueryDto, PaginatedGamesQueryDto } from './dto/analytics-query.dto';

const PAGINATED_RESULT = {
  data: [{ id: 1 }],
  meta: { page: 1, limit: 10, totalItems: 1, totalPages: 1, hasNextPage: false, hasPreviousPage: false },
};

describe('AdminAnalyticsService — idempotency and replay', () => {
  let service: AdminAnalyticsService;

  const mockUserRepo = { count: jest.fn(), createQueryBuilder: jest.fn() };
  const mockGameRepo = { count: jest.fn(), createQueryBuilder: jest.fn() };
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

  // ── repeated calls return identical results ──────────────────────────────

  it('getTotalUsers: repeated calls return the same value', async () => {
    mockUserRepo.count.mockResolvedValue(42);
    const [a, b] = await Promise.all([service.getTotalUsers(), service.getTotalUsers()]);
    expect(a).toBe(42);
    expect(b).toBe(42);
  });

  it('getActiveUsers: repeated calls return the same value', async () => {
    mockUserRepo.count.mockResolvedValue(10);
    const [a, b] = await Promise.all([service.getActiveUsers(), service.getActiveUsers()]);
    expect(a).toBe(10);
    expect(b).toBe(10);
  });

  it('getTotalGames: repeated calls return the same value', async () => {
    mockGameRepo.count.mockResolvedValue(5);
    const [a, b] = await Promise.all([service.getTotalGames(), service.getTotalGames()]);
    expect(a).toBe(5);
    expect(b).toBe(5);
  });

  it('getTotalGamePlayers: repeated calls return the same value', async () => {
    mockGamePlayerRepo.count.mockResolvedValue(20);
    const [a, b] = await Promise.all([service.getTotalGamePlayers(), service.getTotalGamePlayers()]);
    expect(a).toBe(20);
    expect(b).toBe(20);
  });

  it('getDashboardAnalytics: repeated calls return identical shape', async () => {
    mockUserRepo.count.mockResolvedValue(100);
    mockGameRepo.count.mockResolvedValue(50);
    mockGamePlayerRepo.count.mockResolvedValue(200);

    const [a, b] = await Promise.all([
      service.getDashboardAnalytics(),
      service.getDashboardAnalytics(),
    ]);
    expect(a).toEqual(b);
  });

  // ── no state mutation between calls ─────────────────────────────────────

  it('getDashboardAnalytics: does not mutate shared state across calls', async () => {
    mockUserRepo.count.mockResolvedValue(7);
    mockGameRepo.count.mockResolvedValue(3);
    mockGamePlayerRepo.count.mockResolvedValue(12);

    const first = await service.getDashboardAnalytics();
    const second = await service.getDashboardAnalytics();
    expect(first).toEqual(second);
    // Verify repo was called fresh each time (no cached mutation)
    expect(mockUserRepo.count).toHaveBeenCalledTimes(4); // 2 calls × (totalUsers + activeUsers)
  });

  // ── paginated endpoints are stable ───────────────────────────────────────

  it('getPaginatedUsers: same query params produce identical response', async () => {
    const mockQb = {} as any;
    mockUserRepo.createQueryBuilder.mockReturnValue(mockQb);
    mockPaginationService.paginate.mockResolvedValue(PAGINATED_RESULT);

    const query: PaginatedUsersQueryDto = { page: 1, limit: 10 };
    const [a, b] = await Promise.all([
      service.getPaginatedUsers(query),
      service.getPaginatedUsers(query),
    ]);
    expect(a).toEqual(b);
    expect(a).toEqual(PAGINATED_RESULT);
  });

  it('getPaginatedGames: same query params produce identical response', async () => {
    const mockQb = {} as any;
    mockGameRepo.createQueryBuilder.mockReturnValue(mockQb);
    mockPaginationService.paginate.mockResolvedValue(PAGINATED_RESULT);

    const query: PaginatedGamesQueryDto = { page: 2, limit: 5 };
    const [a, b] = await Promise.all([
      service.getPaginatedGames(query),
      service.getPaginatedGames(query),
    ]);
    expect(a).toEqual(b);
  });

  // ── stale / disconnected repo surfaces as error, not silent corruption ───

  it('getTotalUsers: propagates repo error without swallowing it', async () => {
    mockUserRepo.count.mockRejectedValue(new Error('DB connection lost'));
    await expect(service.getTotalUsers()).rejects.toThrow('DB connection lost');
  });

  it('getTotalGames: propagates repo error without swallowing it', async () => {
    mockGameRepo.count.mockRejectedValue(new Error('DB timeout'));
    await expect(service.getTotalGames()).rejects.toThrow('DB timeout');
  });

  it('getDashboardAnalytics: propagates any inner error', async () => {
    mockUserRepo.count.mockRejectedValue(new Error('stale connection'));
    await expect(service.getDashboardAnalytics()).rejects.toThrow('stale connection');
  });

  it('getPaginatedUsers: propagates pagination error', async () => {
    const mockQb = {} as any;
    mockUserRepo.createQueryBuilder.mockReturnValue(mockQb);
    mockPaginationService.paginate.mockRejectedValue(new Error('invalid sort field'));
    await expect(service.getPaginatedUsers({ page: 1, limit: 10 })).rejects.toThrow('invalid sort field');
  });
});
