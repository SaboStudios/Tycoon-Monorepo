import { User } from '../src/modules/users/entities/user.entity';
import { GameStatus } from '../src/modules/games/entities/game.entity';
import { createHarness, GamesWsHarness, sleep } from './utils/games-ws-harness';

jest.setTimeout(60000);

describe('Games WebSocket E2E (ADR-002)', () => {
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

  // ── Handshake (§1 deny-by-default) ────────────────────────────────────────

  it('rejects a handshake without a token (AUTH_REQUIRED) and disconnects', async () => {
    const client = h.connectClient();
    try {
      const err = await client.take('game:error');
      expect(err).toMatchObject({ schemaVersion: 1, code: 'AUTH_REQUIRED' });
      expect(typeof err.message).toBe('string');
      await client.waitForDisconnect();
      expect(client.socket.connected).toBe(false);
    } finally {
      client.close();
    }
  });

  it('rejects a token expired beyond clock tolerance at handshake (AUTH_REQUIRED)', async () => {
    const user = await h.createUser();
    const staleToken = h.signToken(
      user.id,
      { email: user.email, role: 'USER' },
      -600,
    );
    const client = h.connectClient(staleToken);
    try {
      const err = await client.take('game:error');
      expect(err).toMatchObject({ code: 'AUTH_REQUIRED' });
      await client.waitForDisconnect();
    } finally {
      client.close();
    }
  });

  it('rejects a suspended account at handshake (USER_BANNED)', async () => {
    const user = await h.createUser({ is_suspended: true } as Partial<User>);
    const client = h.connectClient(user.token);
    try {
      const err = await client.take('game:error');
      expect(err).toMatchObject({ code: 'USER_BANNED' });
      await client.waitForDisconnect();
    } finally {
      client.close();
    }
  });

  it('accepts a token expired within tolerance but rejects actions (AUTH_EXPIRED)', async () => {
    const g = await h.createRunningGame();
    const token = h.signToken(
      g.users[0].id,
      { email: g.users[0].email, role: 'USER' },
      -30,
    );
    const client = h.connectClient(token);
    try {
      await client.waitForConnect();
      expect(client.socket.connected).toBe(true);
      client.emit('game:join', { gameId: g.gameId });
      const err = await client.take('game:error');
      expect(err).toMatchObject({ code: 'AUTH_EXPIRED' });
    } finally {
      client.close();
    }
  });

  // ── Seats & roles (§2) ───────────────────────────────────────────────────

  it('rejects a seatless join (NOT_SEATED) and admits spectators', async () => {
    const g = await h.createRunningGame();
    const spectator = await h.createUser();
    const client = h.connectClient(spectator.token);
    try {
      await client.waitForConnect();

      client.emit('game:join', { gameId: g.gameId });
      const err = await client.take('game:error');
      expect(err).toMatchObject({ code: 'NOT_SEATED' });

      client.emit('game:join', { gameId: g.gameId, asSpectator: true });
      const snap = await client.take('game:snapshot');
      expect(snap.viewer).toMatchObject({
        userId: spectator.id,
        role: 'spectator',
        seatId: null,
      });
      expect(snap.players).toHaveLength(2);
      // Hidden jail-card state must never be visible to a spectator.
      for (const p of snap.players) {
        expect(p).not.toHaveProperty('chanceJailCard');
        expect(p).not.toHaveProperty('communityChestJailCard');
      }

      client.emit('game:roll', {
        gameId: g.gameId,
        idempotencyKey: 'spect-roll-01',
      });
      const roleErr = await client.take('game:error');
      expect(roleErr).toMatchObject({ code: 'FORBIDDEN_ROLE' });
    } finally {
      client.close();
    }
  });

  // ── Authoritative action flow (§3) ───────────────────────────────────────

  it('runs a server-authoritative roll/turn cycle with idempotent replay', async () => {
    const g = await h.createRunningGame();
    const [u1, u2] = g.users;
    const c1 = h.connectClient(u1.token);
    const c2 = h.connectClient(u2.token);
    try {
      await Promise.all([c1.waitForConnect(), c2.waitForConnect()]);

      c1.emit('game:join', { gameId: g.gameId });
      const snap1 = await c1.take('game:snapshot');
      expect(snap1.viewer).toMatchObject({
        userId: u1.id,
        role: 'player',
        seatId: g.seats[0].id,
      });

      c2.emit('game:join', { gameId: g.gameId });
      const snap2 = await c2.take('game:snapshot');
      expect(snap2.viewer).toMatchObject({
        userId: u2.id,
        role: 'player',
        seatId: g.seats[1].id,
      });

      // Out-of-turn roll is rejected before anything is applied.
      c2.emit('game:roll', {
        gameId: g.gameId,
        idempotencyKey: 'off-turn-001',
      });
      const offTurn = await c2.take('game:error');
      expect(offTurn).toMatchObject({ code: 'NOT_YOUR_TURN' });

      // Server-authoritative dice: client-supplied outcome fields are refused.
      c1.emit('game:roll', {
        gameId: g.gameId,
        idempotencyKey: 'dice-kill-01',
        dice1: 6,
      });
      const diceErr = await c1.take('game:error');
      expect(diceErr).toMatchObject({ code: 'INVALID_PAYLOAD' });
      expect(diceErr.message).toContain('Server-authoritative');

      // Turn owner rolls: room broadcast + actor snapshot, dice from the server.
      c1.emit('game:roll', {
        gameId: g.gameId,
        idempotencyKey: 'roll-key-001',
      });
      const state = await c2.take('game:state');
      expect(state).toMatchObject({ schemaVersion: 1, action: 'roll' });
      expect(state.game.id).toBe(g.gameId);
      expect(state.game.nextPlayerId).toBe(u1.id);

      const rollSnap = await c1.take('game:snapshot');
      expect(rollSnap.replayed).toBe(false);
      expect(rollSnap.action).toBe('roll');
      if (!rollSnap.dice) throw new Error('roll snapshot missing dice');
      const dice = rollSnap.dice;
      expect(dice.first).toBeGreaterThanOrEqual(1);
      expect(dice.first).toBeLessThanOrEqual(6);
      expect(dice.second).toBeGreaterThanOrEqual(1);
      expect(dice.second).toBeLessThanOrEqual(6);
      expect(dice.total).toBe(dice.first + dice.second);

      const u1Seat = state.players.find((p) => p.userId === u1.id);
      expect(u1Seat).toBeDefined();
      expect(u1Seat?.rolled).toBe(true);
      expect(u1Seat?.position).toBe(dice.total);

      // Replay of the same key: snapshot to the actor only, no re-apply.
      c1.emit('game:roll', {
        gameId: g.gameId,
        idempotencyKey: 'roll-key-001',
      });
      const replay = await c1.take('game:snapshot');
      expect(replay.replayed).toBe(true);
      expect(replay.action).toBe('roll');
      expect(replay.dice).toEqual(dice);
      await sleep(200);
      // The first roll's game:state was consumed above; the replay must not
      // add another room broadcast or snapshot for the other seat.
      expect(c2.count('game:state')).toBe(0);
      expect(c2.count('game:snapshot')).toBe(0);

      // End of turn advances next_player_id to the other seat.
      c1.emit('game:end-turn', {
        gameId: g.gameId,
        idempotencyKey: 'end-turn-001',
      });
      const endState = await c2.take(
        'game:state',
        (p) => p.action === 'end-turn',
      );
      expect(endState.game.nextPlayerId).toBe(u2.id);
      const endSnap = await c1.take('game:snapshot');
      expect(endSnap.replayed).toBe(false);
      expect(endSnap.action).toBe('end-turn');

      // The new turn owner can roll now. c1 still holds its own earlier
      // roll broadcast, so match on the action + turn owner.
      c2.emit('game:roll', {
        gameId: g.gameId,
        idempotencyKey: 'roll-key-002',
      });
      const state2 = await c1.take(
        'game:state',
        (p) => p.action === 'roll' && p.game.nextPlayerId === u2.id,
      );
      const u2Seat = state2.players.find((p) => p.userId === u2.id);
      expect(u2Seat?.position).toBeGreaterThan(0);
      await c2.take('game:snapshot');

      // Actions for a game this socket never joined do not leak existence.
      c2.emit('game:roll', {
        gameId: 999_999,
        idempotencyKey: 'wrong-game-1',
      });
      const wrongGame = await c2.take('game:error');
      expect(wrongGame).toMatchObject({ code: 'NOT_SEATED' });
    } finally {
      c1.close();
      c2.close();
    }
  });

  // ── Chat deny-by-default (§7) ────────────────────────────────────────────

  it('rejects chat while the feature flag is off (CHAT_DISABLED)', async () => {
    const g = await h.createRunningGame();
    const client = h.connectClient(g.users[0].token);
    try {
      await client.waitForConnect();
      client.emit('game:join', { gameId: g.gameId });
      await client.take('game:snapshot');

      client.emit('chat:send', { gameId: g.gameId, text: 'hello there' });
      const err = await client.take('game:error');
      expect(err).toMatchObject({ code: 'CHAT_DISABLED' });
    } finally {
      client.close();
    }
  });

  // ── Leave (§2) ───────────────────────────────────────────────────────────

  it('acknowledges game:leave and rejects later actions (NOT_SEATED)', async () => {
    const g = await h.createRunningGame();
    const c2 = h.connectClient(g.users[1].token);
    try {
      await c2.waitForConnect();
      c2.emit('game:join', { gameId: g.gameId });
      await c2.take('game:snapshot');

      c2.emit('game:leave', {});
      const bye = await c2.take('game:unsubscribed');
      expect(bye).toMatchObject({
        schemaVersion: 1,
        reason: 'leave',
        terminal: false,
        gameId: g.gameId,
      });

      c2.emit('game:roll', {
        gameId: g.gameId,
        idempotencyKey: 'after-leav-1',
      });
      const err = await c2.take('game:error');
      expect(err).toMatchObject({ code: 'NOT_SEATED' });
    } finally {
      c2.close();
    }
  });

  // ── Ended game (§3) ──────────────────────────────────────────────────────

  it('rejects actions once the game status is FINISHED (GAME_ENDED)', async () => {
    const g = await h.createRunningGame();
    const client = h.connectClient(g.users[0].token);
    try {
      await client.waitForConnect();
      client.emit('game:join', { gameId: g.gameId });
      await client.take('game:snapshot');

      await h.setGameStatus(g.gameId, GameStatus.FINISHED);
      client.emit('game:roll', {
        gameId: g.gameId,
        idempotencyKey: 'ended-game-1',
      });
      const err = await client.take('game:error');
      expect(err).toMatchObject({ code: 'GAME_ENDED' });
    } finally {
      client.close();
    }
  });

  // ── Reconnect (§2 restore) ───────────────────────────────────────────────

  it('restores board state after reconnect', async () => {
    const g = await h.createRunningGame();
    const u1 = g.users[0];

    const first = h.connectClient(u1.token);
    await first.waitForConnect();
    first.emit('game:join', { gameId: g.gameId });
    await first.take('game:snapshot');
    first.emit('game:roll', {
      gameId: g.gameId,
      idempotencyKey: 'reconnect-001',
    });
    const rollSnap = await first.take('game:snapshot');
    const rolledSeat = rollSnap.players.find((p) => p.userId === u1.id);
    expect(rolledSeat).toBeDefined();
    const rolledPosition = rolledSeat?.position;
    expect(rolledPosition).toBeGreaterThan(0);
    first.close();

    const second = h.connectClient(u1.token);
    try {
      await second.waitForConnect();
      second.emit('game:join', { gameId: g.gameId });
      const snap = await second.take('game:snapshot');
      const seat = snap.players.find((p) => p.userId === u1.id);
      expect(seat?.position).toBe(rolledPosition);
      expect(seat.rolled).toBe(true);
    } finally {
      second.close();
    }
  });

  // ── Ban teardown (§6) ────────────────────────────────────────────────────

  it('detaches a banned player with a terminal notice and blocks reconnect', async () => {
    const g = await h.createRunningGame();
    const [u1, u2] = g.users;
    const c1 = h.connectClient(u1.token);
    const c2 = h.connectClient(u2.token);
    try {
      await Promise.all([c1.waitForConnect(), c2.waitForConnect()]);
      c1.emit('game:join', { gameId: g.gameId });
      await c1.take('game:snapshot');
      c2.emit('game:join', { gameId: g.gameId });
      await c2.take('game:snapshot');

      await h.bridge.notifyUserBanned(u2.id);

      const notice = await c2.take('game:unsubscribed');
      expect(notice).toMatchObject({
        schemaVersion: 1,
        reason: 'banned',
        code: 'USER_BANNED',
        terminal: true,
        gameId: g.gameId,
      });
      await c2.waitForDisconnect();

      await sleep(100);
      expect(c1.socket.connected).toBe(true);

      const retry = h.connectClient(u2.token);
      try {
        const err = await retry.take('game:error');
        expect(err).toMatchObject({ code: 'USER_BANNED' });
        await retry.waitForDisconnect();
      } finally {
        retry.close();
      }
    } finally {
      c1.close();
      c2.close();
    }
  });

  // ── Rate limits (§4) ─────────────────────────────────────────────────────

  it('rate-limits joins per socket (RATE_LIMITED)', async () => {
    const g = await h.createRunningGame();
    const client = h.connectClient(g.users[0].token);
    try {
      await client.waitForConnect();
      for (let i = 0; i < 10; i++) {
        client.emit('game:join', { gameId: g.gameId });
        await client.take('game:snapshot');
      }
      client.emit('game:join', { gameId: g.gameId });
      const err = await client.take('game:error');
      expect(err).toMatchObject({ code: 'RATE_LIMITED' });
      expect(err.message).toContain('Too many requests');
    } finally {
      client.close();
    }
  });
});
