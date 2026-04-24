/**
 * SW-BE-007 — ValidatedCacheService unit tests.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { ValidatedCacheService } from './validated-cache.service';
import { RedisService } from './redis.service';
import { CacheValidationException, CacheOperationException } from './errors/cache.errors';

const mockRedis = () => ({
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
  scanPage: jest.fn(),
});

describe('ValidatedCacheService', () => {
  let service: ValidatedCacheService;
  let redis: ReturnType<typeof mockRedis>;

  beforeEach(async () => {
    redis = mockRedis();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ValidatedCacheService,
        { provide: RedisService, useValue: redis },
      ],
    }).compile();
    service = module.get(ValidatedCacheService);
  });

  afterEach(() => jest.clearAllMocks());

  // ── get ──────────────────────────────────────────────────────────────────

  describe('get', () => {
    it('delegates to RedisService on valid key', async () => {
      redis.get.mockResolvedValue({ id: 1 });
      const result = await service.get('shop:items:1');
      expect(redis.get).toHaveBeenCalledWith('shop:items:1');
      expect(result).toEqual({ id: 1 });
    });

    it('throws CacheValidationException on empty key', async () => {
      await expect(service.get('')).rejects.toBeInstanceOf(CacheValidationException);
      expect(redis.get).not.toHaveBeenCalled();
    });

    it('throws CacheValidationException on key with illegal chars', async () => {
      await expect(service.get('bad key!')).rejects.toBeInstanceOf(CacheValidationException);
    });

    it('maps RedisService error to CacheOperationException', async () => {
      redis.get.mockRejectedValue(new Error('connection refused'));
      await expect(service.get('valid:key')).rejects.toBeInstanceOf(CacheOperationException);
    });
  });

  // ── set ──────────────────────────────────────────────────────────────────

  describe('set', () => {
    it('delegates to RedisService on valid inputs', async () => {
      redis.set.mockResolvedValue(undefined);
      await service.set('shop:items', { id: 1 }, 300);
      expect(redis.set).toHaveBeenCalledWith('shop:items', { id: 1 }, 300);
    });

    it('throws CacheValidationException on invalid key', async () => {
      await expect(service.set('bad key!', 'v')).rejects.toBeInstanceOf(CacheValidationException);
    });

    it('throws CacheValidationException when ttl exceeds max', async () => {
      await expect(service.set('k', 'v', 604_801)).rejects.toBeInstanceOf(CacheValidationException);
    });

    it('maps RedisService error to CacheOperationException', async () => {
      redis.set.mockRejectedValue(new Error('READONLY'));
      await expect(service.set('k', 'v', 60)).rejects.toBeInstanceOf(CacheOperationException);
    });
  });

  // ── del ──────────────────────────────────────────────────────────────────

  describe('del', () => {
    it('delegates to RedisService on valid key', async () => {
      redis.del.mockResolvedValue(undefined);
      await service.del('session:abc');
      expect(redis.del).toHaveBeenCalledWith('session:abc');
    });

    it('throws CacheValidationException on empty key', async () => {
      await expect(service.del('')).rejects.toBeInstanceOf(CacheValidationException);
    });

    it('maps RedisService error to CacheOperationException', async () => {
      redis.del.mockRejectedValue(new Error('down'));
      await expect(service.del('k')).rejects.toBeInstanceOf(CacheOperationException);
    });
  });

  // ── scanPage ─────────────────────────────────────────────────────────────

  describe('scanPage', () => {
    it('delegates to RedisService on valid inputs', async () => {
      redis.scanPage.mockResolvedValue({ nextCursor: 0, keys: ['a', 'b'] });
      const result = await service.scanPage('shop:*', 0, 20);
      expect(redis.scanPage).toHaveBeenCalledWith('shop:*', 0, 20);
      expect(result.keys).toEqual(['a', 'b']);
    });

    it('throws CacheValidationException on empty pattern', async () => {
      await expect(service.scanPage('')).rejects.toBeInstanceOf(CacheValidationException);
    });

    it('throws CacheValidationException when count > 500', async () => {
      await expect(service.scanPage('shop:*', 0, 501)).rejects.toBeInstanceOf(CacheValidationException);
    });

    it('throws CacheValidationException on negative cursor', async () => {
      await expect(service.scanPage('shop:*', -1)).rejects.toBeInstanceOf(CacheValidationException);
    });

    it('maps RedisService error to CacheOperationException', async () => {
      redis.scanPage.mockRejectedValue(new Error('down'));
      await expect(service.scanPage('shop:*')).rejects.toBeInstanceOf(CacheOperationException);
    });
  });
});
