import { ConfigService } from '@nestjs/config';
import { GamesIoAdapter } from './games-io.adapter';
import { GamesWsMetrics } from './games-ws-metrics.service';
import { createRedisMock } from '../../../../test/mocks/redis.mock';
import { createIoRedisMock } from '../../../../test/mocks/ioredis.mock';

describe('GamesIoAdapter', () => {
  const createAdapter = (
    redisConfig: unknown,
    metrics: Pick<GamesWsMetrics, 'adapterPublishFailure'>,
  ) => {
    const configService = {
      get: jest.fn().mockReturnValue(redisConfig),
    } as unknown as ConfigService;

    return new GamesIoAdapter(configService, metrics as GamesWsMetrics);
  };

  it('constructs without Redis config and does not throw', () => {
    const metrics = { adapterPublishFailure: jest.fn() };

    expect(() => createAdapter(undefined, metrics)).not.toThrow();
    expect(metrics.adapterPublishFailure).not.toHaveBeenCalled();
  });

  it('invokes adapterPublishFailure exactly once when the Redis publish path rejects', async () => {
    const redis = createRedisMock();
    const ioRedis = createIoRedisMock();
    const metrics = { adapterPublishFailure: jest.fn() };

    const adapter = createAdapter(
      { host: 'localhost', port: 6379, ...redis, ...ioRedis },
      metrics,
    );

    const publish = jest
      .spyOn(adapter as unknown as { publish: () => Promise<void> }, 'publish')
      .mockRejectedValue(new Error('redis publish failed'));

    await expect(
      (adapter as unknown as { publish: () => Promise<void> }).publish(),
    ).rejects.toThrow('redis publish failed');

    expect(publish).toHaveBeenCalledTimes(1);
    expect(metrics.adapterPublishFailure).toHaveBeenCalledTimes(1);
  });
});
