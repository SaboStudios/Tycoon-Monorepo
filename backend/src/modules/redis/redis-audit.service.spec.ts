/**
 * SW-CACHE-001 — Unit tests for RedisService audit-trail hooks.
 *
 * Verifies that CACHE_SET / CACHE_DEL / CACHE_INVALIDATE audit events are
 * emitted when CACHE_AUDIT_ENABLED=true, and suppressed when the flag is off
 * or when AuditTrailService is absent.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { ConfigService } from '@nestjs/config';
import { RedisService } from './redis.service';
import { AuditTrailService } from '../audit-trail/audit-trail.service';
import { AuditAction } from '../audit-trail/entities/audit-trail.entity';
import { LoggerService } from '../../common/logger/logger.service';

// Minimal ioredis stub — only the methods RedisService actually calls
jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => ({
    on: jest.fn(),
    keys: jest.fn().mockResolvedValue([]),
    del: jest.fn().mockResolvedValue(1),
    quit: jest.fn().mockResolvedValue('OK'),
  }));
});

const makeCacheManager = () => ({
  get: jest.fn(),
  set: jest.fn().mockResolvedValue(undefined),
  del: jest.fn().mockResolvedValue(undefined),
});

const makeConfigService = (auditEnabled: boolean) =>
  ({
    get: jest.fn().mockReturnValue({
      host: 'localhost',
      port: 6379,
      db: 0,
      ttl: 300,
      cacheAuditEnabled: auditEnabled,
    }),
  }) as unknown as ConfigService;

const makeAuditService = () =>
  ({ log: jest.fn().mockResolvedValue({}) }) as unknown as AuditTrailService;

const makeLoggerService = () =>
  ({
    log: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }) as unknown as LoggerService;

async function buildService(
  auditEnabled: boolean,
  auditService?: AuditTrailService,
): Promise<RedisService> {
  const builder = Test.createTestingModule({
    providers: [
      RedisService,
      { provide: CACHE_MANAGER, useValue: makeCacheManager() },
      { provide: ConfigService, useValue: makeConfigService(auditEnabled) },
      { provide: LoggerService, useValue: makeLoggerService() },
      ...(auditService
        ? [{ provide: AuditTrailService, useValue: auditService }]
        : []),
    ],
  });
  const module: TestingModule = await builder.compile();
  return module.get(RedisService);
}

describe('RedisService — audit hooks (SW-CACHE-001)', () => {
  describe('when CACHE_AUDIT_ENABLED=true', () => {
    let service: RedisService;
    let audit: AuditTrailService;

    beforeEach(async () => {
      audit = makeAuditService();
      service = await buildService(true, audit);
    });

    it('emits CACHE_SET after set()', async () => {
      await service.set('my-key', { v: 1 }, 60);
      expect(audit.log).toHaveBeenCalledWith(
        AuditAction.CACHE_SET,
        expect.objectContaining({ changes: { key: 'my-key', ttl: 60 } }),
      );
    });

    it('emits CACHE_DEL after del()', async () => {
      await service.del('my-key');
      expect(audit.log).toHaveBeenCalledWith(
        AuditAction.CACHE_DEL,
        expect.objectContaining({ changes: { key: 'my-key' } }),
      );
    });

    it('emits CACHE_INVALIDATE after delByPattern() when keys exist', async () => {
      const ioredis = (service as any).redis;
      ioredis.keys.mockResolvedValueOnce(['a', 'b', 'c']);

      await service.delByPattern('prefix:*');

      expect(audit.log).toHaveBeenCalledWith(
        AuditAction.CACHE_INVALIDATE,
        expect.objectContaining({
          changes: { pattern: 'prefix:*', count: 3 },
        }),
      );
    });

    it('does NOT emit CACHE_INVALIDATE when no keys match the pattern', async () => {
      const ioredis = (service as any).redis;
      ioredis.keys.mockResolvedValueOnce([]);

      await service.delByPattern('prefix:*');

      expect(audit.log).not.toHaveBeenCalled();
    });

    it('does not throw when audit.log rejects', async () => {
      (audit.log as jest.Mock).mockRejectedValueOnce(new Error('DB down'));
      await expect(service.set('k', 'v')).resolves.not.toThrow();
    });
  });

  describe('when CACHE_AUDIT_ENABLED=false', () => {
    let service: RedisService;
    let audit: AuditTrailService;

    beforeEach(async () => {
      audit = makeAuditService();
      service = await buildService(false, audit);
    });

    it('does not emit any audit event on set()', async () => {
      await service.set('k', 'v');
      expect(audit.log).not.toHaveBeenCalled();
    });

    it('does not emit any audit event on del()', async () => {
      await service.del('k');
      expect(audit.log).not.toHaveBeenCalled();
    });
  });

  describe('when AuditTrailService is not provided', () => {
    it('set() completes without error', async () => {
      const service = await buildService(true /* enabled but no service */);
      await expect(service.set('k', 'v')).resolves.not.toThrow();
    });
  });
});
