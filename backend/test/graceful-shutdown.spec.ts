import { Test, TestingModule } from '@nestjs/testing';
import { GracefulShutdownService } from '../../src/common/shutdown/graceful-shutdown.service';
import { DataSource } from 'typeorm';
import { getQueueToken } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

describe('GracefulShutdownService', () => {
  let service: GracefulShutdownService;

  const mockDataSource = {
    isInitialized: true,
    destroy: jest.fn().mockResolvedValue(undefined),
  };

  const mockRedisService = {
    quit: jest.fn().mockResolvedValue(undefined),
  };

  const mockBackgroundQueue = {
    pause: jest.fn().mockResolvedValue(undefined),
  } as unknown as Queue;

  const mockEmailQueue = {
    pause: jest.fn().mockResolvedValue(undefined),
  } as unknown as Queue;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GracefulShutdownService,
        { provide: DataSource, useValue: mockDataSource },
        { provide: 'RedisService', useValue: mockRedisService },
        {
          provide: getQueueToken('background-jobs'),
          useValue: mockBackgroundQueue,
        },
        { provide: getQueueToken('email-queue'), useValue: mockEmailQueue },
      ],
    })
      .overrideProvider('RedisService')
      .useValue(mockRedisService)
      .compile();

    // GracefulShutdownService injects RedisService by class, not token
    service = new GracefulShutdownService(
      mockDataSource as unknown as DataSource,
      mockRedisService as any,
      mockBackgroundQueue,
      mockEmailQueue,
    );
  });

  it('pauses all queues on shutdown', async () => {
    await service.onApplicationShutdown('SIGTERM');

    expect(mockBackgroundQueue.pause).toHaveBeenCalledTimes(1);
    expect(mockEmailQueue.pause).toHaveBeenCalledTimes(1);
  });

  it('destroys the database connection pool on shutdown', async () => {
    await service.onApplicationShutdown('SIGTERM');

    expect(mockDataSource.destroy).toHaveBeenCalledTimes(1);
  });

  it('quits the Redis connection on shutdown', async () => {
    await service.onApplicationShutdown('SIGTERM');

    expect(mockRedisService.quit).toHaveBeenCalledTimes(1);
  });

  it('skips DB destroy when DataSource is not initialized', async () => {
    const uninitializedDs = { isInitialized: false, destroy: jest.fn() };
    const svc = new GracefulShutdownService(
      uninitializedDs as unknown as DataSource,
      mockRedisService as any,
      null,
      null,
    );

    await svc.onApplicationShutdown('SIGTERM');

    expect(uninitializedDs.destroy).not.toHaveBeenCalled();
    expect(mockRedisService.quit).toHaveBeenCalledTimes(1);
  });

  it('continues shutdown even if queue pause fails', async () => {
    (mockBackgroundQueue.pause as jest.Mock).mockRejectedValueOnce(
      new Error('queue error'),
    );

    await expect(
      service.onApplicationShutdown('SIGTERM'),
    ).resolves.not.toThrow();

    expect(mockDataSource.destroy).toHaveBeenCalledTimes(1);
    expect(mockRedisService.quit).toHaveBeenCalledTimes(1);
  });
});
