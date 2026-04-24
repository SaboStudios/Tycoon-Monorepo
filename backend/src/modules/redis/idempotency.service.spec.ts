import { Test, TestingModule } from '@nestjs/testing';
import { IdempotencyService, IdempotencyRecord } from './idempotency.service';
import { RedisService } from './redis.service';

const mockRedis = () => ({
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
});

describe('IdempotencyService', () => {
  let service: IdempotencyService;
  let redis: ReturnType<typeof mockRedis>;

  beforeEach(async () => {
    redis = mockRedis();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IdempotencyService,
        { provide: RedisService, useValue: redis },
      ],
    }).compile();
    service = module.get(IdempotencyService);
  });

  it('is defined', () => expect(service).toBeDefined());

  describe('get', () => {
    it('returns undefined when key does not exist', async () => {
      redis.get.mockResolvedValue(undefined);
      expect(await service.get('k1')).toBeUndefined();
      expect(redis.get).toHaveBeenCalledWith('idempotency:k1');
    });

    it('returns the stored record', async () => {
      const record: IdempotencyRecord = { status: 'complete', response: { id: 1 }, createdAt: 1000 };
      redis.get.mockResolvedValue(record);
      expect(await service.get('k1')).toEqual(record);
    });
  });

  describe('markProcessing', () => {
    it('stores a processing record with default TTL', async () => {
      redis.set.mockResolvedValue(undefined);
      await service.markProcessing('k1');
      expect(redis.set).toHaveBeenCalledWith(
        'idempotency:k1',
        expect.objectContaining({ status: 'processing' }),
        86_400 * 1000,
      );
    });

    it('respects a custom TTL', async () => {
      redis.set.mockResolvedValue(undefined);
      await service.markProcessing('k1', 60);
      expect(redis.set).toHaveBeenCalledWith(
        'idempotency:k1',
        expect.objectContaining({ status: 'processing' }),
        60_000,
      );
    });
  });

  describe('markComplete', () => {
    it('stores a complete record with the response payload', async () => {
      redis.set.mockResolvedValue(undefined);
      await service.markComplete('k1', { ok: true });
      expect(redis.set).toHaveBeenCalledWith(
        'idempotency:k1',
        expect.objectContaining({ status: 'complete', response: { ok: true } }),
        86_400 * 1000,
      );
    });
  });

  describe('delete', () => {
    it('removes the key', async () => {
      redis.del.mockResolvedValue(undefined);
      await service.delete('k1');
      expect(redis.del).toHaveBeenCalledWith('idempotency:k1');
    });
  });
});
