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
    const cacheKey = this.generateCacheKey(request);

    // Only cache GET requests
    if (request.method !== 'GET') {
      return next.handle();
    }

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

  private generateCacheKey(request: {
    method: string;
    url: string;
    query: Record<string, unknown>;
    user?: { id: string };
  }): string {
    const { method, url, query, user } = request;
    const userId = user?.id || 'anonymous';
    return `cache:${method}:${url}:${userId}:${JSON.stringify(query)}`;
  }
}
