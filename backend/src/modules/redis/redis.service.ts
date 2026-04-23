import { Injectable, Inject, Logger } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { Counter, Gauge, Histogram } from 'prom-client';
import Redis from 'ioredis';
import { ConfigService } from '@nestjs/config';
import { LoggerService } from '../../common/logger/logger.service';

@Injectable()
export class RedisService {
  private readonly logger: LoggerService;
  private redis: Redis;

  // Prometheus metrics
  private readonly redisOperationsTotal: Counter;
  private readonly redisOperationDuration: Histogram;
  private readonly redisErrorsTotal: Counter;
  private readonly redisConnectionsTotal: Gauge;
  private readonly cacheHitsTotal: Counter;
  private readonly cacheMissesTotal: Counter;

  constructor(
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private configService: ConfigService,
    loggerService: LoggerService,
  ) {
    this.logger = loggerService;

    const redisConfig = configService.get<{
      host: string;
      port: number;
      password?: string;
      db: number;
    }>('redis');
    if (!redisConfig) {
      throw new Error('Redis configuration not found');
    }
    this.redis = new Redis({
      host: redisConfig.host,
      port: redisConfig.port,
      password: redisConfig.password,
      db: redisConfig.db,
    });

    // Initialize metrics
    this.redisOperationsTotal = new Counter({
      name: 'tycoon_redis_operations_total',
      help: 'Total Redis operations by operation type',
      labelNames: ['operation'],
    });

    this.redisOperationDuration = new Histogram({
      name: 'tycoon_redis_operation_duration_seconds',
      help: 'Redis operation duration in seconds',
      labelNames: ['operation'],
      buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 2.5, 5],
    });

    this.redisErrorsTotal = new Counter({
      name: 'tycoon_redis_errors_total',
      help: 'Total Redis errors by operation type',
      labelNames: ['operation'],
    });

    this.redisConnectionsTotal = new Gauge({
      name: 'tycoon_redis_connections_total',
      help: 'Total Redis connections',
    });

    this.cacheHitsTotal = new Counter({
      name: 'tycoon_cache_hits_total',
      help: 'Total cache hits',
    });

    this.cacheMissesTotal = new Counter({
      name: 'tycoon_cache_misses_total',
      help: 'Total cache misses',
    });

    this.redis.on('connect', () => {
      this.logger.log('Connected to Redis', 'RedisService');
      this.redisConnectionsTotal.set(1);
    });

    this.redis.on('disconnect', () => {
      this.logger.warn('Disconnected from Redis', 'RedisService');
      this.redisConnectionsTotal.set(0);
    });

    this.redis.on('error', (err: any) => {
      this.logger.error(`Redis connection error: ${err.message}`, 'RedisService');
      this.redisErrorsTotal.inc({ operation: 'connection' });
    });
  }

  // Session management
  async setRefreshToken(
    userId: string,
    token: string,
    ttl: number = 604800,
  ): Promise<void> {
    const endTimer = this.redisOperationDuration.startTimer({ operation: 'set_refresh_token' });
    try {
      await this.redis.setex(`refresh_token:${userId}`, ttl, token);
      this.redisOperationsTotal.inc({ operation: 'set_refresh_token' });
      this.logger.debug(`Set refresh token for user ${userId}`, 'RedisService');
    } catch (error: any) {
      this.redisErrorsTotal.inc({ operation: 'set_refresh_token' });
      this.logger.error(`Failed to set refresh token for user ${userId}: ${error.message}`, 'RedisService');
      throw error;
    } finally {
      endTimer();
    }
  }

  async getRefreshToken(userId: string): Promise<string | null> {
    const endTimer = this.redisOperationDuration.startTimer({ operation: 'get_refresh_token' });
    try {
      const result = await this.redis.get(`refresh_token:${userId}`);
      this.redisOperationsTotal.inc({ operation: 'get_refresh_token' });
      this.logger.debug(`Retrieved refresh token for user ${userId}`, 'RedisService');
      return result;
    } catch (error: any) {
      this.redisErrorsTotal.inc({ operation: 'get_refresh_token' });
      this.logger.error(`Failed to get refresh token for user ${userId}: ${error.message}`, 'RedisService');
      return null;
    } finally {
      endTimer();
    }
  }

  async deleteRefreshToken(userId: string): Promise<void> {
    const endTimer = this.redisOperationDuration.startTimer({ operation: 'delete_refresh_token' });
    try {
      await this.redis.del(`refresh_token:${userId}`);
      this.redisOperationsTotal.inc({ operation: 'delete_refresh_token' });
      this.logger.debug(`Deleted refresh token for user ${userId}`, 'RedisService');
    } catch (error: any) {
      this.redisErrorsTotal.inc({ operation: 'delete_refresh_token' });
      this.logger.error(`Failed to delete refresh token for user ${userId}: ${error.message}`, 'RedisService');
      throw error;
    } finally {
      endTimer();
    }
  }

  // Rate limiting
  async incrementRateLimit(key: string, ttl: number = 60): Promise<number> {
    const endTimer = this.redisOperationDuration.startTimer({ operation: 'increment_rate_limit' });
    try {
      const current = await this.redis.incr(key);
      if (current === 1) {
        await this.redis.expire(key, ttl);
      }
      this.redisOperationsTotal.inc({ operation: 'increment_rate_limit' });
      this.logger.debug(`Incremented rate limit for key ${key} to ${current}`, 'RedisService');
      return current;
    } catch (error: any) {
      this.redisErrorsTotal.inc({ operation: 'increment_rate_limit' });
      this.logger.error(`Failed to increment rate limit for key ${key}: ${error.message}`, 'RedisService');
      return 0; // Fallback to 0 if Redis is down
    } finally {
      endTimer();
    }
  }

  // Cache operations
  async get<T>(key: string): Promise<T | undefined> {
    const endTimer = this.redisOperationDuration.startTimer({ operation: 'cache_get' });
    try {
      const value = await this.cacheManager.get<T>(key);
      if (value !== undefined) {
        this.cacheHitsTotal.inc();
        this.logger.debug(`Cache HIT: ${key}`, 'RedisService');
      } else {
        this.cacheMissesTotal.inc();
        this.logger.debug(`Cache MISS: ${key}`, 'RedisService');
      }
      this.redisOperationsTotal.inc({ operation: 'cache_get' });
      return value;
    } catch (error: any) {
      this.redisErrorsTotal.inc({ operation: 'cache_get' });
      this.logger.error(`Cache GET error for ${key}: ${error.message}`, 'RedisService');
      return undefined; // Graceful degradation
    } finally {
      endTimer();
    }
  }

  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    const endTimer = this.redisOperationDuration.startTimer({ operation: 'cache_set' });
    try {
      await this.cacheManager.set(key, value, ttl);
      this.redisOperationsTotal.inc({ operation: 'cache_set' });
      this.logger.debug(`Cache SET: ${key}`, 'RedisService');
    } catch (error: any) {
      this.redisErrorsTotal.inc({ operation: 'cache_set' });
      this.logger.error(`Cache SET error for ${key}: ${error.message}`, 'RedisService');
      throw error;
    } finally {
      endTimer();
    }
  }

  async del(key: string): Promise<void> {
    const endTimer = this.redisOperationDuration.startTimer({ operation: 'cache_del' });
    try {
      await this.cacheManager.del(key);
      this.redisOperationsTotal.inc({ operation: 'cache_del' });
      this.logger.debug(`Cache DEL: ${key}`, 'RedisService');
    } catch (error: any) {
      this.redisErrorsTotal.inc({ operation: 'cache_del' });
      this.logger.error(`Cache DEL error for ${key}: ${error.message}`, 'RedisService');
      throw error;
    } finally {
      endTimer();
    }
  }

  async delByPattern(pattern: string): Promise<void> {
    const endTimer = this.redisOperationDuration.startTimer({ operation: 'del_by_pattern' });
    try {
      const keys = await this.redis.keys(pattern);
      if (keys.length > 0) {
        await this.redis.del(...keys);
        this.redisOperationsTotal.inc({ operation: 'del_by_pattern' });
        this.logger.log(
          `Invalidated ${keys.length} keys with pattern: ${pattern}`,
          'RedisService',
        );
      }
    } catch (error: any) {
      this.redisErrorsTotal.inc({ operation: 'del_by_pattern' });
      this.logger.error(
        `Cache delByPattern error for ${pattern}: ${error.message}`,
        'RedisService',
      );
      throw error;
    } finally {
      endTimer();
    }
  }

  async reset(): Promise<void> {
    const endTimer = this.redisOperationDuration.startTimer({ operation: 'cache_reset' });
    try {
      // Reset cache by deleting all keys with our prefix
      const keys = await this.redis.keys('cache:*');
      if (keys.length > 0) {
        await this.redis.del(...keys);
        this.redisOperationsTotal.inc({ operation: 'cache_reset' });
        this.logger.log(`Reset cache: deleted ${keys.length} keys`, 'RedisService');
      }
    } catch (error: any) {
      this.redisErrorsTotal.inc({ operation: 'cache_reset' });
      this.logger.error(`Cache reset error: ${error.message}`, 'RedisService');
      throw error;
    } finally {
      endTimer();
    }
  }

  /**
   * Cursor-based key scan with a stable page size.
   *
   * Uses Redis SCAN (non-blocking) instead of KEYS so it is safe to call
   * against production instances.  Returns the next cursor (0 = last page)
   * and the matched keys sorted lexicographically for stable ordering across
   * pages.
   */
  async scanPage(
    pattern: string,
    cursor: number = 0,
    count: number = 20,
  ): Promise<{ nextCursor: number; keys: string[] }> {
    const endTimer = this.redisOperationDuration.startTimer({ operation: 'scan_page' });
    try {
      const [nextCursorStr, keys] = await this.redis.scan(
        cursor,
        'MATCH',
        pattern,
        'COUNT',
        count,
      );
      const sorted = [...keys].sort();
      this.redisOperationsTotal.inc({ operation: 'scan_page' });
      return { nextCursor: parseInt(nextCursorStr, 10), keys: sorted };
    } catch (error: any) {
      this.redisErrorsTotal.inc({ operation: 'scan_page' });
      this.logger.error(`scanPage error for ${pattern}: ${error.message}`, 'RedisService');
      return { nextCursor: 0, keys: [] };
    } finally {
      endTimer();
    }
  }

  /**
   * Add a member to a sorted set with a numeric score.
   * Used to build stable-sorted collections (e.g. leaderboards, queues).
   */
  async zAdd(key: string, score: number, member: string): Promise<void> {
    const endTimer = this.redisOperationDuration.startTimer({ operation: 'zadd' });
    try {
      await this.redis.zadd(key, score, member);
      this.redisOperationsTotal.inc({ operation: 'zadd' });
    } catch (error: any) {
      this.redisErrorsTotal.inc({ operation: 'zadd' });
      this.logger.error(`zAdd error for ${key}: ${error.message}`, 'RedisService');
      throw error;
    } finally {
      endTimer();
    }
  }

  /**
   * Paginate a sorted set by score (ascending).
   *
   * Returns members in score order (stable sort).  Ties are broken
   * lexicographically by member name so the order is deterministic.
   *
   * @param key   Sorted-set key
   * @param page  0-based page index
   * @param limit Items per page (default 20)
   */
  async getSortedPage(
    key: string,
    page: number = 0,
    limit: number = 20,
  ): Promise<{ items: Array<{ member: string; score: number }>; total: number }> {
    const endTimer = this.redisOperationDuration.startTimer({ operation: 'get_sorted_page' });
    try {
      const offset = page * limit;
      const [rawItems, total] = await Promise.all([
        this.redis.zrange(key, offset, offset + limit - 1, 'WITHSCORES'),
        this.redis.zcard(key),
      ]);

      const items: Array<{ member: string; score: number }> = [];
      for (let i = 0; i < rawItems.length; i += 2) {
        items.push({ member: rawItems[i], score: parseFloat(rawItems[i + 1]) });
      }

      this.redisOperationsTotal.inc({ operation: 'get_sorted_page' });
      return { items, total };
    } catch (error: any) {
      this.redisErrorsTotal.inc({ operation: 'get_sorted_page' });
      this.logger.error(`getSortedPage error for ${key}: ${error.message}`, 'RedisService');
      return { items: [], total: 0 };
    } finally {
      endTimer();
    }
  }

  /** Gracefully close the raw ioredis connection. Called during shutdown. */
  async quit(): Promise<void> {
    this.logger.log('Closing Redis connection', 'RedisService');
    await this.redis.quit();
  }
}
