import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable, of } from 'rxjs';
import { tap } from 'rxjs/operators';
import { RedisService } from '../../modules/redis/redis.service';

@Injectable()
export class CacheInterceptor implements NestInterceptor {
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

    const cacheKey = await this.generateCacheKey(request);

    // Check cache first
    const cachedResult = await this.redisService.get(cacheKey);
    if (cachedResult) {
      return of(cachedResult);
    }

    // Execute request and cache result
    return next.handle().pipe(
      tap((result: unknown) => {
        void this.redisService.set(cacheKey, result, 300); // 5 minutes TTL
      }),
    );
  }

  /**
   * Generate a cache key with optional version component.
   * For versioned resources (e.g., shop catalog), includes the current cache version
   * so that when the version increments, old cached entries are naturally missed.
   */
  private async generateCacheKey(request: {
    method: string;
    url: string;
    query: Record<string, unknown>;
    user?: { id: string };
  }): Promise<string> {
    const { method, url, query, user } = request;
    const userId = user?.id || 'anonymous';

    // Include cache version for shop catalog endpoints
    let versionComponent = '';
    if (url.includes('/shop/items') && !url.includes('/admin')) {
      const version = await this.redisService.getCacheVersion('shop:catalog');
      versionComponent = `:v${version}`;
    }

    return `cache:${method}:${url}:${userId}:${JSON.stringify(query)}${versionComponent}`;
  }
}
