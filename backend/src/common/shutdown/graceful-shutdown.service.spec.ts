import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from 'nest-winston';
import { GracefulShutdownService } from './graceful-shutdown.service';
import { createNestWinstonMock } from '../../../test/mocks/nest-winston.mock';

interface Drainable {
  onApplicationShutdown?: (signal?: string) => Promise<void> | void;
}

describe('GracefulShutdownService', () => {
  let service: GracefulShutdownService;
  let logger: ReturnType<typeof createNestWinstonMock>;

  beforeEach(async () => {
    logger = createNestWinstonMock();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GracefulShutdownService,
        { provide: Logger, useValue: logger },
      ],
    }).compile();

    service = module.get<GracefulShutdownService>(GracefulShutdownService);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('awaits all registered drainable resources on shutdown', async () => {
    const first = jest.fn().mockResolvedValue(undefined);
    const second = jest.fn().mockResolvedValue(undefined);

    service.register({ onApplicationShutdown: first } as Drainable);
    service.register({ onApplicationShutdown: second } as Drainable);

    await service.onApplicationShutdown('SIGTERM');

    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);
  });

  it('resolves without hanging when a drainable exceeds the timeout', async () => {
    jest.useFakeTimers();

    const hanging = jest.fn().mockImplementation(() => new Promise<void>(() => {}));
    service.register({ onApplicationShutdown: hanging } as Drainable);

    const shutdown = service.onApplicationShutdown('SIGTERM');

    jest.advanceTimersByTime(service.timeoutMs ?? 30_000);

    await expect(shutdown).resolves.toBeUndefined();
    expect(hanging).toHaveBeenCalledTimes(1);
  });

  it('logs a warning when the drain timeout is exceeded', async () => {
    jest.useFakeTimers();

    const hanging = jest.fn().mockImplementation(() => new Promise<void>(() => {}));
    service.register({ onApplicationShutdown: hanging } as Drainable);

    const shutdown = service.onApplicationShutdown('SIGTERM');

    jest.advanceTimersByTime(service.timeoutMs ?? 30_000);
    await shutdown;

    expect(logger.warn).toHaveBeenCalled();
  });

  it('drains in the documented order: stop accepting work, drain in-flight, close DB/Redis', async () => {
    const order: string[] = [];
    const wsAdapter = { close: jest.fn().mockImplementation(async () => { order.push('ws.close'); }) };
    const dataSource = { destroy: jest.fn().mockImplementation(async () => { order.push('dataSource.destroy'); }) };
    const redisClient = { quit: jest.fn().mockImplementation(async () => { order.push('redis.quit'); }) };

    service.register(wsAdapter as Drainable);
    service.register(dataSource as Drainable);
    service.register(redisClient as Drainable);

    await service.onApplicationShutdown('SIGTERM');

    expect(order).toEqual(['ws.close', 'dataSource.destroy', 'redis.quit']);
  });

  it('is idempotent: a second shutdown call is a no-op', async () => {
    const wsAdapter = { close: jest.fn().mockResolvedValue(undefined) };
    const dataSource = { destroy: jest.fn().mockResolvedValue(undefined) };
    const redisClient = { quit: jest.fn().mockResolvedValue(undefined) };

    service.register(wsAdapter as Drainable);
    service.register(dataSource as Drainable);
    service.register(redisClient as Drainable);

    await service.onApplicationShutdown('SIGTERM');
    await service.onApplicationShutdown('SIGTERM');

    expect(wsAdapter.close).toHaveBeenCalledTimes(1);
    expect(dataSource.destroy).toHaveBeenCalledTimes(1);
    expect(redisClient.quit).toHaveBeenCalledTimes(1);
  });

  it('logs an error in one step and still runs later steps', async () => {
    const order: string[] = [];
    const wsAdapter = { close: jest.fn().mockImplementation(async () => { order.push('ws.close'); }) };
    const dataSource = { destroy: jest.fn().mockImplementation(async () => { order.push('dataSource.destroy'); throw new Error('db down'); }) };
    const redisClient = { quit: jest.fn().mockImplementation(async () => { order.push('redis.quit'); }) };

    service.register(wsAdapter as Drainable);
    service.register(dataSource as Drainable);
    service.register(redisClient as Drainable);

    await service.onApplicationShutdown('SIGTERM');

    expect(order).toEqual(['ws.close', 'dataSource.destroy', 'redis.quit']);
    expect(logger.error).toHaveBeenCalled();
  });
});
