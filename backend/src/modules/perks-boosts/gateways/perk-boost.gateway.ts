import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Logger, OnModuleInit } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Server, Socket } from 'socket.io';
import { getWsCorsConfig } from '../../../config/ws.config';
import {
  PerksBoostsEvents,
  PerkBoostEvent,
} from '../services/perks-boosts-events.service';
import type { JwtPayload } from '../../auth/interfaces/jwt-payload.interface';

@WebSocketGateway({
  namespace: 'boosts',
  cors: getWsCorsConfig(),
})
export class PerkBoostGateway
  implements
    OnGatewayInit,
    OnGatewayConnection,
    OnGatewayDisconnect,
    OnModuleInit
{
  @WebSocketServer() server: Server;
  private readonly logger = new Logger(PerkBoostGateway.name);

  constructor(
    private readonly events: PerksBoostsEvents,
    private readonly jwtService: JwtService,
  ) {}

  onModuleInit() {
    // Subscribe to internal events and push to clients via WebSockets
    this.events.events$.subscribe(({ type, data }) => {
      if (
        type === PerkBoostEvent.BOOST_ACTIVATED ||
        type === PerkBoostEvent.BOOST_EXPIRED
      ) {
        this.notifyPlayer(data.playerId, type, data);
      }
    });
  }

  afterInit(server: Server) {
    this.logger.log('Perk Boost WebSocket Gateway initialized');
  }

  async handleConnection(client: Socket) {
    const token = this.extractToken(client);
    if (!token) {
      this.logger.warn(`Rejected unauthenticated socket ${client.id}: no token`);
      client.disconnect(true);
      return;
    }

    try {
      const payload = await this.jwtService.verifyAsync<JwtPayload>(token);
      const userId = payload.sub;
      client.data.userId = userId;
      client.join(`user_${userId}`);
      this.logger.log(`Client connected: ${client.id}, User: ${userId}`);
    } catch {
      this.logger.warn(
        `Rejected unauthenticated socket ${client.id}: invalid token`,
      );
      client.disconnect(true);
    }
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

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  private notifyPlayer(userId: number, event: PerkBoostEvent, payload: any) {
    this.logger.log(
      `Sending realtime notification to user_${userId}: ${event}`,
    );
    this.server.to(`user_${userId}`).emit(event, payload);
  }
}
