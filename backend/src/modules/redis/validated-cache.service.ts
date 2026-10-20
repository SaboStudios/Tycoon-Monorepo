import { Injectable } from '@nestjs/common';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { RedisService } from './redis.service';
import {
  CacheSetDto,
  CacheGetDto,
  CacheDelDto,
  CacheScanPageDto,
} from './dto/cache-operation.dto';
import {
  CacheErrorCode,
  CacheValidationException,
  mapCacheError,
} from './errors/cache.errors';

/**
 * SW-BE-007 — Thin validation layer over RedisService.
 *
 * Every public method validates its input DTO before delegating to
 * RedisService, and maps raw Redis errors to structured CacheOperationException
 * so callers always receive a typed, secret-free error response.
 */
@Injectable()
export class ValidatedCacheService {
  constructor(private readonly redis: RedisService) {}

  private async assertValid<T extends object>(DtoClass: new () => T, plain: object): Promise<T> {
    const instance = plainToInstance(DtoClass, plain);
    const errors = await validate(instance as object, {
      whitelist: true,
      forbidNonWhitelisted: false,
    });
    if (errors.length > 0) {
      const detail = errors
        .flatMap((e) => Object.values(e.constraints ?? {}))
        .join('; ');
      throw new CacheValidationException(
        CacheErrorCode.INVALID_KEY,
        'Cache DTO validation failed',
        detail,
      );
    }
    return instance;
  }

  async get<T>(key: string): Promise<T | undefined> {
    await this.assertValid(CacheGetDto, { key });
    try {
      return await this.redis.get<T>(key);
    } catch (err) {
      throw mapCacheError(err, 'get');
    }
  }

  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    await this.assertValid(CacheSetDto, { key, value, ttl });
    try {
      await this.redis.set(key, value, ttl);
    } catch (err) {
      throw mapCacheError(err, 'set');
    }
  }

  async del(key: string): Promise<void> {
    await this.assertValid(CacheDelDto, { key });
    try {
      await this.redis.del(key);
    } catch (err) {
      throw mapCacheError(err, 'del');
    }
  }

  async scanPage(
    pattern: string,
    cursor = 0,
    count = 20,
  ): Promise<{ nextCursor: number; keys: string[] }> {
    await this.assertValid(CacheScanPageDto, { pattern, cursor, count });
    try {
      return await this.redis.scanPage(pattern, cursor, count);
    } catch (err) {
      throw mapCacheError(err, 'scanPage');
    }
  }
}
