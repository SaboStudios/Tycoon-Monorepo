import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable, of } from 'rxjs';
import { tap } from 'rxjs/operators';
import { RedisService } from '../../modules/redis/redis.service';

@Injectable()
export class CacheInterceptor implements NestInterceptor {
  constructor(private readonly redisService: RedisService) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<any>> {
    const request = context.switchToHttp().getRequest();
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
      tap(async (result) => {
        await this.redisService.set(cacheKey, result, 300); // 5 minutes TTL
      }),
    );
  }

  private generateCacheKey(request: any): string {
    const { method, url, query, user } = request;
    const userId = user?.id || 'anonymous';
    return `cache:${method}:${url}:${userId}:${JSON.stringify(query)}`;
  }
}