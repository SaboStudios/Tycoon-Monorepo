/**
 * #873 Module auth — pagination and stable sorting
 *
 * Covers:
 *  - listRefreshTokens returns correct page/limit slices.
 *  - Stable sort: results are ordered by the requested field and direction.
 *  - tokenHash and user relation are stripped from every response item.
 *  - isRevoked filter is applied when provided.
 *  - Meta fields (totalItems, totalPages, hasNextPage, hasPreviousPage) are correct.
 *  - Defaults: page=1, limit=20, sortBy=createdAt, sortOrder=DESC.
 *  - Stale / disconnected states: empty result set is handled gracefully.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';

import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { RefreshToken } from './entities/refresh-token.entity';
import { User } from '../users/entities/user.entity';
import { AuthAuditService } from './audit/auth-audit.service';
import { SortOrder, TokenSortField } from './dto/list-refresh-tokens.dto';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeToken(
  overrides: Partial<RefreshToken> = {},
  index = 0,
): RefreshToken {
  return {
    id: `uuid-${index}`,
    tokenHash: `hash-${index}`,
    userId: 1,
    expiresAt: new Date(Date.now() + 86400_000),
    isRevoked: false,
    createdAt: new Date(Date.now() - index * 1000),
    lastUsedAt: new Date(Date.now() - index * 500),
    ipAddress: '127.0.0.1',
    userAgent: 'test-agent',
    user: {} as User,
    ...overrides,
  } as RefreshToken;
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('AuthService — listRefreshTokens (#873)', () => {
  let service: AuthService;
  let findAndCountMock: jest.Mock;

  beforeEach(async () => {
    findAndCountMock = jest.fn();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: { findByEmail: jest.fn() } },
        {
          provide: JwtService,
          useValue: {
            sign: jest.fn().mockReturnValue('tok'),
            verify: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue(604800) },
        },
        {
          provide: getRepositoryToken(RefreshToken),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            findOne: jest.fn(),
            update: jest.fn(),
            findAndCount: findAndCountMock,
          },
        },
        { provide: getRepositoryToken(User), useValue: { findOne: jest.fn() } },
        { provide: AuthAuditService, useValue: { record: jest.fn() } },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  // -------------------------------------------------------------------------
  // Basic pagination
  // -------------------------------------------------------------------------

  it('returns the correct page slice', async () => {
    const tokens = [makeToken({}, 0), makeToken({}, 1)];
    findAndCountMock.mockResolvedValue([tokens, 25]);

    const result = await service.listRefreshTokens(1, { page: 2, limit: 10 });

    expect(findAndCountMock).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 10, take: 10 }),
    );
    expect(result.meta.page).toBe(2);
    expect(result.meta.limit).toBe(10);
  });

  it('uses defaults when dto fields are omitted', async () => {
    findAndCountMock.mockResolvedValue([[], 0]);

    await service.listRefreshTokens(1, {});

    expect(findAndCountMock).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 0, take: 20 }),
    );
  });

  // -------------------------------------------------------------------------
  // Meta fields
  // -------------------------------------------------------------------------

  it('computes totalPages correctly', async () => {
    findAndCountMock.mockResolvedValue([[], 55]);
    const result = await service.listRefreshTokens(1, { limit: 10 });
    expect(result.meta.totalPages).toBe(6);
  });

  it('hasNextPage is true when not on last page', async () => {
    findAndCountMock.mockResolvedValue([[], 30]);
    const result = await service.listRefreshTokens(1, { page: 1, limit: 10 });
    expect(result.meta.hasNextPage).toBe(true);
  });

  it('hasNextPage is false on last page', async () => {
    findAndCountMock.mockResolvedValue([[], 10]);
    const result = await service.listRefreshTokens(1, { page: 1, limit: 10 });
    expect(result.meta.hasNextPage).toBe(false);
  });

  it('hasPreviousPage is false on first page', async () => {
    findAndCountMock.mockResolvedValue([[], 50]);
    const result = await service.listRefreshTokens(1, { page: 1, limit: 10 });
    expect(result.meta.hasPreviousPage).toBe(false);
  });

  it('hasPreviousPage is true on page > 1', async () => {
    findAndCountMock.mockResolvedValue([[], 50]);
    const result = await service.listRefreshTokens(1, { page: 3, limit: 10 });
    expect(result.meta.hasPreviousPage).toBe(true);
  });

  // -------------------------------------------------------------------------
  // Stable sorting
  // -------------------------------------------------------------------------

  it('passes sortBy and sortOrder to the repository', async () => {
    findAndCountMock.mockResolvedValue([[], 0]);

    await service.listRefreshTokens(1, {
      sortBy: TokenSortField.EXPIRES_AT,
      sortOrder: SortOrder.ASC,
    });

    expect(findAndCountMock).toHaveBeenCalledWith(
      expect.objectContaining({
        order: { expiresAt: 'ASC' },
      }),
    );
  });

  it('defaults to createdAt DESC', async () => {
    findAndCountMock.mockResolvedValue([[], 0]);
    await service.listRefreshTokens(1, {});
    expect(findAndCountMock).toHaveBeenCalledWith(
      expect.objectContaining({ order: { createdAt: 'DESC' } }),
    );
  });

  // -------------------------------------------------------------------------
  // Security — tokenHash and user are stripped
  // -------------------------------------------------------------------------

  it('strips tokenHash from every result item', async () => {
    const tokens = [makeToken({}, 0), makeToken({}, 1)];
    findAndCountMock.mockResolvedValue([tokens, 2]);

    const result = await service.listRefreshTokens(1, {});

    result.data.forEach((item) => {
      expect(item).not.toHaveProperty('tokenHash');
    });
  });

  it('strips user relation from every result item', async () => {
    const tokens = [makeToken({}, 0)];
    findAndCountMock.mockResolvedValue([tokens, 1]);

    const result = await service.listRefreshTokens(1, {});

    result.data.forEach((item) => {
      expect(item).not.toHaveProperty('user');
    });
  });

  it('preserves safe fields in result items', async () => {
    const token = makeToken({ id: 'safe-id', isRevoked: false }, 0);
    findAndCountMock.mockResolvedValue([[token], 1]);

    const result = await service.listRefreshTokens(1, {});

    expect(result.data[0]).toMatchObject({ id: 'safe-id', isRevoked: false });
  });

  // -------------------------------------------------------------------------
  // isRevoked filter
  // -------------------------------------------------------------------------

  it('passes isRevoked=true filter to repository', async () => {
    findAndCountMock.mockResolvedValue([[], 0]);

    await service.listRefreshTokens(1, { isRevoked: true });

    expect(findAndCountMock).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 1, isRevoked: true } }),
    );
  });

  it('omits isRevoked from where clause when not provided', async () => {
    findAndCountMock.mockResolvedValue([[], 0]);

    await service.listRefreshTokens(1, {});

    const calls = findAndCountMock.mock.calls as [
      { where: Record<string, unknown> },
    ][];
    expect(calls[0][0].where).not.toHaveProperty('isRevoked');
  });

  // -------------------------------------------------------------------------
  // Stale / disconnected / empty states
  // -------------------------------------------------------------------------

  it('handles empty result set gracefully', async () => {
    findAndCountMock.mockResolvedValue([[], 0]);

    const result = await service.listRefreshTokens(99, {});

    expect(result.data).toEqual([]);
    expect(result.meta.totalItems).toBe(0);
    expect(result.meta.totalPages).toBe(0);
    expect(result.meta.hasNextPage).toBe(false);
    expect(result.meta.hasPreviousPage).toBe(false);
  });

  it('scopes query to the requested userId', async () => {
    findAndCountMock.mockResolvedValue([[], 0]);

    await service.listRefreshTokens(42, {});

    const calls = findAndCountMock.mock.calls as [
      { where: { userId: number } },
    ][];
    expect(calls[0][0].where.userId).toBe(42);
  });
});
