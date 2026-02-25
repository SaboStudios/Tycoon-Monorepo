import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RedisService } from '../../modules/redis/redis.service';

export const RateLimit = (limit: number, ttl: number = 60) =>
  Reflect.metadata('rateLimit', { limit, ttl });

@Injectable()
export class RedisRateLimitGuard implements CanActivate {
  constructor(
    private readonly redisService: RedisService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const rateLimitConfig = this.reflector.get<
      | {
          limit: number;
          ttl: number;
        }
      | undefined
    >('rateLimit', context.getHandler());
    if (!rateLimitConfig) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{
      ip: string;
      route?: { path: string };
      url: string;
    }>();
    const key = `rate_limit:${request.ip}:${request.route?.path || request.url}`;

    const current = await this.redisService.incrementRateLimit(
      key,
      Number(rateLimitConfig.ttl),
    );

    if (current > rateLimitConfig.limit) {
      throw new HttpException(
        'Rate limit exceeded',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return true;
  }
}
