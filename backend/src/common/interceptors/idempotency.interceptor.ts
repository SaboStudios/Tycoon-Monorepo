import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  BadRequestException,
  HttpStatus,
} from '@nestjs/common';
import { Observable, of } from 'rxjs';
import { tap } from 'rxjs/operators';
import { RedisService } from '../../modules/redis/redis.service';
import { Reflector } from '@nestjs/core';
import { IDEMPOTENT_KEY } from '../decorators/idempotent.decorator';

@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  constructor(
    private readonly redisService: RedisService,
    private readonly reflector: Reflector,
  ) {}

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<any>> {
    const isIdempotent = this.reflector.get<boolean>(
      IDEMPOTENT_KEY,
      context.getHandler(),
    );

    if (!isIdempotent) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest();
    const idempotencyKey = request.headers['x-idempotency-key'];

    if (!idempotencyKey) {
      // If the decorator is present, we require the key
      throw new BadRequestException('X-Idempotency-Key header is required');
    }

    const userId = request.user?.id;
    const redisKey = `idempotency:${userId || 'anon'}:${idempotencyKey}`;

    // Check if we have a cached response
    const cachedResponse = await this.redisService.get(redisKey);
    if (cachedResponse) {
      const { statusCode, body } = cachedResponse as {
        statusCode: number;
        body: any;
      };
      const response = context.switchToHttp().getResponse();
      response.status(statusCode);
      return of(body);
    }

    // Handle concurrent requests with the same key using a temporary lock
    const lockKey = `${redisKey}:lock`;
    const acquiredLock = await this.redisService.incrementRateLimit(lockKey, 10);
    if (acquiredLock > 1) {
      throw new BadRequestException(
        'A request with this idempotency key is already in progress',
      );
    }

    return next.handle().pipe(
      tap(async (body) => {
        const response = context.switchToHttp().getResponse();
        const statusCode = response.statusCode || HttpStatus.OK;

        // Cache the response for 24 hours
        await this.redisService.set(
          redisKey,
          { statusCode, body },
          24 * 60 * 60,
        );
        await this.redisService.del(lockKey);
      }),
    );
  }
}
