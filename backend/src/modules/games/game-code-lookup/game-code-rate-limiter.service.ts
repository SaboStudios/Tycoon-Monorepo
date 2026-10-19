import {
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import { RedisService } from '../../redis/redis.service';
import { GameCodeLookupErrorCode } from './game-code';

export interface GameCodeLookupLimits {
  windowSeconds: number;
  perUserLimit: number;
  perIpLimit: number;
  missLimit: number;
  lockoutSeconds: number;
}

export interface GameCodeLookupCaller {
  userId: number | string;
  ip: string | undefined;
}

const DEFAULT_LIMITS: GameCodeLookupLimits = {
  windowSeconds: 60,
  perUserLimit: 20,
  perIpLimit: 60,
  missLimit: 10,
  lockoutSeconds: 900,
};

/**
 * All keys share the `{gcl}` hash tag so the Lua scripts stay single-slot on
 * Redis Cluster.
 */
const KEY_PREFIX = '{gcl}';

/**
 * Atomically: reject if the caller's user or IP is locked out by misses,
 * otherwise count this attempt against the per-user and per-IP windows.
 * Returns [verdict, retryAfterSeconds]; verdict 0 = allowed.
 */
const CONSUME_ATTEMPT_SCRIPT = `
local userMisses = tonumber(redis.call('GET', KEYS[1]) or '0')
if userMisses >= tonumber(ARGV[1]) then return {1, redis.call('TTL', KEYS[1])} end
local ipMisses = tonumber(redis.call('GET', KEYS[2]) or '0')
if ipMisses >= tonumber(ARGV[1]) * 3 then return {1, redis.call('TTL', KEYS[2])} end
local u = redis.call('INCR', KEYS[3])
if u == 1 then redis.call('EXPIRE', KEYS[3], ARGV[4]) end
local i = redis.call('INCR', KEYS[4])
if i == 1 then redis.call('EXPIRE', KEYS[4], ARGV[4]) end
if u > tonumber(ARGV[2]) then return {2, redis.call('TTL', KEYS[3])} end
if i > tonumber(ARGV[3]) then return {3, redis.call('TTL', KEYS[4])} end
return {0, 0}
`;

/** Count a miss for both user and IP; the first miss starts the lockout TTL. */
const RECORD_MISS_SCRIPT = `
for _, key in ipairs(KEYS) do
  local c = redis.call('INCR', key)
  if c == 1 then redis.call('EXPIRE', key, ARGV[1]) end
end
return 1
`;

/**
 * Anti-enumeration limiter for game code lookups.
 *
 * Game codes are 6 chars of [A-Z0-9] (~2.2e9 values), so a lookup endpoint
 * without limits is a join-anything oracle for private games. This limiter:
 *   - caps lookups per user and per client IP per window,
 *   - locks a user (and, at 3× the threshold, an IP) out after repeated misses,
 *   - fails CLOSED (503) when Redis is unavailable.
 *
 * Keys hold a truncated SHA-256 of the IP, never the raw address.
 * Runbook: backend/docs/GAMES_MATCHMAKING_RUNBOOK.md#game-code-anti-enumeration
 */
@Injectable()
export class GameCodeRateLimiterService {
  private readonly logger = new Logger(GameCodeRateLimiterService.name);
  private readonly limits: GameCodeLookupLimits;

  constructor(
    private readonly redis: RedisService,
    configService: ConfigService,
  ) {
    this.limits = {
      ...DEFAULT_LIMITS,
      ...(configService.get<GameCodeLookupLimits>('game.codeLookup') ?? {}),
    };
  }

  /** Throws 429 (RATE_LIMITED) or 503 (DEPENDENCY_UNAVAILABLE). */
  async consumeAttempt(caller: GameCodeLookupCaller): Promise<void> {
    const keys = this.keysFor(caller);
    let result: [number, number];
    try {
      result = await this.redis.evalStrict<[number, number]>(
        CONSUME_ATTEMPT_SCRIPT,
        [keys.userMisses, keys.ipMisses, keys.userAttempts, keys.ipAttempts],
        [
          this.limits.missLimit,
          this.limits.perUserLimit,
          this.limits.perIpLimit,
          this.limits.windowSeconds,
        ],
      );
    } catch (err) {
      throw this.unavailable(err);
    }

    const [verdict, ttl] = result;
    if (verdict !== 0) {
      throw this.rateLimited(
        ttl > 0
          ? ttl
          : verdict === 1
            ? this.limits.lockoutSeconds
            : this.limits.windowSeconds,
      );
    }
  }

  /** Record a lookup that did not resolve to a game (unknown or malformed). */
  async recordMiss(caller: GameCodeLookupCaller): Promise<void> {
    const keys = this.keysFor(caller);
    try {
      await this.redis.evalStrict<number>(
        RECORD_MISS_SCRIPT,
        [keys.userMisses, keys.ipMisses],
        [this.limits.lockoutSeconds],
      );
    } catch (err) {
      throw this.unavailable(err);
    }
  }

  private keysFor(caller: GameCodeLookupCaller) {
    const user = String(caller.userId);
    const ip = createHash('sha256')
      .update(caller.ip ?? 'unknown')
      .digest('hex')
      .slice(0, 16);
    return {
      userAttempts: `${KEY_PREFIX}:att:u:${user}`,
      ipAttempts: `${KEY_PREFIX}:att:ip:${ip}`,
      userMisses: `${KEY_PREFIX}:miss:u:${user}`,
      ipMisses: `${KEY_PREFIX}:miss:ip:${ip}`,
    };
  }

  private rateLimited(retryAfterSeconds: number): HttpException {
    return new HttpException(
      {
        message: 'Too many game code lookups. Try again later.',
        code: GameCodeLookupErrorCode.RATE_LIMITED,
        retryAfterSeconds,
      },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }

  private unavailable(err: unknown): ServiceUnavailableException {
    this.logger.error(
      `Game code limiter unavailable, failing closed: ${(err as Error)?.message ?? err}`,
    );
    return new ServiceUnavailableException({
      message: 'Game code lookup is temporarily unavailable.',
      code: GameCodeLookupErrorCode.DEPENDENCY_UNAVAILABLE,
    });
  }
}
