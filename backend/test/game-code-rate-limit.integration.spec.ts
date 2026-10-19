/**
 * Exercises the game-code anti-enumeration Lua scripts against a real Redis
 * (CI `backend-integration` job provides redis:7). Unit specs mock evalStrict,
 * so this is the only place the scripts themselves are verified.
 */
import { ConfigService } from '@nestjs/config';
import { HttpException } from '@nestjs/common';
import Redis from 'ioredis';
import { RedisService } from '../src/modules/redis/redis.service';
import { GameCodeRateLimiterService } from '../src/modules/games/game-code-lookup/game-code-rate-limiter.service';

const limits = {
  windowSeconds: 60,
  perUserLimit: 3,
  perIpLimit: 5,
  missLimit: 2,
  lockoutSeconds: 120,
};

describe('Game code rate limiter (Redis integration)', () => {
  let redisService: RedisService;
  let limiter: GameCodeRateLimiterService;
  let raw: Redis;
  const run = Date.now();

  const redisAt = (port: number) =>
    // The cache manager is unused by evalStrict; skipping RedisModule avoids
    // leaving a cache-store connection open after the suite.
    new RedisService(
      {} as never,
      {
        get: () => ({
          host: process.env.REDIS_HOST ?? 'localhost',
          port,
          db: 0,
        }),
      } as unknown as ConfigService,
    );

  beforeAll(() => {
    redisService = redisAt(Number(process.env.REDIS_PORT ?? 6379));
    limiter = new GameCodeRateLimiterService(redisService, {
      get: () => limits,
    } as unknown as ConfigService);
    raw = new Redis({
      host: process.env.REDIS_HOST ?? 'localhost',
      port: Number(process.env.REDIS_PORT ?? 6379),
    });
  });

  afterAll(async () => {
    const keys = await raw.keys('{gcl}:*');
    if (keys.length) await raw.del(...keys);
    await raw.quit();
    await redisService.quit();
  });

  const status = (p: Promise<void>) =>
    p.then(
      () => 200,
      (e: HttpException) => e.getStatus(),
    );

  it('caps attempts per user within the window', async () => {
    const caller = { userId: `u-${run}-a`, ip: `10.0.${run % 250}.1` };
    const results: number[] = [];
    for (let i = 0; i < 4; i++)
      results.push(await status(limiter.consumeAttempt(caller)));
    expect(results).toEqual([200, 200, 200, 429]);
  });

  it('caps attempts per IP across different users', async () => {
    const ip = `10.1.${run % 250}.2`;
    const results: number[] = [];
    for (let i = 0; i < 6; i++) {
      results.push(
        await status(
          limiter.consumeAttempt({ userId: `u-${run}-ip-${i}`, ip }),
        ),
      );
    }
    expect(results).toEqual([200, 200, 200, 200, 200, 429]);
  });

  it('locks a user out after missLimit misses, with a TTL for Retry-After', async () => {
    const caller = { userId: `u-${run}-miss`, ip: `10.2.${run % 250}.3` };
    await limiter.recordMiss(caller);
    await limiter.recordMiss(caller);
    const err = await limiter
      .consumeAttempt(caller)
      .catch((e: HttpException) => e);
    expect(err).toBeInstanceOf(HttpException);
    expect((err as HttpException).getStatus()).toBe(429);
    const body = (err as HttpException).getResponse() as {
      code: string;
      retryAfterSeconds: number;
    };
    expect(body.code).toBe('RATE_LIMITED');
    expect(body.retryAfterSeconds).toBeGreaterThan(0);
    expect(body.retryAfterSeconds).toBeLessThanOrEqual(limits.lockoutSeconds);
  });

  it('fails closed with 503 quickly when Redis is unreachable', async () => {
    const deadRedis = redisAt(1);
    const deadLimiter = new GameCodeRateLimiterService(deadRedis, {
      get: () => limits,
    } as unknown as ConfigService);
    const started = Date.now();
    const code = await status(
      deadLimiter.consumeAttempt({ userId: `u-${run}-dead`, ip: '10.9.9.9' }),
    );
    expect(code).toBe(503);
    expect(Date.now() - started).toBeLessThan(2000);
    // quit() waits on a connection that never opens; drop the socket instead.
    (deadRedis as unknown as { redis: Redis }).redis.disconnect();
  });

  it('sets a TTL on every key it creates (no immortal counters)', async () => {
    const keys = await raw.keys('{gcl}:*');
    expect(keys.length).toBeGreaterThan(0);
    for (const key of keys) {
      expect(await raw.ttl(key)).toBeGreaterThan(0);
    }
  });
});
