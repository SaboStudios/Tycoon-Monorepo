import { randomInt } from 'crypto';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayInit,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Logger, OnModuleDestroy, UseFilters, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Server, Socket } from 'socket.io';
import { Game, GameStatus } from '../entities/game.entity';
import { GamePlayer } from '../entities/game-player.entity';
import { GamePlayersService } from '../game-players.service';
import { GamesService } from '../games.service';
import { GameActionIdempotencyService } from './game-action-idempotency.service';
import { GameActionError, GameActionErrorCode } from './game-action.error';
import {
  GamesRealtimeBridge,
  TerminationReason,
} from './games-realtime.bridge';
import { GamesSnapshotService } from './games-snapshot.service';
import { GamesWsExceptionFilter } from './games-ws-exception.filter';
import { GamesWsMetrics } from './games-ws-metrics.service';
import { WsJwtGuard } from './ws-jwt.guard';
import { WsAuthService, WsPrincipal } from './ws-auth.service';
import { WsRateLimiterService } from './ws-rate-limiter.service';

const REASON_TEXT: Partial<Record<TerminationReason, string>> = {
  [GameActionErrorCode.USER_BANNED]: 'banned',
  [GameActionErrorCode.GAME_ENDED]: 'force_end',
};

interface AuthedSocketData {
  principal?: WsPrincipal;
  role?: 'player' | 'spectator';
  gameId?: number;
  seatId?: number | null;
  terminated?: boolean;
  counted?: boolean;
}

interface AuthedSocket extends Socket {
  data: AuthedSocketData;
}

/**
 * Structural shape shared by local sockets and adapter RemoteSockets so the
 * ban/force-end teardown path works on both.
 */
interface DetachableSocket {
  data: AuthedSocketData;
  rooms: { has(room: string): boolean };
  emit(event: string, payload: unknown): unknown;
  leave(room: string): Promise<void> | void;
  disconnect(close?: boolean): unknown;
}

function parseGameId(value: unknown): number {
  const gameId =
    typeof value === 'string' ? Number(value) : (value as number | undefined);
  if (typeof gameId !== 'number' || !Number.isInteger(gameId) || gameId <= 0) {
    throw new GameActionError(GameActionErrorCode.INVALID_PAYLOAD, {
      message: 'gameId must be a positive integer',
    });
  }
  return gameId;
}

function parseIdempotencyKey(value: unknown): string {
  if (typeof value !== 'string') {
    throw new GameActionError(GameActionErrorCode.INVALID_PAYLOAD, {
      message: 'idempotencyKey is required and must be a string',
    });
  }
  const key = value.trim();
  if (key.length < 8 || key.length > 200) {
    throw new GameActionError(GameActionErrorCode.INVALID_PAYLOAD, {
      message: 'idempotencyKey must be 8-200 characters',
    });
  }
  return key;
}

const SERVER_ONLY_FIELDS = [
  'dice1',
  'dice2',
  'd1',
  'd2',
  'dice',
  'result',
  'value',
  'seed',
  'outcome',
];

function assertNoUnknownFields(
  payload: Record<string, unknown>,
  allowed: readonly string[],
): void {
  for (const key of Object.keys(payload)) {
    if (SERVER_ONLY_FIELDS.includes(key)) {
      throw new GameActionError(GameActionErrorCode.INVALID_PAYLOAD, {
        message: `Server-authoritative field "${key}" must never be sent by clients`,
      });
    }
    if (!allowed.includes(key)) {
      throw new GameActionError(GameActionErrorCode.INVALID_PAYLOAD, {
        message: `Unknown field "${key}"`,
      });
    }
  }
}

function asPayload(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new GameActionError(GameActionErrorCode.INVALID_PAYLOAD, {
      message: 'Payload must be an object',
    });
  }
  return value as Record<string, unknown>;
}

function assertGamePlayable(game: Game): void {
  if (
    game.status === GameStatus.FINISHED ||
    game.status === GameStatus.CANCELLED
  ) {
    throw new GameActionError(GameActionErrorCode.GAME_ENDED, {
      message: 'This game has ended',
    });
  }
}

function assertGameRunning(game: Game): void {
  assertGamePlayable(game);
  if (game.status !== GameStatus.RUNNING) {
    throw new GameActionError(GameActionErrorCode.NOT_YOUR_TURN, {
      message: 'Game has not started',
    });
  }
}

/**
 * Realtime entry point for the Game board (ADR-002).
 *
 * Protocol (server → client events all carry `schemaVersion`):
 *   game:snapshot      full authoritative state for the calling socket
 *   game:state         room broadcast after a server-authoritative action
 *   game:error         { schemaVersion, code, message, requestId? }
 *   game:unsubscribed  terminal/leave notice { reason, code, terminal }
 *   chat:message       in-game chat (only when GAMES_CHAT_ENABLED)
 *
 * Client → server events: `game:join`, `game:roll`, `game:end-turn`,
 * `game:leave`, `chat:send`.
 *
 * Security invariants: deny-by-default handshake (WsAuthService), per-action
 * re-auth (WsJwtGuard), seat ownership bound to the verified principal,
 * server-generated dice via crypto.randomInt, rate limits per socket and per
 * user, idempotent roll/end-turn coordinated with the REST write path.
 */
@WebSocketGateway({
  namespace: '/games',
  cors: { origin: true, credentials: true },
})
@UseFilters(GamesWsExceptionFilter)
export class GamesGateway
  implements
    OnGatewayInit,
    OnGatewayConnection,
    OnGatewayDisconnect,
    OnModuleDestroy
{
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(GamesGateway.name);

  constructor(
    private readonly wsAuthService: WsAuthService,
    private readonly snapshotService: GamesSnapshotService,
    private readonly gamesService: GamesService,
    private readonly gamePlayersService: GamePlayersService,
    private readonly rateLimiter: WsRateLimiterService,
    private readonly idempotency: GameActionIdempotencyService,
    private readonly metrics: GamesWsMetrics,
    private readonly bridge: GamesRealtimeBridge,
    private readonly configService: ConfigService,
  ) {}

  afterInit(): void {
    this.bridge.register(this);
    this.logger.log('Games gateway initialized (namespace /games)');
  }

  onModuleDestroy(): void {
    this.bridge.unregister(this);
  }

  async handleConnection(client: AuthedSocket): Promise<void> {
    try {
      const principal = await this.wsAuthService.authenticate(client);
      client.data.principal = principal;
      client.data.role = 'spectator';
      client.data.counted = true;
      this.metrics.socketConnected();
    } catch (err) {
      const actionError =
        err instanceof GameActionError
          ? err
          : new GameActionError(GameActionErrorCode.AUTH_REQUIRED, {
              message: 'Authentication failed',
            });
      this.metrics.rejected(actionError.code);
      client.emit('game:error', {
        schemaVersion: 1,
        ...actionError.toPayload(),
      });
      client.disconnect(true);
    }
  }

  handleDisconnect(client: AuthedSocket): void {
    if (client.data?.counted) {
      this.metrics.socketDisconnected();
    }
  }

  /**
   * Join a game room. Idempotent: re-joining the same game re-emits the
   * current snapshot instead of erroring (ADR-002 §2). Requires an existing
   * seat for the verified principal unless `asSpectator` is set.
   */
  @UseGuards(WsJwtGuard)
  @SubscribeMessage('game:join')
  async handleJoin(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody() body: unknown,
  ): Promise<void> {
    const principal = client.data.principal!;
    const payload = asPayload(body);
    assertNoUnknownFields(payload, ['gameId', 'asSpectator']);

    await this.consumeOrThrow('join', client.id, principal.userId);
    const gameId = parseGameId(payload.gameId);
    const asSpectator = payload.asSpectator === true;

    if (this.bridge.getGameTermination(gameId)) {
      throw new GameActionError(GameActionErrorCode.GAME_ENDED, {
        message: 'This game has ended',
      });
    }
    const game = await this.loadGame(gameId);
    assertGamePlayable(game);

    const seat = await this.snapshotService.findSeat(gameId, principal.userId);
    let role: 'player' | 'spectator';
    let seatId: number | null = null;
    if (seat) {
      role = 'player';
      seatId = seat.id;
    } else if (asSpectator) {
      role = 'spectator';
    } else {
      throw new GameActionError(GameActionErrorCode.NOT_SEATED, {
        message: 'Take a seat first or join as spectator',
      });
    }

    if (client.data.gameId !== undefined && client.data.gameId !== gameId) {
      await client.leave(this.roomFor(client.data.gameId));
    }

    client.data.gameId = gameId;
    client.data.seatId = seatId;
    client.data.role = role;
    await client.join(this.roomFor(gameId));

    const snapshot = await this.snapshotService.build(gameId, {
      userId: principal.userId,
      role,
      seatId,
    });
    client.emit('game:snapshot', snapshot);
  }

  /**
   * Server-authoritative dice roll (ADR-002 §3). The server generates the
   * dice; any client-supplied outcome field is rejected before validation.
   * Replay of a stored idempotency key returns a snapshot to the actor and
   * does not re-apply or re-broadcast the roll.
   */
  @UseGuards(WsJwtGuard)
  @SubscribeMessage('game:roll')
  async handleRoll(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody() body: unknown,
  ): Promise<void> {
    const principal = client.data.principal!;
    const payload = asPayload(body);
    assertNoUnknownFields(payload, ['gameId', 'idempotencyKey']);

    await this.consumeOrThrow('roll', client.id, principal.userId);
    const gameId = parseGameId(payload.gameId);
    const idempotencyKey = parseIdempotencyKey(payload.idempotencyKey);

    const seat = await this.assertSeated(client, gameId);
    if (this.bridge.getGameTermination(gameId)) {
      throw new GameActionError(GameActionErrorCode.GAME_ENDED, {
        message: 'This game has ended',
      });
    }
    const game = await this.loadGame(gameId);
    assertGameRunning(game);

    if (game.next_player_id !== principal.userId) {
      throw new GameActionError(GameActionErrorCode.NOT_YOUR_TURN, {
        message: 'It is not your turn',
      });
    }

    const outcome = await this.idempotency.execute(
      {
        gameId: String(gameId),
        seatId: String(seat.id),
        action: 'roll',
        idempotencyKey,
        payload: null,
      },
      async () => {
        const fresh = await this.snapshotService.findSeat(
          gameId,
          principal.userId,
        );
        if (fresh?.rolled === 1) {
          throw new GameActionError(GameActionErrorCode.NOT_YOUR_TURN, {
            message: 'Seat already rolled this turn',
          });
        }
        const dice1 = randomInt(1, 7);
        const dice2 = randomInt(1, 7);
        await this.gamePlayersService.rollDice(gameId, seat.id, dice1, dice2);
        return { first: dice1, second: dice2, total: dice1 + dice2 };
      },
    );

    if (outcome.replayed) {
      await this.emitSnapshot(client, gameId, seat.id, true, {
        action: 'roll',
        dice: outcome.result,
      });
      return;
    }

    const state = await this.snapshotService.buildPublicState(gameId);
    this.server.to(this.roomFor(gameId)).emit('game:state', {
      action: 'roll',
      dice: outcome.result,
      ...state,
    });
    await this.emitSnapshot(client, gameId, seat.id, false, {
      action: 'roll',
      dice: outcome.result,
    });
  }

  /**
   * End the acting seat's turn (ADR-002 minimal event set `turn`). The turn
   * only advances for the seat the server marked as `next_player_id`.
   */
  @UseGuards(WsJwtGuard)
  @SubscribeMessage('game:end-turn')
  async handleEndTurn(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody() body: unknown,
  ): Promise<void> {
    const principal = client.data.principal!;
    const payload = asPayload(body);
    assertNoUnknownFields(payload, ['gameId', 'idempotencyKey']);

    await this.consumeOrThrow('end-turn', client.id, principal.userId);
    const gameId = parseGameId(payload.gameId);
    const idempotencyKey = parseIdempotencyKey(payload.idempotencyKey);

    const seat = await this.assertSeated(client, gameId);
    if (this.bridge.getGameTermination(gameId)) {
      throw new GameActionError(GameActionErrorCode.GAME_ENDED, {
        message: 'This game has ended',
      });
    }
    const game = await this.loadGame(gameId);
    assertGameRunning(game);

    if (game.next_player_id !== principal.userId) {
      throw new GameActionError(GameActionErrorCode.NOT_YOUR_TURN, {
        message: 'It is not your turn',
      });
    }

    const outcome = await this.idempotency.execute(
      {
        gameId: String(gameId),
        seatId: String(seat.id),
        action: 'end-turn',
        idempotencyKey,
        payload: null,
      },
      async () => {
        await this.gamePlayersService.advanceTurn(gameId, principal.userId);
        return { advanced: true };
      },
    );

    if (outcome.replayed) {
      await this.emitSnapshot(client, gameId, seat.id, true, {
        action: 'end-turn',
      });
      return;
    }

    const state = await this.snapshotService.buildPublicState(gameId);
    this.server.to(this.roomFor(gameId)).emit('game:state', {
      action: 'end-turn',
      ...state,
    });
    await this.emitSnapshot(client, gameId, seat.id, false, {
      action: 'end-turn',
    });
  }

  /**
   * Leave the current room without closing the socket. `game:unsubscribed`
   * with `terminal: false` acknowledges; terminal bans/force-ends set
   * `terminal: true`.
   */
  @UseGuards(WsJwtGuard)
  @SubscribeMessage('game:leave')
  async handleLeave(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody() body: unknown,
  ): Promise<void> {
    const gameId = client.data.gameId;
    if (body !== null && body !== undefined) {
      const payload = asPayload(body);
      assertNoUnknownFields(payload, ['gameId']);
      if (payload.gameId !== undefined) {
        const requested = parseGameId(payload.gameId);
        if (gameId !== undefined && requested !== gameId) {
          throw new GameActionError(GameActionErrorCode.NOT_SEATED, {
            message: 'Socket is not joined to that game',
          });
        }
      }
    }

    if (gameId !== undefined) {
      await client.leave(this.roomFor(gameId));
    }
    client.data.gameId = undefined;
    client.data.seatId = null;
    client.data.role = 'spectator';

    client.emit('game:unsubscribed', {
      schemaVersion: 1,
      reason: 'leave',
      terminal: false,
      gameId: gameId ?? null,
    });
  }

  /**
   * In-game chat. Deny-by-default: rejected with CHAT_DISABLED unless
   * GAMES_CHAT_ENABLED is on (ADR-002 §7 — moderation pipeline pending).
   */
  @UseGuards(WsJwtGuard)
  @SubscribeMessage('chat:send')
  async handleChat(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody() body: unknown,
  ): Promise<void> {
    const principal = client.data.principal!;
    const payload = asPayload(body);
    assertNoUnknownFields(payload, ['gameId', 'text']);

    const gameId = client.data.gameId;
    if (gameId === undefined) {
      throw new GameActionError(GameActionErrorCode.NOT_SEATED, {
        message: 'Join a game before chatting',
      });
    }
    if (
      payload.gameId !== undefined &&
      parseGameId(payload.gameId) !== gameId
    ) {
      throw new GameActionError(GameActionErrorCode.NOT_SEATED, {
        message: 'Socket is not joined to that game',
      });
    }

    if (!this.configService.get<boolean>('game.chatEnabled')) {
      throw new GameActionError(GameActionErrorCode.CHAT_DISABLED, {
        message: 'In-game chat is disabled',
      });
    }

    await this.consumeOrThrow('chat', client.id, principal.userId);

    const text = typeof payload.text === 'string' ? payload.text.trim() : '';
    if (text.length === 0 || text.length > 280) {
      throw new GameActionError(GameActionErrorCode.INVALID_PAYLOAD, {
        message: 'Chat text must be 1-280 characters',
      });
    }

    this.server.to(this.roomFor(gameId)).emit('chat:message', {
      schemaVersion: 1,
      gameId,
      userId: principal.userId,
      seatId: client.data.seatId ?? null,
      text,
      at: new Date().toISOString(),
    });
  }

  // ── Ban / force-end teardown (ADR-002 §6, via GamesRealtimeBridge) ────────

  async unsubscribeUser(
    userId: number,
    reason: TerminationReason,
  ): Promise<void> {
    for (const socket of await this.collectSockets()) {
      if (socket.data?.principal?.userId !== userId) continue;
      await this.terminate(socket, reason, socket.data.gameId);
    }
  }

  async endGame(gameId: number, reason: TerminationReason): Promise<void> {
    const room = this.roomFor(gameId);
    for (const socket of await this.collectSockets()) {
      if (!socket.rooms?.has(room)) continue;
      await this.terminate(socket, reason, gameId);
    }
  }

  /**
   * Terminal notice → room detach → disconnect, in that order so no room
   * event can be delivered after `game:unsubscribed`. Idempotent: sockets
   * without the target room/user are skipped, and `disconnect(true)` on an
   * already-closed socket is a no-op.
   */
  private async terminate(
    socket: DetachableSocket,
    reason: TerminationReason,
    gameId: number | undefined,
  ): Promise<void> {
    socket.emit('game:unsubscribed', {
      schemaVersion: 1,
      reason: REASON_TEXT[reason] ?? reason,
      code: reason,
      terminal: true,
      gameId: gameId ?? null,
    });
    if (gameId !== undefined) {
      await socket.leave(this.roomFor(gameId));
    }
    socket.disconnect(true);
    this.metrics.teardown(REASON_TEXT[reason] ?? reason);
  }

  /**
   * fetchSockets spans every instance through the Redis adapter; if the
   * adapter is unavailable we still detach local sockets (documented
   * degradation: other instances fail closed on the durable DB checks).
   */
  private async collectSockets(): Promise<DetachableSocket[]> {
    if (!this.server) return [];
    try {
      return (await this.server.fetchSockets()) as unknown as DetachableSocket[];
    } catch (err) {
      this.logger.warn(
        `fetchSockets failed (${(err as Error).message}); detaching local sockets only`,
      );
      const sockets = this.server.sockets as unknown as
        | Map<string, unknown>
        | Record<string, unknown>;
      const local =
        sockets instanceof Map
          ? [...sockets.values()]
          : Object.values(sockets ?? {});
      return local as unknown as DetachableSocket[];
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private async consumeOrThrow(
    action: 'join' | 'roll' | 'end-turn' | 'chat',
    socketId: string,
    userId: number,
  ): Promise<void> {
    const allowed = await this.rateLimiter.consume(action, socketId, userId);
    if (!allowed) {
      this.metrics.rateLimited(action);
      throw new GameActionError(GameActionErrorCode.RATE_LIMITED, {
        message: 'Too many requests; slow down and retry shortly',
      });
    }
  }

  private async assertSeated(
    client: AuthedSocket,
    gameId: number,
  ): Promise<GamePlayer> {
    const principal = client.data.principal!;
    if (client.data.gameId !== gameId) {
      throw new GameActionError(GameActionErrorCode.NOT_SEATED, {
        message: 'Join this game first',
      });
    }
    if (client.data.role !== 'player') {
      throw new GameActionError(GameActionErrorCode.FORBIDDEN_ROLE, {
        message: 'Spectators cannot perform this action',
      });
    }
    const seat = await this.snapshotService.findSeat(gameId, principal.userId);
    if (!seat) {
      throw new GameActionError(GameActionErrorCode.NOT_SEATED, {
        message: 'You do not hold a seat in this game',
      });
    }
    return seat;
  }

  private async loadGame(gameId: number): Promise<Game> {
    try {
      return await this.gamesService.findById(gameId);
    } catch {
      throw new GameActionError(GameActionErrorCode.GAME_NOT_FOUND, {
        message: 'Game not found',
      });
    }
  }

  private async emitSnapshot(
    client: AuthedSocket,
    gameId: number,
    seatId: number,
    replayed: boolean,
    extra?: Record<string, unknown>,
  ): Promise<void> {
    const snapshot = await this.snapshotService.build(gameId, {
      userId: client.data.principal!.userId,
      role: 'player',
      seatId,
    });
    client.emit('game:snapshot', {
      ...snapshot,
      replayed,
      ...(extra ?? {}),
    });
  }

  private roomFor(gameId: number): string {
    return `game_${gameId}`;
  }
}
