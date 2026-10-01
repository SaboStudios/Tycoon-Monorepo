import { ArgumentsHost } from '@nestjs/common';
import { GameActionErrorCode } from './game-action.error';
import { GamesRealtimeBridge } from './games-realtime.bridge';
import { GamesGateway } from './games.gateway';
import { GamesSnapshotService } from './games-snapshot.service';
import { GamesWsExceptionFilter } from './games-ws-exception.filter';
import { GamesWsMetrics } from './games-ws-metrics.service';
import { GameActionIdempotencyService } from './game-action-idempotency.service';
import { GamePlayersService } from '../game-players.service';
import { GamesService } from '../games.service';
import { WsAuthService } from './ws-auth.service';
import { WsRateLimiterService } from './ws-rate-limiter.service';
import { GameStatus } from '../entities/game.entity';

const FUTURE_EXP = Math.floor(Date.now() / 1000) + 600;

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

interface FakeClient {
  id: string;
  data: {
    principal?: {
      userId: number;
      role: string;
      isAdmin: boolean;
      exp: number;
    };
    role?: 'player' | 'spectator';
    gameId?: number;
    seatId?: number | null;
    counted?: boolean;
  };
  joined: string[];
  left: string[];
  emitted: {
    event: string;
    payload: { code?: string } & Record<string, unknown>;
  }[];
  join: jest.Mock;
  leave: jest.Mock;
  emit: jest.Mock;
  disconnect: jest.Mock;
}

function makeClient(
  data: FakeClient['data'] = {
    principal: { userId: 1, role: 'user', isAdmin: false, exp: FUTURE_EXP },
  },
): FakeClient {
  const client: FakeClient = {
    id: 'socket-1',
    data,
    joined: [],
    left: [],
    emitted: [],
    emit: jest.fn((event: string, payload: unknown) => {
      client.emitted.push({
        event,
        payload: payload as FakeClient['emitted'][0]['payload'],
      });
    }),
    disconnect: jest.fn(),
    leave: jest.fn((room: string) => {
      client.left.push(room);
    }),
    join: jest.fn((room: string) => {
      client.joined.push(room);
    }),
  };
  return client;
}

function lastError(client: FakeClient): { code?: string; message?: string } {
  const errors = client.emitted.filter((e) => e.event === 'game:error');
  expect(errors.length).toBeGreaterThan(0);
  return errors[errors.length - 1].payload;
}

describe('GamesGateway - authz matrix (seat / spectator / turn)', () => {
  let gateway: GamesGateway;
  let filter: GamesWsExceptionFilter;
  let fakeRedis: FakeRedis;
  let bridge: GamesRealtimeBridge;
  let snapshot: {
    findSeat: jest.Mock;
    build: jest.Mock;
    buildPublicState: jest.Mock;
  };
  let gamesService: { findById: jest.Mock };
  let players: { rollDice: jest.Mock; advanceTurn: jest.Mock };
  let rateLimiter: { consume: jest.Mock };
  let metrics: {
    rejected: jest.Mock;
    rateLimited: jest.Mock;
    teardown: jest.Mock;
    socketConnected: jest.Mock;
    socketDisconnected: jest.Mock;
  };
  let roomEmissions: { room: string; event: string; payload: unknown }[];

  const runningGame = {
    id: 1,
    code: 'ABC123',
    status: GameStatus.RUNNING,
    next_player_id: 1,
    creator_id: 1,
    number_of_players: 4,
    mode: 'PUBLIC',
    placements: {},
  };

  const seat1 = {
    id: 10,
    game_id: 1,
    user_id: 1,
    position: 3,
    balance: 1400,
    rolled: 0,
    in_jail: false,
    in_jail_rolls: 0,
    circle: 0,
    rolls: 1,
    chance_jail_card: false,
    community_chest_jail_card: false,
  };

  /**
   * Runs a handler the way Nest does: thrown GameActionErrors flow through
   * GamesWsExceptionFilter, which emits `game:error` on the socket.
   */
  async function deliver(
    client: FakeClient,
    fn: () => Promise<void>,
  ): Promise<void> {
    try {
      await fn();
    } catch (err) {
      const host = {
        switchToWs: () => ({ getClient: () => client }),
      } as unknown as ArgumentsHost;
      filter.catch(err, host);
    }
  }

  beforeEach(() => {
    fakeRedis = new FakeRedis();
    bridge = new GamesRealtimeBridge();
    snapshot = {
      findSeat: jest.fn(),
      build: jest.fn().mockResolvedValue({ schemaVersion: 1 }),
      buildPublicState: jest.fn().mockResolvedValue({
        schemaVersion: 1,
        game: { id: 1 },
        players: [],
      }),
    };
    gamesService = { findById: jest.fn().mockResolvedValue(runningGame) };
    players = {
      rollDice: jest.fn().mockResolvedValue({ id: 10, position: 7 }),
      advanceTurn: jest.fn().mockResolvedValue(undefined),
    };
    rateLimiter = { consume: jest.fn().mockResolvedValue(true) };
    metrics = {
      rejected: jest.fn(),
      rateLimited: jest.fn(),
      teardown: jest.fn(),
      socketConnected: jest.fn(),
      socketDisconnected: jest.fn(),
    };
    roomEmissions = [];

    // Default: every user queried holds seat 10 in game 1 (tests override).
    snapshot.findSeat.mockResolvedValue(seat1);

    gateway = new GamesGateway(
      {} as WsAuthService,
      snapshot as unknown as GamesSnapshotService,
      gamesService as unknown as GamesService,
      players as unknown as GamePlayersService,
      rateLimiter as unknown as WsRateLimiterService,
      new GameActionIdempotencyService(fakeRedis as never),
      metrics as unknown as GamesWsMetrics,
      bridge,
      { get: jest.fn().mockReturnValue(false) } as never,
    );
    gateway.server = {
      to: (room: string) => ({
        emit: (event: string, payload: unknown) => {
          roomEmissions.push({ room, event, payload });
        },
      }),
      fetchSockets: jest.fn().mockResolvedValue([]),
      sockets: new Map(),
    } as never;
    filter = new GamesWsExceptionFilter(metrics as unknown as GamesWsMetrics);
  });

  function seatedClient(): FakeClient {
    const client = makeClient();
    client.data.role = 'player';
    client.data.gameId = 1;
    client.data.seatId = 10;
    snapshot.findSeat.mockResolvedValue(seat1);
    return client;
  }

  it('rejects a spectator roll with FORBIDDEN_ROLE', async () => {
    const client = makeClient();
    client.data.role = 'spectator';
    client.data.gameId = 1;

    await deliver(client, () =>
      gateway.handleRoll(client as never, {
        gameId: 1,
        idempotencyKey: 'key-12345678',
      }),
    );

    expect(lastError(client).code).toBe(GameActionErrorCode.FORBIDDEN_ROLE);
    expect(players.rollDice).not.toHaveBeenCalled();
    expect(metrics.rejected).toHaveBeenCalledWith(
      GameActionErrorCode.FORBIDDEN_ROLE,
    );
  });

  it('rejects a roll from a socket that never joined with NOT_SEATED', async () => {
    const client = makeClient();

    await deliver(client, () =>
      gateway.handleRoll(client as never, {
        gameId: 1,
        idempotencyKey: 'key-12345678',
      }),
    );

    expect(lastError(client).code).toBe(GameActionErrorCode.NOT_SEATED);
    expect(players.rollDice).not.toHaveBeenCalled();
  });

  it('rejects a roll for a different game than the joined room', async () => {
    const client = seatedClient();

    await deliver(client, () =>
      gateway.handleRoll(client as never, {
        gameId: 2,
        idempotencyKey: 'key-12345678',
      }),
    );

    expect(lastError(client).code).toBe(GameActionErrorCode.NOT_SEATED);
  });

  it('rejects an off-turn roll with NOT_YOUR_TURN', async () => {
    const client = seatedClient();
    gamesService.findById.mockResolvedValue({
      ...runningGame,
      next_player_id: 2,
    });

    await deliver(client, () =>
      gateway.handleRoll(client as never, {
        gameId: 1,
        idempotencyKey: 'key-12345678',
      }),
    );

    expect(lastError(client).code).toBe(GameActionErrorCode.NOT_YOUR_TURN);
    expect(players.rollDice).not.toHaveBeenCalled();
  });

  it('rejects a roll when the seat already rolled this turn', async () => {
    const client = seatedClient();
    snapshot.findSeat.mockResolvedValue({ ...seat1, rolled: 1 });

    await deliver(client, () =>
      gateway.handleRoll(client as never, {
        gameId: 1,
        idempotencyKey: 'key-12345678',
      }),
    );

    expect(lastError(client).code).toBe(GameActionErrorCode.NOT_YOUR_TURN);
    expect(players.rollDice).not.toHaveBeenCalled();
  });

  it('rejects a roll on a finished game with GAME_ENDED', async () => {
    const client = seatedClient();
    gamesService.findById.mockResolvedValue({
      ...runningGame,
      status: GameStatus.FINISHED,
    });

    await deliver(client, () =>
      gateway.handleRoll(client as never, {
        gameId: 1,
        idempotencyKey: 'key-12345678',
      }),
    );

    expect(lastError(client).code).toBe(GameActionErrorCode.GAME_ENDED);
  });

  it('rejects a roll on a force-ended game even before the DB lookup', async () => {
    const client = seatedClient();
    await bridge.notifyGameEnded(1);

    await deliver(client, () =>
      gateway.handleRoll(client as never, {
        gameId: 1,
        idempotencyKey: 'key-12345678',
      }),
    );

    expect(lastError(client).code).toBe(GameActionErrorCode.GAME_ENDED);
    expect(gamesService.findById).not.toHaveBeenCalled();
  });

  it('rejects a roll before the game starts with NOT_YOUR_TURN', async () => {
    const client = seatedClient();
    gamesService.findById.mockResolvedValue({
      ...runningGame,
      status: GameStatus.PENDING,
    });

    await deliver(client, () =>
      gateway.handleRoll(client as never, {
        gameId: 1,
        idempotencyKey: 'key-12345678',
      }),
    );

    expect(lastError(client).code).toBe(GameActionErrorCode.NOT_YOUR_TURN);
  });

  it('rejects unknown games with GAME_NOT_FOUND', async () => {
    const client = seatedClient();
    // Joined room exists but the game row is gone (deleted mid-session).
    client.data.gameId = 99;
    gamesService.findById.mockRejectedValue(new Error('not found'));

    await deliver(client, () =>
      gateway.handleRoll(client as never, {
        gameId: 99,
        idempotencyKey: 'key-12345678',
      }),
    );

    expect(lastError(client).code).toBe(GameActionErrorCode.GAME_NOT_FOUND);
  });

  it('does not leak game existence for unjoined games (NOT_SEATED first)', async () => {
    const client = seatedClient();

    await deliver(client, () =>
      gateway.handleRoll(client as never, {
        gameId: 99,
        idempotencyKey: 'key-12345678',
      }),
    );

    expect(lastError(client).code).toBe(GameActionErrorCode.NOT_SEATED);
    expect(gamesService.findById).not.toHaveBeenCalled();
  });

  it('rejects client-supplied dice fields with INVALID_PAYLOAD', async () => {
    const client = seatedClient();

    await deliver(client, () =>
      gateway.handleRoll(client as never, {
        gameId: 1,
        idempotencyKey: 'key-12345678',
        dice1: 6,
        dice2: 6,
      }),
    );

    expect(lastError(client).code).toBe(GameActionErrorCode.INVALID_PAYLOAD);
    expect(players.rollDice).not.toHaveBeenCalled();
  });

  it('rejects a roll without an idempotency key', async () => {
    const client = seatedClient();

    await deliver(client, () =>
      gateway.handleRoll(client as never, { gameId: 1 }),
    );

    expect(lastError(client).code).toBe(GameActionErrorCode.INVALID_PAYLOAD);
  });

  it('rejects unknown payload fields', async () => {
    const client = seatedClient();

    await deliver(client, () =>
      gateway.handleRoll(client as never, {
        gameId: 1,
        idempotencyKey: 'key-12345678',
        balance: 999999,
      }),
    );

    expect(lastError(client).code).toBe(GameActionErrorCode.INVALID_PAYLOAD);
  });

  it('rejects when the per-socket rate limit is exhausted', async () => {
    const client = seatedClient();
    rateLimiter.consume.mockResolvedValue(false);

    await deliver(client, () =>
      gateway.handleRoll(client as never, {
        gameId: 1,
        idempotencyKey: 'key-12345678',
      }),
    );

    expect(lastError(client).code).toBe(GameActionErrorCode.RATE_LIMITED);
    expect(metrics.rateLimited).toHaveBeenCalledWith('roll');
    expect(players.rollDice).not.toHaveBeenCalled();
  });

  it('applies a valid roll with server-generated dice and broadcasts state', async () => {
    const client = seatedClient();

    await deliver(client, () =>
      gateway.handleRoll(client as never, {
        gameId: 1,
        idempotencyKey: 'key-12345678',
      }),
    );

    expect(players.rollDice).toHaveBeenCalledTimes(1);
    const [gameId, seatId, d1, d2] = players.rollDice.mock.calls[0] as [
      number,
      number,
      number,
      number,
    ];
    expect(gameId).toBe(1);
    expect(seatId).toBe(10);
    expect(d1).toBeGreaterThanOrEqual(1);
    expect(d1).toBeLessThanOrEqual(6);
    expect(d2).toBeGreaterThanOrEqual(1);
    expect(d2).toBeLessThanOrEqual(6);

    expect(roomEmissions).toEqual([
      expect.objectContaining({ room: 'game_1', event: 'game:state' }),
    ]);
    const snapshots = client.emitted.filter((e) => e.event === 'game:snapshot');
    expect(snapshots).toHaveLength(1);
    expect(snapshots[0].payload).toEqual(
      expect.objectContaining({ replayed: false }),
    );
  });

  it('replays an idempotent roll without re-applying or re-broadcasting', async () => {
    const client = seatedClient();

    await deliver(client, () =>
      gateway.handleRoll(client as never, {
        gameId: 1,
        idempotencyKey: 'idem-key-12345',
      }),
    );
    expect(players.rollDice).toHaveBeenCalledTimes(1);
    expect(roomEmissions).toHaveLength(1);

    await deliver(client, () =>
      gateway.handleRoll(client as never, {
        gameId: 1,
        idempotencyKey: 'idem-key-12345',
      }),
    );

    expect(players.rollDice).toHaveBeenCalledTimes(1);
    expect(roomEmissions).toHaveLength(1);
    const snapshots = client.emitted.filter((e) => e.event === 'game:snapshot');
    expect(snapshots[snapshots.length - 1].payload).toEqual(
      expect.objectContaining({ replayed: true }),
    );
  });

  it('fails closed with DEPENDENCY_UNAVAILABLE when Redis is down', async () => {
    const client = seatedClient();
    fakeRedis.down = true;

    await deliver(client, () =>
      gateway.handleRoll(client as never, {
        gameId: 1,
        idempotencyKey: 'idem-key-12345',
      }),
    );

    expect(lastError(client).code).toBe(
      GameActionErrorCode.DEPENDENCY_UNAVAILABLE,
    );
    expect(players.rollDice).not.toHaveBeenCalled();
  });

  it('rejects an end-turn from an off-seat user with NOT_YOUR_TURN', async () => {
    const client = seatedClient();
    gamesService.findById.mockResolvedValue({
      ...runningGame,
      next_player_id: 7,
    });

    await deliver(client, () =>
      gateway.handleEndTurn(client as never, {
        gameId: 1,
        idempotencyKey: 'end-key-12345',
      }),
    );

    expect(lastError(client).code).toBe(GameActionErrorCode.NOT_YOUR_TURN);
    expect(players.advanceTurn).not.toHaveBeenCalled();
  });

  it('advances the turn for the acting seat and broadcasts', async () => {
    const client = seatedClient();

    await deliver(client, () =>
      gateway.handleEndTurn(client as never, {
        gameId: 1,
        idempotencyKey: 'end-key-12345',
      }),
    );

    expect(players.advanceTurn).toHaveBeenCalledWith(1, 1);
    expect(roomEmissions).toEqual([
      expect.objectContaining({ room: 'game_1', event: 'game:state' }),
    ]);
  });

  it('seats the player and returns a snapshot on join', async () => {
    const client = makeClient();

    await deliver(client, () =>
      gateway.handleJoin(client as never, { gameId: 1 }),
    );

    expect(client.joined).toContain('game_1');
    expect(client.data.role).toBe('player');
    expect(client.data.seatId).toBe(10);
    expect(client.emitted[0]).toEqual(
      expect.objectContaining({ event: 'game:snapshot' }),
    );
  });

  it('rejects a join without a seat unless spectator is requested', async () => {
    const client = makeClient();
    snapshot.findSeat.mockResolvedValue(null);

    await deliver(client, () =>
      gateway.handleJoin(client as never, { gameId: 1 }),
    );

    expect(lastError(client).code).toBe(GameActionErrorCode.NOT_SEATED);
    expect(client.joined).toHaveLength(0);
  });

  it('allows a seatless spectator to join with asSpectator', async () => {
    const client = makeClient();
    snapshot.findSeat.mockResolvedValue(null);

    await deliver(client, () =>
      gateway.handleJoin(client as never, {
        gameId: 1,
        asSpectator: true,
      }),
    );

    expect(client.joined).toContain('game_1');
    expect(client.data.role).toBe('spectator');
    expect(snapshot.build).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ role: 'spectator', seatId: null }),
    );
  });

  it('re-emits the snapshot on a duplicate join (idempotent join)', async () => {
    const client = makeClient();

    await deliver(client, () =>
      gateway.handleJoin(client as never, { gameId: 1 }),
    );
    await deliver(client, () =>
      gateway.handleJoin(client as never, { gameId: 1 }),
    );

    expect(client.joined).toEqual(['game_1', 'game_1']);
    expect(
      client.emitted.filter((e) => e.event === 'game:snapshot'),
    ).toHaveLength(2);
    expect(
      client.emitted.find((e) => e.event === 'game:error'),
    ).toBeUndefined();
  });

  it('rejects chat with CHAT_DISABLED while chat is off by default', async () => {
    const client = makeClient();
    client.data.gameId = 1;
    client.data.role = 'player';

    await deliver(client, () =>
      gateway.handleChat(client as never, { text: 'hello' }),
    );

    expect(lastError(client).code).toBe(GameActionErrorCode.CHAT_DISABLED);
    expect(roomEmissions).toHaveLength(0);
  });

  it('leaves the room and acks with terminal:false on game:leave', async () => {
    const client = seatedClient();

    await deliver(client, () =>
      gateway.handleLeave(client as never, { gameId: 1 }),
    );

    expect(client.left).toContain('game_1');
    expect(client.data.gameId).toBeUndefined();
    expect(client.emitted).toEqual([
      expect.objectContaining({
        event: 'game:unsubscribed',
        payload: expect.objectContaining({
          terminal: false,
          reason: 'leave',
          gameId: 1,
        }) as FakeClient['emitted'][0]['payload'],
      }),
    ]);
  });

  describe('ban / force-end teardown (bridge)', () => {
    it('notifies, detaches and disconnects the banned user socket', async () => {
      const client = seatedClient();
      const disconnect = jest.fn();
      const leave = jest.fn();
      gateway.server = {
        ...gateway.server,
        fetchSockets: jest.fn().mockResolvedValue([
          {
            data: client.data,
            rooms: { has: () => true },
            emit: client.emit,
            leave,
            disconnect,
          },
        ]),
      } as never;

      await gateway.unsubscribeUser(1, GameActionErrorCode.USER_BANNED);

      expect(client.emitted).toEqual([
        expect.objectContaining({
          event: 'game:unsubscribed',
          payload: expect.objectContaining({
            terminal: true,
            reason: 'banned',
            code: GameActionErrorCode.USER_BANNED,
            gameId: 1,
          }) as FakeClient['emitted'][0]['payload'],
        }),
      ]);
      expect(leave).toHaveBeenCalledWith('game_1');
      expect(disconnect).toHaveBeenCalledWith(true);
      expect(metrics.teardown).toHaveBeenCalledWith('banned');
    });

    it('force-end detaches only sockets inside the game room', async () => {
      const inside = jest.fn();
      const outside = jest.fn();
      gateway.server = {
        ...gateway.server,
        fetchSockets: jest.fn().mockResolvedValue([
          {
            data: {
              principal: { userId: 1, role: 'user', isAdmin: false, exp: 1 },
            },
            rooms: { has: (r: string) => r === 'game_1' },
            emit: jest.fn(),
            leave: jest.fn(),
            disconnect: inside,
          },
          {
            data: {
              principal: { userId: 2, role: 'user', isAdmin: false, exp: 1 },
            },
            rooms: { has: () => false },
            emit: jest.fn(),
            leave: jest.fn(),
            disconnect: outside,
          },
        ]),
      } as never;

      await gateway.endGame(1, GameActionErrorCode.GAME_ENDED);

      expect(inside).toHaveBeenCalledWith(true);
      expect(outside).not.toHaveBeenCalled();
      expect(metrics.teardown).toHaveBeenCalledWith('force_end');
    });

    it('falls back to local sockets when fetchSockets fails', async () => {
      const disconnect = jest.fn();
      gateway.server = {
        ...gateway.server,
        fetchSockets: jest.fn().mockRejectedValue(new Error('redis down')),
        sockets: new Map([
          [
            'local-1',
            {
              data: {
                principal: {
                  userId: 1,
                  role: 'user',
                  isAdmin: false,
                  exp: 1,
                },
                gameId: 1,
              },
              rooms: new Set(['game_1']),
              emit: jest.fn(),
              leave: jest.fn(),
              disconnect,
            },
          ],
        ]),
      } as never;

      await gateway.unsubscribeUser(1, GameActionErrorCode.USER_BANNED);

      expect(disconnect).toHaveBeenCalledWith(true);
    });
  });
});
