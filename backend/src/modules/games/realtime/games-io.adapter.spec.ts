import { GamesIoAdapter } from './games-io.adapter';

jest.mock('ioredis', () => {
  const publish = jest.fn();
  const on = jest.fn();
  const duplicate = jest.fn(() => ({ on }));
  const RedisMock = jest.fn(() => ({ publish, on, duplicate }));
  return { __esModule: true, default: RedisMock };
});

jest.mock('@socket.io/redis-adapter', () => ({
  createAdapter: jest.fn(() => ({})),
}));

import Redis from 'ioredis';

describe('GamesIoAdapter', () => {
  const app = {} as never;
  const redisConfig = { host: 'localhost', port: 6379, db: 0 };

  it('invokes the publish-failure callback when publish rejects', async () => {
    const onPublishError = jest.fn();
    const adapter = new GamesIoAdapter(app, redisConfig, onPublishError);

    const server = { adapter: jest.fn() } as never;
    jest
      .spyOn(Object.getPrototypeOf(GamesIoAdapter.prototype), 'createIOServer')
      .mockReturnValue(server);

    adapter.createIOServer(0);

    const pub = (Redis as unknown as jest.Mock).mock.results[0].value;
    const err = new Error('publish failed');
    pub.publish.mockRejectedValueOnce(err);

    await expect(pub.publish('channel', 'payload')).rejects.toThrow(
      'publish failed',
    );
    await Promise.resolve();

    expect(onPublishError).toHaveBeenCalledTimes(1);
    expect(onPublishError).toHaveBeenCalledWith(err);
  });
});
