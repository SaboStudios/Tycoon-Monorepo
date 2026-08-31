import { Test, TestingModule } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { HealthController } from './health.controller';
import { RedisService } from '../modules/redis/redis.service';
import { NearService } from '../modules/near/near.service';
import { AuditTrailService } from '../modules/audit-trail/audit-trail.service';

const mockRedis = {
  set: jest.fn(),
  get: jest.fn(),
};

const mockNearService = {
  circuit: 'CLOSED',
};

const mockDataSource = {
  query: jest.fn(),
};

const mockConfigService = {
  get: jest.fn((key: string, defaultValue?: any) => {
    if (key === 'NEAR_HEALTH_ENABLED') return defaultValue ?? true;
    return defaultValue;
  }),
};

describe('HealthController', () => {
  let controller: HealthController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        { provide: RedisService, useValue: mockRedis },
        { provide: NearService, useValue: mockNearService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: getDataSourceToken(), useValue: mockDataSource },
        { provide: AuditTrailService, useValue: { log: jest.fn() } },
        { provide: Reflector, useValue: { get: jest.fn() } },
      ],
    }).compile();

    controller = module.get<HealthController>(HealthController);
    jest.clearAllMocks();
  });

  it('returns healthy liveness payload', () => {
    expect(controller.liveness().status).toBe('healthy');
  });

  it('returns healthy readiness when redis and db are up', async () => {
    mockRedis.set.mockResolvedValue(undefined);
    mockRedis.get.mockResolvedValue('ok');
    mockDataSource.query.mockResolvedValue([{ '?column?': 1 }]);

    const result = await controller.readiness();
    expect(result.status).toBe('healthy');
    expect(result.redis).toBe('connected');
    expect(result.database).toBe('connected');
  });

  it('returns degraded aggregate when one dependency is down', async () => {
    mockRedis.set.mockRejectedValue(new Error('redis down'));
    mockDataSource.query.mockResolvedValue([{ '?column?': 1 }]);

    const result = await controller.aggregate();
    expect(result.status).toBe('degraded');
  });

  it('returns unhealthy checkRedis when redis is down', async () => {
    mockRedis.set.mockRejectedValue(new Error('ECONNREFUSED'));

    const result = await controller.checkRedis();
    expect(result.status).toBe('unhealthy');
    expect(result.redis).toBe('disconnected');
  });

  it('returns unhealthy readiness when NEAR circuit is open', async () => {
    mockRedis.set.mockResolvedValue(undefined);
    mockRedis.get.mockResolvedValue('ok');
    mockDataSource.query.mockResolvedValue([{ '?column?': 1 }]);
    mockNearService.circuit = 'OPEN';

    const result = await controller.readiness();
    expect(result.status).toBe('unhealthy');
    expect(result.near).toBe('unhealthy');
  });

  it('returns healthy readiness when NEAR circuit is closed', async () => {
    mockRedis.set.mockResolvedValue(undefined);
    mockRedis.get.mockResolvedValue('ok');
    mockDataSource.query.mockResolvedValue([{ '?column?': 1 }]);
    mockNearService.circuit = 'CLOSED';

    const result = await controller.readiness();
    expect(result.status).toBe('healthy');
    expect(result.near).toBe('healthy');
  });

  it('returns healthy readiness when NEAR health is disabled', async () => {
    mockRedis.set.mockResolvedValue(undefined);
    mockRedis.get.mockResolvedValue('ok');
    mockDataSource.query.mockResolvedValue([{ '?column?': 1 }]);
    mockNearService.circuit = 'OPEN';
    mockConfigService.get.mockReturnValue(false);

    const result = await controller.readiness();
    expect(result.status).toBe('healthy');
    expect(result.near).toBeUndefined();
  });
});
