import {
  CallHandler,
  ConflictException,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, of, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { RedisService } from '../../redis/redis.service';
import { IDEMPOTENT_KEY, IdempotentOptions } from '../decorators/idempotent.decorator';

interface CachedResponse {
  status: 'in_progress' | 'completed';
  body?: unknown;
}

/**
 * Idempotency interceptor for mutating entrypoints (privacy export/erasure,
 * purchases, admin mutations).
 *
 * Guarantees:
 *  - Duplicate requests carrying the same idempotency key return the original
 *    response instead of re-executing side effects.
 *  - Concurrent duplicates are rejected with 409 while the first request is
 *    still in flight (fail-closed, no double execution).
 *  - If the idempotency store (Redis) is unavailable we fail closed with 503
 *    rather than risk executing a non-idempotent write twice.
 */
@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly redis: RedisService,
  ) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<unknown>> {
    const options = this.reflector.getAllAndOverride<IdempotentOptions>(IDEMPOTENT_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!options) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest();
    const key = this.resolveKey(request, options);

    if (!key) {
      if (options.required) {
        throw new ConflictException({
          code: 'IDEMPOTENCY_KEY_REQUIRED',
          message: 'An idempotency key is required for this operation.',
        });
      }
      return next.handle();
    }

    const storageKey = `${options.namespace ?? 'idempotency'}:${key}`;

    let existing: CachedResponse | null;
    try {
      existing = await this.redis.getJson<CachedResponse>(storageKey);
    } catch {
      // Dependency outage: fail closed on writes.
      throw new ServiceUnavailableException({
        code: 'IDEMPOTENCY_STORE_UNAVAILABLE',
        message: 'Idempotency store unavailable, please retry shortly.',
      });
    }

    if (existing?.status === 'completed') {
      return of(existing.body);
    }

    if (existing?.status === 'in_progress') {
      throw new ConflictException({
        code: 'IDEMPOTENCY_IN_PROGRESS',
        message: 'A request with this idempotency key is already in progress.',
      });
    }

    try {
      await this.redis.setJson(
        storageKey,
        { status: 'in_progress' } satisfies CachedResponse,
        options.ttlSeconds ?? 86_400,
      );
    } catch {
      throw new ServiceUnavailableException({
        code: 'IDEMPOTENCY_STORE_UNAVAILABLE',
        message: 'Idempotency store unavailable, please retry shortly.',
      });
    }

    return next.handle().pipe(
      tap((body) => {
        void this.redis
          .setJson(storageKey, { status: 'completed', body } satisfies CachedResponse, options.ttlSeconds ?? 86_400)
          .catch(() => undefined);
      }),
      catchError((error) => {
        // Release the in-progress marker so the caller can retry after a failure.
        void this.redis.del(storageKey).catch(() => undefined);
        return throwError(() => error);
      }),
    );
  }

  private resolveKey(request: Record<string, any>, options: IdempotentOptions): string | null {
    const header = request.headers?.[options.header ?? 'idempotency-key'];
    const fromHeader = Array.isArray(header) ? header[0] : header;
    const fromBody = options.bodyField ? request.body?.[options.bodyField] : undefined;
    const raw = fromHeader ?? fromBody;

    if (typeof raw !== 'string' || raw.trim().length === 0) {
      return null;
    }

    // Scope the key to the authenticated principal so one user cannot replay
    // or collide with another user's idempotency keys.
    const principal = request.user?.id ?? request.user?.sub ?? 'anonymous';
    return `${principal}:${raw.trim()}`;
  }
}
