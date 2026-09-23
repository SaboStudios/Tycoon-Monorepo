import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, of, from } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { RedisService } from '../../modules/redis/redis.service';
import {
  CacheOptions,
  CACHE_OPTIONS,
} from '../decorators/cache-options.decorator';

/**
 * SW-BE-007: Redis cache namespace stampede protection.
 *
 * Concurrent duplicate GET requests that miss the cache would otherwise all
 * hit the origin simultaneously (cache stampede / thundering herd). We guard
 * the origin with a short-lived distributed lock per cache key so only one
 * request recomputes the value while the others wait briefly and re-read the
 * cache. On any Redis failure we fail open for reads (graceful degradation)
 * but never block the origin indefinitely.
 */
@Injectable()
export class AdvancedCacheInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AdvancedCacheInterceptor.name);

  /** Default lock TTL (ms) — bounds how long a single-flight holder may run. */
  private static readonly LOCK_TTL_MS = 10_000;
  /** How long a waiter polls for the winner's cached value before falling through. */
  private static readonly LOCK_WAIT_MS = 2_000;
  /** Poll interval (ms) while waiting for the single-flight winner. */
  private static readonly LOCK_POLL_MS = 50;

  constructor(
    private readonly redisService: RedisService,
    private readonly reflector: Reflector,
  ) {}

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<unknown>> {
    const request = context.switchToHttp().getRequest();
    const { method, url, query, headers, user } = request;

    // Only cache GET requests
    if (method !== 'GET') {
      return next.handle();
    }

    // Check for cache bypass header
    if (headers['x-cache-bypass'] === 'true') {
      this.logger.log(`Cache BYPASS: ${url}`);
      return next.handle();
    }

    const options = this.reflector.get<CacheOptions>(
      CACHE_OPTIONS,
      context.getHandler(),
    );

    const cacheKey = this.generateCacheKey(url, query, user, options);

    // Check cache first
    try {
      const cachedResult = await this.redisService.get(cacheKey);
      if (cachedResult !== undefined) {
        return of(cachedResult);
      }
    } catch (error) {
      this.logger.error(
        `Error checking cache for ${cacheKey}: ${error.message}`,
      );
      // Fallback to next.handle() - graceful degradation
    }

    // SW-BE-007: single-flight guard. Only one concurrent miss recomputes the
    // origin; the rest wait briefly for the winner to populate the cache.
    const lockKey = `${cacheKey}:lock`;
    let acquiredLock = false;
    try {
      acquiredLock = await this.redisService.acquireLock(
        lockKey,
        AdvancedCacheInterceptor.LOCK_TTL_MS,
      );
    } catch (error) {
      this.logger.error(
        `Error acquiring cache lock for ${cacheKey}: ${error.message}`,
      );
      // Fail open for reads: proceed without single-flight protection.
    }

    if (!acquiredLock) {
      const winnerResult = await this.waitForWinner(cacheKey);
      if (winnerResult !== undefined) {
        return of(winnerResult);
      }
      // Winner did not populate in time — fall through and serve the origin.
    }

    // Execute request and cache result
    return next.handle().pipe(
      tap((result: unknown) => {
        const ttl = options?.ttl || 300; // Default 5 minutes
        void this.redisService.set(cacheKey, result, ttl);
      }),
      catchError((error) => {
        // Ensure the lock is released on failure so the next request can retry.
        if (acquiredLock) {
          void this.redisService.releaseLock(lockKey);
        }
        throw error;
      }),
      tap({
        complete: () => {
          if (acquiredLock) {
            void this.redisService.releaseLock(lockKey);
          }
        },
      }),
    );
  }

  /**
   * Poll the cache for the single-flight winner's value within a bounded
   * window. Returns undefined if the value never appears (caller falls through).
   */
  private async waitForWinner(cacheKey: string): Promise<unknown> {
    const deadline = Date.now() + AdvancedCacheInterceptor.LOCK_WAIT_MS;
    while (Date.now() < deadline) {
      await new Promise((resolve) =>
        setTimeout(resolve, AdvancedCacheInterceptor.LOCK_POLL_MS),
      );
      try {
        const value = await this.redisService.get(cacheKey);
        if (value !== undefined) {
          return value;
        }
      } catch (error) {
        this.logger.error(
          `Error polling cache for ${cacheKey}: ${error.message}`,
        );
        return undefined;
      }
    }
    return undefined;
  }

  private generateCacheKey(
    url: string,
    query: Record<string, unknown>,
    user?: { id: string | number },
    options?: CacheOptions,
  ): string {
    const prefix = options?.keyPrefix || 'cache';
    const useUser = options?.useUserPrefix !== false;
    const userId = useUser && user ? user.id : 'public';

    // Clean URL for key naming
    const urlPath = url.split('?')[0];
    const cleanUrl = urlPath.startsWith('/') ? urlPath.substring(1) : urlPath;
    const urlSegment = cleanUrl.replace(/\//g, ':');

    // Use tycoon:prefix:urlSegment:userId:query
    return `tycoon:${prefix}:${urlSegment}:${userId}:${JSON.stringify(query)}`;
  }
}
