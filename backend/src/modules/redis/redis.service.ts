import { Injectable, Inject, Logger } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import Redis from 'ioredis';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class RedisService {
  private redis: Redis;
  private readonly logger = new Logger(RedisService.name);

  constructor(
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private configService: ConfigService,
  ) {
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

    this.redis.on('error', (err: any) => {
      this.logger.error(`Redis connection error: ${err.message}`);
    });
  }

  // Session management
  async setRefreshToken(
    userId: string,
    token: string,
    ttl: number = 604800,
  ): Promise<void> {
    try {
      await this.redis.setex(`refresh_token:${userId}`, ttl, token);
    } catch (error: any) {
      this.logger.error(`Failed to set refresh token: ${error.message}`);
    }
  }

  async getRefreshToken(userId: string): Promise<string | null> {
    try {
      return await this.redis.get(`refresh_token:${userId}`);
    } catch (error: any) {
      this.logger.error(`Failed to get refresh token: ${error.message}`);
      return null;
    }
  }

  async deleteRefreshToken(userId: string): Promise<void> {
    try {
      await this.redis.del(`refresh_token:${userId}`);
    } catch (error: any) {
      this.logger.error(`Failed to delete refresh token: ${error.message}`);
    }
  }

  // Rate limiting
  async incrementRateLimit(key: string, ttl: number = 60): Promise<number> {
    try {
      const current = await this.redis.incr(key);
      if (current === 1) {
        await this.redis.expire(key, ttl);
      }
      return current;
    } catch (error: any) {
      this.logger.error(`Failed to increment rate limit: ${error.message}`);
      return 0; // Fallback to 0 if Redis is down
    }
  }

  // Cache operations
  async get<T>(key: string): Promise<T | undefined> {
    try {
      const value = await this.cacheManager.get<T>(key);
      if (value !== undefined) {
        this.logger.log(`Cache HIT: ${key}`);
      } else {
        this.logger.log(`Cache MISS: ${key}`);
      }
      return value;
    } catch (error: any) {
      this.logger.error(`Cache GET error for ${key}: ${error.message}`);
      return undefined; // Graceful degradation
    }
  }

  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    try {
      await this.cacheManager.set(key, value, ttl);
    } catch (error: any) {
      this.logger.error(`Cache SET error for ${key}: ${error.message}`);
    }
  }

  async del(key: string): Promise<void> {
    try {
      await this.cacheManager.del(key);
    } catch (error: any) {
      this.logger.error(`Cache DEL error for ${key}: ${error.message}`);
    }
  }

  async delByPattern(pattern: string): Promise<void> {
    try {
      const keys = await this.redis.keys(pattern);
      if (keys.length > 0) {
        await this.redis.del(...keys);
        this.logger.log(
          `Invalidated ${keys.length} keys with pattern: ${pattern}`,
        );
      }
    } catch (error: any) {
      this.logger.error(
        `Cache delByPattern error for ${pattern}: ${error.message}`,
      );
    }
  }

  async reset(): Promise<void> {
    try {
      // Reset cache by deleting all keys with our prefix
      const keys = await this.redis.keys('cache:*');
      if (keys.length > 0) {
        await this.redis.del(...keys);
      }
    } catch (error: any) {
      this.logger.error(`Cache reset error: ${error.message}`);
    }
  }

  /** Gracefully close the raw ioredis connection. Called during shutdown. */
  async quit(): Promise<void> {
    await this.redis.quit();
  }
}
