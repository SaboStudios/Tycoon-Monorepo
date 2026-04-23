import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { RedisService } from './redis.service';
import { LoggerService } from '../../common/logger/logger.service';

describe('RedisService', () => {
  let service: RedisService;
  let loggerService: jest.Mocked<LoggerService>;

  beforeEach(async () => {
    const mockLoggerService = {
      log: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    };

    const mockCacheManager = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
    };

    const mockRedis = {
      setex: jest.fn(),
      get: jest.fn(),
      del: jest.fn(),
      incr: jest.fn(),
      expire: jest.fn(),
      keys: jest.fn(),
      quit: jest.fn(),
      on: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      imports: [ConfigModule],
      providers: [
        RedisService,
        {
          provide: LoggerService,
          useValue: mockLoggerService,
        },
        {
          provide: 'CACHE_MANAGER',
          useValue: mockCacheManager,
        },
      ],
    }).compile();

    service = module.get<RedisService>(RedisService);
    loggerService = module.get(LoggerService);

    // Mock the Redis instance
    (service as any).redis = mockRedis;
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('Session management', () => {
    it('should set refresh token successfully', async () => {
      (service as any).redis.setex.mockResolvedValue('OK');

      await service.setRefreshToken('user123', 'token456');

      expect((service as any).redis.setex).toHaveBeenCalledWith('refresh_token:user123', 604800, 'token456');
      expect(loggerService.debug).toHaveBeenCalledWith('Set refresh token for user user123', 'RedisService');
    });

    it('should handle set refresh token error', async () => {
      (service as any).redis.setex.mockRejectedValue(new Error('Redis error'));

      await expect(service.setRefreshToken('user123', 'token456')).rejects.toThrow('Redis error');
      expect(loggerService.error).toHaveBeenCalledWith(
        'Failed to set refresh token for user user123: Redis error',
        'RedisService'
      );
    });

    it('should get refresh token successfully', async () => {
      (service as any).redis.get.mockResolvedValue('token456');

      const result = await service.getRefreshToken('user123');

      expect(result).toBe('token456');
      expect(loggerService.debug).toHaveBeenCalledWith('Retrieved refresh token for user user123', 'RedisService');
    });

    it('should return null on get refresh token error', async () => {
      (service as any).redis.get.mockRejectedValue(new Error('Redis error'));

      const result = await service.getRefreshToken('user123');

      expect(result).toBeNull();
      expect(loggerService.error).toHaveBeenCalledWith(
        'Failed to get refresh token for user user123: Redis error',
        'RedisService'
      );
    });
  });

  describe('Cache operations', () => {
    it('should handle cache hit', async () => {
      const mockCacheManager = (service as any).cacheManager;
      mockCacheManager.get.mockResolvedValue('cached_value');

      const result = await service.get('test_key');

      expect(result).toBe('cached_value');
      expect(loggerService.debug).toHaveBeenCalledWith('Cache HIT: test_key', 'RedisService');
    });

    it('should handle cache miss', async () => {
      const mockCacheManager = (service as any).cacheManager;
      mockCacheManager.get.mockResolvedValue(undefined);

      const result = await service.get('test_key');

      expect(result).toBeUndefined();
      expect(loggerService.debug).toHaveBeenCalledWith('Cache MISS: test_key', 'RedisService');
    });

    it('should set cache value', async () => {
      const mockCacheManager = (service as any).cacheManager;
      mockCacheManager.set.mockResolvedValue(undefined);

      await service.set('test_key', 'test_value', 300);

      expect(mockCacheManager.set).toHaveBeenCalledWith('test_key', 'test_value', 300);
      expect(loggerService.debug).toHaveBeenCalledWith('Cache SET: test_key', 'RedisService');
    });
  });
});