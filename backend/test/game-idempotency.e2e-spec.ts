import {
  gameActionIdempotencyKey,
  GameActionIntent,
} from '../src/common/decorators/idempotent.decorator';
import { createHarness, GamesWsHarness, sleep } from './utils/games-ws-harness';

jest.setTimeout(60000);

const KEY = 'idem-key-0001';

function rollIntent(gameId: number, seatId: number, key = KEY) {
  return {
    gameId: String(gameId),
    seatId: String(seatId),
    action: 'roll',
    idempotencyKey: key,
    payload: null,
  } as GameActionIntent;
}

describe('Game action idempotency E2E (ADR-002 §5)', () => {
  let h: GamesWsHarness;

  beforeAll(async () => {
    h = await createHarness();
  });

  afterAll(async () => {
    await h.close();
  });

  afterEach(() => {
    h.redis.down = false;
    h.bridge.reset();
  });

  it('replays a duplicate roll without re-applying or re-broadcasting', async () => {
    const g = await h.createRunningGame();
    const [u1] = g.users;
    const c1 = h.connectClient(u1.token);
    const observer = h.connectClient(g.users[1].token);
    try {
      await Promise.all([c1.waitForConnect(), observer.waitForConnect()]);
      c1.emit('game:join', { gameId: g.gameId });
      await c1.take('game:snapshot');
      observer.emit('game:join', { gameId: g.gameId });
      await observer.take('game:snapshot');

      c1.emit('game:roll', { gameId: g.gameId, idempotencyKey: KEY });
      const state = await observer.take('game:state');
      const snap = await c1.take('game:snapshot');
      expect(snap.replayed).toBe(false);
      if (!snap.dice) throw new Error('roll snapshot missing dice');
      const seatView = state.players.find((p) => p.userId === u1.id);
      expect(seatView).toBeDefined();
      const appliedPosition = seatView?.position;
      expect(appliedPosition).toBe(snap.dice.total);

      // Same key, same intent: replayed to the actor only.
      c1.emit('game:roll', { gameId: g.gameId, idempotencyKey: KEY });
      const replay = await c1.take('game:snapshot');
      expect(replay.replayed).toBe(true);
      expect(replay.dice).toEqual(snap.dice);

      await sleep(200);
      expect(observer.count('game:state')).toBe(0);
      const seat = await h.getSeat(g.gameId, u1.id);
      expect(seat?.position).toBe(appliedPosition);
      expect(seat?.rolls).toBe(1);
    } finally {
      c1.close();
      observer.close();
    }
  });

  it('fails closed when the idempotency store is unavailable', async () => {
    const g = await h.createRunningGame();
    const [u1] = g.users;
    const client = h.connectClient(u1.token);
    try {
      await client.waitForConnect();
      client.emit('game:join', { gameId: g.gameId });
      await client.take('game:snapshot');

      h.redis.down = true;
      client.emit('game:roll', { gameId: g.gameId, idempotencyKey: KEY });
      const err = await client.take('game:error');
      expect(err).toMatchObject({ code: 'DEPENDENCY_UNAVAILABLE' });

      const seat = await h.getSeat(g.gameId, u1.id);
      expect(seat?.position).toBe(0);
      expect(seat?.rolls).toBe(0);
      expect(client.count('game:state')).toBe(0);
    } finally {
      h.redis.down = false;
      client.close();
    }
  });

  it('rejects a reused key whose stored intent does not match (DUPLICATE_ACTION)', async () => {
    const g = await h.createRunningGame();
    const [u1] = g.users;
    const client = h.connectClient(u1.token);
    try {
      await client.waitForConnect();
      client.emit('game:join', { gameId: g.gameId });
      await client.take('game:snapshot');

      const storeKey = gameActionIdempotencyKey(
        rollIntent(g.gameId, g.seats[0].id),
      );
      h.redis.entries.set(storeKey, {
        value: {
          bodyHash: 'pruned-record-from-another-payload',
          response: { first: 1, second: 1, total: 2 },
          expiresAt: Date.now() + 60_000,
        },
        expiresAt: null,
      });

      client.emit('game:roll', { gameId: g.gameId, idempotencyKey: KEY });
      const err = await client.take('game:error');
      expect(err).toMatchObject({ code: 'DUPLICATE_ACTION' });

      const seat = await h.getSeat(g.gameId, u1.id);
      expect(seat?.position).toBe(0);
      expect(seat?.rolls).toBe(0);
    } finally {
      client.close();
    }
  });

  it('rejects when the key is already claimed in flight (DUPLICATE_ACTION)', async () => {
    const g = await h.createRunningGame();
    const [u1] = g.users;
    const client = h.connectClient(u1.token);
    try {
      await client.waitForConnect();
      client.emit('game:join', { gameId: g.gameId });
      await client.take('game:snapshot');

      const storeKey = gameActionIdempotencyKey(
        rollIntent(g.gameId, g.seats[0].id),
      );
      h.redis.counters.set(`${storeKey}:lock`, {
        count: 1,
        expiresAt: Date.now() + 60_000,
      });

      client.emit('game:roll', { gameId: g.gameId, idempotencyKey: KEY });
      const err = await client.take('game:error');
      expect(err).toMatchObject({ code: 'DUPLICATE_ACTION' });

      const seat = await h.getSeat(g.gameId, u1.id);
      expect(seat?.position).toBe(0);
      expect(seat?.rolls).toBe(0);
    } finally {
      client.close();
    }
  });
});
