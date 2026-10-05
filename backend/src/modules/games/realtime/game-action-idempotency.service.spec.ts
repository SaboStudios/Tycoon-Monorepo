import { GameActionIdempotencyService } from './game-action-idempotency.service';
import { GameActionError, GameActionErrorCode } from './game-action.error';

class FakeRedis {
  store = new Map<string, { value: unknown; exp: number }>();
  counters = new Map<string, { count: number; exp: number }>();
  down = false;

  get<T>(key: string): Promise<T | undefined> {
    if (this.down) return Promise.resolve(undefined);
    const entry = this.store.get(key);
    if (!entry) return Promise.resolve(undefined);
    if (entry.exp <= Date.now()) {
      this.store.delete(key);
      return Promise.resolve(undefined);
    }
    return Promise.resolve(entry.value as T);
  }

  set<T>(key: string, value: T, ttl?: number): Promise<void> {
    if (this.down) return Promise.resolve();
    this.store.set(key, { value, exp: Date.now() + (ttl ?? 60_000) });
    return Promise.resolve();
  }

  del(key: string): Promise<void> {
    this.store.delete(key);
    this.counters.delete(key);
    return Promise.resolve();
  }

  incrementRateLimit(key: string, ttl = 60): Promise<number> {
    if (this.down) return Promise.resolve(0);
    const now = Date.now();
    const entry = this.counters.get(key);
    if (!entry || entry.exp <= now) {
      this.counters.set(key, { count: 1, exp: now + ttl * 1000 });
      return Promise.resolve(1);
    }
    entry.count += 1;
    return Promise.resolve(entry.count);
  }
}

const intent = {
  gameId: '1',
  seatId: '10',
  action: 'roll' as const,
  idempotencyKey: 'abcdefgh-1234',
  payload: null,
};

describe('GameActionIdempotencyService', () => {
  let redis: FakeRedis;
  let service: GameActionIdempotencyService;

  beforeEach(() => {
    redis = new FakeRedis();
    service = new GameActionIdempotencyService(redis as never);
  });

  it('executes the action once and stores the result', async () => {
    const fn = jest.fn().mockResolvedValue({ first: 3, second: 4 });

    const first = await service.execute(intent, fn);
    expect(first).toEqual({ result: { first: 3, second: 4 }, replayed: false });
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('replays the stored result on a duplicate key without re-running', async () => {
    const fn = jest.fn().mockResolvedValue({ first: 3, second: 4 });
    await service.execute(intent, fn);

    const second = await service.execute(intent, fn);
    expect(second).toEqual({
      result: { first: 3, second: 4 },
      replayed: true,
    });
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('fails closed with DUPLICATE_ACTION when the key is reused with another intent', async () => {
    await service.execute(intent, jest.fn().mockResolvedValue('ok'));

    await expect(
      service.execute(
        { ...intent, payload: { tampered: true } },
        jest.fn().mockResolvedValue('other'),
      ),
    ).rejects.toMatchObject({ code: GameActionErrorCode.DUPLICATE_ACTION });
  });

  it('fails closed with DEPENDENCY_UNAVAILABLE when Redis is down', async () => {
    redis.down = true;
    const fn = jest.fn();

    await expect(service.execute(intent, fn)).rejects.toMatchObject({
      code: GameActionErrorCode.DEPENDENCY_UNAVAILABLE,
    });
    expect(fn).not.toHaveBeenCalled();
  });

  it('rejects a concurrent duplicate while the first attempt is in flight', async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    const slow = jest.fn().mockImplementation(async () => {
      await gate;
      return 'done';
    });

    const first = service.execute(intent, slow);
    await expect(service.execute(intent, slow)).rejects.toMatchObject({
      code: GameActionErrorCode.DUPLICATE_ACTION,
    });

    release();
    await expect(first).resolves.toEqual({
      result: 'done',
      replayed: false,
    });
  });

  it('releases the claim when the action throws so a retry can proceed', async () => {
    const failing = jest
      .fn()
      .mockRejectedValueOnce(
        new GameActionError(GameActionErrorCode.NOT_YOUR_TURN),
      );
    await expect(service.execute(intent, failing)).rejects.toMatchObject({
      code: GameActionErrorCode.NOT_YOUR_TURN,
    });

    const ok = jest.fn().mockResolvedValue('recovered');
    // A corrected retry (same key) may run because nothing was stored.
    await expect(service.execute(intent, ok)).resolves.toEqual({
      result: 'recovered',
      replayed: false,
    });
  });
});
