import { Injectable } from '@nestjs/common';

/**
 * Canonical idempotency helper for claim/complete/fail pattern.
 * Shared by all modules (shop, uploads, etc.) to ensure consistent replay behavior.
 */
export interface IdempotencyRecord {
  status: 'in_flight' | 'complete' | 'failed';
  response?: unknown;
  timestamp: number;
}

export interface IdempotencyOptions {
  inFlightTtl?: number; // seconds; default 60
  completeTtl?: number; // seconds; default 86400 (24h)
}

/**
 * Generic Redis store interface; implementations can use ioredis.Redis or RedisService.
 * This decouples the helper from any specific Redis provider.
 */
export interface RedisStore {
  get(key: string): Promise<string | null>;
  setex(key: string, ttl: number, value: string): Promise<void>;
  set(key: string, value: string, ...args: any[]): Promise<any>;
  del(key: string): Promise<void>;
}

@Injectable()
export class IdempotencyHelper {
  private readonly PREFIX = 'idempotency:';
  private readonly DEFAULT_IN_FLIGHT_TTL = 60;
  private readonly DEFAULT_COMPLETE_TTL = 86_400; // 24h

  constructor(private readonly redis: RedisStore) {}

  /**
   * Claim a key atomically. Rejects if already in-flight or complete.
   * Returns true if claimed, false if already exists.
   */
  async claim(
    key: string,
    options: IdempotencyOptions = {},
  ): Promise<boolean> {
    const prefixedKey = this.PREFIX + key;
    const ttl = options.inFlightTtl ?? this.DEFAULT_IN_FLIGHT_TTL;

    const record: IdempotencyRecord = {
      status: 'in_flight',
      timestamp: Date.now(),
    };

    try {
      // SET key value EX ttl NX — only succeeds if key does not exist
      const result = await this.redis.set(
        prefixedKey,
        JSON.stringify(record),
        'EX',
        ttl,
        'NX',
      );
      return result === 'OK';
    } catch {
      // Fail open: allow the request if Redis is down
      return true;
    }
  }

  /**
   * Get cached result if operation is complete or in-flight.
   */
  async get(key: string): Promise<IdempotencyRecord | null> {
    const prefixedKey = this.PREFIX + key;

    try {
      const data = await this.redis.get(prefixedKey);
      if (!data) return null;
      return JSON.parse(data) as IdempotencyRecord;
    } catch {
      return null;
    }
  }

  /**
   * Mark operation as complete with cached response.
   * Called after the operation succeeds.
   */
  async complete(
    key: string,
    response: unknown,
    options: IdempotencyOptions = {},
  ): Promise<void> {
    const prefixedKey = this.PREFIX + key;
    const ttl = options.completeTtl ?? this.DEFAULT_COMPLETE_TTL;

    const record: IdempotencyRecord = {
      status: 'complete',
      response,
      timestamp: Date.now(),
    };

    try {
      await this.redis.setex(
        prefixedKey,
        ttl,
        JSON.stringify(record),
      );
    } catch {
      // Fail silently; cache miss is not fatal
    }
  }

  /**
   * Mark operation as failed and clear the key.
   * Called when the operation fails; allows retries.
   */
  async fail(key: string): Promise<void> {
    const prefixedKey = this.PREFIX + key;

    try {
      await this.redis.del(prefixedKey);
    } catch {
      // Fail silently
    }
  }

  /**
   * Explicitly clear a key (e.g., for cleanup or testing).
   */
  async clear(key: string): Promise<void> {
    const prefixedKey = this.PREFIX + key;

    try {
      await this.redis.del(prefixedKey);
    } catch {
      // Fail silently
    }
  }
}
