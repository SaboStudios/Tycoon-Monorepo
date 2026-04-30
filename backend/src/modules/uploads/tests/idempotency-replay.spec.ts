import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { IdempotencyService } from '../idempotency/idempotency.service';

jest.mock('ioredis', () => ({
  Redis: jest.fn().mockImplementation(() => ({
    on: jest.fn(),
  })),
}));

describe('Uploads Idempotency and Replay Tests', () => {
  let service: IdempotencyService;
  let redis: {
    get: jest.Mock;
    setex: jest.Mock;
    del: jest.Mock;
    keys: jest.Mock;
    ttl: jest.Mock;
    ping: jest.Mock;
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IdempotencyService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue({
              host: 'localhost',
              port: 6379,
              db: 0,
            }),
          },
        },
      ],
    }).compile();

    service = module.get(IdempotencyService);
    redis = {
      get: jest.fn(),
      setex: jest.fn(),
      del: jest.fn(),
      keys: jest.fn(),
      ttl: jest.fn(),
      ping: jest.fn(),
    };
    (service as any).redis = redis;
  });

  it('reads a cached idempotency record', async () => {
    const req = {
      method: 'POST',
      path: '/uploads/avatar',
      ip: '127.0.0.1',
      headers: { 'x-idempotency-key': 'cache-key' },
      query: {},
      body: { foo: 'bar' },
    } as any;

    redis.get.mockResolvedValue(
      JSON.stringify({
        key: 'idempotency:cache-key',
        timestamp: Date.now(),
        ttl: 3600,
        response: { statusCode: 201, headers: {}, body: { ok: true } },
      }),
    );

    const result = await service.checkIdempotency(req);
    expect(result?.response?.body).toEqual({ ok: true });
  });

  it('stores response payload in redis', async () => {
    const req = {
      method: 'POST',
      path: '/uploads/avatar',
      ip: '127.0.0.1',
      headers: { 'x-idempotency-key': 'store-key' },
      query: {},
      body: { file: 'avatar.jpg' },
    } as any;

    await service.storeResponse(
      req,
      {
        statusCode: 201,
        getHeaders: () => ({ 'content-type': 'application/json' }),
        body: { uploaded: true },
      },
      { ttl: 60 },
    );

    expect(redis.setex).toHaveBeenCalledTimes(1);
  });

  it('fails integrity check when request hash differs', () => {
    const req = {
      method: 'POST',
      path: '/uploads/avatar',
      headers: {},
      query: {},
      body: { amount: 1 },
    } as any;

    const valid = service.validateRequestIntegrity(req, { requestHash: 'mismatch' } as any, {
      includeBody: true,
    });
    expect(valid).toBe(false);
  });

  it('returns healthy when redis ping succeeds', async () => {
    redis.ping.mockResolvedValue('PONG');
    const health = await service.healthCheck();
    expect(health.status).toBe('healthy');
  });
});
