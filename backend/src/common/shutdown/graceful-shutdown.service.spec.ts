import { GracefulShutdownService } from './graceful-shutdown.service';

describe('GracefulShutdownService', () => {
  let service: GracefulShutdownService;
  let wsAdapter: { close: jest.Mock };
  let dataSource: { destroy: jest.Mock };
  let redisClient: { quit: jest.Mock };
  let logger: { log: jest.Mock; error: jest.Mock };

  beforeEach(() => {
    wsAdapter = { close: jest.fn().mockResolvedValue(undefined) };
    dataSource = { destroy: jest.fn().mockResolvedValue(undefined) };
    redisClient = { quit: jest.fn().mockResolvedValue(undefined) };
    logger = { log: jest.fn(), error: jest.fn() };

    service = new GracefulShutdownService(
      wsAdapter as any,
      dataSource as any,
      redisClient as any,
      logger as any,
    );
  });

  it('drains in the documented order: stop accepting work, drain in-flight, close DB/Redis', async () => {
    const order: string[] = [];
    wsAdapter.close.mockImplementation(async () => {
      order.push('ws.close');
    });
    dataSource.destroy.mockImplementation(async () => {
      order.push('dataSource.destroy');
    });
    redisClient.quit.mockImplementation(async () => {
      order.push('redis.quit');
    });

    await service.onApplicationShutdown('SIGTERM');

    expect(order).toEqual(['ws.close', 'dataSource.destroy', 'redis.quit']);
  });

  it('is idempotent: a second shutdown call is a no-op', async () => {
    await service.onApplicationShutdown('SIGTERM');
    await service.onApplicationShutdown('SIGTERM');

    expect(wsAdapter.close).toHaveBeenCalledTimes(1);
    expect(dataSource.destroy).toHaveBeenCalledTimes(1);
    expect(redisClient.quit).toHaveBeenCalledTimes(1);
  });

  it('logs an error in one step and still runs later steps', async () => {
    const order: string[] = [];
    wsAdapter.close.mockImplementation(async () => {
      order.push('ws.close');
    });
    dataSource.destroy.mockImplementation(async () => {
      order.push('dataSource.destroy');
      throw new Error('db down');
    });
    redisClient.quit.mockImplementation(async () => {
      order.push('redis.quit');
    });

    await service.onApplicationShutdown('SIGTERM');

    expect(order).toEqual(['ws.close', 'dataSource.destroy', 'redis.quit']);
    expect(logger.error).toHaveBeenCalled();
  });
});
