import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  BadRequestException,
  ConflictException,
  HttpStatus,
  ServiceUnavailableException,
} from '@nestjs/common';
import { createHash } from 'crypto';
import { Observable, from, of, throwError } from 'rxjs';
import { catchError, concatMap } from 'rxjs/operators';
import { RedisService } from '../../modules/redis/redis.service';
import { Reflector } from '@nestjs/core';
import { IDEMPOTENT_KEY } from '../decorators/idempotent.decorator';

/** Completed responses are replayable for 24h (SW-BE-033). */
export const IDEMPOTENCY_RESPONSE_TTL_SECONDS = 24 * 60 * 60;
/** In-flight claims expire quickly so a crashed handler cannot wedge a key. */
export const IDEMPOTENCY_LOCK_TTL_SECONDS = 60;
/** Keys are client-generated UUIDs/ULIDs; anything else is rejected. */
const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9_.:-]{1,128}$/;

interface StoredIdempotentResponse {
  statusCode: number;
  body: unknown;
  bodyHash?: string;
}

/**
 * Stable SHA-256 of the request body. Object keys are sorted so that
 * `{a,b}` and `{b,a}` hash identically; a changed value hashes differently.
 */
export function hashRequestBody(body: unknown): string {
  const canonical = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(canonical);
    if (value && typeof value === 'object') {
      return Object.keys(value as Record<string, unknown>)
        .sort()
        .reduce<Record<string, unknown>>((acc, key) => {
          acc[key] = canonical((value as Record<string, unknown>)[key]);
          return acc;
        }, {});
    }
    return value;
  };
  return createHash('sha256')
    .update(JSON.stringify(canonical(body ?? null)))
    .digest('hex');
}

/**
 * Claim / complete / fail idempotency for routes marked `@Idempotent()`
 * (SW-BE-033):
 *
 * - replay with the same body  → stored response, `X-Idempotency-Replayed: true`
 * - replay with a different body → 409 (payload conflict)
 * - same key while in flight    → 409
 * - handler error               → claim released so the client can retry
 * - Redis unavailable           → 503; the handler never runs (fail closed)
 */
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
    const idempotencyKey: string | undefined =
      request.headers['x-idempotency-key'] ?? request.headers['idempotency-key'];

    if (!idempotencyKey) {
      // If the decorator is present, we require the key
      throw new BadRequestException('X-Idempotency-Key header is required');
    }
    if (!IDEMPOTENCY_KEY_PATTERN.test(idempotencyKey)) {
      throw new BadRequestException(
        'X-Idempotency-Key must be 1-128 characters of [A-Za-z0-9_.:-]',
      );
    }

    // The raw key is hashed so it never appears in RedisService cache logs.
    const userId = request.user?.id;
    const keyDigest = createHash('sha256')
      .update(idempotencyKey)
      .digest('hex')
      .slice(0, 32);
    const redisKey = `idempotency:${userId || 'anon'}:${keyDigest}`;
    const bodyHash = hashRequestBody(request.body);

    // Check if we have a cached response
    const cachedResponse =
      await this.redisService.get<StoredIdempotentResponse>(redisKey);
    if (cachedResponse) {
      // Records written before body hashing existed carry no hash; replay them.
      if (
        typeof cachedResponse.bodyHash === 'string' &&
        cachedResponse.bodyHash !== bodyHash
      ) {
        throw new ConflictException(
          'Idempotency-Key was already used with a different request body',
        );
      }
      const response = context.switchToHttp().getResponse();
      response.status(cachedResponse.statusCode);
      response.setHeader?.('X-Idempotency-Replayed', 'true');
      return of(cachedResponse.body);
    }

    // Claim the key. incrementRateLimit returns 0 when Redis is unreachable;
    // treat that as an outage rather than a successful claim so a write can
    // never run without duplicate protection.
    const lockKey = `${redisKey}:lock`;
    const claims = await this.redisService.incrementRateLimit(
      lockKey,
      IDEMPOTENCY_LOCK_TTL_SECONDS,
    );
    if (claims === 0) {
      throw new ServiceUnavailableException(
        'Idempotency store unavailable; request was not processed',
      );
    }
    if (claims > 1) {
      throw new ConflictException(
        'A request with this idempotency key is already in progress',
      );
    }

    return next.handle().pipe(
      concatMap((body) =>
        from(
          (async () => {
            const response = context.switchToHttp().getResponse();
            const statusCode = response.statusCode || HttpStatus.OK;
            await this.redisService.set(
              redisKey,
              { statusCode, body, bodyHash } satisfies StoredIdempotentResponse,
              IDEMPOTENCY_RESPONSE_TTL_SECONDS,
            );
            await this.redisService.del(lockKey);
            return body;
          })(),
        ),
      ),
      catchError((error) =>
        // Errors are not cached: release the claim so a retry can proceed.
        from(this.redisService.del(lockKey)).pipe(
          concatMap(() => throwError(() => error)),
        ),
      ),
    );
  }
}
