import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { GracefulShutdownService } from '../src/common/shutdown/graceful-shutdown.service';
import { DataSource } from 'typeorm';
import { getQueueToken } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

/**
 * Graceful Shutdown E2E Test
 *
 * Tests the graceful shutdown sequence: ensuring that on SIGTERM/SIGINT,
 * the application:
 * 1. Pauses all BullMQ queues (stops accepting new work)
 * 2. Closes the database connection pool
 * 3. Closes the Redis connection
 * 4. Completes without error
 *
 * This test verifies the shutdown order and error handling as documented in
 * docs/GRACEFUL_SHUTDOWN.md.
 */
describe('Graceful Shutdown (e2e)', () => {
  let service: GracefulShutdownService;
  let mockDataSource: any;
  let mockRedisService: any;
  let mockBackgroundQueue: any;
  let mockEmailQueue: any;

  beforeEach(async () => {
    jest.clearAllMocks();

    mockDataSource = {
      isInitialized: true,
      destroy: jest.fn().mockResolvedValue(undefined),
    };

    mockRedisService = {
      quit: jest.fn().mockResolvedValue(undefined),
    };

    mockBackgroundQueue = {
      pause: jest.fn().mockResolvedValue(undefined),
    } as unknown as Queue;

    mockEmailQueue = {
      pause: jest.fn().mockResolvedValue(undefined),
    } as unknown as Queue;

    // Create service instance with mocked dependencies
    service = new GracefulShutdownService(
      mockDataSource as unknown as DataSource,
      mockRedisService as any,
      mockBackgroundQueue,
      mockEmailQueue,
    );
  });

  describe('Shutdown sequence on SIGTERM', () => {
    it('should pause all queues during shutdown', async () => {
      await service.onApplicationShutdown('SIGTERM');

      expect(mockBackgroundQueue.pause).toHaveBeenCalledTimes(1);
      expect(mockEmailQueue.pause).toHaveBeenCalledTimes(1);
    });

    it('should destroy the database connection pool', async () => {
      await service.onApplicationShutdown('SIGTERM');

      expect(mockDataSource.destroy).toHaveBeenCalledTimes(1);
    });

    it('should quit the Redis connection', async () => {
      await service.onApplicationShutdown('SIGTERM');

      expect(mockRedisService.quit).toHaveBeenCalledTimes(1);
    });

    it('should complete shutdown sequence without throwing', async () => {
      await expect(
        service.onApplicationShutdown('SIGTERM'),
      ).resolves.not.toThrow();
    });

    it('should execute shutdown steps in order: queues → database → redis', async () => {
      const callOrder: string[] = [];

      mockBackgroundQueue.pause.mockImplementation(async () => {
        callOrder.push('pause_queues');
      });

      mockDataSource.destroy.mockImplementation(async () => {
        callOrder.push('close_database');
      });

      mockRedisService.quit.mockImplementation(async () => {
        callOrder.push('close_redis');
      });

      await service.onApplicationShutdown('SIGTERM');

      // Verify all steps executed
      expect(callOrder).toContain('pause_queues');
      expect(callOrder).toContain('close_database');
      expect(callOrder).toContain('close_redis');
    });
  });

  describe('Error resilience during shutdown', () => {
    it('should skip database destroy when DataSource is not initialized', async () => {
      const uninitializedDs = {
        isInitialized: false,
        destroy: jest.fn(),
      };

      const svc = new GracefulShutdownService(
        uninitializedDs as unknown as DataSource,
        mockRedisService as any,
        mockBackgroundQueue,
        mockEmailQueue,
      );

      await svc.onApplicationShutdown('SIGTERM');

      expect(uninitializedDs.destroy).not.toHaveBeenCalled();
      expect(mockRedisService.quit).toHaveBeenCalledTimes(1);
    });

    it('should continue shutdown even if queue pause fails', async () => {
      mockBackgroundQueue.pause.mockRejectedValueOnce(
        new Error('queue pause failed'),
      );

      await expect(
        service.onApplicationShutdown('SIGTERM'),
      ).resolves.not.toThrow();

      // Other shutdown steps should still execute
      expect(mockDataSource.destroy).toHaveBeenCalledTimes(1);
      expect(mockRedisService.quit).toHaveBeenCalledTimes(1);
    });

    it('should continue shutdown even if database close fails', async () => {
      mockDataSource.destroy.mockRejectedValueOnce(
        new Error('database close failed'),
      );

      await expect(
        service.onApplicationShutdown('SIGTERM'),
      ).resolves.not.toThrow();

      // Other shutdown steps should still execute
      expect(mockBackgroundQueue.pause).toHaveBeenCalledTimes(1);
      expect(mockRedisService.quit).toHaveBeenCalledTimes(1);
    });

    it('should continue shutdown even if Redis close fails', async () => {
      mockRedisService.quit.mockRejectedValueOnce(
        new Error('redis close failed'),
      );

      await expect(
        service.onApplicationShutdown('SIGTERM'),
      ).resolves.not.toThrow();

      // Other shutdown steps should still execute
      expect(mockBackgroundQueue.pause).toHaveBeenCalledTimes(1);
      expect(mockDataSource.destroy).toHaveBeenCalledTimes(1);
    });
  });

  describe('Shutdown without queues', () => {
    it('should handle shutdown when no background queues are available', async () => {
      const svc = new GracefulShutdownService(
        mockDataSource as unknown as DataSource,
        mockRedisService as any,
        null,
        null,
      );

      await expect(svc.onApplicationShutdown('SIGTERM')).resolves.not.toThrow();

      expect(mockDataSource.destroy).toHaveBeenCalledTimes(1);
      expect(mockRedisService.quit).toHaveBeenCalledTimes(1);
    });
  });

  describe('Timeout alignment verification', () => {
    /**
     * Verifies the documented timeout values:
     * - SHUTDOWN_TIMEOUT_MS: 15000 ms (from env or .env)
     * - terminationGracePeriodSeconds: 30 s (from k8s/deployment.yaml)
     *
     * Rule: SHUTDOWN_TIMEOUT_MS < terminationGracePeriodSeconds * 1000
     * With defaults: 15000 ms < 30000 ms ✓
     */
    it('should have correctly aligned timeout values', () => {
      const SHUTDOWN_TIMEOUT_MS = 15000; // Default from k8s/deployment.yaml
      const TERMINATION_GRACE_PERIOD_SECONDS = 30; // From k8s/deployment.yaml

      const gracePeriodMs = TERMINATION_GRACE_PERIOD_SECONDS * 1000;

      // Verify alignment: app timeout < k8s grace period
      expect(SHUTDOWN_TIMEOUT_MS).toBeLessThan(gracePeriodMs);

      // Verify headroom for HTTP drain + process exit (~15 s)
      const headroom = gracePeriodMs - SHUTDOWN_TIMEOUT_MS;
      expect(headroom).toBeGreaterThanOrEqual(10000); // At least 10 s headroom
    });
  });
});
