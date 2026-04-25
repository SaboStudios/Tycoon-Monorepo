import { Test, TestingModule } from '@nestjs/testing';
import {
  ExecutionContext,
  BadRequestException,
  HttpStatus,
} from '@nestjs/common';
import { of, throwError } from 'rxjs';
import { Reflector } from '@nestjs/core';
import { IdempotencyInterceptor } from './idempotency.interceptor';
import { RedisService } from '../../modules/redis/redis.service';
import { IDEMPOTENT_KEY } from '../decorators/idempotent.decorator';

// ── helpers ──────────────────────────────────────────────────────────────────

const mockRedisService = {
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
  incrementRateLimit: jest.fn(),
};

const buildContext = (
  overrides: {
    headers?: Record<string, string>;
    user?: { id: number } | null;
    statusCode?: number;
    isIdempotent?: boolean;
  } = {},
): ExecutionContext => {
  const res = {
    statusCode: overrides.statusCode ?? HttpStatus.CREATED,
    status: jest.fn().mockReturnThis(),
  };
  const ctx = {
    getHandler: jest.fn().mockReturnValue('handler'),
    switchToHttp: jest.fn().mockReturnValue({
      getRequest: jest.fn().mockReturnValue({
        headers: overrides.headers ?? {},
        user: overrides.user !== undefined ? overrides.user : { id: 1 },
      }),
      getResponse: jest.fn().mockReturnValue(res),
    }),
  } as unknown as ExecutionContext;
  return ctx;
};

// ── suite ─────────────────────────────────────────────────────────────────────

describe('IdempotencyInterceptor (common)', () => {
  let interceptor: IdempotencyInterceptor;
  let reflector: Reflector;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IdempotencyInterceptor,
        { provide: RedisService, useValue: mockRedisService },
        Reflector,
      ],
    }).compile();

    interceptor = module.get<IdempotencyInterceptor>(IdempotencyInterceptor);
    reflector = module.get<Reflector>(Reflector);
  });

  it('should be defined', () => {
    expect(interceptor).toBeDefined();
  });

  // ── non-idempotent routes ─────────────────────────────────────────────────

  describe('non-idempotent routes', () => {
    it('passes through when route is not marked @Idempotent()', async () => {
      jest.spyOn(reflector, 'get').mockReturnValue(false);
      const ctx = buildContext({ isIdempotent: false });
      const next = { handle: jest.fn().mockReturnValue(of({ id: 1 })) };

      await interceptor.intercept(ctx, next as any);

      expect(next.handle).toHaveBeenCalled();
      expect(mockRedisService.get).not.toHaveBeenCalled();
    });
  });

  // ── missing header ────────────────────────────────────────────────────────

  describe('missing x-idempotency-key header', () => {
    it('throws 400 when header is absent', async () => {
      jest.spyOn(reflector, 'get').mockReturnValue(true);
      const ctx = buildContext({ headers: {} });
      const next = { handle: jest.fn().mockReturnValue(of({})) };

      await expect(interceptor.intercept(ctx, next as any)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('error message mentions X-Idempotency-Key', async () => {
      jest.spyOn(reflector, 'get').mockReturnValue(true);
      const ctx = buildContext({ headers: {} });
      const next = { handle: jest.fn().mockReturnValue(of({})) };

      await expect(interceptor.intercept(ctx, next as any)).rejects.toThrow(
        'X-Idempotency-Key header is required',
      );
    });
  });

  // ── replay — cached response ──────────────────────────────────────────────

  describe('replay — cached response', () => {
    it('returns cached response when idempotency key already exists', async () => {
      jest.spyOn(reflector, 'get').mockReturnValue(true);
      const ctx = buildContext({
        headers: { 'x-idempotency-key': 'test-key-123' },
      });
      const next = { handle: jest.fn() };

      mockRedisService.get.mockResolvedValue({
        statusCode: HttpStatus.CREATED,
        body: { id: 42, code: 'CACHED' },
      });

      const result$ = await interceptor.intercept(ctx, next as any);
      const result = await new Promise((resolve) =>
        result$.subscribe((v) => resolve(v)),
      );

      expect(result).toEqual({ id: 42, code: 'CACHED' });
      expect(next.handle).not.toHaveBeenCalled();
    });

    it('does not call the handler on replay', async () => {
      jest.spyOn(reflector, 'get').mockReturnValue(true);
      const ctx = buildContext({ headers: { 'x-idempotency-key': 'replay-key' } });
      const next = { handle: jest.fn() };

      mockRedisService.get.mockResolvedValue({
        statusCode: HttpStatus.OK,
        body: { replayed: true },
      });

      await interceptor.intercept(ctx, next as any);
      expect(next.handle).not.toHaveBeenCalled();
    });

    it('replays a null body correctly', async () => {
      jest.spyOn(reflector, 'get').mockReturnValue(true);
      const ctx = buildContext({ headers: { 'x-idempotency-key': 'null-key' } });
      const next = { handle: jest.fn() };

      mockRedisService.get.mockResolvedValue({
        statusCode: HttpStatus.NO_CONTENT,
        body: null,
      });

      const result$ = await interceptor.intercept(ctx, next as any);
      const result = await new Promise((resolve) =>
        result$.subscribe((v) => resolve(v)),
      );
      expect(result).toBeNull();
    });
  });

  // ── concurrent request lock ───────────────────────────────────────────────

  describe('concurrent request lock', () => {
    it('throws 400 when concurrent request with same key is in flight', async () => {
      jest.spyOn(reflector, 'get').mockReturnValue(true);
      const ctx = buildContext({ headers: { 'x-idempotency-key': 'race-key' } });
      const next = { handle: jest.fn() };

      mockRedisService.get.mockResolvedValue(null);
      mockRedisService.incrementRateLimit.mockResolvedValue(2);

      await expect(interceptor.intercept(ctx, next as any)).rejects.toThrow(
        'A request with this idempotency key is already in progress',
      );
    });
  });

  // ── first request — cache and pass through ────────────────────────────────

  describe('first request', () => {
    it('caches and passes through on first request', async () => {
      jest.spyOn(reflector, 'get').mockReturnValue(true);
      const ctx = buildContext({ headers: { 'x-idempotency-key': 'fresh-key' } });
      const body = { id: 99 };
      const next = { handle: jest.fn().mockReturnValue(of(body)) };

      mockRedisService.get.mockResolvedValue(null);
      mockRedisService.incrementRateLimit.mockResolvedValue(1);
      mockRedisService.set.mockResolvedValue(undefined);
      mockRedisService.del.mockResolvedValue(undefined);

      const result$ = await interceptor.intercept(ctx, next as any);
      const result = await new Promise((resolve) =>
        result$.subscribe((v) => resolve(v)),
      );

      expect(result).toEqual(body);
      expect(next.handle).toHaveBeenCalled();
    });

    it('stores response with 24-hour TTL', async () => {
      jest.spyOn(reflector, 'get').mockReturnValue(true);
      const ctx = buildContext({ headers: { 'x-idempotency-key': 'ttl-key' } });
      const next = { handle: jest.fn().mockReturnValue(of({ ok: true })) };

      mockRedisService.get.mockResolvedValue(null);
      mockRedisService.incrementRateLimit.mockResolvedValue(1);
      mockRedisService.set.mockResolvedValue(undefined);
      mockRedisService.del.mockResolvedValue(undefined);

      const result$ = await interceptor.intercept(ctx, next as any);
      await new Promise((resolve) => result$.subscribe({ complete: resolve as any }));

      expect(mockRedisService.set).toHaveBeenCalledWith(
        expect.stringContaining('idempotency:'),
        expect.objectContaining({ body: { ok: true } }),
        86400,
      );
    });

    it('scopes the Redis key to the authenticated user id', async () => {
      jest.spyOn(reflector, 'get').mockReturnValue(true);
      const ctx = buildContext({
        headers: { 'x-idempotency-key': 'scoped-key' },
        user: { id: 42 },
      });
      const next = { handle: jest.fn().mockReturnValue(of({})) };

      mockRedisService.get.mockResolvedValue(null);
      mockRedisService.incrementRateLimit.mockResolvedValue(1);
      mockRedisService.set.mockResolvedValue(undefined);
      mockRedisService.del.mockResolvedValue(undefined);

      await interceptor.intercept(ctx, next as any);

      expect(mockRedisService.get).toHaveBeenCalledWith(
        expect.stringContaining('42'),
      );
    });

    it('uses "anon" scope when no user is present', async () => {
      jest.spyOn(reflector, 'get').mockReturnValue(true);
      const ctx = buildContext({
        headers: { 'x-idempotency-key': 'anon-key' },
        user: null,
      });
      const next = { handle: jest.fn().mockReturnValue(of({})) };

      mockRedisService.get.mockResolvedValue(null);
      mockRedisService.incrementRateLimit.mockResolvedValue(1);
      mockRedisService.set.mockResolvedValue(undefined);
      mockRedisService.del.mockResolvedValue(undefined);

      await interceptor.intercept(ctx, next as any);

      expect(mockRedisService.get).toHaveBeenCalledWith(
        expect.stringContaining('anon'),
      );
    });

    it('releases the lock after successful response', async () => {
      jest.spyOn(reflector, 'get').mockReturnValue(true);
      const ctx = buildContext({ headers: { 'x-idempotency-key': 'lock-key' } });
      const next = { handle: jest.fn().mockReturnValue(of({ done: true })) };

      mockRedisService.get.mockResolvedValue(null);
      mockRedisService.incrementRateLimit.mockResolvedValue(1);
      mockRedisService.set.mockResolvedValue(undefined);
      mockRedisService.del.mockResolvedValue(undefined);

      const result$ = await interceptor.intercept(ctx, next as any);
      await new Promise((resolve) => result$.subscribe({ complete: resolve as any }));

      // Lock key is deleted after the response is cached
      expect(mockRedisService.del).toHaveBeenCalledWith(
        expect.stringContaining('lock'),
      );
    });
  });
});
