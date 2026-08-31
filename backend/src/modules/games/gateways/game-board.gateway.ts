import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  MessageBody,
} from '@nestjs/websockets';
import { Logger, OnModuleInit } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Server, Socket } from 'socket.io';
import { getWsCorsConfig } from '../../../config/ws.config';
import type { JwtPayload } from '../../auth/interfaces/jwt-payload.interface';

export enum GameBoardEvent {
  JOIN = 'join',
  ROLL = 'roll',
  TURN = 'turn',
  DISCONNECT = 'disconnect',
  TURN_READY = 'turn-ready',
}

@WebSocketGateway({
  namespace: 'games',
  cors: getWsCorsConfig(),
})
export class GameBoardGateway
  implements
    OnGatewayInit,
    OnGatewayConnection,
    OnGatewayDisconnect,
    OnModuleInit
{
  @WebSocketServer() server: Server;
  private readonly logger = new Logger(GameBoardGateway.name);

  constructor(private readonly jwtService: JwtService) {}

  onModuleInit() {
    this.logger.log('GameBoardGateway module initialized');
  }

  afterInit(server: Server) {
    this.logger.log('Game Board WebSocket Gateway initialized');
  }

  async handleConnection(client: Socket) {
    const token = this.extractToken(client);
    if (!token) {
      this.logger.warn(
        `Rejected unauthenticated socket ${client.id}: no token`,
      );
      client.disconnect(true);
      return;
    }

    try {
      const payload = await this.jwtService.verifyAsync<JwtPayload>(token);
      const userId = payload.sub;
      client.data.userId = userId;
      this.logger.log(`Client connected: ${client.id}, User: ${userId}`);
    } catch {
      this.logger.warn(
        `Rejected unauthenticated socket ${client.id}: invalid token`,
      );
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket) {
    const userId = client.data.userId;
    if (client.data.gameId) {
      this.server
        .to(`game_${client.data.gameId}`)
        .emit(GameBoardEvent.DISCONNECT, {
          userId,
          gameId: client.data.gameId,
          timestamp: new Date().toISOString(),
        });
    }
    this.logger.log(`Client disconnected: ${client.id}, User: ${userId}`);
  }

  @SubscribeMessage(GameBoardEvent.JOIN)
  handleJoin(
    client: Socket,
    @MessageBody() data: { gameId: number },
  ): void {
    const userId = client.data.userId;
    const gameId = data.gameId;

    client.data.gameId = gameId;
    client.join(`game_${gameId}`);

    this.logger.log(
      `User ${userId} joined game ${gameId} via socket ${client.id}`,
    );

    this.server.to(`game_${gameId}`).emit(GameBoardEvent.JOIN, {
      userId,
      gameId,
      timestamp: new Date().toISOString(),
    });
  }

  @SubscribeMessage(GameBoardEvent.ROLL)
  handleRoll(
    client: Socket,
    @MessageBody() data: { gameId: number; diceValue: number },
  ): void {
    const userId = client.data.userId;
    const gameId = data.gameId;
    const diceValue = data.diceValue;

    if (!client.data.gameId) {
      this.logger.warn(
        `User ${userId} attempted roll without joining game first`,
      );
      return;
    }

    this.logger.log(
      `User ${userId} rolled ${diceValue} in game ${gameId}`,
    );

    this.server.to(`game_${gameId}`).emit(GameBoardEvent.ROLL, {
      userId,
      gameId,
      diceValue,
      timestamp: new Date().toISOString(),
    });
  }

  @SubscribeMessage(GameBoardEvent.TURN)
  handleTurn(
    client: Socket,
    @MessageBody() data: { gameId: number; nextPlayerId: number },
  ): void {
    const gameId = data.gameId;
    const nextPlayerId = data.nextPlayerId;

    this.logger.log(
      `Turn changed in game ${gameId}: next player ${nextPlayerId}`,
    );

    this.server.to(`game_${gameId}`).emit(GameBoardEvent.TURN, {
      gameId,
      nextPlayerId,
      timestamp: new Date().toISOString(),
    });
  }

  @SubscribeMessage(GameBoardEvent.TURN_READY)
  handleTurnReady(
    client: Socket,
    @MessageBody() data: { gameId: number },
  ): void {
    const userId = client.data.userId;
    const gameId = data.gameId;

    this.logger.log(`User ${userId} signaled ready in game ${gameId}`);

    this.server.to(`game_${gameId}`).emit(GameBoardEvent.TURN_READY, {
      userId,
      gameId,
      timestamp: new Date().toISOString(),
    });
  }

  private extractToken(client: Socket): string | undefined {
    const authToken = client.handshake.auth?.token as string | undefined;
    if (authToken) return authToken;

    const authHeader = client.handshake.headers?.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      return authHeader.slice('Bearer '.length);
    }

    return undefined;
  }
}
