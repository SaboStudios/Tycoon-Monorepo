import { HttpException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../../redis/redis.service';
import { GameCodeRateLimiterService } from './game-code-rate-limiter.service';

/** Resolve to the rejection of `p`; fails the test if `p` resolves. */
async function rejectionOf<T = HttpException>(p: Promise<unknown>): Promise<T> {
  try {
    await p;
  } catch (e) {
    return e as T;
  }
  throw new Error('expected promise to reject');
}

describe('GameCodeRateLimiterService', () => {
  const limits = {
    windowSeconds: 60,
    perUserLimit: 5,
    perIpLimit: 10,
    missLimit: 3,
    lockoutSeconds: 900,
  };
  let evalStrict: jest.Mock<
    Promise<unknown>,
    [string, string[], Array<string | number>]
  >;
  let limiter: GameCodeRateLimiterService;

  beforeEach(() => {
    evalStrict = jest.fn<
      Promise<unknown>,
      [string, string[], Array<string | number>]
    >();
    const redis = { evalStrict } as unknown as RedisService;
    const config = {
      get: jest.fn().mockReturnValue(limits),
    } as unknown as ConfigService;
    limiter = new GameCodeRateLimiterService(redis, config);
  });

  const caller = { userId: 42, ip: '203.0.113.7' };

  it('allows the attempt when the script returns verdict 0', async () => {
    evalStrict.mockResolvedValue([0, 0]);
    await expect(limiter.consumeAttempt(caller)).resolves.toBeUndefined();

    const [, keys, args] = evalStrict.mock.calls[0];
    expect(args).toEqual([3, 5, 10, 60]);
    // Keys never contain the raw IP, and share one Redis Cluster hash slot.
    expect(keys.join(' ')).not.toContain('203.0.113.7');
    expect(keys.every((k) => k.startsWith('{gcl}:'))).toBe(true);
    expect(keys).toContain('{gcl}:att:u:42');
  });

  it.each([
    [1, 'miss lockout'],
    [2, 'per-user window'],
    [3, 'per-IP window'],
  ])('throws 429 RATE_LIMITED for verdict %i (%s)', async (verdict) => {
    evalStrict.mockResolvedValue([verdict, 17]);
    const err = await rejectionOf(limiter.consumeAttempt(caller));
    expect(err).toBeInstanceOf(HttpException);
    expect(err.getStatus()).toBe(429);
    expect(err.getResponse()).toMatchObject({
      code: 'RATE_LIMITED',
      retryAfterSeconds: 17,
    });
  });

  it('falls back to the configured window when TTL is unavailable', async () => {
    evalStrict.mockResolvedValue([1, -1]);
    const err = await rejectionOf(limiter.consumeAttempt(caller));
    expect(
      (err.getResponse() as { retryAfterSeconds: number }).retryAfterSeconds,
    ).toBe(900);
  });

  it('fails closed with 503 when Redis errors on consume', async () => {
    evalStrict.mockRejectedValue(new Error('ECONNREFUSED'));
    const err = await rejectionOf(limiter.consumeAttempt(caller));
    expect(err).toBeInstanceOf(ServiceUnavailableException);
    expect(err.getResponse()).toMatchObject({
      code: 'DEPENDENCY_UNAVAILABLE',
    });
  });

  it('records misses against user and IP with the lockout TTL', async () => {
    evalStrict.mockResolvedValue(1);
    await limiter.recordMiss(caller);
    const [, keys, args] = evalStrict.mock.calls[0];
    expect(keys).toEqual([
      '{gcl}:miss:u:42',
      expect.stringMatching(/^\{gcl\}:miss:ip:[0-9a-f]{16}$/),
    ]);
    expect(args).toEqual([900]);
  });

  it('fails closed with 503 when Redis errors on recordMiss', async () => {
    evalStrict.mockRejectedValue(new Error('timeout'));
    await expect(limiter.recordMiss(caller)).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it('uses defaults when game.codeLookup config is missing', async () => {
    const redis = { evalStrict } as unknown as RedisService;
    const config = { get: jest.fn() } as unknown as ConfigService;
    const fallback = new GameCodeRateLimiterService(redis, config);
    evalStrict.mockResolvedValue([0, 0]);
    await fallback.consumeAttempt(caller);
    expect(evalStrict.mock.calls[0][2]).toEqual([10, 20, 60, 60]);
  });
});
