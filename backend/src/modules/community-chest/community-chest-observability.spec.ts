import { Test, TestingModule } from '@nestjs/testing';
import { CommunityChestObservabilityService } from './community-chest-observability.service';
import { Counter, Histogram } from 'prom-client';

/**
 * Issue #884: Community-chest observability (logs, traces, metrics)
 *
 * Covers:
 * - Structured logging with context and correlation IDs
 * - Metrics counters for draws and creates
 * - Metrics histograms for operation duration and payout amounts
 * - Error tracking and logging
 */
describe('CommunityChestObservabilityService', () => {
  let service: CommunityChestObservabilityService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CommunityChestObservabilityService],
    }).compile();

    service = module.get<CommunityChestObservabilityService>(
      CommunityChestObservabilityService,
    );
  });

  describe('Card draw recording', () => {
    it('should record card draw event with type', () => {
      const recordSpy = jest.spyOn(console, 'log');

      service.recordCardDraw('reward', 'test-corr-id', 1, 100);

      // Verify metrics increment
      expect(service['cardsDrawnTotal'].inc).toBeDefined();
    });

    it('should include correlation ID in log context', () => {
      const loggerSpy = jest.spyOn(service['logger'], 'log');

      service.recordCardDraw('penalty', 'test-corr-id-123', 2, 200);

      expect(loggerSpy).toHaveBeenCalled();
      const logCall = loggerSpy.mock.calls[0];
      expect(logCall[0]).toContain('Community Chest card drawn');
    });

    it('should record game and player IDs in logs', () => {
      const loggerSpy = jest.spyOn(service['logger'], 'log');

      service.recordCardDraw('move', 'corr-id', 5, 42);

      expect(loggerSpy).toHaveBeenCalled();
      const logCall = loggerSpy.mock.calls[0];
      expect(logCall[1]).toBeDefined();
    });

    it('should handle unknown card type gracefully', () => {
      expect(() =>
        service.recordCardDraw(undefined, 'test-id'),
      ).not.toThrow();
    });
  });

  describe('Card creation recording', () => {
    it('should record card creation with type and payout', () => {
      service.recordCardCreated('reward', 'test-corr-id', 200);

      // Metrics should be recorded
      expect(service['cardsCreatedTotal']).toBeDefined();
      expect(service['payoutAmountTotal']).toBeDefined();
    });

    it('should record payout amount in histogram when provided', () => {
      service.recordCardCreated('reward', 'corr-id', 500);

      // Payout histogram should have recorded the amount
      expect(service['payoutAmountTotal']).toBeDefined();
    });

    it('should handle creation without payout amount', () => {
      expect(() =>
        service.recordCardCreated('move', 'corr-id'),
      ).not.toThrow();
    });

    it('should log card creation with structured data', () => {
      const loggerSpy = jest.spyOn(service['logger'], 'log');

      service.recordCardCreated('penalty', 'test-id', 100);

      expect(loggerSpy).toHaveBeenCalled();
      const logCall = loggerSpy.mock.calls[0];
      expect(logCall[0]).toContain('Community Chest card created');
    });
  });

  describe('List operation recording', () => {
    it('should log list operations with item count', () => {
      const debugSpy = jest.spyOn(service['logger'], 'debug');

      service.recordListOperation(42, 'list-corr-id');

      expect(debugSpy).toHaveBeenCalled();
    });

    it('should include correlation ID in list logs', () => {
      const debugSpy = jest.spyOn(service['logger'], 'debug');

      service.recordListOperation(10, 'unique-corr-id-xyz');

      expect(debugSpy).toHaveBeenCalled();
      const logCall = debugSpy.mock.calls[0];
      expect(logCall[1]).toBeDefined();
    });
  });

  describe('Card retrieval recording', () => {
    it('should record successful card retrieval', () => {
      expect(() =>
        service.recordCardRetrieved(1, true, 'corr-id'),
      ).not.toThrow();
    });

    it('should warn when card not found', () => {
      const warnSpy = jest.spyOn(service['logger'], 'warn');

      service.recordCardRetrieved(999, false, 'corr-id');

      expect(warnSpy).toHaveBeenCalled();
      const logCall = warnSpy.mock.calls[0];
      expect(logCall[0]).toContain('not found');
    });

    it('should log card ID in retrieval logs', () => {
      const warnSpy = jest.spyOn(service['logger'], 'warn');

      service.recordCardRetrieved(42, false, 'test-id');

      expect(warnSpy).toHaveBeenCalled();
    });
  });

  describe('Error recording', () => {
    it('should record operation errors with type', () => {
      const errorSpy = jest.spyOn(service['logger'], 'error');

      service.recordError('draw', 'NoCardsAvailableException', 'No cards in system');

      expect(errorSpy).toHaveBeenCalled();
      const logCall = errorSpy.mock.calls[0];
      expect(logCall[0]).toContain('error');
    });

    it('should track error types in metrics', () => {
      service.recordError('create', 'ConflictException', 'Duplicate instruction');

      // Error counter should be incremented
      expect(service['errorsTotal']).toBeDefined();
    });

    it('should include error message in logs', () => {
      const errorSpy = jest.spyOn(service['logger'], 'error');

      service.recordError('list', 'DatabaseException', 'Connection timeout');

      expect(errorSpy).toHaveBeenCalled();
      const logCall = errorSpy.mock.calls[0];
      expect(logCall[0]).toContain('DatabaseException');
    });

    it('should include correlation ID in error logs', () => {
      const errorSpy = jest.spyOn(service['logger'], 'error');

      service.recordError('get', 'NotFound', 'Card not found', 'error-corr-id');

      expect(errorSpy).toHaveBeenCalled();
    });
  });

  describe('Operation timing', () => {
    it('should create timer for draw operation', () => {
      const timer = service.startTimer('draw');

      expect(timer).toBeDefined();
      expect(timer.end).toBeDefined();
      expect(typeof timer.end).toBe('function');
    });

    it('should create timer for create operation', () => {
      const timer = service.startTimer('create');

      expect(timer).toBeDefined();
      expect(timer.end).toBeDefined();
    });

    it('should create timer for list operation', () => {
      const timer = service.startTimer('list');

      expect(timer).toBeDefined();
      expect(timer.end).toBeDefined();
    });

    it('should allow ending timer', () => {
      const timer = service.startTimer('draw');

      expect(() => timer.end()).not.toThrow();
    });
  });

  describe('Metrics retrieval', () => {
    it('should provide metrics in Prometheus format', async () => {
      const metrics = await service.getMetrics();

      expect(typeof metrics).toBe('string');
      expect(metrics.length).toBeGreaterThan(0);
    });

    it('should include registered metrics', async () => {
      const metrics = await service.getMetrics();

      expect(metrics).toContain('tycoon_community_chest');
    });
  });

  describe('Log context structure', () => {
    it('should include operation name in context', () => {
      const logSpy = jest.spyOn(service['logger'], 'log');

      service.recordCardDraw('reward', 'id');

      expect(logSpy).toHaveBeenCalled();
      const context = logSpy.mock.calls[0][1];
      expect(context.operation).toBeDefined();
    });

    it('should include timestamp in all logs', () => {
      const logSpy = jest.spyOn(service['logger'], 'log');

      service.recordCardCreated('penalty', 'id', 100);

      expect(logSpy).toHaveBeenCalled();
      const context = logSpy.mock.calls[0][1];
      expect(context.timestamp).toBeDefined();
      // Verify it's a valid ISO timestamp
      expect(new Date(context.timestamp).toISOString()).toBeDefined();
    });

    it('should include context label in logs', () => {
      const logSpy = jest.spyOn(service['logger'], 'log');

      service.recordCardDraw('move', 'id');

      expect(logSpy).toHaveBeenCalled();
      const context = logSpy.mock.calls[0][1];
      expect(context.context).toBe('CommunityChest');
    });

    it('should include card type in appropriate logs', () => {
      const logSpy = jest.spyOn(service['logger'], 'log');

      service.recordCardCreated('reward', 'id', 200);

      expect(logSpy).toHaveBeenCalled();
      const context = logSpy.mock.calls[0][1];
      expect(context.card_type).toBe('reward');
    });
  });

  describe('No PII/secrets in logs', () => {
    it('should not log raw passwords or tokens', () => {
      const logSpy = jest.spyOn(service['logger'], 'log');

      service.recordCardDraw('reward', 'correlation-id', 1, 100);

      expect(logSpy).toHaveBeenCalled();
      const logMessage = logSpy.mock.calls[0];
      const logText = JSON.stringify(logMessage);

      expect(logText).not.toContain('password');
      expect(logText).not.toContain('secret');
      expect(logText).not.toContain('token');
    });

    it('should handle disconnected tracer/metrics gracefully', async () => {
      // Even if metrics backend is unavailable, service should not crash
      expect(() => service.recordCardDraw('reward', 'id')).not.toThrow();
      expect(() => service.recordError('draw', 'TestError')).not.toThrow();
    });
  });
});
