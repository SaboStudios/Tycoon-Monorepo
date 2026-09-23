import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable, of } from 'rxjs';
import { tap } from 'rxjs/operators';
import { RedisService } from '../../modules/redis/redis.service';

/**
 * Cache namespace prefix. All keys written by this interceptor live under
 * `cache:` so operators can inspect/evict the namespace without touching
 * unrelated Redis keys (see backend/docs/REDIS_CACHE_RUNBOOK.md).
 */
const CACHE_NAMESPACE = 'cache';

/** Default TTL (seconds) for cached GET responses. */
const DEFAULT_TTL_SECONDS = 300;

/**
 * Stampede (thundering herd) protection window in seconds. When a cache miss
 * occurs, the first request acquires a short-lived lock and populates the
 * cache; concurrent duplicate requests wait briefly and re-read the cache
 * instead of all hitting the origin simultaneously.
 */
const STAMPEDE_LOCK_TTL_SECONDS = 10;

/** How long a duplicate request waits for the lock holder to fill the cache. */
const STAMPEDE_WAIT_MS = 50;

/** Number of re-read attempts while waiting for the lock holder. */
const STAMPEDE_MAX_ATTEMPTS = 20;

/**
 * SW-BE-007: Redis cache failures must fail closed on writes and degrade
 * gracefully on reads. Reads fall through to the origin; writes are skipped
 * rather than surfacing a cache error to the client.
 */
const SW_BE_007 = 'SW-BE-007';

@Injectable()
export class CacheInterceptor implements NestInterceptor {
  private readonly logger = new Logger(CacheInterceptor.name);

  constructor(private readonly redisService: RedisService) {}

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<unknown>> {
    const request = context.switchToHttp().getRequest<{
      method: string;
      url: string;
      query: Record<string, unknown>;
      user?: { id: string };
    }>();

    // Only cache GET requests
    if (request.method !== 'GET') {
      return next.handle();
    }

    const cacheKey = this.generateCacheKey(request);

    // Check cache first (fail-open on read: fall through to origin).
    const cachedResult = await this.safeGet(cacheKey);
    if (cachedResult !== null && cachedResult !== undefined) {
      return of(cachedResult);
    }

    // Stampede protection: only the lock holder populates the cache.
    const lockKey = `${cacheKey}:lock`;
    const acquired = await this.safeAcquireLock(lockKey);

    if (!acquired) {
      // Another request is already filling the cache; wait and re-read.
      const filled = await this.waitForCacheFill(cacheKey);
      if (filled !== null && filled !== undefined) {
        return of(filled);
      }
      // Lock holder failed or timed out: fall through to origin.
      return next.handle();
    }

    // Execute request and cache result; always release the lock.
    return next.handle().pipe(
      tap({
        next: (result: unknown) => {
          void this.safeSet(cacheKey, result, DEFAULT_TTL_SECONDS);
          void this.safeReleaseLock(lockKey);
        },
        error: () => {
          void this.safeReleaseLock(lockKey);
        },
      }),
    );
  }

  private async safeGet(key: string): Promise<unknown> {
    try {
      return await this.redisService.get(key);
    } catch (error) {
      this.logCacheFailure('get', key, error);
      return null;
    }
  }

  private async safeSet(
    key: string,
    value: unknown,
    ttlSeconds: number,
  ): Promise<void> {
    try {
      await this.redisService.set(key, value, ttlSeconds);
    } catch (error) {
      // Fail closed on writes: never surface a cache write error to clients.
      this.logCacheFailure('set', key, error);
    }
  }

  private async safeAcquireLock(lockKey: string): Promise<boolean> {
    try {
      const existing = await this.redisService.get(lockKey);
      if (existing) {
        return false;
      }
      await this.redisService.set(lockKey, '1', STAMPEDE_LOCK_TTL_SECONDS);
      return true;
    } catch (error) {
      this.logCacheFailure('lock', lockKey, error);
      // Fail open on lock acquisition: proceed to origin rather than block.
      return true;
    }
  }

  private async safeReleaseLock(lockKey: string): Promise<void> {
    try {
      await this.redisService.del(lockKey);
    } catch (error) {
      this.logCacheFailure('unlock', lockKey, error);
    }
  }

  private async waitForCacheFill(cacheKey: string): Promise<unknown> {
    for (let attempt = 0; attempt < STAMPEDE_MAX_ATTEMPTS; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, STAMPEDE_WAIT_MS));
      const value = await this.safeGet(cacheKey);
      if (value !== null && value !== undefined) {
        return value;
      }
    }
    return null;
  }

  private logCacheFailure(
    operation: string,
    key: string,
    error: unknown,
  ): void {
    const message = error instanceof Error ? error.message : String(error);
    this.logger.warn(
      `[${SW_BE_007}] Redis cache ${operation} failed for key=${key}: ${message}`,
    );
  }

  private generateCacheKey(request: {
    method: string;
    url: string;
    query: Record<string, unknown>;
    user?: { id: string };
  }): string {
    const { method, url, query, user } = request;
    const userId = user?.id || 'anonymous';
    return `${CACHE_NAMESPACE}:${method}:${url}:${userId}:${JSON.stringify(query)}`;
  }
}
