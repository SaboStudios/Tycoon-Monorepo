import {
  CanActivate,
  ExecutionContext,
  HttpException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { HttpMetricsService } from '../../metrics/http-metrics.service';
import { GameCodeRateLimiterService } from './game-code-rate-limiter.service';

/**
 * Consumes one game-code lookup attempt before the handler runs. Guards run
 * ahead of the global CacheInterceptor, so cached responses still count.
 *
 * Must be listed AFTER JwtAuthGuard: `@UseGuards(JwtAuthGuard, GameCodeLookupGuard)`.
 * Deny-by-default when no authenticated user is present.
 */
@Injectable()
export class GameCodeLookupGuard implements CanActivate {
  constructor(
    private readonly limiter: GameCodeRateLimiterService,
    private readonly metrics: HttpMetricsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context
      .switchToHttp()
      .getRequest<Request & { user?: { id?: number | string } }>();
    const userId = req.user?.id;
    if (userId === undefined || userId === null) {
      throw new UnauthorizedException();
    }

    try {
      await this.limiter.consumeAttempt({ userId, ip: req.ip });
    } catch (err) {
      this.metrics.recordGameCodeLookup(
        err instanceof HttpException && err.getStatus() === 429
          ? 'rate_limited'
          : 'unavailable',
      );
      throw err;
    }
    return true;
  }
}
