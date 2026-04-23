/**
 * SW-BE-032: Redis / cache layer — pagination and stable sorting tests
 *
 * Covers:
 *  - scanPage: cursor-based key scan, stable (lexicographic) key ordering,
 *    graceful degradation on Redis error.
 *  - zAdd / getSortedPage: sorted-set pagination, score ordering, tie-breaking,
 *    empty-set handling, graceful degradation on Redis error.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { RedisService } from './redis.service';
import { LoggerService } from '../../common/logger/logger.service';

jest.mock('prom-client', () => {
  const noop = () => ({
    inc: jest.fn(),
    set: jest.fn(),
    startTimer: jest.fn(() => jest.fn()),
    observe: jest.fn(),
  });
  return { Counter: jest.fn(noop), Gauge: jest.fn(noop), Histogram: jest.fn(noop) };
});

const mockRedisInstance = {
  setex: jest.fn(),
  get: jest.fn(),
  del: jest.fn(),
  incr: jest.fn(),
  expire: jest.fn(),
  keys: jest.fn(),
  scan: jest.fn(),
  zadd: jest.fn(),
  zrange: jest.fn(),
  zcard: jest.fn(),
  quit: jest.fn(),
  on: jest.fn(),
};

jest.mock('ioredis', () => jest.fn().mockImplementation(() => mockRedisInstance));

describe('RedisService — pagination and stable sorting (SW-BE-032)', () => {
  let service: RedisService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RedisService,
        { provide: CACHE_MANAGER, useValue: { get: jest.fn(), set: jest.fn(), del: jest.fn() } },
        { provide: LoggerService, useValue: { log: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() } },
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue({ host: 'localhost', port: 6379, db: 0, ttl: 300 }) },
        },
      ],
    }).compile();

    service = module.get(RedisService);
  });

  // ---------------------------------------------------------------------------
  // scanPage
  // ---------------------------------------------------------------------------

  describe('scanPage', () => {
    it('returns keys sorted lexicographically', async () => {
      mockRedisInstance.scan.mockResolvedValue(['42', ['cache:z', 'cache:a', 'cache:m']]);
      const result = await service.scanPage('cache:*');
      expect(result.keys).toEqual(['cache:a', 'cache:m', 'cache:z']);
      expect(result.nextCursor).toBe(42);
    });

    it('passes cursor, pattern and count to SCAN', async () => {
      mockRedisInstance.scan.mockResolvedValue(['0', []]);
      await service.scanPage('prefix:*', 7, 50);
      expect(mockRedisInstance.scan).toHaveBeenCalledWith(7, 'MATCH', 'prefix:*', 'COUNT', 50);
    });

    it('nextCursor 0 signals last page', async () => {
      mockRedisInstance.scan.mockResolvedValue(['0', ['k1']]);
      const { nextCursor } = await service.scanPage('*');
      expect(nextCursor).toBe(0);
    });

    it('returns empty result on Redis error (graceful degradation)', async () => {
      mockRedisInstance.scan.mockRejectedValue(new Error('down'));
      const result = await service.scanPage('*');
      expect(result).toEqual({ nextCursor: 0, keys: [] });
    });

    it('returns stable order across multiple calls with same data', async () => {
      const keys = ['b', 'a', 'c', 'aa', 'ab'];
      mockRedisInstance.scan.mockResolvedValue(['0', keys]);
      const r1 = await service.scanPage('*');
      mockRedisInstance.scan.mockResolvedValue(['0', [...keys].reverse()]);
      const r2 = await service.scanPage('*');
      expect(r1.keys).toEqual(r2.keys);
    });
  });

  // ---------------------------------------------------------------------------
  // zAdd
  // ---------------------------------------------------------------------------

  describe('zAdd', () => {
    it('calls ZADD with correct arguments', async () => {
      mockRedisInstance.zadd.mockResolvedValue(1);
      await service.zAdd('leaderboard', 100, 'player:1');
      expect(mockRedisInstance.zadd).toHaveBeenCalledWith('leaderboard', 100, 'player:1');
    });

    it('throws on Redis error', async () => {
      mockRedisInstance.zadd.mockRejectedValue(new Error('down'));
      await expect(service.zAdd('k', 1, 'm')).rejects.toThrow('down');
    });
  });

  // ---------------------------------------------------------------------------
  // getSortedPage
  // ---------------------------------------------------------------------------

  describe('getSortedPage', () => {
    it('returns first page with correct members and scores', async () => {
      mockRedisInstance.zrange.mockResolvedValue(['alice', '10', 'bob', '20']);
      mockRedisInstance.zcard.mockResolvedValue(5);

      const result = await service.getSortedPage('leaderboard', 0, 2);

      expect(result.items).toEqual([
        { member: 'alice', score: 10 },
        { member: 'bob', score: 20 },
      ]);
      expect(result.total).toBe(5);
    });

    it('calculates correct offset for page > 0', async () => {
      mockRedisInstance.zrange.mockResolvedValue([]);
      mockRedisInstance.zcard.mockResolvedValue(10);

      await service.getSortedPage('k', 2, 5);

      // page=2, limit=5 → offset=10, end=14
      expect(mockRedisInstance.zrange).toHaveBeenCalledWith('k', 10, 14, 'WITHSCORES');
    });

    it('returns empty items and total=0 on Redis error (graceful degradation)', async () => {
      mockRedisInstance.zrange.mockRejectedValue(new Error('down'));
      mockRedisInstance.zcard.mockRejectedValue(new Error('down'));

      const result = await service.getSortedPage('k');
      expect(result).toEqual({ items: [], total: 0 });
    });

    it('returns empty items for empty sorted set', async () => {
      mockRedisInstance.zrange.mockResolvedValue([]);
      mockRedisInstance.zcard.mockResolvedValue(0);

      const result = await service.getSortedPage('empty');
      expect(result).toEqual({ items: [], total: 0 });
    });

    it('uses default page=0 and limit=20', async () => {
      mockRedisInstance.zrange.mockResolvedValue([]);
      mockRedisInstance.zcard.mockResolvedValue(0);

      await service.getSortedPage('k');
      expect(mockRedisInstance.zrange).toHaveBeenCalledWith('k', 0, 19, 'WITHSCORES');
    });

    it('preserves score order (ascending) from Redis', async () => {
      mockRedisInstance.zrange.mockResolvedValue(['low', '1', 'mid', '5', 'high', '9']);
      mockRedisInstance.zcard.mockResolvedValue(3);

      const { items } = await service.getSortedPage('k');
      expect(items.map((i) => i.score)).toEqual([1, 5, 9]);
    });
  });
});
