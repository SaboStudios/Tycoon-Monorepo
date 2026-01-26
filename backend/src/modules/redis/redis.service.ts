import { Injectable, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import Redis from 'ioredis';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class RedisService {
  private redis: Redis;

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
  }

  // Session management
  async setRefreshToken(
    userId: string,
    token: string,
    ttl: number = 604800,
  ): Promise<void> {
    await this.redis.setex(`refresh_token:${userId}`, ttl, token);
  }

  async getRefreshToken(userId: string): Promise<string | null> {
    return await this.redis.get(`refresh_token:${userId}`);
  }

  async deleteRefreshToken(userId: string): Promise<void> {
    await this.redis.del(`refresh_token:${userId}`);
  }

  // Rate limiting
  async incrementRateLimit(key: string, ttl: number = 60): Promise<number> {
    const current = await this.redis.incr(key);
    if (current === 1) {
      await this.redis.expire(key, ttl);
    }
    return current;
  }

  // Cache operations
  async get<T>(key: string): Promise<T | undefined> {
    return await this.cacheManager.get<T>(key);
  }

  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    await this.cacheManager.set(key, value, ttl);
  }

  async del(key: string): Promise<void> {
    await this.cacheManager.del(key);
  }

  async reset(): Promise<void> {
    // Reset cache by deleting all keys with our prefix
    const keys = await this.redis.keys('cache:*');
    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
  }
}
