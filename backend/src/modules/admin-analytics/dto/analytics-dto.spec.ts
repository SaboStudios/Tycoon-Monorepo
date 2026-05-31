import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { DashboardAnalyticsDto } from './dashboard-analytics.dto';
import { PaginatedUsersQueryDto, PaginatedGamesQueryDto, UserSortField, GameSortField } from './analytics-query.dto';

describe('DashboardAnalyticsDto validation', () => {
  it('passes with valid non-negative integers', async () => {
    const dto = plainToInstance(DashboardAnalyticsDto, {
      totalUsers: 10, activeUsers: 5, totalGames: 20, totalGamePlayers: 40,
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('fails when a field is negative', async () => {
    const dto = plainToInstance(DashboardAnalyticsDto, {
      totalUsers: -1, activeUsers: 5, totalGames: 20, totalGamePlayers: 40,
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'totalUsers')).toBe(true);
  });

  it('fails when a field is not an integer', async () => {
    const dto = plainToInstance(DashboardAnalyticsDto, {
      totalUsers: 'abc', activeUsers: 5, totalGames: 20, totalGamePlayers: 40,
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'totalUsers')).toBe(true);
  });
});

describe('PaginatedUsersQueryDto validation', () => {
  it('passes with valid sortBy enum value', async () => {
    const dto = plainToInstance(PaginatedUsersQueryDto, { sortBy: UserSortField.EMAIL });
    const errors = await validate(dto);
    expect(errors.filter((e) => e.property === 'sortBy')).toHaveLength(0);
  });

  it('fails with invalid sortBy value', async () => {
    const dto = plainToInstance(PaginatedUsersQueryDto, { sortBy: 'password' });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'sortBy')).toBe(true);
  });

  it('passes without sortBy (optional)', async () => {
    const dto = plainToInstance(PaginatedUsersQueryDto, {});
    const errors = await validate(dto);
    expect(errors.filter((e) => e.property === 'sortBy')).toHaveLength(0);
  });
});

describe('PaginatedGamesQueryDto validation', () => {
  it('passes with valid sortBy enum value', async () => {
    const dto = plainToInstance(PaginatedGamesQueryDto, { sortBy: GameSortField.STATUS });
    const errors = await validate(dto);
    expect(errors.filter((e) => e.property === 'sortBy')).toHaveLength(0);
  });

  it('fails with invalid sortBy value', async () => {
    const dto = plainToInstance(PaginatedGamesQueryDto, { sortBy: 'creator_id' });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'sortBy')).toBe(true);
  });
});
