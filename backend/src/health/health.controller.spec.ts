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
  });

  describe('aggregate()', () => {
    it('returns healthy when all dependencies are up', async () => {
      mockRedis.set.mockResolvedValue(undefined);
      mockRedis.get.mockResolvedValue('ok');
      mockDataSource.query.mockResolvedValue([]);

      const result = await controller.aggregate();
      expect(result.status).toBe('healthy');
      expect(result.memory).toBeDefined();
    });

    it('returns degraded when only one dependency is up', async () => {
      mockRedis.set.mockRejectedValue(new Error('Redis down'));
      mockDataSource.query.mockResolvedValue([]);

      const result = await controller.aggregate();
      expect(result.status).toBe('degraded');
    });

    it('returns unhealthy when all dependencies are down', async () => {
      mockRedis.set.mockRejectedValue(new Error('Redis down'));
      mockDataSource.query.mockRejectedValue(new Error('DB down'));

      const result = await controller.aggregate();
      expect(result.status).toBe('unhealthy');
    });
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
  });
});
