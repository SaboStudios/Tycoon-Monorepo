import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Logger, UseGuards } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { WsJwtGuard } from '../auth/ws-jwt.guard';
import { GamesService } from './games.service';
import { GameActionError, GameActionErrorCode } from './game-action.error';

interface AuthedSocket extends Socket {
  data: {
    userId?: string;
    role?: 'player' | 'spectator';
    gameId?: string;
  };
}

@WebSocketGateway({
  namespace: '/games',
  cors: { origin: true, credentials: true },
})
export class GamesGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(GamesGateway.name);

  constructor(private readonly gamesService: GamesService) {}

  async handleConnection(client: AuthedSocket): Promise<void> {
    try {
      const user = await this.gamesService.authenticateSocket(client);
      client.data.userId = user.id;
      client.data.role = user.role === 'admin' ? 'player' : 'player';
    } catch (err) {
      this.logger.warn(`WS handshake rejected: ${(err as Error).message}`);
      client.emit('error', { code: GameActionErrorCode.UNAUTHORIZED });
      client.disconnect(true);
    }
  }

  handleDisconnect(client: AuthedSocket): void {
    const { gameId, userId } = client.data;
    if (gameId && userId) {
      this.gamesService.detachSocket(gameId, userId, client.id);
    }
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('game:join')
  async handleJoin(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody() payload: { gameId: string; asSpectator?: boolean },
  ): Promise<void> {
    try {
      const { gameId, asSpectator } = payload ?? ({} as any);
      if (!gameId) {
        throw new GameActionError(GameActionErrorCode.INVALID_PAYLOAD);
      }
      const role = asSpectator ? 'spectator' : 'player';
      await this.gamesService.authorizeJoin(client.data.userId!, gameId, role);
      client.data.gameId = gameId;
      client.data.role = role;
      await client.join(this.roomFor(gameId));
      const snapshot = await this.gamesService.getSnapshot(gameId, role);
      client.emit('game:snapshot', snapshot);
    } catch (err) {
      this.emitError(client, err);
    }
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('game:roll')
  async handleRoll(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody() payload: { gameId: string; idempotencyKey: string },
  ): Promise<void> {
    try {
      if (client.data.role !== 'player') {
        throw new GameActionError(GameActionErrorCode.FORBIDDEN_SPECTATOR);
      }
      const { gameId, idempotencyKey } = payload ?? ({} as any);
      if (!gameId || !idempotencyKey) {
        throw new GameActionError(GameActionErrorCode.INVALID_PAYLOAD);
      }
      const result = await this.gamesService.roll(
        client.data.userId!,
        gameId,
        idempotencyKey,
      );
      this.server.to(this.roomFor(gameId)).emit('game:state', result);
    } catch (err) {
      this.emitError(client, err);
    }
  }

  /**
   * Gracefully unsubscribe a user from all game rooms when they are banned
   * or an admin force-ends their session. Detaches the socket from the room,
   * notifies the client, and disconnects without leaking game state.
   */
  async forceUnsubscribe(userId: string, reason: 'banned' | 'force-ended'): Promise<void> {
    const sockets = await this.server.fetchSockets();
    for (const socket of sockets as unknown as AuthedSocket[]) {
      if (socket.data?.userId !== userId) continue;
      const gameId = socket.data.gameId;
      if (gameId) {
        await socket.leave(this.roomFor(gameId));
        this.gamesService.detachSocket(gameId, userId, socket.id);
      }
      socket.emit('game:unsubscribed', { reason });
      socket.disconnect(true);
    }
  }

  private roomFor(gameId: string): string {
    return `game:${gameId}`;
  }

  private emitError(client: AuthedSocket, err: unknown): void {
    const code =
      err instanceof GameActionError
        ? err.code
        : GameActionErrorCode.INTERNAL_ERROR;
    client.emit('game:error', { code });
  }
}
