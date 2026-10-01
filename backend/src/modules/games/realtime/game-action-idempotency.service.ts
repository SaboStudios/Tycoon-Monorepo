import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../../redis/redis.service';
import {
  GameActionIntent,
  gameActionIdempotencyKey,
  hashGameActionIntent,
  IDEMPOTENT_TTL_MS,
} from '../../../common/decorators/idempotent.decorator';
import { GameActionError, GameActionErrorCode } from './game-action.error';

interface StoredActionRecord {
  bodyHash: string;
  response: unknown;
  expiresAt: number;
}

export interface ActionOutcome<T> {
  result: T;
  /** True when the result was replayed from a prior execution of this key. */
  replayed: boolean;
}

const CLAIM_TTL_SECONDS = 60;

/**
 * Action idempotency for WS intents (ADR-002 §5), coordinated with the REST
 * write path via the shared `gameActionIdempotencyKey`/`hashGameActionIntent`
 * helpers so a reconnect replay or duplicate tab can never double-apply a
 * roll.
 *
 * Semantics (mirrors the HTTP idempotency interceptor):
 *  - same key + same intent  → prior result is returned, nothing re-applied;
 *  - same key + other intent → DUPLICATE_ACTION, fail closed;
 *  - Redis outage            → DEPENDENCY_UNAVAILABLE, fail closed on writes;
 *  - concurrent claim        → DUPLICATE_ACTION while the first is in flight.
 */
@Injectable()
export class GameActionIdempotencyService {
  private readonly logger = new Logger(GameActionIdempotencyService.name);

  constructor(private readonly redis: RedisService) {}

  async execute<T>(
    intent: GameActionIntent,
    fn: () => Promise<T>,
  ): Promise<ActionOutcome<T>> {
    const storeKey = gameActionIdempotencyKey(intent);
    const bodyHash = hashGameActionIntent(intent);

    const existing = await this.redis.get<StoredActionRecord>(storeKey);
    if (existing) {
      if (existing.bodyHash !== bodyHash) {
        throw new GameActionError(GameActionErrorCode.DUPLICATE_ACTION, {
          message: 'Idempotency key was reused with a different payload',
        });
      }
      return { result: existing.response as T, replayed: true };
    }

    const claimKey = `${storeKey}:lock`;
    const claims = await this.redis.incrementRateLimit(
      claimKey,
      CLAIM_TTL_SECONDS,
    );
    if (claims === 0) {
      this.logger.error('Idempotency claim failed; Redis unavailable');
      throw new GameActionError(GameActionErrorCode.DEPENDENCY_UNAVAILABLE, {
        message: 'Idempotency store unavailable; action not applied',
      });
    }
    if (claims > 1) {
      throw new GameActionError(GameActionErrorCode.DUPLICATE_ACTION, {
        message: 'Identical action already in flight',
      });
    }

    try {
      const result = await fn();
      await this.redis.set<StoredActionRecord>(
        storeKey,
        {
          bodyHash,
          response: result,
          expiresAt: Date.now() + IDEMPOTENT_TTL_MS,
        },
        IDEMPOTENT_TTL_MS,
      );
      await this.redis.del(claimKey);
      return { result, replayed: false };
    } catch (err) {
      // Release the claim so a corrected retry can proceed; never store
      // failures — only committed outcomes are replayable.
      await this.redis.del(claimKey);
      throw err;
    }
  }
}
