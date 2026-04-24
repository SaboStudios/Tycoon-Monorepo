import { Test, TestingModule } from '@nestjs/testing';
import {
  ExecutionContext,
  BadRequestException,
  HttpStatus,
} from '@nestjs/common';
import { of } from 'rxjs';
import { Reflector } from '@nestjs/core';
import { IdempotencyInterceptor } from './idempotency.interceptor';
import { RedisService } from '../../modules/redis/redis.service';
import { IDEMPOTENT_KEY } from '../decorators/idempotent.decorator';

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
  const reflector = new Reflector();
  const ctx = {
    getHandler: jest.fn().mockReturnValue('handler'),
    switchToHttp: jest.fn().mockReturnValue({
      getRequest: jest.fn().mockReturnValue({
        headers: overrides.headers ?? {},
        user: overrides.user ?? { id: 1 },
      }),
      getResponse: jest.fn().mockReturnValue({
        statusCode: overrides.statusCode ?? HttpStatus.CREATED,
      }),
    }),
  } as unknown as ExecutionContext;

  // Spy on reflector.get to return isIdempotent flag
  jest
    .spyOn(reflector, 'get')
    .mockReturnValue(
      overrides.isIdempotent !== undefined ? overrides.isIdempotent : true,
    );

  return ctx;
};

describe('IdempotencyInterceptor', () => {
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

  it('passes through when route is not marked @Idempotent()', async () => {
    jest.spyOn(reflector, 'get').mockReturnValue(false);
    const ctx = buildContext({ isIdempotent: false });
    const next = { handle: jest.fn().mockReturnValue(of({ id: 1 })) };

    await interceptor.intercept(ctx, next as any);

    expect(next.handle).toHaveBeenCalled();
    expect(mockRedisService.get).not.toHaveBeenCalled();
  });

  it('throws 400 when x-idempotency-key header is missing', async () => {
    jest.spyOn(reflector, 'get').mockReturnValue(true);
    const ctx = buildContext({ headers: {}, isIdempotent: true });
    const next = { handle: jest.fn().mockReturnValue(of({})) };

    await expect(interceptor.intercept(ctx, next as any)).rejects.toThrow(
      BadRequestException,
    );
    await expect(interceptor.intercept(ctx, next as any)).rejects.toThrow(
      'X-Idempotency-Key header is required',
    );
  });

  it('returns cached response when idempotency key already exists', async () => {
    jest.spyOn(reflector, 'get').mockReturnValue(true);
    const ctx = buildContext({
      headers: { 'x-idempotency-key': 'test-key-123' },
      isIdempotent: true,
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
    // Service handler should NOT be called on replay
    expect(next.handle).not.toHaveBeenCalled();
  });

  it('throws 400 when concurrent request with same key is in flight', async () => {
    jest.spyOn(reflector, 'get').mockReturnValue(true);
    const ctx = buildContext({
      headers: { 'x-idempotency-key': 'race-key' },
      isIdempotent: true,
    });
    const next = { handle: jest.fn() };

    // No cached response
    mockRedisService.get.mockResolvedValue(null);
    // Lock already held (value > 1)
    mockRedisService.incrementRateLimit.mockResolvedValue(2);

    await expect(interceptor.intercept(ctx, next as any)).rejects.toThrow(
      'A request with this idempotency key is already in progress',
    );
  });

  it('caches and passes through on first request', async () => {
    jest.spyOn(reflector, 'get').mockReturnValue(true);
    const ctx = buildContext({
      headers: { 'x-idempotency-key': 'fresh-key' },
      isIdempotent: true,
    });
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
    expect(mockRedisService.set).toHaveBeenCalledWith(
      expect.stringContaining('idempotency:'),
      expect.objectContaining({ body }),
      86400,
    );
  });
});
