import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../../redis/redis.service';

interface WindowCounter {
  count: number;
  resetAt: number;
}

export interface WsRateLimits {
  joinPerSocket: number;
  joinPerUser: number;
  rollPerSocket: number;
  rollPerUser: number;
  windowSeconds: number;
}

const DEFAULT_LIMITS: WsRateLimits = {
  joinPerSocket: 10,
  joinPerUser: 30,
  rollPerSocket: 30,
  rollPerUser: 90,
  windowSeconds: 60,
};

const KEY_PREFIX = 'ws_rl';

/**
 * Fixed-window rate limiter for `game:join` and `game:roll`
 * (ADR-002 §4: per socket and per game; runbook § Rate limiting: per user and
 * per socket).
 *
 * Redis is the cross-instance store when available. When Redis is unreachable
 * (`incrementRateLimit` returns 0) the limiter degrades to a per-instance
 * in-memory window instead of failing open silently or blocking play —
 * the multi-instance limit is then best-effort until Redis recovers, which is
 * documented in GAMES_MATCHMAKING_RUNBOOK.md.
 */
@Injectable()
export class WsRateLimiterService {
  private readonly logger = new Logger(WsRateLimiterService.name);
  private readonly limits: WsRateLimits;
  private readonly local = new Map<string, WindowCounter>();
  private redisUnavailableLogged = false;

  constructor(private readonly redis: RedisService) {
    this.limits = { ...DEFAULT_LIMITS };
  }

  /**
   * Returns true when the intent is allowed, false when it exceeded the
   * per-socket or per-user budget for this window. `join` has its own budget;
   * `roll`, `end-turn` and `chat` share the action budget (runbook § Rate
   * limiting: per user and per socket).
   */
  async consume(
    action: 'join' | 'roll' | 'end-turn' | 'chat',
    socketId: string,
    userId: number,
  ): Promise<boolean> {
    // `join` has its own budget; roll/end-turn/chat share one action bucket.
    const bucket = action === 'join' ? 'join' : 'action';
    const socketBudget =
      action === 'join' ? this.limits.joinPerSocket : this.limits.rollPerSocket;
    const userBudget =
      action === 'join' ? this.limits.joinPerUser : this.limits.rollPerUser;

    const socketKey = `${KEY_PREFIX}:${bucket}:socket:${socketId}`;
    const userKey = `${KEY_PREFIX}:${bucket}:user:${userId}`;

    const [socketCount, userCount] = await Promise.all([
      this.increment(socketKey),
      this.increment(userKey),
    ]);

    return socketCount <= socketBudget && userCount <= userBudget;
  }

  private async increment(key: string): Promise<number> {
    const redisCount = await this.redis.incrementRateLimit(
      key,
      this.limits.windowSeconds,
    );
    if (redisCount > 0) {
      return redisCount;
    }

    // Redis unreachable → per-instance fallback window so a single instance
    // can never be flooded; cross-instance precision resumes with Redis.
    if (!this.redisUnavailableLogged) {
      this.redisUnavailableLogged = true;
      this.logger.warn(
        'Redis unavailable; WS rate limiting degrading to per-instance windows',
      );
    }
    return this.incrementLocal(key);
  }

  private incrementLocal(key: string): number {
    const now = Date.now();
    const entry = this.local.get(key);
    if (!entry || entry.resetAt <= now) {
      this.local.set(key, {
        count: 1,
        resetAt: now + this.limits.windowSeconds * 1000,
      });
      return 1;
    }
    entry.count += 1;

    // Bound memory: drop stale windows opportunistically.
    if (this.local.size > 10_000) {
      for (const [k, v] of this.local) {
        if (v.resetAt <= now) this.local.delete(k);
      }
    }
    return entry.count;
  }
}
