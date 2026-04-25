import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { RedisService } from './redis.service';
import { LoggerService } from '../../common/logger/logger.service';

// Prevent duplicate Prometheus metric registration across test runs
jest.mock('prom-client', () => {
  const noop = () => ({ inc: jest.fn(), set: jest.fn(), startTimer: jest.fn(() => jest.fn()), observe: jest.fn() });
  return { Counter: jest.fn(noop), Gauge: jest.fn(noop), Histogram: jest.fn(noop) };
});

const mockRedisInstance = {
  setex: jest.fn(),
  get: jest.fn(),
  del: jest.fn(),
  incr: jest.fn(),
  expire: jest.fn(),
  keys: jest.fn(),
  quit: jest.fn(),
  on: jest.fn(),
};

jest.mock('ioredis', () => jest.fn().mockImplementation(() => mockRedisInstance));

describe('RedisService', () => {
  let service: RedisService;
  let cacheManager: { get: jest.Mock; set: jest.Mock; del: jest.Mock };
  let loggerService: jest.Mocked<LoggerService>;

  beforeEach(async () => {
    jest.clearAllMocks();

    cacheManager = { get: jest.fn(), set: jest.fn(), del: jest.fn() };
    loggerService = { log: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RedisService,
        { provide: CACHE_MANAGER, useValue: cacheManager },
        { provide: LoggerService, useValue: loggerService },
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue({ host: 'localhost', port: 6379, db: 0, ttl: 300 }) },
        },
      ],
    }).compile();

    service = module.get(RedisService);
  });

  it('should be defined', () => expect(service).toBeDefined());

  describe('Session management', () => {
    it('sets refresh token', async () => {
      mockRedisInstance.setex.mockResolvedValue('OK');
      await service.setRefreshToken('u1', 'tok');
      expect(mockRedisInstance.setex).toHaveBeenCalledWith('refresh_token:u1', 604800, 'tok');
    });

    it('throws on set refresh token error', async () => {
      mockRedisInstance.setex.mockRejectedValue(new Error('down'));
      await expect(service.setRefreshToken('u1', 'tok')).rejects.toThrow('down');
    });

    it('gets refresh token', async () => {
      mockRedisInstance.get.mockResolvedValue('tok');
      expect(await service.getRefreshToken('u1')).toBe('tok');
    });

    it('returns null on get refresh token error', async () => {
      mockRedisInstance.get.mockRejectedValue(new Error('down'));
      expect(await service.getRefreshToken('u1')).toBeNull();
    });

    it('deletes refresh token', async () => {
      mockRedisInstance.del.mockResolvedValue(1);
      await service.deleteRefreshToken('u1');
      expect(mockRedisInstance.del).toHaveBeenCalledWith('refresh_token:u1');
    });
  });

  describe('Cache operations', () => {
    it('cache hit', async () => {
      cacheManager.get.mockResolvedValue('val');
      expect(await service.get('k')).toBe('val');
      expect(loggerService.debug).toHaveBeenCalledWith('Cache HIT: k', 'RedisService');
    });

    it('cache miss', async () => {
      cacheManager.get.mockResolvedValue(undefined);
      expect(await service.get('k')).toBeUndefined();
      expect(loggerService.debug).toHaveBeenCalledWith('Cache MISS: k', 'RedisService');
    });

    it('sets cache value', async () => {
      cacheManager.set.mockResolvedValue(undefined);
      await service.set('k', 'v', 300);
      expect(cacheManager.set).toHaveBeenCalledWith('k', 'v', 300);
    });

    it('deletes cache key', async () => {
      cacheManager.del.mockResolvedValue(undefined);
      await service.del('k');
      expect(cacheManager.del).toHaveBeenCalledWith('k');
    });
  });

  describe('Rate limiting', () => {
    it('increments and sets TTL on first call', async () => {
      mockRedisInstance.incr.mockResolvedValue(1);
      mockRedisInstance.expire.mockResolvedValue(1);
      expect(await service.incrementRateLimit('rl:u1')).toBe(1);
      expect(mockRedisInstance.expire).toHaveBeenCalledWith('rl:u1', 60);
    });

    it('does not reset TTL on subsequent calls', async () => {
      mockRedisInstance.incr.mockResolvedValue(5);
      await service.incrementRateLimit('rl:u1');
      expect(mockRedisInstance.expire).not.toHaveBeenCalled();
    });

    it('returns 0 on Redis error (graceful degradation)', async () => {
      mockRedisInstance.incr.mockRejectedValue(new Error('down'));
      expect(await service.incrementRateLimit('rl:u1')).toBe(0);
    });
  });

  describe('delByPattern', () => {
    it('deletes matched keys', async () => {
      mockRedisInstance.keys.mockResolvedValue(['a', 'b']);
      mockRedisInstance.del.mockResolvedValue(2);
      await service.delByPattern('prefix:*');
      expect(mockRedisInstance.del).toHaveBeenCalledWith('a', 'b');
    });

    it('no-ops when no keys match', async () => {
      mockRedisInstance.keys.mockResolvedValue([]);
      await service.delByPattern('prefix:*');
      expect(mockRedisInstance.del).not.toHaveBeenCalled();
    });
  });

  describe('quit', () => {
    it('closes the Redis connection', async () => {
      mockRedisInstance.quit.mockResolvedValue('OK');
      await service.quit();
      expect(mockRedisInstance.quit).toHaveBeenCalled();
    });
  });
});
