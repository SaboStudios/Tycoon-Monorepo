/**
 * SW-BE-028 — HealthController: DTO validation and error mapping tests.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { HealthController } from './health.controller';
import { RedisService } from '../modules/redis/redis.service';
import { Test, TestingModule } from '@nestjs/testing';
import { HealthController } from './health.controller';
import { RedisService } from '../modules/redis/redis.service';
import { DataSource } from 'typeorm';
import { getDataSourceToken } from '@nestjs/typeorm';

const mockRedis = {
  set: jest.fn(),
  get: jest.fn(),
};

const mockDataSource = {
  query: jest.fn(),
};

describe('HealthController', () => {
  let controller: HealthController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        { provide: RedisService, useValue: mockRedis },
        { provide: getDataSourceToken(), useValue: mockDataSource },
      ],
    }).compile();

    controller = module.get<HealthController>(HealthController);
    jest.clearAllMocks();
  });

  // ── liveness ──────────────────────────────────────────────────────────────

  describe('liveness()', () => {
    it('always returns status: healthy', () => {
      expect(controller.liveness().status).toBe('healthy');
    });

    it('includes a valid ISO 8601 timestamp', () => {
      const { timestamp } = controller.liveness();
      expect(new Date(timestamp).toISOString()).toBe(timestamp);
    });

    it('includes uptime as a non-negative number', () => {
      const { uptime } = controller.liveness() as { uptime: number };
      expect(typeof uptime).toBe('number');
      expect(uptime).toBeGreaterThanOrEqual(0);
    });

    it('does not include redis or database fields', () => {
      const result = controller.liveness() as Record<string, unknown>;
      expect(result).not.toHaveProperty('redis');
      expect(result).not.toHaveProperty('database');
    });
  });

  // ── readiness ─────────────────────────────────────────────────────────────

  describe('liveness()', () => {
    it('always returns healthy', () => {
      const result = controller.liveness();
      expect(result.status).toBe('healthy');
      expect(result.timestamp).toBeDefined();
      expect(typeof result.uptime).toBe('number');
    });
  });

  describe('readiness()', () => {
    it('returns healthy when both Redis and DB are up', async () => {
      mockRedis.set.mockResolvedValue(undefined);
      mockRedis.get.mockResolvedValue('ok');
      mockDataSource.query.mockResolvedValue([]);
      mockDataSource.query.mockResolvedValue([{ '?column?': 1 }]);

      const result = await controller.readiness();
      expect(result.status).toBe('healthy');
      expect(result.redis).toBe('connected');
      expect(result.database).toBe('connected');
    });

    it('returns unhealthy when Redis is down', async () => {
      mockRedis.set.mockRejectedValue(new Error('ECONNREFUSED'));
      mockDataSource.query.mockResolvedValue([]);

      const result = await controller.readiness();
      expect(result.status).toBe('unhealthy');
      expect(result.redis).toBe('disconnected');
    });

    it('returns unhealthy when DB is down', async () => {
      mockRedis.set.mockResolvedValue(undefined);
      mockRedis.get.mockResolvedValue('ok');
      mockDataSource.query.mockRejectedValue(new Error('DB error'));

      const result = await controller.readiness();
      expect(result.status).toBe('unhealthy');
      expect(result.database).toBe('disconnected');
    });

    it('returns unhealthy when both are down', async () => {
      mockRedis.set.mockRejectedValue(new Error('Redis down'));
      mockDataSource.query.mockRejectedValue(new Error('DB down'));

      const result = await controller.readiness();
      expect(result.status).toBe('unhealthy');
      expect(result.redis).toBe('disconnected');
      expect(result.database).toBe('disconnected');
    });

    it('includes a valid ISO 8601 timestamp', async () => {
      mockRedis.set.mockResolvedValue(undefined);
      mockRedis.get.mockResolvedValue('ok');
      mockDataSource.query.mockResolvedValue([]);

      const { timestamp } = await controller.readiness();
      expect(new Date(timestamp).toISOString()).toBe(timestamp);
    });

    it('does not leak internal error messages in the response', async () => {
      mockRedis.set.mockRejectedValue(new Error('secret-internal-host:6379'));
      mockDataSource.query.mockRejectedValue(new Error('password=secret'));

      const result = await controller.readiness();
      const serialised = JSON.stringify(result);
      expect(serialised).not.toContain('secret-internal-host');
      expect(serialised).not.toContain('password=secret');
    });
  });

  // ── aggregate ─────────────────────────────────────────────────────────────

  });

  describe('aggregate()', () => {
    it('returns healthy when all dependencies are up', async () => {
      mockRedis.set.mockResolvedValue(undefined);
      mockRedis.get.mockResolvedValue('ok');
      mockDataSource.query.mockResolvedValue([]);

      const result = await controller.aggregate();
      expect(result.status).toBe('healthy');
    });

    it('returns degraded when only Redis is down', async () => {
      expect(result.memory⁹).toBeDefined();
    });

    it('returns degraded when only one dependency is up', async () => {
      mockRedis.set.mockRejectedValue(new Error('Redis down'));
      mockDataSource.query.mockResolvedValue([]);

      const result = await controller.aggregate();
      expect(result.status).toBe('degraded');
    });

    it('returns degraded when only DB is down', async () => {
      mockRedis.set.mockResolvedValue(undefined);
      mockRedis.get.mockResolvedValue('ok');
      mockDataSource.query.mockRejectedValue(new Error('DB down'));

      const result = await controller.aggregate();
      expect(result.status).toBe('degraded');
    });

    it('returns unhealthy when all dependencies are down', async () => {
      mockRedis.set.mockRejectedValue(new Error('Redis down'));
      mockDataSource.query.mockRejectedValue(new Error('DB down'));

      const result = await controller.aggregate();
      expect(result.status).toBe('unhealthy');
    });

    it('includes memory with heapUsedMb and rssMb as integers', async () => {
      mockRedis.set.mockResolvedValue(undefined);
      mockRedis.get.mockResolvedValue('ok');
      mockDataSource.query.mockResolvedValue([]);

      const result = await controller.aggregate();
      const memory = result.memory as { heapUsedMb: number; rssMb: number };
      expect(Number.isInteger(memory.heapUsedMb)).toBe(true);
      expect(Number.isInteger(memory.rssMb)).toBe(true);
    });

    it('includes uptime as a non-negative number', async () => {
      mockRedis.set.mockResolvedValue(undefined);
      mockRedis.get.mockResolvedValue('ok');
      mockDataSource.query.mockResolvedValue([]);

      const result = await controller.aggregate();
      expect(result.uptime as number).toBeGreaterThanOrEqual(0);
    });

    it('includes a valid ISO 8601 timestamp', async () => {
      mockRedis.set.mockResolvedValue(undefined);
      mockRedis.get.mockResolvedValue('ok');
      mockDataSource.query.mockResolvedValue([]);

      const { timestamp } = await controller.aggregate();
      expect(new Date(timestamp).toISOString()).toBe(timestamp);
    });

    it('does not leak internal error messages in the response', async () => {
      mockRedis.set.mockRejectedValue(new Error('redis://user:topsecret@host'));
      mockDataSource.query.mockRejectedValue(new Error('DB password=topsecret'));

      const result = await controller.aggregate();
      const serialised = JSON.stringify(result);
      expect(serialised).not.toContain('topsecret');
    });
  });

  // ── checkRedis — backward compat ──────────────────────────────────────────

  });

  describe('checkRedis() — backward compat', () => {
    it('returns healthy when Redis is up', async () => {
      mockRedis.set.mockResolvedValue(undefined);
      mockRedis.get.mockResolvedValue('ok');

      const result = await controller.checkRedis();
      expect(result.status).toBe('healthy');
      expect(result.redis).toBe('connected');
    });

    it('returns unhealthy when Redis is down', async () => {
      mockRedis.set.mockRejectedValue(new Error('ECONNREFUSED'));

      const result = await controller.checkRedis();
      expect(result.status).toBe('unhealthy');
      expect(result.redis).toBe('disconnected');
    });

    it('includes a valid ISO 8601 timestamp', async () => {
      mockRedis.set.mockResolvedValue(undefined);
      mockRedis.get.mockResolvedValue('ok');

      const { timestamp } = await controller.checkRedis();
      expect(new Date(timestamp).toISOString()).toBe(timestamp);
    });

    it('does not include database field', async () => {
      mockRedis.set.mockResolvedValue(undefined);
      mockRedis.get.mockResolvedValue('ok');

      const result = await controller.checkRedis();
      expect(result).not.toHaveProperty('database');
    });
  });
});
