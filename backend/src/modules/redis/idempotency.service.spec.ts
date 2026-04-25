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

  // ── get ────────────────────────────────────────────────────────────────────

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

    it('namespaces the key with the idempotency: prefix', async () => {
      redis.get.mockResolvedValue(undefined);
      await service.get('my-unique-key');
      expect(redis.get).toHaveBeenCalledWith('idempotency:my-unique-key');
    });
  });

  // ── markProcessing ─────────────────────────────────────────────────────────

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

    it('sets createdAt to a recent timestamp', async () => {
      redis.set.mockResolvedValue(undefined);
      const before = Date.now();
      await service.markProcessing('k1');
      const after = Date.now();

      const [, record] = redis.set.mock.calls[0] as [string, IdempotencyRecord, number];
      expect(record.createdAt).toBeGreaterThanOrEqual(before);
      expect(record.createdAt).toBeLessThanOrEqual(after);
    });

    it('does not include a response field', async () => {
      redis.set.mockResolvedValue(undefined);
      await service.markProcessing('k1');
      const [, record] = redis.set.mock.calls[0] as [string, IdempotencyRecord, number];
      expect(record.response).toBeUndefined();
    });
  });

  // ── markComplete ───────────────────────────────────────────────────────────

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

    it('preserves arbitrary response shapes (array)', async () => {
      redis.set.mockResolvedValue(undefined);
      await service.markComplete('k1', [1, 2, 3]);
      const [, record] = redis.set.mock.calls[0] as [string, IdempotencyRecord, number];
      expect(record.response).toEqual([1, 2, 3]);
    });

    it('preserves null response', async () => {
      redis.set.mockResolvedValue(undefined);
      await service.markComplete('k1', null);
      const [, record] = redis.set.mock.calls[0] as [string, IdempotencyRecord, number];
      expect(record.response).toBeNull();
    });

    it('sets status to complete', async () => {
      redis.set.mockResolvedValue(undefined);
      await service.markComplete('k1', {});
      const [, record] = redis.set.mock.calls[0] as [string, IdempotencyRecord, number];
      expect(record.status).toBe('complete');
    });

    it('respects a custom TTL', async () => {
      redis.set.mockResolvedValue(undefined);
      await service.markComplete('k1', {}, 300);
      expect(redis.set).toHaveBeenCalledWith(
        'idempotency:k1',
        expect.any(Object),
        300_000,
      );
    });
  });

  // ── delete ─────────────────────────────────────────────────────────────────

  describe('delete', () => {
    it('removes the key', async () => {
      redis.del.mockResolvedValue(undefined);
      await service.delete('k1');
      expect(redis.del).toHaveBeenCalledWith('idempotency:k1');
    });

    it('uses the same namespace prefix as get/markProcessing', async () => {
      redis.del.mockResolvedValue(undefined);
      await service.delete('abc-123');
      expect(redis.del).toHaveBeenCalledWith('idempotency:abc-123');
    });
  });
});
