import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, of } from 'rxjs';
import { tap } from 'rxjs/operators';
import { RedisService } from '../../modules/redis/redis.service';
import {
  CacheOptions,
  CACHE_OPTIONS,
} from '../decorators/cache-options.decorator';

@Injectable()
export class AdvancedCacheInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AdvancedCacheInterceptor.name);

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

    // Execute request and cache result
    return next.handle().pipe(
      tap((result: unknown) => {
        const ttl = options?.ttl || 300; // Default 5 minutes
        void this.redisService.set(cacheKey, result, ttl);
      }),
    );
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
