import {
  BadRequestException,
  ExecutionContext,
  HttpException,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { HttpMetricsService } from '../../metrics/http-metrics.service';
import { GamesService } from '../games.service';
import { normalizeGameCode } from './game-code';
import { GameCodeLookupGuard } from './game-code-lookup.guard';
import { GameCodeLookupService } from './game-code-lookup.service';
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

describe('normalizeGameCode', () => {
  it.each(['abc123', ' ABC123 ', 'Zz9900'])('accepts %p', (raw) => {
    expect(normalizeGameCode(raw)).toMatch(/^[A-Z0-9]{6}$/);
  });

  it.each([
    '',
    'ABC12',
    'ABC1234',
    'ABC-12',
    "' OR 1",
    'x'.repeat(5000),
    undefined,
    123456,
  ])('rejects %p with INVALID_GAME_CODE and does not echo input', (raw) => {
    const err = (() => {
      try {
        normalizeGameCode(raw);
      } catch (e) {
        return e as BadRequestException;
      }
    })();
    expect(err).toBeInstanceOf(BadRequestException);
    const body = err!.getResponse() as { code: string; message: string };
    expect(body.code).toBe('INVALID_GAME_CODE');
    if (typeof raw === 'string' && raw.length > 0) {
      expect(body.message).not.toContain(raw);
    }
  });
});

describe('GameCodeLookupService', () => {
  const caller = { userId: 7, ip: '198.51.100.1' };
  let gamesService: { findByCode: jest.Mock };
  let limiter: { recordMiss: jest.Mock };
  let metrics: { recordGameCodeLookup: jest.Mock };
  let service: GameCodeLookupService;

  beforeEach(() => {
    gamesService = { findByCode: jest.fn() };
    limiter = { recordMiss: jest.fn().mockResolvedValue(undefined) };
    metrics = { recordGameCodeLookup: jest.fn() };
    service = new GameCodeLookupService(
      gamesService as unknown as GamesService,
      limiter as unknown as GameCodeRateLimiterService,
      metrics as unknown as HttpMetricsService,
    );
  });

  it('returns the game and records "found" without a miss', async () => {
    gamesService.findByCode.mockResolvedValue({ id: 1, code: 'ABC123' });
    await expect(service.lookup('abc123', caller)).resolves.toEqual({
      id: 1,
      code: 'ABC123',
    });
    expect(gamesService.findByCode).toHaveBeenCalledWith('ABC123');
    expect(limiter.recordMiss).not.toHaveBeenCalled();
    expect(metrics.recordGameCodeLookup).toHaveBeenCalledWith('found');
  });

  it('counts an unknown code as a miss and returns a uniform 404', async () => {
    gamesService.findByCode.mockRejectedValue(
      new NotFoundException('Game not found'),
    );
    const err = await rejectionOf(service.lookup('ZZZ999', caller));
    expect(err).toBeInstanceOf(NotFoundException);
    expect(err.getResponse()).toEqual({
      message: 'Game not found',
      code: 'GAME_NOT_FOUND',
    });
    expect(JSON.stringify(err.getResponse())).not.toContain('ZZZ999');
    expect(limiter.recordMiss).toHaveBeenCalledWith(caller);
    expect(metrics.recordGameCodeLookup).toHaveBeenCalledWith('not_found');
  });

  it('counts a malformed code as a miss and never queries the DB', async () => {
    await expect(service.lookup('../etc', caller)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(gamesService.findByCode).not.toHaveBeenCalled();
    expect(limiter.recordMiss).toHaveBeenCalledWith(caller);
    expect(metrics.recordGameCodeLookup).toHaveBeenCalledWith('invalid');
  });

  it('fails closed (503) when a miss cannot be recorded', async () => {
    gamesService.findByCode.mockRejectedValue(new NotFoundException());
    limiter.recordMiss.mockRejectedValue(new ServiceUnavailableException());
    await expect(service.lookup('ZZZ999', caller)).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it('propagates non-404 errors without recording a miss', async () => {
    gamesService.findByCode.mockRejectedValue(new Error('db down'));
    await expect(service.lookup('ABC123', caller)).rejects.toThrow('db down');
    expect(limiter.recordMiss).not.toHaveBeenCalled();
  });
});

describe('GameCodeLookupGuard', () => {
  let limiter: { consumeAttempt: jest.Mock };
  let metrics: { recordGameCodeLookup: jest.Mock };
  let guard: GameCodeLookupGuard;

  const ctxFor = (req: object) =>
    ({
      switchToHttp: () => ({ getRequest: () => req }),
    }) as unknown as ExecutionContext;

  beforeEach(() => {
    limiter = { consumeAttempt: jest.fn().mockResolvedValue(undefined) };
    metrics = { recordGameCodeLookup: jest.fn() };
    guard = new GameCodeLookupGuard(
      limiter as unknown as GameCodeRateLimiterService,
      metrics as unknown as HttpMetricsService,
    );
  });

  it('denies by default when no authenticated user is attached', async () => {
    await expect(
      guard.canActivate(ctxFor({ ip: '1.2.3.4' })),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(limiter.consumeAttempt).not.toHaveBeenCalled();
  });

  it('consumes an attempt keyed by user id and IP', async () => {
    await expect(
      guard.canActivate(ctxFor({ ip: '1.2.3.4', user: { id: 9 } })),
    ).resolves.toBe(true);
    expect(limiter.consumeAttempt).toHaveBeenCalledWith({
      userId: 9,
      ip: '1.2.3.4',
    });
  });

  it('records rate_limited and rethrows 429', async () => {
    limiter.consumeAttempt.mockRejectedValue(new HttpException('x', 429));
    await expect(
      guard.canActivate(ctxFor({ ip: '1.2.3.4', user: { id: 9 } })),
    ).rejects.toBeInstanceOf(HttpException);
    expect(metrics.recordGameCodeLookup).toHaveBeenCalledWith('rate_limited');
  });

  it('records unavailable and rethrows 503', async () => {
    limiter.consumeAttempt.mockRejectedValue(new ServiceUnavailableException());
    await expect(
      guard.canActivate(ctxFor({ ip: '1.2.3.4', user: { id: 9 } })),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(metrics.recordGameCodeLookup).toHaveBeenCalledWith('unavailable');
  });
});
