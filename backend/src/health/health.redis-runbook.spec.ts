/**
 * SW-BE-036 — Redis health indicator: runbook-level regression tests.
 *
 * Exercises the scenarios documented in backend/docs/runbooks/redis-cache.md:
 *   §5  health check endpoints (normal operation)
 *   §6  incident playbooks (redis down)
 *   §10 circuit-breaker / degraded-mode signal semantics
 */
import { Test, TestingModule } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import { Reflector } from '@nestjs/core';
import { HealthController } from './health.controller';
import { RedisService } from '../modules/redis/redis.service';
import { AuditTrailService } from '../modules/audit-trail/audit-trail.service';

const mockRedis = { set: jest.fn(), get: jest.fn() };
const mockDataSource = { query: jest.fn() };

describe('HealthController — Redis runbook scenarios (SW-BE-036)', () => {
  let controller: HealthController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        { provide: RedisService, useValue: mockRedis },
        { provide: getDataSourceToken(), useValue: mockDataSource },
        { provide: AuditTrailService, useValue: { log: jest.fn() } },
        { provide: Reflector, useValue: { get: jest.fn() } },
      ],
    }).compile();
    controller = module.get<HealthController>(HealthController);
    jest.clearAllMocks();
  });

  // ── §5 Normal operation ───────────────────────────────────────────────────

  it('GET /health/redis returns healthy + connected when Redis is up', async () => {
    mockRedis.set.mockResolvedValue(undefined);
    mockRedis.get.mockResolvedValue('ok');
    const result = await controller.checkRedis();
    expect(result.status).toBe('healthy');
    expect(result.redis).toBe('connected');
    expect(typeof result.timestamp).toBe('string');
  });

  it('GET /health/live always returns healthy', () => {
    expect(controller.liveness().status).toBe('healthy');
  });

  // ── §6.1 Redis down ───────────────────────────────────────────────────────

  it('GET /health/redis returns unhealthy + disconnected when Redis is down', async () => {
    mockRedis.set.mockRejectedValue(new Error('ECONNREFUSED'));
    const result = await controller.checkRedis();
    expect(result.status).toBe('unhealthy');
    expect(result.redis).toBe('disconnected');
  });

  // ── §10 Degraded mode — Redis down, DB up ────────────────────────────────

  it('GET /health returns degraded when Redis is down but DB is up', async () => {
    mockRedis.set.mockRejectedValue(new Error('ECONNREFUSED'));
    mockDataSource.query.mockResolvedValue([{ '?column?': 1 }]);
    const result = await controller.aggregate();
    expect(result.status).toBe('degraded');
    expect(result.redis).toBe('disconnected');
    expect(result.database).toBe('connected');
  });

  it('GET /health returns degraded when DB is down but Redis is up', async () => {
    mockRedis.set.mockResolvedValue(undefined);
    mockRedis.get.mockResolvedValue('ok');
    mockDataSource.query.mockRejectedValue(new Error('db down'));
    const result = await controller.aggregate();
    expect(result.status).toBe('degraded');
    expect(result.redis).toBe('connected');
    expect(result.database).toBe('disconnected');
  });

  it('GET /health returns unhealthy when ALL dependencies are down', async () => {
    mockRedis.set.mockRejectedValue(new Error('ECONNREFUSED'));
    mockDataSource.query.mockRejectedValue(new Error('db down'));
    const result = await controller.aggregate();
    expect(result.status).toBe('unhealthy');
  });

  // ── Readiness probe ───────────────────────────────────────────────────────

  it('GET /health/ready returns healthy when both deps are up', async () => {
    mockRedis.set.mockResolvedValue(undefined);
    mockRedis.get.mockResolvedValue('ok');
    mockDataSource.query.mockResolvedValue([{ '?column?': 1 }]);
    const result = await controller.readiness();
    expect(result.status).toBe('healthy');
  });

  it('GET /health/ready returns unhealthy when Redis is down', async () => {
    mockRedis.set.mockRejectedValue(new Error('ECONNREFUSED'));
    mockDataSource.query.mockResolvedValue([{ '?column?': 1 }]);
    const result = await controller.readiness();
    expect(result.status).toBe('unhealthy');
    expect(result.redis).toBe('disconnected');
    expect(result.database).toBe('connected');
  });
});
